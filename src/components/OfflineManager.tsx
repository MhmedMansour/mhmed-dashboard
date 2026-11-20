"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  CloudOff,
  CloudDownload,
  RefreshCw,
  CheckCircle2,
  Clock3,
  HardDrive,
  Trash2,
  ChevronDown,
  Wifi,
  WifiOff,
  Loader2,
  Database,
} from "lucide-react";
import {
  QueuedOp,
  clearOps,
  countOps,
  deleteOp,
  getLastSyncedAt,
  listOps,
} from "@/lib/offlineDb";
import {
  formatAgoAr,
  getOfflineCacheStats,
  getOfflineFilesAt,
  prepareFilesOffline,
  syncOutbox,
} from "@/lib/offlineSync";
import { formatBytes } from "@/lib/engineering";

function formatClock(ts: number | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("ar-EG", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function OfflineManager({
  isOnline,
  filesToCache,
  onSynced,
  onNotify,
  compact = false,
}: {
  isOnline: boolean;
  /** preview URLs that should be available offline */
  filesToCache: string[];
  onSynced: () => Promise<void>;
  onNotify?: (msg: string) => void;
  compact?: boolean;
}) {
  const [pending, setPending] = useState<QueuedOp[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepareProgress, setPrepareProgress] = useState<{ done: number; total: number } | null>(null);
  const [filesCached, setFilesCached] = useState(0);
  const [usage, setUsage] = useState<{ usageBytes: number | null; quotaBytes: number | null }>({
    usageBytes: null,
    quotaBytes: null,
  });
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [offlineFilesAt, setOfflineFilesAt] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [ops, stats] = await Promise.all([listOps(), getOfflineCacheStats()]);
    setPending(ops);
    setFilesCached(stats.filesCached);
    setUsage({ usageBytes: stats.usageBytes, quotaBytes: stats.quotaBytes });
    setLastSynced(getLastSyncedAt());
    setOfflineFilesAt(getOfflineFilesAt());
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("mihwar-outbox-change", onChange);
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    const timer = setInterval(refresh, 15000);
    return () => {
      window.removeEventListener("mihwar-outbox-change", onChange);
      window.removeEventListener("online", onChange);
      window.removeEventListener("offline", onChange);
      clearInterval(timer);
    };
  }, [refresh]);

  const handleSync = async () => {
    if (!isOnline) {
      onNotify?.("مازلت أوفلاين — المزامنة هتشتغل تلقائياً أول ما النت يرجع");
      return;
    }
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await syncOutbox();
      if (result.synced > 0) {
        await onSynced();
        await refresh();
      } else {
        await refresh();
      }
      if (result.synced > 0 && result.remaining === 0) {
        const msg = `تمت مزامنة ${result.synced} ${result.synced === 1 ? "تعديل" : "تعديلات"} بنجاح ✓`;
        setSyncMsg(msg);
        onNotify?.(msg);
      } else if (result.synced > 0) {
        const msg = `اترفع ${result.synced} وباقي ${result.remaining} في الطابور`;
        setSyncMsg(msg);
        onNotify?.(msg);
      } else if (result.messages[0]) {
        setSyncMsg(result.messages[0]);
      } else if (result.remaining === 0) {
        setSyncMsg("مفيش حاجة مستنية — كل حاجة متزامنة ✓");
      }
    } finally {
      setSyncing(false);
    }
  };

  const handlePrepare = async () => {
    if (!isOnline) {
      onNotify?.("لازم نت أول مرة عشان نحفظ الملفات على جهازك، وبعدها هتفتح أوفلاين");
      return;
    }
    setPreparing(true);
    try {
      // Include official Haram card scans too (they live in their own table).
      let haramUrls: string[] = [];
      try {
        const r = await fetch("/api/haram-documents", { credentials: "include" });
        if (r.ok) {
          const data = await r.json();
          haramUrls = (Array.isArray(data.documents) ? data.documents : [])
            .filter((d: { storagePath?: string | null }) => Boolean(d.storagePath))
            .map((d: { id: number }) => `/api/haram-documents/${d.id}/preview`);
        }
      } catch {
        // Offline manager still prepares the rest of the files.
      }
      const allUrls = [...new Set([...filesToCache, ...haramUrls])].filter(Boolean);
      if (allUrls.length === 0) {
        onNotify?.("مفيش ملفات قابلة للمعاينة حالياً للحفظ أوفلاين");
        return;
      }
      setPrepareProgress({ done: 0, total: allUrls.length });
      const res = await prepareFilesOffline(allUrls, (done, total) =>
        setPrepareProgress({ done, total })
      );
      await refresh();
      const msg =
        res.cached === res.total
          ? `تم تجهيز ${res.cached} ملف للعمل أوفلاين ✓`
          : `اتحفظ ${res.cached} من ${res.total} ملف أوفلاين (الباقي كبير أو اتعذر)`;
      setSyncMsg(msg);
      onNotify?.(msg);
    } finally {
      setPreparing(false);
      setTimeout(() => setPrepareProgress(null), 2500);
    }
  };

  const handleDiscard = async (id?: number) => {
    if (id == null) return;
    await deleteOp(id);
    await refresh();
  };

  const handleDiscardAll = async () => {
    if (!window.confirm("متأكد؟ هيمسح كل التعديلات المستنية من غير ما تترفع.")) return;
    await clearOps();
    await refresh();
    onNotify?.("تم مسح طابور الانتظار");
  };

  const pendingCount = pending.length;

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleSync}
        title={isOnline ? "الحالة: أونلاين — اضغط للمزامنة" : "الحالة: أوفلاين"}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold border transition ${
          !isOnline
            ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
            : pendingCount > 0
            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
            : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
        }`}
      >
        {syncing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isOnline ? (
          <Wifi className="w-3.5 h-3.5" />
        ) : (
          <WifiOff className="w-3.5 h-3.5" />
        )}
        {!isOnline ? "أوفلاين" : pendingCount > 0 ? `${pendingCount} مستني` : "متزامن ✓"}
      </button>
    );
  }

  return (
    <section
      className={`rounded-2xl border px-4 py-3.5 shadow-xs ${
        !isOnline
          ? "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40"
          : pendingCount > 0
          ? "border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/25"
          : "border-emerald-200/70 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20"
      }`}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-white shrink-0 ${
              !isOnline ? "bg-amber-500" : pendingCount > 0 ? "bg-blue-600" : "bg-emerald-600"
            }`}
          >
            {!isOnline ? <CloudOff className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </span>
          <div>
            <div className="text-xs font-extrabold text-slate-900 dark:text-white">
              {!isOnline ? (
                <>وضع أوفلاين — شغّال من النسخة المحفوظة على جهازك</>
              ) : pendingCount > 0 ? (
                <>أونلاين — عندك {pendingCount} {pendingCount === 1 ? "تعديل مستني" : "تعديلات مستنية"} الرفع</>
              ) : (
                <>أونلاين ومتزامن ✓</>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Clock3 className="w-3 h-3" />
                آخر مزامنة: {formatAgoAr(lastSynced)} ({formatClock(lastSynced)})
              </span>
              <span className="inline-flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                ملفات محفوظة أوفلاين: <strong className="font-mono">{filesCached}</strong>
                {offlineFilesAt ? ` (${formatAgoAr(offlineFilesAt)})` : ""}
              </span>
              {usage.usageBytes != null && (
                <span className="inline-flex items-center gap-1 font-mono">
                  <Database className="w-3 h-3" />
                  {formatBytes(usage.usageBytes)}
                  {usage.quotaBytes ? ` / ${formatBytes(usage.quotaBytes)}` : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200"
            >
              عرض الطابور ({pendingCount})
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          )}
          <button
            type="button"
            onClick={handlePrepare}
            disabled={preparing || !isOnline}
            title="يحفظ نسخ من ملفاتك (صور/PDF) على الجهاز عشان تفتح من غير نت"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-white px-3 py-2 text-[11px] font-bold text-white dark:text-slate-900 disabled:opacity-50"
          >
            {preparing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudDownload className="w-3.5 h-3.5" />}
            {preparing && prepareProgress
              ? `جاري التجهيز ${prepareProgress.done}/${prepareProgress.total}`
              : "جهّز ملفاتي أوفلاين"}
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing || (!isOnline && pendingCount === 0)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {syncing ? "جاري المزامنة…" : pendingCount > 0 ? `مزامنة (${pendingCount})` : "تحديث البيانات"}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="mt-2.5 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200">
          {syncMsg}
        </div>
      )}

      {expanded && pendingCount > 0 && (
        <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
              التعديلات المستنية الرفع (بالترتيب)
            </span>
            <button
              type="button"
              onClick={handleDiscardAll}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline"
            >
              <Trash2 className="w-3 h-3" />
              مسح الكل
            </button>
          </div>
          <ul className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {pending.map((op) => (
              <li key={op.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[11px]">
                <span className="min-w-0">
                  <span className="block font-bold text-slate-800 dark:text-slate-200 truncate">{op.label}</span>
                  <span className="block font-mono text-[10px] text-slate-400">
                    {new Date(op.createdAt).toLocaleString("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {op.attempts > 0 ? ` • محاولات: ${op.attempts}` : ""}
                    {op.lastError ? ` • ${op.lastError}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleDiscard(op.id)}
                  title="إسقاط هذا التعديل من الطابور"
                  className="shrink-0 rounded p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function OfflineCompactBadge(props: {
  isOnline: boolean;
  onClick?: () => void;
}) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const refresh = async () => setCount(await countOps());
    refresh();
    window.addEventListener("mihwar-outbox-change", refresh);
    return () => window.removeEventListener("mihwar-outbox-change", refresh);
  }, []);
  return (
    <button
      type="button"
      onClick={props.onClick}
      title={props.isOnline ? (count > 0 ? `${count} تعديلات مستنية المزامنة` : "متصل ومتزامن") : "وضع أوفلاين — اضغط لعرض حالة المزامنة"}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold border transition ${
        !props.isOnline
          ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
          : count > 0
          ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
          : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
      }`}
    >
      {props.isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
      {!props.isOnline ? "أوفلاين" : count > 0 ? `${count} ⏳` : "✓"}
    </button>
  );
}
