"use client";

import { useRef } from "react";

import { toast } from "@/components/ui/toast";
import { downloadFile, fileSlug } from "@/lib/output/files";
import { parseBackup, serializeBackup } from "@/lib/workspace/backup";
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
      toast.add({
        type: "success",
        title: "Download started",
        description:
          "Your backup download started. It includes all editable career details, resumes, and settings. Saving in this browser is tracked separately.",
      });
    } catch (error) {
      toast.add({
        type: "error",
        title: "Action could not finish",
        description: (error as Error).message,
      });
    }
  };
  const importJson = async (file?: File) => {
    if (!file) return;
    try {
      if (!file.name.toLowerCase().endsWith(".json") || file.size > 5_000_000)
        throw new Error("Choose a JSON backup no larger than 5 MB.");
      const document = parseBackup(await file.text());
      const backupFingerprint = await fingerprint(document);
      controller.requestReplacement("Restore from backup?", {
        document,
        backupFingerprint,
      });
    } catch (error) {
      toast.add({
        type: "error",
        title: "Action could not finish",
        description: (error as Error).message,
      });
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
