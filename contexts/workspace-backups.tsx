"use client";

import { createContext, type ReactNode, useContext } from "react";

import { useWorkspace } from "@/hooks/workspace/use-workspace";
import { useWorkspaceBackups } from "@/hooks/workspace/use-workspace-backups";
import { createExampleDocument } from "@/lib/resume/example";

/** Own one backup hook and derive the controls shared by every backup presentation.
 * @returns Provider value for the current mounted workspace.
 * @example const backups = useBackupControls();
 */
function useBackupControls() {
  const { state, controller } = useWorkspace();
  const { document } = state;
  const { input, exportJson, importJson, requestImport } = useWorkspaceBackups({
    document,
    controller,
  });
  const backupStatus = !state.backupFingerprint
    ? "No JSON backup recorded"
    : !state.currentFingerprint
      ? "Checking JSON backup status…"
      : state.currentFingerprint !== state.backupFingerprint
        ? "JSON backup is out of date"
        : "JSON backup is up to date";

  return {
    input,
    importJson,
    menu: {
      backupStatus,
      disabled: state.saving,
      importJson: requestImport,
      exportJson,
      example: () =>
        controller.requestReplacement("Load fictional example?", {
          document: createExampleDocument(),
          backupFingerprint: null,
        }),
      recover: state.recovery
        ? () =>
            controller.requestReplacement(
              "Restore previous work?",
              state.recovery!,
            )
        : undefined,
      resume: controller.reviewOverwrite,
    },
  };
}

const WorkspaceBackupsContext = createContext<ReturnType<
  typeof useBackupControls
> | null>(null);

/** Own backup actions and one input ref above every menu and inline presentation.
 * @param props Persistent workspace children after readiness.
 * @returns Shared backup provider; the import input is rendered separately once.
 * @example <WorkspaceBackupsProvider><WorkspaceView /></WorkspaceBackupsProvider>
 */
export function WorkspaceBackupsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const backups = useBackupControls();
  return (
    <WorkspaceBackupsContext.Provider value={backups}>
      {children}
    </WorkspaceBackupsContext.Provider>
  );
}

/** Access the persistent backup owner from any backup presentation.
 * @returns Shared actions, input ref and status; throws without WorkspaceBackupsProvider.
 * @example const { menu } = useWorkspaceBackupControls();
 */
export function useWorkspaceBackupControls() {
  const backups = useContext(WorkspaceBackupsContext);
  if (!backups) throw new Error("WorkspaceBackupsProvider is required");
  return backups;
}
