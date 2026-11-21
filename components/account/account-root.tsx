"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { BrandLoading } from "@/components/brand/brand-loading";
import { CareerWorkspace } from "@/components/career/career-workspace";
import { toast } from "@/components/ui/toast";
import { AccountSessionStore, ownerKey } from "@/stores/account/session";

/** Minimum interval between focus-triggered session checks. */
const SESSION_RECHECK_MS = 60_000;

/** Resolve the account owner, then mount that owner's workspace. Changing user or
 * session remounts the workspace, disposing the previous controller, its storage,
 * and in-flight requests so late responses never reach another owner.
 * @returns The owner-keyed career workspace, or a status while sign-in is unresolved.
 * @example <AccountRoot />
 */
export function AccountRoot() {
  const [store] = useState(() => new AccountSessionStore());
  const session = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const lastCheck = useRef(0);

  useEffect(() => {
    lastCheck.current = Date.now();
    void store.start();
    const recheck = () => {
      if (Date.now() - lastCheck.current < SESSION_RECHECK_MS) return;
      lastCheck.current = Date.now();
      void store.refresh();
    };
    window.addEventListener("focus", recheck);
    return () => window.removeEventListener("focus", recheck);
  }, [store]);

  useEffect(() => {
    if (session.kind !== "expired") return;
    const id = toast.add({
      type: "warning",
      title: "Your sign-in expired",
      description:
        "Sign in again from Settings › Account to finish saving. Your drafts stay on this device.",
      timeout: 0,
    });
    return () => toast.close(id);
  }, [session.kind]);

  const key = ownerKey(session);
  if (session.kind === "error")
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-sm">
        <p role="alert">{session.message}</p>
      </main>
    );
  if (!key)
    return (
      <main>
        <BrandLoading message="Opening workspace…" />
      </main>
    );
  return <CareerWorkspace key={key} account={{ store, session }} />;
}
