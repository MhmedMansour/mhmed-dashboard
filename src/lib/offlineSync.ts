"use client";

import {
  QueuedOp,
  bumpOpAttempt,
  countOps,
  deleteOp,
  listOps,
  notifyOutboxChanged,
} from "./offlineDb";

// Module-level lock shared by the dashboard and the offline manager: a race
// between the "online" event, SW sync and a manual click must not replay the
// same queued mutations twice.
let syncInFlight = false;

export interface SyncResult {
  synced: number;
  failed: number;
  remaining: number;
  stopped: boolean;
  messages: string[];
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message : String(err || "");
  return (
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("Load failed") ||
    msg.includes("network")
  );
}

async function replayOp(op: QueuedOp): Promise<Response> {
  if (op.files && op.files.length > 0) {
    const form = new FormData();
    if (op.formFields) {
      for (const [k, v] of Object.entries(op.formFields)) form.append(k, v);
    }
    for (const f of op.files) {
      const file = new File([f.blob], f.name, { type: f.type || "application/octet-stream" });
      form.append(f.field || "files", file);
    }
    return fetch(op.url, { method: op.method, body: form, credentials: "include" });
  }
  if (op.json !== undefined && op.json !== null) {
    return fetch(op.url, {
      method: op.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(op.json),
      credentials: "include",
    });
  }
  return fetch(op.url, { method: op.method, credentials: "include" });
}

/**
 * Replays queued mutations in FIFO order.
 * Stops at the first network failure to preserve order; 4xx errors are
 * dropped as failed so one bad op can't block the whole queue forever.
 */
export async function syncOutbox(
  onProgress?: (done: number, total: number, label: string) => void
): Promise<SyncResult> {
  if (syncInFlight) {
    return {
      synced: 0,
      failed: 0,
      remaining: await countOps(),
      stopped: true,
      messages: ["المزامنة شغالة بالفعل"],
    };
  }
  syncInFlight = true;
  try {
    return await replayOutbox(onProgress);
  } finally {
    syncInFlight = false;
  }
}

async function replayOutbox(
  onProgress?: (done: number, total: number, label: string) => void
): Promise<SyncResult> {
  const ops = await listOps();
  const result: SyncResult = {
    synced: 0,
    failed: 0,
    remaining: ops.length,
    stopped: false,
    messages: [],
  };
  if (ops.length === 0) return result;

  let done = 0;
  for (const op of ops) {
    if (!op.id) continue;
    onProgress?.(done, ops.length, op.label);
    try {
      const res = await replayOp(op);
      if (res.ok) {
        await deleteOp(op.id);
        result.synced += 1;
      } else if (res.status >= 500) {
        await bumpOpAttempt(op.id, `خطأ سيرفر ${res.status}`);
        result.stopped = true;
        result.messages.push(`توقف عند «${op.label}» — خطأ سيرفر ${res.status}`);
        break;
      } else {
        let detail = "";
        try {
          const data = await res.json();
          if (data?.error) detail = `: ${data.error}`;
        } catch {
          // ignore
        }
        await deleteOp(op.id);
        result.failed += 1;
        result.messages.push(`فشل «${op.label}» (${res.status}${detail}) — تم إسقاطه من الطابور`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "تعذر الاتصال";
      await bumpOpAttempt(op.id, msg);
      if (isNetworkFailure(err) || !navigator.onLine) {
        result.stopped = true;
        result.messages.push("مازلت أوفلاين — سيُستأنف الإرسال تلقائياً عند عودة النت");
        break;
      }
      await deleteOp(op.id);
      result.failed += 1;
      result.messages.push(`فشل «${op.label}» — ${msg}`);
    }
    done += 1;
    onProgress?.(done, ops.length, op.label);
  }

  const left = await listOps();
  result.remaining = left.length;
  notifyOutboxChanged();
  return result;
}

export async function requestBackgroundSync(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const syncManager = (reg as unknown as { sync?: { register: (tag: string) => Promise<void> } }).sync;
    if (syncManager) await syncManager.register("mihwar-sync");
  } catch {
    // Background Sync not supported — manual + online-event sync still works.
  }
}

/** Warm the service-worker file cache so previews/downloads open offline. */
export async function prepareFilesOffline(
  urls: string[],
  onProgress?: (done: number, total: number) => void
): Promise<{ cached: number; total: number }> {
  const unique = [...new Set(urls.filter(Boolean))];
  let cached = 0;
  for (let i = 0; i < unique.length; i++) {
    try {
      const res = await fetch(unique[i], { credentials: "include" });
      if (res.ok) cached += 1;
    } catch {
      // skip failures — partial offline is better than nothing
    }
    onProgress?.(i + 1, unique.length);
  }
  try {
    localStorage.setItem("mihwar_offline_files_at", String(Date.now()));
  } catch {
    // ignore
  }
  return { cached, total: unique.length };
}

export async function getOfflineCacheStats(): Promise<{
  filesCached: number;
  quotaBytes: number | null;
  usageBytes: number | null;
}> {
  let filesCached = 0;
  try {
    if ("caches" in window) {
      const cache = await caches.open("mihwar-files-v5");
      const keys = await cache.keys();
      filesCached = keys.length;
    }
  } catch {
    // ignore
  }
  let quotaBytes: number | null = null;
  let usageBytes: number | null = null;
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      quotaBytes = typeof est.quota === "number" ? est.quota : null;
      usageBytes = typeof est.usage === "number" ? est.usage : null;
    }
  } catch {
    // ignore
  }
  return { filesCached, quotaBytes, usageBytes };
}

export function getOfflineFilesAt(): number | null {
  try {
    const raw = localStorage.getItem("mihwar_offline_files_at");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function formatAgoAr(timestamp: number | null): string {
  if (!timestamp) return "لم تتم المزامنة بعد";
  const diff = Date.now() - timestamp;
  if (diff < 0) return "الآن";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "منذ لحظات";
  if (minutes === 1) return "منذ دقيقة";
  if (minutes === 2) return "منذ دقيقتين";
  if (minutes < 11) return `منذ ${minutes} دقائق`;
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "منذ ساعة";
  if (hours === 2) return "منذ ساعتين";
  if (hours < 11) return `منذ ${hours} ساعات`;
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "منذ يوم";
  if (days === 2) return "منذ يومين";
  return `منذ ${days} أيام`;
}
