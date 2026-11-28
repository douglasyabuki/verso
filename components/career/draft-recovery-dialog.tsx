"use client";

import { X } from "lucide-react";
import { useRef, useState } from "react";

import { DraftChanges } from "@/components/career/scope-comparison";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DisclosureChevron,
  DisclosureGuide,
  DisclosureLabel,
  disclosureTriggerClassName,
} from "@/components/ui/disclosure";
import { matchesDraftVersion } from "@/lib/career/recovery";
import type { RecoveryDiscardResult } from "@/stores/career/controller";
import type { CareerDocument, CareerDraft } from "@/types-and-constants/career";

/** Review a stored draft before making its editor available. */
export function DraftRecoveryDialog({
  draft,
  document,
  language,
  name,
  subject,
  saved,
  saving,
  onDismiss,
  onContinue,
  onDiscard,
}: {
  draft: CareerDraft;
  document: CareerDocument;
  language: string;
  name: string;
  subject?: string;
  saved: boolean;
  saving: boolean;
  onDismiss: () => void;
  onContinue: (draft: CareerDraft) => Promise<void>;
  onDiscard: (draft: CareerDraft) => Promise<RecoveryDiscardResult>;
}) {
  const primary = useRef<HTMLButtonElement>(null);
  const [initial] = useState(draft);
  const [comparison, setComparison] = useState<{
    draft: CareerDraft;
    open: boolean;
  } | null>(null);
  const [action, setAction] = useState<"continue" | "discard" | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const newer = !matchesDraftVersion(initial, draft);
  const comparing =
    comparison && matchesDraftVersion(comparison.draft, draft)
      ? comparison.open
      : newer;
  const setComparing = (open: boolean) => setComparison({ draft, open });
  const busy = saving || action !== null;
  const discard = async () => {
    setAction("discard");
    setUnconfirmed(false);
    try {
      const result = await onDiscard(draft);
      if (result === "changed") setComparing(true);
      if (result === "unconfirmed") setUnconfirmed(true);
    } finally {
      setAction(null);
    }
  };
  const continueEditing = async () => {
    setAction("continue");
    try {
      await onContinue(draft);
    } finally {
      setAction(null);
    }
  };
  return (
    <Dialog
      open
      disablePointerDismissal
      onOpenChange={(open) => {
        if (!open && !busy) onDismiss();
      }}
    >
      <DialogContent
        initialFocus={primary}
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto data-[size=default]:max-w-xl data-[size=default]:sm:max-w-xl"
      >
        <DialogHeader>
          <div className="flex w-full items-start justify-between gap-2">
            <DialogTitle className="self-center wrap-anywhere">
              Continue editing {name}?
            </DialogTitle>
            <DialogCancel
              variant="ghost"
              size="icon-sm"
              disabled={busy}
              aria-label="Close recovery review"
            >
              <X aria-hidden="true" />
            </DialogCancel>
          </div>
          <DialogDescription>
            You have unsaved changes {subject ? `to ${subject}` : "here"}. If
            you discard them,{" "}
            {saved
              ? "you’ll see the last saved version."
              : "you’ll return to the list."}
          </DialogDescription>
        </DialogHeader>
        {newer && (
          <p role="status" className="text-sm">
            A newer version of these edits is available. Review it before
            discarding.
          </p>
        )}
        {unconfirmed && (
          <p role="alert" className="text-sm text-destructive">
            Verso couldn’t confirm the discard. Your edits are still available.
            You can try again.
          </p>
        )}
        <Collapsible open={comparing} onOpenChange={setComparing}>
          <CollapsibleTrigger
            render={<Button size="sm" variant="ghost" />}
            className={disclosureTriggerClassName}
          >
            <DisclosureChevron />
            <DisclosureLabel>
              {comparing ? "Hide changes" : "Show changes"}
            </DisclosureLabel>
          </CollapsibleTrigger>
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
        <DialogFooter>
          <DialogCancel variant="ghost" disabled={busy}>
            Decide later
          </DialogCancel>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void discard()}
          >
            {action === "discard" ? "Discarding…" : "Discard changes"}
          </Button>
          <Button
            ref={primary}
            disabled={busy}
            onClick={() => void continueEditing()}
          >
            Continue editing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
