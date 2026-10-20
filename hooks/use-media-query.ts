"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Observe a viewport query without hydration mismatches. @param query CSS media query. @returns Whether it currently matches; false during server rendering. @example useMediaQuery("(min-width: 1024px)") */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", callback);
      return () => media.removeEventListener("change", callback);
    },
    [query],
  );
  const snapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
