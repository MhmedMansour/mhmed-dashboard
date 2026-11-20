"use client";

// Local offline storage (IndexedDB): dashboard snapshots + mutation outbox.
// No external dependency — tiny promise wrapper around IndexedDB.

const DB_NAME = "mihwar-offline";
const DB_VERSION = 1;

export interface QueuedFile {
  field: string;
  name: string;
  type: string;
  blob: Blob;
}

export interface QueuedOp {
  id?: number;
  /** machine kind, e.g. "project-create", "file-upload", "file-delete" */
  kind: string;
  /** Arabic human-readable label shown in the pending list */
  label: string;
  method: "POST" | "PATCH" | "DELETE";
  url: string;
  json?: Record<string, unknown> | unknown[] | null;
  formFields?: Record<string, string>;
  files?: QueuedFile[];
  createdAt: number;
  attempts: number;
  lastError?: string;
}

export interface DashboardSnapshot {
  key: string;
  payload: unknown;
  timestamp: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB غير متاح في هذا المتصفح"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("snapshots")) {
        db.createObjectStore("snapshots", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("outbox")) {
        const store = db.createObjectStore("outbox", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("تعذر فتح قاعدة البيانات المحلية"));
    req.onblocked = () => reject(new Error("قاعدة البيانات المحلية مشغولة"));
  });
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const objectStore = transaction.objectStore(store);
        let result: T | undefined;
        try {
          const req = run(objectStore);
          req.onsuccess = () => {
            result = req.result as T;
          };
          req.onerror = () => reject(req.error || new Error("فشلت العملية المحلية"));
        } catch (err) {
          reject(err as Error);
          return;
        }
        transaction.oncomplete = () => {
          db.close();
          resolve(result as T);
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error || new Error("فشلت العملية المحلية"));
        };
        transaction.onabort = () => {
          db.close();
          reject(transaction.error || new Error("أُلغيت العملية المحلية"));
        };
      })
  );
}

export function notifyOutboxChanged() {
  try {
    window.dispatchEvent(new CustomEvent("mihwar-outbox-change"));
  } catch {
    // ignore (SSR)
  }
}

// ---------- Snapshots (last synced dashboard payloads) ----------

export async function saveSnapshot(key: string, payload: unknown): Promise<void> {
  try {
    await tx("snapshots", "readwrite", (s) =>
      s.put({ key, payload, timestamp: Date.now() } as DashboardSnapshot)
    );
    try {
      localStorage.setItem("mihwar_last_synced_at", String(Date.now()));
    } catch {
      // ignore
    }
  } catch {
    // Offline storage is best-effort; the app still works without it.
  }
}

export async function loadSnapshot(key: string): Promise<DashboardSnapshot | null> {
  try {
    const row = await tx<DashboardSnapshot | undefined>("snapshots", "readonly", (s) =>
      s.get(key)
    );
    return row || null;
  } catch {
    return null;
  }
}

export async function loadLatestSnapshot(): Promise<DashboardSnapshot | null> {
  try {
    const rows = await tx<DashboardSnapshot[]>("snapshots", "readonly", (s) =>
      s.getAll()
    );
    if (!rows || rows.length === 0) return null;
    rows.sort((a, b) => b.timestamp - a.timestamp);
    return rows[0];
  } catch {
    return null;
  }
}

export function snapshotKey(range: string, segment: string, search: string): string {
  return `${range}|${segment}|${search.trim().toLowerCase()}`;
}

export function getLastSyncedAt(): number | null {
  try {
    const raw = localStorage.getItem("mihwar_last_synced_at");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

// ---------- Outbox (pending mutations) ----------

export async function queueOp(
  op: Omit<QueuedOp, "id" | "createdAt" | "attempts">
): Promise<number> {
  const id = (await tx("outbox", "readwrite", (s) =>
    s.add({
      ...op,
      createdAt: Date.now(),
      attempts: 0,
    } as QueuedOp)
  )) as unknown as number;
  notifyOutboxChanged();
  return Number(id);
}

export async function listOps(): Promise<QueuedOp[]> {
  try {
    const rows = await tx<QueuedOp[]>("outbox", "readonly", (s) => s.getAll());
    return (rows || []).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  } catch {
    return [];
  }
}

export async function countOps(): Promise<number> {
  try {
    return await tx<number>("outbox", "readonly", (s) => s.count());
  } catch {
    return 0;
  }
}

export async function deleteOp(id: number): Promise<void> {
  try {
    await tx("outbox", "readwrite", (s) => s.delete(id));
  } finally {
    notifyOutboxChanged();
  }
}

export async function clearOps(): Promise<void> {
  try {
    await tx("outbox", "readwrite", (s) => s.clear());
  } finally {
    notifyOutboxChanged();
  }
}

export async function bumpOpAttempt(id: number, lastError: string): Promise<void> {
  try {
    const row = await tx<QueuedOp | undefined>("outbox", "readonly", (s) => s.get(id));
    if (!row) return;
    await tx("outbox", "readwrite", (s) =>
      s.put({ ...row, attempts: (row.attempts || 0) + 1, lastError })
    );
  } catch {
    // ignore
  } finally {
    notifyOutboxChanged();
  }
}
