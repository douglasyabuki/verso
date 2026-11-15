"use client";

import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type {
  AccountProviders,
  AccountSession,
  AccountSessionStore,
} from "@/stores/account/session";
import {
  type CareerHead,
  openCareerStorage,
} from "@/stores/career/persistence";

const PROVIDER_LABELS: Record<keyof AccountProviders, string> = {
  github: "Continue with GitHub",
  google: "Continue with Google",
};

/** Settings › Account: sign-in, identity, and guarded sign-out.
 * @param props Session store/state, unconfirmed-work count, guarded sign-out
 * resolution, recovery export, and optional guest-import content.
 * @returns Account panel content; never moves or merges workspaces by itself.
 * @example <AccountPanel store={store} session={session} unconfirmed={0} resolveDrafts={run} exportRecovery={exportRecovery} />
 */
export function AccountPanel({
  store,
  session,
  unconfirmed,
  resolveDrafts,
  exportRecovery,
  children,
}: {
  store?: AccountSessionStore;
  session?: AccountSession;
  unconfirmed: number;
  resolveDrafts: (action: () => void) => void;
  exportRecovery: () => void;
  children?: React.ReactNode;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!store || !session || session.kind === "unavailable")
    return (
      <p>
        Accounts are not enabled on this deployment. Your workspace is saved in
        this browser.
      </p>
    );
  if (session.kind === "loading") return <p role="status">Checking sign-in…</p>;
  if (session.kind === "error") return <p role="alert">{session.message}</p>;

  const signIn = async (provider: keyof AccountProviders) => {
    setBusy(true);
    setError("");
    const failure = await store.signIn(
      provider,
      window.location.pathname + window.location.search,
    );
    if (failure) {
      setError(failure);
      setBusy(false);
    }
  };
  const providerButtons = (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(PROVIDER_LABELS) as (keyof AccountProviders)[])
        .filter((provider) => session.providers[provider])
        .map((provider) => (
          <Button
            key={provider}
            variant="outline"
            disabled={busy}
            onClick={() => void signIn(provider)}
          >
            {PROVIDER_LABELS[provider]}
          </Button>
        ))}
    </div>
  );
  const signOut = async () => {
    setConfirming(false);
    setBusy(true);
    setError("");
    const failure = await store.signOut();
    if (failure) setError(failure);
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Account action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {session.kind === "guest" ? (
        <>
          <p>
            Sign in to save your workspace to an account. Signing in does not
            move, merge, or replace the workspace saved in this browser; you can
            review and import it afterwards.
          </p>
          {providerButtons}
        </>
      ) : (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Signed in as</dt>
            <dd>{session.user.name}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd>{session.user.email}</dd>
          </dl>
          <p>
            Saves go to your account and are confirmed only after the server
            acknowledges them. Drafts and unconfirmed Saves stay on this device
            until they are confirmed.
          </p>
          {session.kind === "expired" && (
            <Alert>
              <AlertTitle>Your sign-in expired</AlertTitle>
              <AlertDescription>
                Sign in again to finish saving. Your drafts and unconfirmed
                Saves are kept on this device.
              </AlertDescription>
            </Alert>
          )}
          {session.kind === "expired" && providerButtons}
          {children}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                resolveDrafts(() =>
                  unconfirmed > 0 ? setConfirming(true) : void signOut(),
                )
              }
            >
              Sign out
            </Button>
          </div>
          <AlertDialog
            open={confirming}
            onOpenChange={(open) => !open && setConfirming(false)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Sign out with unconfirmed work?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {unconfirmed === 1
                    ? "1 change has"
                    : `${unconfirmed} changes have`}{" "}
                  not been confirmed by your account. They stay on this device
                  and reappear when you sign in again as this user. Export
                  recovery if you might sign in elsewhere.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-wrap">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button variant="outline" onClick={exportRecovery}>
                  Export recovery
                </Button>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => void signOut()}
                >
                  Sign out
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

/** Read this browser's guest workspace without creating or changing it.
 * @returns The committed guest head, or undefined when no guest workspace is saved.
 * @example const guest = await readGuestWorkspace()
 */
export async function readGuestWorkspace(): Promise<CareerHead | undefined> {
  const storage = await openCareerStorage();
  try {
    return await storage.load();
  } catch (error) {
    if (String(error).includes("No saved workspace")) return undefined;
    throw error;
  } finally {
    storage.close();
  }
}

/** Offer the explicit, reviewed guest-workspace import.
 * @param props Review starter, disabled state, and latest error.
 * @returns Import description and action.
 * @example <GuestImport review={openReview} disabled={false} error="" />
 */
export function GuestImport({
  review,
  disabled,
  error,
}: {
  review: () => void;
  disabled: boolean;
  error: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p>
        Import the workspace saved in this browser as a guest. You review it
        first; it replaces your account workspace, which is kept as the one
        previous workspace. The guest workspace is not changed.
      </p>
      <Button
        variant="outline"
        className="self-start"
        disabled={disabled}
        onClick={review}
      >
        Review guest workspace import
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
