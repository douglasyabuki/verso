"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceView } from "@/components/workspace/workspace-view";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
import { WorkspaceProvider } from "@/stores/workspace/provider";

export function Workspace() {
  return (
    <WorkspaceProvider>
      <WorkspaceReady />
    </WorkspaceProvider>
  );
}

function WorkspaceReady() {
  const { state } = useWorkspace();
  if (!state.ready) {
    return (
      <div
        className="flex h-dvh items-center justify-center text-sm text-muted-foreground"
        role="status"
      >
        Opening your workspace?
      </div>
    );
  }
  return (
    <TooltipProvider>
      <WorkspaceView />
    </TooltipProvider>
  );
}
