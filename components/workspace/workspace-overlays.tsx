"use client";

import { useEffect, useRef } from "react";

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
import { operationDialog } from "@/lib/workspace/operations";
import type { Confirmation } from "@/types-and-constants/editor";

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
  const dialog = operationDialog(state);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (confirmation) returnFocus.current = confirmation.returnFocus ?? null;
  }, [confirmation]);
  return (
    <>
      <AlertDialog
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open) dismiss();
        }}
      >
        <AlertDialogContent
          finalFocus={() => {
            const trigger = returnFocus.current;
            if (!trigger) return undefined;
            return trigger.isConnected && !trigger.matches(":disabled")
              ? trigger
              : (globalThis.document.querySelector<HTMLElement>(
                  "[data-workspace-heading]",
                ) ?? undefined);
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={
                confirmation?.destructive === false ? "default" : "destructive"
              }
              onClick={() => {
                const action = confirmation?.action;
                dismiss();
                action?.();
              }}
            >
              {confirmation?.confirmLabel ?? "Confirm"}
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
            <AlertDialogTitle>{dialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {dialog?.messages.join(" ")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 text-sm">
            {!!dialog?.summary && (
              <p>
                {dialog?.summary}:{" "}
                {pending?.snapshot.document.profile.name || "Untitled profile"}{" "}
                · revision {pending?.snapshot.document.revision}
              </p>
            )}
            {!pending?.sessionOnly && (
              <p className="text-muted-foreground">
                Saved browser version:{" "}
                {reviewed?.snapshot
                  ? `${reviewed.snapshot.document.profile.name || "Untitled profile"} · revision ${reviewed.snapshot.document.revision} · ${reviewed.savedAt}`
                  : reviewed?.error || "No work saved in this browser"}
              </p>
            )}
            {pending?.kind === "clear" &&
              !controller.canClearData(pending.sessionOnly) && (
                <p role="status">There is no workspace data to clear.</p>
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
                  Review saved version again
                </Button>
              </>
            )}
            <Button
              variant="destructive"
              disabled={
                state.saving ||
                (pending?.kind === "clear" &&
                  !controller.canClearData(pending.sessionOnly)) ||
                (!pending?.sessionOnly &&
                  !!state.conflict &&
                  state.conflict.raw !== pending?.review?.raw)
              }
              onClick={() => void controller.confirmReplacement()}
            >
              {state.saving
                ? pending?.kind === "clear"
                  ? "Clearing data…"
                  : "Saving…"
                : dialog?.confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
