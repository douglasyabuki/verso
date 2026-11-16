"use client";

import { LoaderCircle, LogOut } from "lucide-react";

import { ProviderIcon } from "@/components/account/provider-icon";
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
import type { AccountActions } from "@/hooks/account/use-account-actions";
import type {
  AccountProviders,
  AccountSession,
} from "@/stores/account/session";
import {
  type CareerHead,
  openCareerStorage,
} from "@/stores/career/persistence";

const PROVIDER_NAMES: Record<keyof AccountProviders, string> = {
  github: "GitHub",
  google: "Google",
};

/** Settings › Account: sign-in, identity, and guarded sign-out.
 * @param props Session state, shared account actions, and optional guest-import content.
 * @returns Account panel content; never moves or merges workspaces by itself.
 * @example <AccountPanel session={session} actions={actions} />
 */
export function AccountPanel({
  session,
  actions,
  children,
}: {
  session?: AccountSession;
  actions: AccountActions;
  children?: React.ReactNode;
}) {
  if (!session || session.kind === "unavailable")
    return (
      <p>
        Accounts are not enabled on this deployment. Your workspace is saved in
        this browser.
      </p>
    );
  if (session.kind === "loading") return <p role="status">Checking sign-in…</p>;
  if (session.kind === "error") return <p role="alert">{session.message}</p>;

  const providerButtons = (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(PROVIDER_NAMES) as (keyof AccountProviders)[])
        .filter((provider) => session.providers[provider])
        .map((provider) => {
          const pending = actions.pendingProvider === provider;
          return (
            <Button
              key={provider}
              variant="outline"
              disabled={actions.busy}
              aria-busy={pending}
              onClick={() => void actions.signIn(provider)}
            >
              {pending ? (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <ProviderIcon provider={provider} data-icon="inline-start" />
              )}
              {pending
                ? `Connecting to ${PROVIDER_NAMES[provider]}…`
                : `Continue with ${PROVIDER_NAMES[provider]}`}
            </Button>
          );
        })}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {actions.error && (
        <Alert variant="destructive">
          <AlertTitle>Account action failed</AlertTitle>
          <AlertDescription>{actions.error}</AlertDescription>
        </Alert>
      )}
      {session.kind === "guest" ? (
        <>
          <p>
            Sign in or create an account to save your workspace to it.
            Continuing with a provider creates your account the first time.
            Signing in does not move, merge, or replace the workspace saved in
            this browser; you can review and import it afterwards.
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
              disabled={actions.busy}
              onClick={actions.requestSignOut}
            >
              <LogOut data-icon="inline-start" aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Confirm signing out while account work is unconfirmed.
 * @param props Shared account actions, unconfirmed count, and recovery export.
 * @returns The confirmation dialog; open only while `actions.confirming`.
 * @example <SignOutConfirmation actions={actions} unconfirmed={2} exportRecovery={exportRecovery} />
 */
export function SignOutConfirmation({
  actions,
  unconfirmed,
  exportRecovery,
}: {
  actions: AccountActions;
  unconfirmed: number;
  exportRecovery: () => void;
}) {
  return (
    <AlertDialog
      open={actions.confirming}
      onOpenChange={(open) => !open && actions.cancelSignOut()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out with unconfirmed work?</AlertDialogTitle>
          <AlertDialogDescription>
            {unconfirmed === 1 ? "1 change has" : `${unconfirmed} changes have`}{" "}
            not been confirmed by your account. They stay on this device and
            reappear when you sign in again as this user. Export recovery if you
            might sign in elsewhere.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-wrap">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="outline" onClick={exportRecovery}>
            Export recovery
          </Button>
          <AlertDialogAction
            variant="destructive"
            onClick={() => void actions.signOut()}
          >
            Sign out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
