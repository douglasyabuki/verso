"use client";

import { Download, LoaderCircle, LogIn, UserRoundX } from "lucide-react";
import { useEffect, useState } from "react";

import { ProviderIcon } from "@/components/account/provider-icon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { workspaceBasePath } from "@/lib/career/navigation";
import type {
  AccountProviders,
  AccountSessionStore,
  AccountUser,
} from "@/stores/account/session";
import { deleteAccountStorage } from "@/stores/career/persistence";
import {
  ACCOUNT_DELETION,
  ACCOUNT_PROVIDER_NAMES,
  ACCOUNT_PROVIDERS,
} from "@/types-and-constants/account";

/** Tab-scoped marker that reopens deletion after a fresh sign-in by the same user. */
const REAUTH_KEY = "verso.delete-reauth.v1";

type Stage =
  | { kind: "closed" }
  | { kind: "checking" }
  | { kind: "blocked" }
  | { kind: "verify" }
  | { kind: "confirm"; capability: string }
  | { kind: "deleting"; capability: string }
  | { kind: "error"; message: string };

/** Read and clear the re-authentication marker.
 * @returns {string | null} The user ID that started deletion before signing in again, or null.
 */
function takeReauthMarker(): string | null {
  try {
    const value = sessionStorage.getItem(REAUTH_KEY);
    sessionStorage.removeItem(REAUTH_KEY);
    return value;
  } catch {
    return null;
  }
}

/** Settings › Account › Delete account: permanent, server-confirmed deletion.
 * Requires a recent sign-in, no unconfirmed account work, and typing DELETE. The signed
 * deletion capability settles unknown outcomes instead of replaying the request.
 * @param props Session store, signed-in user, configured providers, unconfirmed count, and backup export.
 * @returns The delete-account row and its staged dialog.
 * @example <DeleteAccount store={store} user={user} providers={providers} unconfirmed={0} exportWorkspace={exportWorkspace} />
 */
export function DeleteAccount({
  store,
  user,
  providers,
  unconfirmed,
  exportWorkspace,
}: {
  store: AccountSessionStore;
  user: AccountUser;
  providers: AccountProviders;
  unconfirmed: number;
  exportWorkspace: () => void;
}) {
  const [stage, setStage] = useState<Stage>({ kind: "closed" });
  const [typed, setTyped] = useState("");
  const [notice, setNotice] = useState("");
  const [backupError, setBackupError] = useState("");

  const begin = async () => {
    setTyped("");
    setBackupError("");
    if (unconfirmed > 0) {
      setStage({ kind: "blocked" });
      return;
    }
    setStage({ kind: "checking" });
    const prepared = await store.prepareDeletion();
    if (prepared.ok)
      setStage({ kind: "confirm", capability: prepared.capability });
    else if (prepared.code === "reauthenticate") setStage({ kind: "verify" });
    else setStage({ kind: "error", message: prepared.message });
  };

  useEffect(() => {
    const marker = takeReauthMarker();
    if (marker === null) return;
    if (marker === user.id) queueMicrotask(() => void begin());
    else
      queueMicrotask(() =>
        setNotice(
          "A different account signed in, so the earlier deletion request was cancelled.",
        ),
      );
    // Runs once per mounted owner; `begin` reads current props when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reauthenticate = async (provider: keyof AccountProviders) => {
    try {
      sessionStorage.setItem(REAUTH_KEY, user.id);
    } catch {
      // Without the marker the user reopens deletion manually after signing in.
    }
    const failure = await store.signIn(
      provider,
      `${workspaceBasePath}/settings/account`,
    );
    if (failure) setStage({ kind: "error", message: failure });
  };

  const confirmDeletion = async (capability: string) => {
    setStage({ kind: "deleting", capability });
    const result = await store.deleteAccount(capability);
    if (!result.ok) {
      setStage(
        result.code === "reauthenticate"
          ? { kind: "verify" }
          : { kind: "error", message: result.message },
      );
      return;
    }
    // The store now shows the guest owner, which unmounts this account's workspace
    // and closes its storage. Remove this browser's copy of the deleted account's
    // recovery data, then leave the workspace with a full load so no in-memory
    // account state survives.
    await deleteAccountStorage(user.id);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  };

  const open = stage.kind !== "closed";
  const busy = stage.kind === "checking" || stage.kind === "deleting";

  return (
    <section
      aria-labelledby="delete-account-title"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 p-4"
    >
      <div className="flex flex-col gap-1">
        <h3 id="delete-account-title" className="font-medium text-destructive">
          Delete account
        </h3>
        <p className="text-sm text-muted-foreground">
          Permanently remove your Verso account, its workspace, and its public
          PDF links.
        </p>
        {notice && (
          <p role="status" className="text-sm">
            {notice}
          </p>
        )}
      </div>
      <Button variant="destructive" onClick={() => void begin()}>
        <UserRoundX data-icon="inline-start" aria-hidden="true" />
        Delete account
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(next) => !next && !busy && setStage({ kind: "closed" })}
      >
        <AlertDialogContent>
          {stage.kind === "checking" && (
            <AlertDialogHeader>
              <AlertDialogTitle>Checking your account…</AlertDialogTitle>
              <AlertDialogDescription>
                Nothing has been deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
          )}
          {stage.kind === "blocked" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Finish your unsaved work first
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {unconfirmed === 1
                    ? "1 change has"
                    : `${unconfirmed} changes have`}{" "}
                  not been confirmed by your account. Save or discard them, or
                  export recovery, before deleting your account.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Close</AlertDialogCancel>
              </AlertDialogFooter>
            </>
          )}
          {stage.kind === "verify" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign in again to continue</AlertDialogTitle>
                <AlertDialogDescription>
                  For your security, deleting an account requires a sign-in from
                  the last {ACCOUNT_DELETION.freshMs / 60_000} minutes. You
                  return here afterwards; nothing has been deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex flex-col gap-2">
                {ACCOUNT_PROVIDERS.filter(
                  (provider) => providers[provider],
                ).map((provider) => (
                  <Button
                    key={provider}
                    variant="outline"
                    onClick={() => void reauthenticate(provider)}
                  >
                    <ProviderIcon
                      provider={provider}
                      data-icon="inline-start"
                    />
                    Sign in again with {ACCOUNT_PROVIDER_NAMES[provider]}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                <LogIn className="mr-1 inline size-3" aria-hidden="true" />
                Use a method connected to {user.email}. Signing in as someone
                else cancels this request.
              </p>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
              </AlertDialogFooter>
            </>
          )}
          {(stage.kind === "confirm" || stage.kind === "deleting") && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete your account permanently?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This deletes {user.email} from Verso and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex flex-col gap-3 text-sm">
                <div>
                  <p className="font-medium">Deleted</p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    <li>
                      Your account workspace and its one previous workspace
                    </li>
                    <li>
                      Connected Google and GitHub sign-in methods and all
                      sessions
                    </li>
                    <li>
                      Public PDF links and releases; they stop working
                      immediately
                    </li>
                    <li>This browser&apos;s recovery data for this account</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium">Kept</p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    <li>The guest workspace in this browser</li>
                    <li>Other Verso accounts</li>
                    <li>PDFs and backups you already downloaded</li>
                  </ul>
                </div>
                <Button
                  variant="outline"
                  className="self-start"
                  disabled={stage.kind === "deleting"}
                  onClick={() => {
                    try {
                      exportWorkspace();
                      setBackupError("");
                    } catch (error) {
                      setBackupError(String(error));
                    }
                  }}
                >
                  <Download data-icon="inline-start" aria-hidden="true" />
                  Download workspace backup
                </Button>
                {backupError && (
                  <p role="alert" className="text-destructive">
                    {backupError}
                  </p>
                )}
                <Field>
                  <FieldLabel htmlFor="delete-account-confirmation">
                    Type {ACCOUNT_DELETION.confirmation} to confirm
                  </FieldLabel>
                  <Input
                    id="delete-account-confirmation"
                    autoComplete="off"
                    spellCheck={false}
                    value={typed}
                    disabled={stage.kind === "deleting"}
                    onChange={(event) => setTyped(event.target.value)}
                  />
                  <FieldDescription>
                    Close other Verso tabs signed in to this account first.
                  </FieldDescription>
                </Field>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={stage.kind === "deleting"}>
                  Cancel
                </AlertDialogCancel>
                <Button
                  variant="destructive"
                  disabled={
                    typed !== ACCOUNT_DELETION.confirmation ||
                    stage.kind === "deleting"
                  }
                  onClick={() => void confirmDeletion(stage.capability)}
                >
                  {stage.kind === "deleting" ? (
                    <LoaderCircle
                      data-icon="inline-start"
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <UserRoundX data-icon="inline-start" aria-hidden="true" />
                  )}
                  {stage.kind === "deleting"
                    ? "Deleting…"
                    : "Permanently delete account"}
                </Button>
              </AlertDialogFooter>
            </>
          )}
          {stage.kind === "error" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Account not deleted</AlertDialogTitle>
              </AlertDialogHeader>
              <Alert variant="destructive">
                <AlertDescription>{stage.message}</AlertDescription>
              </Alert>
              <AlertDialogFooter>
                <AlertDialogCancel>Close</AlertDialogCancel>
                <Button variant="outline" onClick={() => void begin()}>
                  Try again
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
