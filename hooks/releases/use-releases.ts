"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import type { AccountSession } from "@/stores/account/session";
import {
  ReleaseStore,
  type ReleaseStoreState,
} from "@/stores/releases/release-store";

/** Options for {@link useReleases}. */
export type ReleasesOptions = {
  /** Mounted owner's session; releases exist only for authenticated accounts. */
  session?: AccountSession;
  /** Called when the server reports an invalid or mismatched session. */
  onSessionInvalid?: () => void;
};

/** Mounted release store with its current state. */
export type Releases = { store: ReleaseStore; state: ReleaseStoreState };

const empty: ReleaseStoreState = {
  list: null,
  loading: false,
  busy: null,
  error: null,
  uncertain: false,
};

const noop = () => () => {};

/** Create and load one release store for an authenticated owner, disposed when the owner unmounts.
 * The workspace remounts per owner, so the store never crosses accounts.
 * @param options Mounted session and session-invalid callback.
 * @returns {Releases | null} Store and state for an authenticated owner; null for guests and unavailable accounts.
 * @example const releases = useReleases({ session, onSessionInvalid: () => store.invalidate() })
 */
export function useReleases({
  session,
  onSessionInvalid,
}: ReleasesOptions): Releases | null {
  const identity =
    session?.kind === "authenticated"
      ? { userId: session.user.id, sessionId: session.sessionId }
      : null;
  const [store] = useState(() =>
    identity ? new ReleaseStore(identity, { onSessionInvalid }) : null,
  );
  const state = useSyncExternalStore(
    store?.subscribe ?? noop,
    store?.getSnapshot ?? (() => empty),
    store?.getSnapshot ?? (() => empty),
  );
  useEffect(() => {
    if (!store) return;
    store.load().catch(() => {});
    return () => store.dispose();
  }, [store]);
  return store ? { store, state } : null;
}
