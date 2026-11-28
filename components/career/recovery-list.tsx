"use client";

import { useState } from "react";

import { DraftChanges } from "@/components/career/scope-comparison";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DisclosureChevron,
  DisclosureGuide,
  DisclosureLabel,
  disclosureTriggerClassName,
} from "@/components/ui/disclosure";
import { draftAge, newestFirst } from "@/lib/career/recovery";
import type { RecoveryDiscardResult } from "@/stores/career/controller";
import type { CareerDocument, CareerDraft } from "@/types-and-constants/career";

/** Unresolved recovery drafts with preview, restore, and confirmed discard per row.
 * @param props Drafts to list plus labelling, comparison, and resolution callbacks.
 * @returns Bordered list (newest first), or null when no drafts are listed.
 * @example <RecoveryList drafts={drafts} document={document} language="en-US" label={label} outdated={outdated} onRestore={restore} onDiscard={discard} onExport={exportRecovery} />
 */
export function RecoveryList({
  drafts,
  disabled = false,
  label,
  document,
  language,
  outdated,
  onRestore,
  onDiscard,
  onExport,
}: {
  drafts: readonly CareerDraft[];
  disabled?: boolean;
  /** Human-readable name for the draft's scope. */
  label: (draft: CareerDraft) => string;
  document: CareerDocument;
  language: string;
  /** True when saved content moved since the draft started. */
  outdated: (draft: CareerDraft) => boolean;
  onRestore: (draft: CareerDraft) => void;
  onDiscard: (draft: CareerDraft) => Promise<RecoveryDiscardResult>;
  onExport: () => void;
}) {
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState<CareerDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  if (!drafts.length) return null;
  return (
    <>
      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {newestFirst(drafts).map((draft) => {
          const name = label(draft);
          const open = previewing === draft.draftId;
          return (
            <li key={draft.draftId} className="flex flex-col gap-3 px-4 py-3">
              <Collapsible
                open={open}
                onOpenChange={(open) =>
                  setPreviewing(open ? draft.draftId : null)
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span className="wrap-anywhere">{name}</span>
                      {outdated(draft) && (
                        <Badge variant="attention">Outdated</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Edited {draftAge(draft.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <CollapsibleTrigger
                      render={<Button size="sm" variant="ghost" />}
                      aria-label={`Preview ${name}`}
                      className={disclosureTriggerClassName}
                    >
                      <DisclosureChevron />
                      <DisclosureLabel>Preview</DisclosureLabel>
                    </CollapsibleTrigger>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => onRestore(draft)}
                    >
                      Restore draft
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={disabled}
                      aria-label={`Discard ${name}`}
                      onClick={() => {
                        setUnconfirmed(false);
                        setDiscarding(draft);
                      }}
                    >
                      Discard
                    </Button>
                  </div>
                </div>
                <CollapsibleContent>
                  <DisclosureGuide>
                    <DraftChanges
                      draft={draft}
                      document={document}
                      language={language}
                    />
                  </DisclosureGuide>
                </CollapsibleContent>
              </Collapsible>
            </li>
          );
        })}
      </ul>
      <AlertDialog
        open={discarding !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDiscarding(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              Discarding removes the unsaved changes to{" "}
              {discarding ? label(discarding) : "this form"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {unconfirmed && (
            <p role="alert" className="text-sm text-destructive">
              Verso couldn’t confirm the discard. Your edits are still
              available.
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button variant="outline" onClick={onExport}>
              Export recovery
            </Button>
            <Button
              variant="destructive"
              disabled={busy || disabled}
              onClick={async () => {
                if (!discarding) return;
                setBusy(true);
                try {
                  const result = await onDiscard(discarding);
                  if (result === "unconfirmed") setUnconfirmed(true);
                  else {
                    if (result === "changed") setPreviewing(discarding.draftId);
                    setDiscarding(null);
                  }
                } finally {
                  setBusy(false);
                }
              }}
            >
              Discard draft
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
