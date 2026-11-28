"use client";

import { useState } from "react";

import { ConfirmDiscardDraft } from "@/components/career/draft-recovery-banners";
import { ScopeComparison } from "@/components/career/scope-comparison";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DisclosureChevron } from "@/components/ui/disclosure";
import { draftAge, newestFirst } from "@/lib/career/recovery";
import type { CareerDraft } from "@/types-and-constants/career";

/** Unresolved recovery drafts with preview, restore, and confirmed discard per row.
 * @param props Drafts to list plus labelling, comparison, and resolution callbacks.
 * @returns Bordered list (newest first), or null when no drafts are listed.
 * @example <RecoveryList drafts={drafts} label={label} saved={saved} outdated={outdated} onRestore={restore} onDiscard={discard} onExport={exportRecovery} />
 */
export function RecoveryList({
  drafts,
  disabled = false,
  label,
  saved,
  outdated,
  onRestore,
  onDiscard,
  onExport,
}: {
  drafts: readonly CareerDraft[];
  disabled?: boolean;
  /** Human-readable name for the draft's scope. */
  label: (draft: CareerDraft) => string;
  /** Current saved values for the draft's scope; undefined when the record is gone. */
  saved: (draft: CareerDraft) => unknown;
  /** True when saved content moved since the draft started. */
  outdated: (draft: CareerDraft) => boolean;
  onRestore: (draft: CareerDraft) => void;
  onDiscard: (draft: CareerDraft) => void;
  onExport: () => void;
}) {
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState<CareerDraft | null>(null);
  if (!drafts.length) return null;
  return (
    <>
      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {newestFirst(drafts).map((draft) => {
          const name = label(draft);
          const open = previewing === draft.draftId;
          const current = saved(draft);
          return (
            <li key={draft.draftId} className="flex flex-col gap-3 px-4 py-3">
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
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-expanded={open}
                    aria-label={`Preview ${name}`}
                    className="[&[aria-expanded=true]>[data-slot=disclosure-chevron]]:rotate-90"
                    onClick={() => setPreviewing(open ? null : draft.draftId)}
                  >
                    <DisclosureChevron />
                    Preview
                  </Button>
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
                    onClick={() => setDiscarding(draft)}
                  >
                    Discard
                  </Button>
                </div>
              </div>
              {open &&
                (current === undefined ? (
                  <p className="text-xs text-muted-foreground">
                    The original record no longer exists. Restore the draft to
                    save it as new.
                  </p>
                ) : (
                  <ScopeComparison current={current} draft={draft.values} />
                ))}
            </li>
          );
        })}
      </ul>
      <ConfirmDiscardDraft
        open={discarding !== null}
        name={discarding ? label(discarding) : ""}
        onOpenChange={(open) => {
          if (!open) setDiscarding(null);
        }}
        onConfirm={() => {
          if (discarding) onDiscard(discarding);
          setDiscarding(null);
        }}
        onExport={onExport}
      />
    </>
  );
}
