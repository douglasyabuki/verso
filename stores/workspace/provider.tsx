"use client";

import {
  createContext,
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { WorkspaceController } from "@/stores/workspace/controller";

export const WorkspaceContext = createContext<WorkspaceController | null>(null);

/** Own one tab-scoped controller and register its lifecycle listeners.
 * @param props Children consuming the workspace context.
 * @returns Context provider; readiness presentation belongs to its children.
 * @example <WorkspaceProvider><WorkspaceView /></WorkspaceProvider>
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() => new WorkspaceController());
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  useEffect(() => controller.start(), [controller]);
  useEffect(() => {
    if (!state.ready) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (
        !controller.isUnsaved() &&
        !state.sessionOnly &&
        !state.error &&
        !state.conflict
      )
        return;
      event.preventDefault();
      event.returnValue = "";
    };
    const flush = () => {
      if (document.visibilityState === "hidden") void controller.flush();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [controller, state.ready, state.sessionOnly, state.error, state.conflict]);

  return (
    <WorkspaceContext.Provider value={controller}>
      {children}
    </WorkspaceContext.Provider>
  );
}
