"use client";

// Browser helpers for previewing and downloading stored files.
// Works online AND offline (service worker serves cached bytes when offline).

export const MISSING_CONTENT_MESSAGE =
  "محتوى هذا الملف غير متاح لأنه رُفع قبل تفعيل التخزين الدائم. أعد رفعه وسيبقى محفوظاً.";

export const OFFLINE_NOT_CACHED_MESSAGE =
  "الملف غير محفوظ أوفلاين — افتحه مرة واحدة أونلاين أولاً ليُحفظ على جهازك.";

export function isContentAvailable(file: {
  storagePath: string | null;
  hasContent?: boolean;
}): boolean {
  if (typeof file.hasContent === "boolean") return file.hasContent;
  // Registered archives (workstation://) have a manifest but no bytes to lose.
  if (!file.storagePath) return false;
  return !file.storagePath.startsWith("/tmp/");
}

async function readError(response: Response, fallback: string): Promise<string> {
  const code = response.headers.get("content-type") || "";
  try {
    if (code.includes("application/json")) {
      const data = await response.json();
      if (data && typeof data.error === "string") return data.error;
      if (data && data.code === "OFFLINE_NOT_CACHED") return OFFLINE_NOT_CACHED_MESSAGE;
    } else {
      const text = await response.text();
      if (text) {
        try {
          const data = JSON.parse(text);
          if (data && typeof data.error === "string") return data.error;
        } catch {
          // not json
        }
      }
    }
  } catch {
    // Non-JSON error bodies fall through to the generic message.
  }
  if (response.status === 503 && !navigator.onLine) return OFFLINE_NOT_CACHED_MESSAGE;
  return fallback;
}

function isOfflineNow(): boolean {
  try {
    return !navigator.onLine;
  } catch {
    return false;
  }
}

export async function downloadStoredFile(
  url: string,
  fileName: string
): Promise<{ ok: true; offline?: boolean } | { ok: false; message: string }> {
  try {
    const response = await fetch(url, { credentials: "include", cache: "no-store" });
    if (!response.ok) {
      return { ok: false, message: await readError(response, "تعذر تحميل الملف") };
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return { ok: true, offline: isOfflineNow() };
  } catch {
    if (isOfflineNow()) return { ok: false, message: OFFLINE_NOT_CACHED_MESSAGE };
    return { ok: false, message: "تعذر الاتصال بالخادم لتحميل الملف" };
  }
}

export async function openStoredPreview(
  url: string,
  fileName: string
): Promise<{ ok: true; offline?: boolean } | { ok: false; message: string }> {
  // Open the tab synchronously (inside the click) so browsers don't block it,
  // then verify the file exists; the tab is closed if the content is missing.
  const tab = window.open("about:blank", "_blank");
  try {
    const response = await fetch(url, { method: "HEAD", credentials: "include", cache: "no-store" });
    if (!response.ok) {
      tab?.close();
      // HEAD has no body — do one GET to read the JSON error message.
      try {
        const full = await fetch(url, { credentials: "include", cache: "no-store" });
        if (!full.ok) return { ok: false, message: await readError(full, "تعذر عرض الملف") };
      } catch {
        // fall through
      }
      if (isOfflineNow()) return { ok: false, message: OFFLINE_NOT_CACHED_MESSAGE };
      return { ok: false, message: "تعذر عرض الملف" };
    }
    if (tab) {
      tab.opener = null;
      tab.document.title = fileName;
      tab.location.replace(url);
    } else {
      window.open(url, "_blank", "noopener");
    }
    return { ok: true, offline: isOfflineNow() };
  } catch {
    tab?.close();
    if (isOfflineNow()) return { ok: false, message: OFFLINE_NOT_CACHED_MESSAGE };
    return { ok: false, message: "تعذر الاتصال بالخادم لعرض الملف" };
  }
}

/** Check whether a file URL is already stored in the offline file cache. */
export async function isFileCachedOffline(url: string): Promise<boolean> {
  try {
    if (!("caches" in window)) return false;
    const cache = await caches.open("mihwar-files-v5");
    const match = await cache.match(url);
    return !!match;
  } catch {
    return false;
  }
}
