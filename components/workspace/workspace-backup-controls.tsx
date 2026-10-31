"use client";

import { Input } from "@/components/ui/input";
import { WorkspaceDataMenu } from "@/components/workspace/workspace-data-menu";
import { useWorkspaceBackupControls } from "@/contexts/workspace-backups";

/** Render menu or inline controls using the single persistent backup owner. */
export function WorkspaceBackupControls({
  inline = false,
}: {
  inline?: boolean;
}) {
  const { menu } = useWorkspaceBackupControls();
  return <WorkspaceDataMenu inline={inline} {...menu} />;
}

/** Render the shared backup import input; mount exactly once in WorkspaceView. */
export function WorkspaceBackupImportInput() {
  const { input, importJson } = useWorkspaceBackupControls();
  return (
    <Input
      ref={input}
      type="file"
      accept=".json,application/json"
      className="hidden"
      aria-label="Restore from a JSON backup"
      onChange={(event) => void importJson(event.target.files?.[0])}
    />
  );
}
