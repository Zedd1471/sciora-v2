"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Hydration guard. Replaces the `useState(false)` + `useEffect(() => setMounted(true))`
 * pattern, which React's compiler rules reject (synchronous setState inside an effect).
 * Server renders `false`, the client flips to `true` after hydration.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
