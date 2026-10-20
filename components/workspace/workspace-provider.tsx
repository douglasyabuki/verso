"use client";

import {
  createContext,
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { WorkspaceController } from "@/lib/workspace/controller";

export const WorkspaceContext = createContext<WorkspaceController | null>(null);

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
      {state.ready ? (
        children
      ) : (
        <div
          className="flex h-dvh items-center justify-center text-sm text-muted-foreground"
          role="status"
        >
          Opening your workspace…
        </div>
      )}
    </WorkspaceContext.Provider>
  );
}
