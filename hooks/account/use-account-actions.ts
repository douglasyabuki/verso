"use client";

import { useState } from "react";

import { toast } from "@/components/ui/toast";
import { authErrorMessage } from "@/lib/account/auth-feedback";
import type {
  AccountProviders,
  AccountSessionStore,
} from "@/stores/account/session";

export type AccountActionsOptions = {
  /** Session store; absent when accounts are not enabled. */
  store?: AccountSessionStore;
  /** Saves and drafts not yet confirmed by the account. */
  unconfirmed: number;
  /** Resolve occupied drafts (Cancel/Discard/Save) before running the action. */
  resolveDrafts: (action: () => void) => void;
};

export type AccountActions = {
  busy: boolean;
  error: string;
  /** Provider whose redirect is starting, for its pending label. */
  pendingProvider: keyof AccountProviders | null;
  /** True while the unconfirmed-work sign-out confirmation is open. */
  confirming: boolean;
  signIn: (provider: keyof AccountProviders) => Promise<void>;
  requestSignOut: () => void;
  signOut: () => Promise<void>;
  cancelSignOut: () => void;
};

/** Share guarded account sign-in and sign-out between Settings › Account and the
 * avatar menu, so both use one busy/error state and one confirmation.
 * @param options Session store, unconfirmed-work count, and draft resolution.
 * @returns Sign-in/out commands with busy, error, pending-provider, and
 * confirmation state. `requestSignOut` resolves drafts first, then opens the
 * confirmation when work is unconfirmed or signs out immediately otherwise.
 * @example const actions = useAccountActions({ store, unconfirmed: 0, resolveDrafts })
 */
export function useAccountActions({
  store,
  unconfirmed,
  resolveDrafts,
}: AccountActionsOptions): AccountActions {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() =>
    typeof window === "undefined"
      ? ""
      : authErrorMessage(
          new URLSearchParams(window.location.search).get("error"),
        ),
  );
  const [pendingProvider, setPendingProvider] = useState<
    keyof AccountProviders | null
  >(null);
  const [confirming, setConfirming] = useState(false);

  const signIn = async (provider: keyof AccountProviders) => {
    if (!store) return;
    setBusy(true);
    setPendingProvider(provider);
    setError("");
    const failure = await store.signIn(
      provider,
      window.location.pathname + window.location.search,
    );
    if (failure) {
      setError(failure);
      setBusy(false);
      setPendingProvider(null);
    }
  };

  const signOut = async () => {
    if (!store) return;
    setConfirming(false);
    setBusy(true);
    setError("");
    const failure = await store.signOut();
    if (failure) {
      setError(failure);
      // Sign-out can start from the avatar menu, where no panel shows the error.
      toast.add({
        type: "error",
        title: "Sign-out failed",
        description: failure,
      });
    }
    setBusy(false);
  };

  return {
    busy,
    error,
    pendingProvider,
    confirming,
    signIn,
    requestSignOut: () =>
      resolveDrafts(() =>
        unconfirmed > 0 ? setConfirming(true) : void signOut(),
      ),
    signOut,
    cancelSignOut: () => setConfirming(false),
  };
}
