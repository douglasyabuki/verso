"use client";

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
import { useWorkspace } from "@/hooks/workspace/use-workspace";

export type Confirmation = {
  title: string;
  description: string;
  action: () => void;
};

export function WorkspaceOverlays({
  confirmation,
  dismiss,
}: {
  confirmation?: Confirmation;
  dismiss: () => void;
}) {
  const { state, controller } = useWorkspace();
  const pending = state.pending;
  const reviewed = pending?.review;
  return (
    <>
      <AlertDialog
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open) dismiss();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const action = confirmation?.action;
                dismiss();
                action?.();
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !state.saving) controller.cancelReplacement();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.sessionOnly
                ? "This replaces only the workspace in this tab. The result remains unsaved. Existing browser data will not be changed. Export JSON to keep it."
                : "This replaces the current workspace and the stored version reviewed below, only if that version has not changed again."}{" "}
              One previous workspace will remain recoverable during this
              session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 text-sm">
            <p>
              Candidate:{" "}
              {pending?.snapshot.document.profile.name || "Untitled profile"} ·
              revision {pending?.snapshot.document.revision}
            </p>
            {!pending?.sessionOnly && (
              <p className="text-muted-foreground">
                Reviewed storage:{" "}
                {reviewed?.snapshot
                  ? `${reviewed.snapshot.document.profile.name || "Untitled profile"} · revision ${reviewed.snapshot.document.revision} · ${reviewed.savedAt}`
                  : reviewed?.error || "No stored workspace"}
              </p>
            )}
            {state.error && (
              <p role="alert" className="text-destructive">
                {state.error}
              </p>
            )}
          </div>
          <AlertDialogFooter className="flex-wrap">
            <AlertDialogCancel disabled={state.saving}>
              Cancel
            </AlertDialogCancel>
            {!pending?.sessionOnly && state.error && (
              <>
                <Button
                  variant="outline"
                  disabled={state.saving}
                  onClick={controller.useInThisTab}
                >
                  Use in this tab only…
                </Button>
                <Button
                  variant="outline"
                  disabled={state.saving}
                  onClick={controller.reviewOverwrite}
                >
                  Review stored version again
                </Button>
              </>
            )}
            <Button
              disabled={state.saving}
              onClick={() => void controller.confirmReplacement()}
            >
              {state.saving
                ? "Saving…"
                : pending?.sessionOnly
                  ? "Replace in this tab"
                  : "Confirm replacement"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
