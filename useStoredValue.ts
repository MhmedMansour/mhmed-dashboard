"use client";

import { useSyncExternalStore } from "react";

/**
 * SSR-safe localStorage subscription.
 * All app preferences share the `mihwar_` prefix; `setStoredValue` notifies
 * every consumer immediately (including same-tab updates), while the native
 * `storage` event keeps other tabs in sync.
 */

const PREFIX = "mihwar_";
const subscribers = new Set<() => void>();

function onStorageEvent(event: StorageEvent) {
  if (!event.key || event.key.startsWith(PREFIX)) {
    subscribers.forEach((fn) => fn());
  }
}

let listening = false;

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  // One shared browser listener regardless of how many sections subscribe.
  if (!listening && typeof window !== "undefined") {
    window.addEventListener("storage", onStorageEvent);
    listening = true;
  }
  return () => {
    subscribers.delete(callback);
    if (listening && subscribers.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorageEvent);
      listening = false;
    }
  };
}

function read(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(`${PREFIX}${key}`) ?? "";
  } catch {
    return "";
  }
}

function readServer(): string {
  return "";
}

export function notifyStoredChange(): void {
  subscribers.forEach((fn) => fn());
}

export function setStoredValue(key: string, value: string): void {
  try {
    window.localStorage.setItem(`${PREFIX}${key}`, value);
  } catch {
    // Private mode or quota — the hook still works from its in-memory fallback.
  }
  notifyStoredChange();
}

/** Returns the stored string, or `fallback` when unset/unavailable. */
export function useStoredValue(key: string, fallback = ""): string {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    readServer
  );
  return raw || fallback;
}

/** Convenience helper for "0"/"1" boolean flags. */
export function useStoredFlag(key: string, fallback = false): boolean {
  const value = useStoredValue(key, fallback ? "1" : "0");
  return value === "1";
}
