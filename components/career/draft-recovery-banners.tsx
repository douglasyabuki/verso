"use client";

import { useState } from "react";

import { ScopeComparison } from "@/components/career/scope-comparison";
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
import { draftAge } from "@/lib/career/recovery";

/** Confirm permanent removal of one stored draft, offering export first.
 * @param props Open state, the draft's display name, and confirm/export handlers.
 * @returns Alert dialog whose destructive action is last.
 * @example <ConfirmDiscardDraft open={open} name="Profile" onOpenChange={setOpen} onConfirm={discard} onExport={exportRecovery} />
 */
export function ConfirmDiscardDraft({
  open,
  name,
  onOpenChange,
  onConfirm,
  onExport,
}: {
  open: boolean;
  name: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onExport: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard this draft?</AlertDialogTitle>
          <AlertDialogDescription>
            Unsaved changes to {name} are removed from this device. Saved
            content stays. Export recovery first if you might need them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-wrap">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="outline" onClick={onExport}>
            Export recovery
          </Button>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            Discard draft
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Notice for a restored, uncommitted draft with at most two contextual actions.
 * Save / Discard / Cancel remain the form's own actions; this only explains state.
 * @param props Restored time, comparison values, and optional rebase/export actions.
 * @returns Status region with "Show changes" and, only when needed, "Update to current" or "Export recovery".
 * @example <RestoredDraftBanner updatedAt={draft.updatedAt} current={saved} draft={draft.values} />
 */
export function RestoredDraftBanner({
  updatedAt,
  current,
  draft,
  disabled = false,
  onReconcile,
  onExport,
}: {
  updatedAt?: string;
  /** Saved values for the scope, compared with the draft. */
  current: unknown;
  draft: unknown;
  disabled?: boolean;
  /** Present only when the draft must adopt current saved content before Save. */
  onReconcile?: () => void;
  /** Present only when recovery could not be stored durably. */
  onExport?: () => void;
}) {
  const [comparing, setComparing] = useState(false);
  return (
    <Alert role="status" aria-label="Restored draft">
      <AlertTitle>Restored draft · edited {draftAge(updatedAt)}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>
          {onReconcile
            ? "This Save's outcome is unknown. Update the draft to the current saved content, review it, then Save."
            : "Not saved yet. Review it, then Save or Discard."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            aria-expanded={comparing}
            onClick={() => setComparing((value) => !value)}
          >
            {comparing ? "Hide changes" : "Show changes"}
          </Button>
          {onReconcile && (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={onReconcile}
            >
              Update to current
            </Button>
          )}
          {onExport && (
            <Button size="sm" variant="outline" onClick={onExport}>
              Export recovery
            </Button>
          )}
        </div>
        {comparing && <ScopeComparison current={current} draft={draft} />}
      </AlertDescription>
    </Alert>
  );
}

/** Offer an older stored draft for the form being opened, without restoring it automatically.
 * @param props Stored draft time plus Restore/Discard handlers.
 * @returns Status notice with Restore and Discard actions.
 * @example <StoredDraftNotice updatedAt={draft.updatedAt} onRestore={restore} onDiscard={discard} />
 */
export function StoredDraftNotice({
  updatedAt,
  name,
  disabled = false,
  onRestore,
  onDiscard,
  onExport,
}: {
  updatedAt?: string;
  /** Display name of the form, used in the discard confirmation. */
  name: string;
  disabled?: boolean;
  onRestore: () => void;
  onDiscard: () => void;
  onExport: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <Alert role="status" aria-label="Stored draft">
      <AlertTitle>Unsaved draft from {draftAge(updatedAt)}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>
          This form has changes that were never saved. Restore them to keep
          editing, or discard them.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            aria-label="Restore stored draft"
            onClick={onRestore}
          >
            Restore
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            aria-label="Discard stored draft"
            onClick={() => setConfirming(true)}
          >
            Discard
          </Button>
        </div>
      </AlertDescription>
      <ConfirmDiscardDraft
        open={confirming}
        name={name}
        onOpenChange={setConfirming}
        onConfirm={onDiscard}
        onExport={onExport}
      />
    </Alert>
  );
}
