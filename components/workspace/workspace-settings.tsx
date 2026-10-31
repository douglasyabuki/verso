"use client";

import { ChevronRight } from "lucide-react";

import { CompilerSettings } from "@/components/output/template-editor";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { InfoHint } from "@/components/ui/info-hint";
import { WorkspaceBackupControls } from "@/components/workspace/workspace-backup-controls";
import { useWorkspaceEditor } from "@/hooks/workspace/use-workspace-editor";

/** Render inline backups and advanced compiler settings using their existing owners. */
export function WorkspaceSettings() {
  const { document, update } = useWorkspaceEditor();
  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium">
        Backups
        <InfoHint label="editable backups">
          A backup (JSON) includes all editable career details, resumes, and
          settings. PDF and LaTeX downloads cannot restore your editable work
          and do not count as backups.
        </InfoHint>
      </div>
      <WorkspaceBackupControls inline />
      <Collapsible>
        <CollapsibleTrigger
          render={<Button variant="outline" />}
          className="group"
        >
          <ChevronRight
            data-icon="inline-start"
            className="transition-transform duration-200 group-data-panel-open:rotate-90 motion-reduce:transition-none"
          />
          Advanced PDF settings
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-4">
            <CompilerSettings document={document} update={update} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
