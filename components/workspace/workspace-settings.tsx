"use client";

import { cn } from "cn";

import { CompilerSettings } from "@/components/output/template-editor";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DisclosureChevron,
  DisclosureGuide,
  DisclosureLabel,
  disclosureTriggerClassName,
} from "@/components/ui/disclosure";
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
          className={cn(disclosureTriggerClassName, "min-h-8")}
        >
          <DisclosureChevron />
          <DisclosureLabel>Advanced PDF settings</DisclosureLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <DisclosureGuide>
            <CompilerSettings document={document} update={update} />
          </DisclosureGuide>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
