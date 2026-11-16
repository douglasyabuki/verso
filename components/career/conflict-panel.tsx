"use client";

import { type ReactNode, useState } from "react";

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
import type { DraftConflict } from "@/lib/career/conflict";

/** Resolve one conflicted scope while both versions stay retained.
 * Keep my draft rebases the draft onto the saved version (a separate Save still
 * commits it); Use saved version discards the draft after confirmation; Export keeps
 * a portable copy. Nothing is removed until the person chooses.
 * @param props Conflict versions, resolution actions, and an optional custom comparison.
 * @returns Alert with comparison and actions; the destructive action is last.
 * @example <ConflictPanel conflict={conflict} onKeepDraft={keep} onUseSaved={discard} onExport={exportRecovery} />
 */
export function ConflictPanel({
  conflict,
  subject = "draft",
  disabled = false,
  comparison,
  onKeepDraft,
  onUseSaved,
  onExport,
}: {
  conflict: DraftConflict;
  /** Noun for the retained local version, such as "draft" or "entry order". */
  subject?: string;
  disabled?: boolean;
  /** Replaces the default field comparison, for scopes whose values are opaque IDs. */
  comparison?: ReactNode;
  onKeepDraft: () => void;
  onUseSaved: () => void | Promise<void>;
  onExport: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const missing = conflict.saved === undefined;
  return (
    <Alert role="region" aria-label="Conflicting versions">
      <AlertTitle>
        {conflict.replaced
          ? `The workspace was replaced since this ${subject} started`
          : `Saved content changed since this ${subject} started`}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>
          Another device or tab saved revision {conflict.revision}. Both
          versions are kept until you choose. Keeping your {subject} uses the
          saved version as its new starting point; Save then commits it.
        </p>
        {missing ? (
          <p>
            The saved record no longer exists. Export your {subject}, or restore
            it as new.
          </p>
        ) : (
          (comparison ?? (
            <ScopeComparison current={conflict.saved} draft={conflict.draft} />
          ))
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onExport}>
            Export recovery
          </Button>
          {!missing && (
            <Button variant="outline" disabled={disabled} onClick={onKeepDraft}>
              Keep my {subject}
            </Button>
          )}
          <Button
            variant="destructive"
            disabled={disabled}
            onClick={() => setConfirming(true)}
          >
            Use saved version
          </Button>
        </div>
      </AlertDescription>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your {subject}?</AlertDialogTitle>
            <AlertDialogDescription>
              The saved version stays. Your {subject} is removed from this
              device; export recovery first if you might need it.
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
                setConfirming(false);
                void onUseSaved();
              }}
            >
              Discard {subject}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Alert>
  );
}
