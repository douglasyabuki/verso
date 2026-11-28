import { useRef } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CareerHead } from "@/stores/career/persistence";
import type { CareerDocument } from "@/types-and-constants/career";

export type WorkspaceReplacement = { head: CareerHead } & (
  | {
      kind: "replace" | "import";
      incoming: CareerDocument;
      previous?: CareerHead;
      filename?: string;
    }
  | { kind: "restore"; previous: CareerHead }
);

function WorkspaceSummary({
  title,
  document,
  filename,
}: {
  title: string;
  document: CareerDocument;
  filename?: string;
}) {
  const { sections, resumes } = document;
  return (
    <section className="min-w-0 rounded-lg border p-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {filename && (
        <p className="mt-1 text-sm wrap-anywhere">
          <bdi>{filename}</bdi>
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {sections.length} {sections.length === 1 ? "section" : "sections"} ·{" "}
        {resumes.length} {resumes.length === 1 ? "resume" : "resumes"}
      </p>
      {resumes.length > 0 && (
        <ul className="mt-2 list-disc ps-4 text-sm wrap-anywhere">
          {resumes.map((resume) => (
            <li key={resume.id}>{resume.name || "Untitled resume"}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function WorkspaceReplacementDialog({
  review,
  saving,
  stale,
  error,
  exportChoice,
  onDownload,
  onContinue,
  onConfirm,
  onClose,
}: {
  review: WorkspaceReplacement | null;
  saving: boolean;
  stale: boolean;
  error: string;
  exportChoice: "downloaded" | "skipped" | null;
  onDownload: (previous: CareerHead) => void;
  onContinue: () => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  const restoring = review?.kind === "restore";
  const discarded = review && !restoring ? review.previous : undefined;
  const exportRequired = Boolean(discarded && !exportChoice);

  return (
    <Dialog
      open={Boolean(review)}
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      {review && (
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto data-[size=default]:max-w-xl"
          initialFocus={cancel}
        >
          <DialogHeader>
            <DialogTitle>
              {restoring
                ? "Review workspace restore"
                : review.kind === "import"
                  ? "Review guest workspace import"
                  : "Review workspace replacement"}
            </DialogTitle>
            <DialogDescription>
              {restoring
                ? "The current saved workspace will become the previous workspace."
                : "Confirming will replace your saved workspace. Verso will keep a copy of the workspace you have now."}{" "}
              Unsaved recovery drafts are kept separately.
            </DialogDescription>
          </DialogHeader>
          {review.kind === "import" && (
            <p className="text-sm">
              Nothing is merged. Your guest workspace stays in this browser.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <WorkspaceSummary
              title="Current saved workspace"
              document={review.head.document}
            />
            <WorkspaceSummary
              title={restoring ? "Previous workspace" : "Incoming workspace"}
              filename={review.kind === "restore" ? undefined : review.filename}
              document={
                review.kind === "restore"
                  ? review.previous.document
                  : review.incoming
              }
            />
          </div>
          {discarded && (
            <div className="flex flex-col gap-2">
              <p className="text-sm">
                Replacing this workspace will discard the older retained
                workspace (revision {discarded.revision}).
              </p>
              {!exportChoice && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={saving || stale}
                    onClick={() => onDownload(discarded)}
                  >
                    Download previous workspace
                  </Button>
                  <Button
                    variant="outline"
                    disabled={saving || stale}
                    onClick={onContinue}
                  >
                    Continue without downloading
                  </Button>
                </div>
              )}
              {exportChoice === "downloaded" && (
                <p role="status" className="text-sm">
                  Download started.
                </p>
              )}
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              ref={cancel}
              variant="outline"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              disabled={saving || stale || exportRequired}
              onClick={onConfirm}
            >
              {restoring ? "Restore workspace" : "Replace workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
