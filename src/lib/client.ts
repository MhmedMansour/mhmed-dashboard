"use client";

/**
 * Shared client helpers: typed API wrapper with consistent error surfacing,
 * plus filtering utilities reused across dashboard panels.
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  formData?: FormData;
  /** Treat a network failure as recoverable (offline queue) */
  throwOnNetwork?: boolean;
}

/**
 * Single fetch wrapper so every API call gets the same JSON parsing,
 * Arabic error messages, and network-failure detection.
 */
export async function api<T>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, formData, throwOnNetwork = false } = options;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: "include",
      cache: "no-store",
      headers:
        formData || body === undefined
          ? undefined
          : { "Content-Type": "application/json" },
      body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
  } catch (err) {
    if (throwOnNetwork) throw err;
    throw new ApiError("تعذر الاتصال بالخادم — تحقق من الإنترنت", 0);
  }

  if (!response.ok) {
    let message = `خطأ من الخادم (${response.status})`;
    try {
      const data = await response.json();
      if (data?.error && typeof data.error === "string") message = data.error;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return (await response.blob()) as unknown as T;
  }
  return (await response.json()) as T;
}

/** True when the failure is a connectivity problem rather than a server rejection. */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message : "";
  return (
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("تعذر الاتصال بالخادم")
  );
}

/** Filters rows against a free-text query across the given fields. */
export function matchesQuery<T>(
  rows: T[],
  query: string,
  fields: Array<(row: T) => string | null | undefined>
): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    fields.some((get) => (get(row) || "").toLowerCase().includes(needle))
  );
}
