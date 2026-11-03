"use client";

import type { ComponentProps } from "react";

import { WorkspaceToolbarView } from "@/components/workspace/workspace-toolbar-view";
import { useWorkspace } from "@/hooks/workspace/use-workspace";

export function WorkspaceSaveStatus({ className }: { className?: string }) {
  const { state, controller } = useWorkspace();
  const status =
    state.saving && state.pending?.kind === "clear"
      ? "Clearing data…"
      : state.saving
        ? "Saving…"
        : state.pending
          ? "Awaiting confirmation"
          : state.sessionOnly
            ? "This tab only"
            : state.error || state.conflict
              ? "Saving paused"
              : controller.isUnsaved()
                ? "Saving…"
                : "Saved in this browser";

  return (
    <span className={className} role="status">
      {status}
    </span>
  );
}

export function WorkspaceToolbar(
  props: Omit<
    ComponentProps<typeof WorkspaceToolbarView>,
    "history" | "status"
  >,
) {
  const { state, controller } = useWorkspace();
  return (
    <WorkspaceToolbarView
      {...props}
      history={{
        canUndo: state.canUndo,
        canRedo: state.canRedo,
        undo: controller.undo,
        redo: controller.redo,
      }}
      status={<WorkspaceSaveStatus className="text-xs text-muted-foreground" />}
    />
  );
}
