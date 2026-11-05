"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Hydration-safe localStorage read.
 * Server and client hydration both return `null`; after hydration the
 * client switches to the real value — no mismatch, no setState-in-effect.
 */
export function useLocalStorage(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(key),
    () => null,
  );
}
