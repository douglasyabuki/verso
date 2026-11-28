"use client";

import { Download, LoaderCircle, Trash2 } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { formatCount } from "@/lib/format-count";
import type { WorkspaceIdentity } from "@/stores/career/backend";
import type {
  WorkspaceDeletionResult,
  WorkspaceDeletionStatus,
} from "@/stores/career/controller";
import type { CareerHead } from "@/stores/career/persistence";
import { WORKSPACE_DELETION } from "@/types-and-constants/account";

type Stage =
  | { kind: "closed" }
  | { kind: "confirm"; reviewed: CareerHead; changed: boolean }
  | { kind: "deleting"; reviewed: CareerHead }
  | { kind: "pending"; message: string }
  | { kind: "working"; label: string }
  | { kind: "error"; message: string };

/** Counts shown in the confirmation for one reviewed head.
 * @param head Reviewed committed head.
 * @returns Section, entry, resume, preset, and starter counts.
 * @example contents(state.head)
 */
function contents(head: CareerHead) {
  const { document } = head;
  return {
    sections: document.sections.length,
    entries: document.sections.reduce(
      (sum, section) => sum + section.entries.length,
      0,
    ),
    resumes: document.resumes.length,
    presets: document.presets.length,
    starters: document.starters.length,
  };
}

const sameRevision = (current: CareerHead | null, reviewed: CareerHead) =>
  current?.workspaceId === reviewed.workspaceId &&
  current.revision === reviewed.revision &&
  current.generation === reviewed.generation;

/** Settings › Data › Delete workspace data: permanent deletion of the active workspace.
 * Shows what is deleted and kept for the reviewed revision, offers an optional saved-content
 * backup, and requires typing DELETE. A change to the workspace after review, or a conflict
 * from storage, shows the updated contents and requires fresh confirmation. Unresolved
 * account outcomes stay visible with status-check, retry, and server-cancel actions.
 * @param props Owner kind, live head, counts, deletion status, and controller actions.
 * @returns The section row with its staged confirmation dialog.
 * @example <DeleteWorkspaceData owner="guest" head={state.head} ... />
 */
export function DeleteWorkspaceData({
  owner,
  head,
  available,
  busy,
  unsaved,
  previousAvailable,
  publicLinks,
  deletion,
  exportWorkspace,
  refreshRecovery,
  onDelete,
  onResolve,
  onRetry,
  onCancelAttempt,
  onDeleted,
}: {
  owner: "guest" | "account";
  head: CareerHead | null;
  /** Durable storage is available (not tab-only or unavailable). */
  available: boolean;
  /** A Save or other workspace operation is in progress. */
  busy: boolean;
  /** Unsaved drafts open in this tab plus stored recovery. */
  unsaved: number;
  previousAvailable: boolean;
  /** Account only: public links and their releases, when the list is loaded. */
  publicLinks?: { links: number; releases: number };
  deletion: WorkspaceDeletionStatus | null;
  exportWorkspace: (head: CareerHead) => void;
  /** Re-read stored recovery so the count includes drafts stored by other tabs. */
  refreshRecovery: () => Promise<void>;
  onDelete: (reviewed: WorkspaceIdentity) => Promise<WorkspaceDeletionResult>;
  onResolve: (operationId: string) => Promise<WorkspaceDeletionResult>;
  onRetry: (operationId: string) => Promise<WorkspaceDeletionResult>;
  onCancelAttempt: (operationId: string) => Promise<WorkspaceDeletionResult>;
  onDeleted: (result: Extract<WorkspaceDeletionResult, { ok: true }>) => void;
}) {
  const [stage, setStage] = useState<Stage>({ kind: "closed" });
  const [typed, setTyped] = useState("");
  const [backupError, setBackupError] = useState("");
  const [notice, setNotice] = useState("");
  const account = owner === "account";
  const pending = deletion?.kind === "pending" ? deletion : null;
  const cleanupPending = deletion?.kind === "cleanup-pending" ? deletion : null;

  const review = (changed = false) => {
    if (!head) return;
    setTyped("");
    setBackupError("");
    setNotice("");
    setStage({ kind: "confirm", reviewed: head, changed });
    void refreshRecovery();
  };

  // The workspace changed (another tab, device, or Save) while the dialog was open.
  const stale = stage.kind === "confirm" && !sameRevision(head, stage.reviewed);

  const settle = (result: WorkspaceDeletionResult) => {
    if (result.ok) {
      setStage({ kind: "closed" });
      onDeleted(result);
      return;
    }
    if (result.reason === "pending") {
      setStage({ kind: "pending", message: result.message });
      return;
    }
    if (result.reason === "cancelled") {
      setStage({ kind: "closed" });
      setNotice(result.message);
      return;
    }
    if (result.reason === "conflict" || result.reason === "replaced") {
      review(true);
      return;
    }
    setStage({ kind: "error", message: result.message });
  };

  const confirm = async (reviewed: CareerHead) => {
    setStage({ kind: "deleting", reviewed });
    settle(
      await onDelete({
        workspaceId: reviewed.workspaceId,
        revision: reviewed.revision,
        generation: reviewed.generation,
      }),
    );
  };

  const act = async (
    label: string,
    work: (operationId: string) => Promise<WorkspaceDeletionResult>,
  ) => {
    if (!pending && !cleanupPending) return;
    const operationId = (pending ?? cleanupPending)!.operationId;
    setStage({ kind: "working", label });
    settle(await work(operationId));
  };

  const open = stage.kind !== "closed";
  const locked = stage.kind === "deleting" || stage.kind === "working";
  const reviewed =
    stage.kind === "confirm" || stage.kind === "deleting"
      ? stage.reviewed
      : null;
  const counts = reviewed && contents(stale && head ? head : reviewed);

  return (
    <section
      aria-labelledby="delete-workspace-title"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col items-start gap-2">
        <div className="flex flex-col gap-1">
          <h3
            id="delete-workspace-title"
            className="font-medium text-destructive"
          >
            Delete workspace data
          </h3>
          <p className="text-sm text-muted-foreground">
            {account
              ? "Permanently clear your account workspace and start fresh. You stay signed in."
              : "Permanently clear the workspace in this browser and start fresh."}
          </p>
          {!available && (
            <p className="text-sm text-muted-foreground">
              Available when durable saving is active. Reload or return to
              durable saving first.
            </p>
          )}
        </div>
        <Button
          variant="destructive"
          size="sm"
          disabled={!available || busy || !head || Boolean(pending)}
          onClick={() => review()}
        >
          <Trash2 data-icon="inline-start" aria-hidden="true" />
          Delete workspace data
        </Button>
      </div>
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {pending && stage.kind === "closed" && (
        <Alert variant="destructive">
          <AlertTitle>Deletion not confirmed yet</AlertTitle>
          <AlertDescription>
            {pending.reason === "offline"
              ? "Verso could not reach your account, so it cannot tell yet whether your workspace was deleted."
              : "Your account has not confirmed the deletion. Your workspace and public PDF links are unchanged for now, but the request could still complete."}
          </AlertDescription>
          <PendingActions
            disabled={busy}
            onCheck={() => void act("Checking status…", onResolve)}
            onRetry={() => void act("Retrying deletion…", onRetry)}
            onKeep={() => void act("Keeping your workspace…", onCancelAttempt)}
          />
        </Alert>
      )}
      {cleanupPending && (
        <Alert variant="destructive">
          <AlertTitle>Local copy not cleared</AlertTitle>
          <AlertDescription>
            Deleted from your account. This browser&apos;s local copy
            couldn&apos;t be cleared. Retry to remove it; it is also retried the
            next time Verso opens.
          </AlertDescription>
          <Button
            size="sm"
            variant="outline"
            className="justify-self-start"
            disabled={busy || locked}
            onClick={() => void act("Clearing local copy…", onResolve)}
          >
            Retry cleanup
          </Button>
        </Alert>
      )}
      <AlertDialog
        open={open}
        onOpenChange={(next) =>
          !next && !locked && setStage({ kind: "closed" })
        }
      >
        <AlertDialogContent>
          {reviewed && counts && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete workspace data permanently?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {account
                    ? "This permanently deletes your account's workspace. You'll stay signed in, but your public PDF links, including pinned versions, will stop working. This can't be undone."
                    : "This permanently deletes your workspace in this browser. It can't be undone."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {(stale || (stage.kind === "confirm" && stage.changed)) && (
                <Alert role="status">
                  <AlertTitle>Your workspace changed</AlertTitle>
                  <AlertDescription>
                    It changed since you opened this. Review the updated
                    contents and type {WORKSPACE_DELETION.confirmation} again.
                  </AlertDescription>
                  {stale && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="justify-self-start"
                      onClick={() => review(true)}
                    >
                      Review updated workspace
                    </Button>
                  )}
                </Alert>
              )}
              <div className="flex flex-col gap-3 text-sm">
                <div>
                  <p className="font-medium">Deleted</p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    <li>
                      Career details:{" "}
                      {formatCount(counts.sections, "section", "sections")} and{" "}
                      {formatCount(counts.entries, "entry", "entries")},
                      including archived content
                    </li>
                    <li>{formatCount(counts.resumes, "resume", "resumes")}</li>
                    <li>
                      Workspace settings: resume defaults, content languages,{" "}
                      {formatCount(
                        counts.presets,
                        "layout preset",
                        "layout presets",
                      )}
                      , and{" "}
                      {formatCount(
                        counts.starters,
                        "resume starter",
                        "resume starters",
                      )}
                    </li>
                    {previousAvailable && <li>The previous workspace</li>}
                    <li>Undo and Redo history</li>
                    <li>
                      {formatCount(unsaved, "unsaved draft", "unsaved drafts")}{" "}
                      and stored recovery, including drafts open in other tabs
                    </li>
                    {account && (
                      <li>
                        {publicLinks
                          ? `${formatCount(publicLinks.links, "public PDF link", "public PDF links")} and ${formatCount(publicLinks.releases, "published version", "published versions")}`
                          : "All public PDF links and their published versions"}
                        ; they stop working immediately
                      </li>
                    )}
                    {account && (
                      <li>This browser&apos;s local copy for this account</li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="font-medium">Kept</p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {account ? (
                      <>
                        <li>Your account, sign-in methods, and this session</li>
                        <li>The guest workspace in this browser</li>
                      </>
                    ) : (
                      <li>Workspaces of accounts signed in on this browser</li>
                    )}
                    <li>
                      Device preferences such as theme and preview refresh
                    </li>
                    <li>
                      Backups and PDFs already downloaded; copies stay with
                      whoever has them
                    </li>
                  </ul>
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    variant="outline"
                    className="self-start"
                    disabled={stage.kind === "deleting"}
                    onClick={() => {
                      try {
                        exportWorkspace(stale && head ? head : reviewed);
                        setBackupError("");
                      } catch (error) {
                        setBackupError(String(error));
                      }
                    }}
                  >
                    <Download data-icon="inline-start" aria-hidden="true" />
                    Download workspace backup
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Optional. Saved content only; unsaved drafts aren&apos;t
                    included.
                  </p>
                  {backupError && (
                    <p role="alert" className="text-destructive">
                      {backupError}
                    </p>
                  )}
                </div>
                <Field>
                  <FieldLabel htmlFor="delete-workspace-confirmation">
                    Type {WORKSPACE_DELETION.confirmation} to confirm
                  </FieldLabel>
                  <Input
                    id="delete-workspace-confirmation"
                    autoComplete="off"
                    spellCheck={false}
                    value={typed}
                    disabled={stage.kind === "deleting" || stale}
                    onChange={(event) => setTyped(event.target.value)}
                  />
                  <FieldDescription>
                    Unsaved drafts are deleted too; you don&apos;t need to save
                    or discard them first.
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
                    typed !== WORKSPACE_DELETION.confirmation ||
                    stage.kind === "deleting" ||
                    stale ||
                    busy
                  }
                  onClick={() => void confirm(reviewed)}
                >
                  {stage.kind === "deleting" ? (
                    <LoaderCircle
                      data-icon="inline-start"
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Trash2 data-icon="inline-start" aria-hidden="true" />
                  )}
                  {stage.kind === "deleting"
                    ? "Deleting…"
                    : "Delete workspace data"}
                </Button>
              </AlertDialogFooter>
            </>
          )}
          {stage.kind === "working" && (
            <AlertDialogHeader>
              <AlertDialogTitle>{stage.label}</AlertDialogTitle>
              <AlertDialogDescription>
                Waiting for your account to answer.
              </AlertDialogDescription>
            </AlertDialogHeader>
          )}
          {stage.kind === "pending" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Deletion not confirmed yet</AlertDialogTitle>
                <AlertDialogDescription>{stage.message}</AlertDialogDescription>
              </AlertDialogHeader>
              <PendingActions
                disabled={busy}
                onCheck={() => void act("Checking status…", onResolve)}
                onRetry={() => void act("Retrying deletion…", onRetry)}
                onKeep={() =>
                  void act("Keeping your workspace…", onCancelAttempt)
                }
              />
              <AlertDialogFooter>
                <AlertDialogCancel>Close</AlertDialogCancel>
              </AlertDialogFooter>
            </>
          )}
          {stage.kind === "error" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Workspace data not deleted</AlertDialogTitle>
              </AlertDialogHeader>
              <Alert variant="destructive">
                <AlertDescription>{stage.message}</AlertDescription>
              </Alert>
              <AlertDialogFooter>
                <AlertDialogCancel>Close</AlertDialogCancel>
                <Button variant="outline" onClick={() => review()}>
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

/** Actions for an unresolved account deletion attempt.
 * @param props Disabled state and the check, retry, and keep handlers.
 * @returns Action buttons; Keep workspace cancels on the server, never only locally.
 * @example <PendingActions disabled={false} onCheck={check} onRetry={retry} onKeep={keep} />
 */
function PendingActions({
  disabled,
  onCheck,
  onRetry,
  onKeep,
}: {
  disabled: boolean;
  onCheck: () => void;
  onRetry: () => void;
  onKeep: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={disabled} onClick={onCheck}>
        Check status
      </Button>
      <Button size="sm" variant="outline" disabled={disabled} onClick={onKeep}>
        Keep workspace
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={disabled}
        onClick={onRetry}
      >
        Retry deletion
      </Button>
    </div>
  );
}
