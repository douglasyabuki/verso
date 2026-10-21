"use client";

import { useContext, useSyncExternalStore } from "react";

import { WorkspaceContext } from "@/stores/workspace/provider";

/** Access tab-scoped document state and persistence commands.
 * @returns Observable state and its controller; throws outside WorkspaceProvider.
 * @example const { state, controller } = useWorkspace();
 */
export function useWorkspace() {
  const controller = useContext(WorkspaceContext);
  if (!controller) throw new Error("WorkspaceProvider is required");
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  return { state, controller };
}
