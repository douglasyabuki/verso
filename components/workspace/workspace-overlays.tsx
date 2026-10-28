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
                ? "This replaces your work in this tab only. It will not be saved in this browser and can be lost when you close the tab. Download a backup to keep it. The version already saved in this browser stays unchanged."
                : "This replaces your current work and the version saved in this browser shown below. If the saved version changes again, you must review it before replacing it."}{" "}
              You can restore one previous version while this tab stays open.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 text-sm">
            <p>
              Version to load:{" "}
              {pending?.snapshot.document.profile.name || "Untitled profile"} ·
              revision {pending?.snapshot.document.revision}
            </p>
            {!pending?.sessionOnly && (
              <p className="text-muted-foreground">
                Currently saved in this browser:{" "}
                {reviewed?.snapshot
                  ? `${reviewed.snapshot.document.profile.name || "Untitled profile"} · revision ${reviewed.snapshot.document.revision} · ${reviewed.savedAt}`
                  : reviewed?.error || "No work saved in this browser"}
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
                  Review saved version again
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
