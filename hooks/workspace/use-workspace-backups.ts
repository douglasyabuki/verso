"use client";

import { useRef } from "react";

import { downloadFile, fileSlug } from "@/lib/output/files";
import { parseBackup, serializeBackup } from "@/lib/workspace/backup";
import { semanticallyEqual } from "@/lib/workspace/semantic";
import type { WorkspaceController } from "@/stores/workspace/controller";
import { fingerprint } from "@/stores/workspace/persistence";
import type { ResumeDocument } from "@/types-and-constants/resume";

type WorkspaceBackupsOptions = {
  document: ResumeDocument;
  controller: WorkspaceController;
};

/** Coordinate validated JSON downloads and staged workspace imports.
 * @param options Current document snapshot and its replacement/backup commands.
 * @returns File input ref, picker action, export action and async import action; import errors leave the workspace unchanged.
 * @example const backups = useWorkspaceBackups({ document, controller });
 */
export function useWorkspaceBackups({
  document,
  controller,
}: WorkspaceBackupsOptions) {
  const input = useRef<HTMLInputElement>(null);
  const exportJson = () => {
    if (
      controller.getSnapshot().pending ||
      controller.getSnapshot().replacing ||
      controller.getSnapshot().saving
    )
      return;
    try {
      const snapshot = document;
      const serialized = serializeBackup(snapshot);
      parseBackup(serialized);
      downloadFile(
        serialized,
        `${fileSlug(snapshot.profile.name)}-workspace-r${snapshot.revision}.json`,
        "application/json",
      );
      void controller.markBackup(snapshot);
      controller.notify(
        "Backup download started",
        "The JSON includes your editable career details, resumes, and workspace settings.",
      );
    } catch (error) {
      controller.notify(
        "Backup download could not start",
        (error as Error).message,
      );
    }
  };
  const importJson = async (file?: File) => {
    if (
      !file ||
      controller.getSnapshot().pending ||
      controller.getSnapshot().replacing
    )
      return;
    const generation = controller.getGeneration();
    try {
      if (!file.name.toLowerCase().endsWith(".json") || file.size > 5_000_000)
        throw new Error("Choose a JSON backup no larger than 5 MB.");
      const document = parseBackup(await file.text());
      if (generation !== controller.getGeneration()) return;
      const current = controller.getSnapshot().document;
      if (semanticallyEqual(current, document)) {
        await controller.markBackup(current, "matching-import");
        return;
      }
      const backupFingerprint = await fingerprint(document);
      if (generation !== controller.getGeneration()) return;
      controller.requestReplacement("import", {
        document,
        backupFingerprint,
      });
    } catch (error) {
      if (generation === controller.getGeneration())
        controller.notify(
          "Backup could not be restored",
          `${(error as Error).message} Your workspace has not changed.`,
        );
    } finally {
      if (input.current) input.current.value = "";
    }
  };
  return {
    input,
    exportJson,
    importJson,
    requestImport: () => input.current?.click(),
  };
}
