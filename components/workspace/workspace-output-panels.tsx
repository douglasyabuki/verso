"use client";

import { PreviewPane } from "@/components/output/preview-pane";
import { IssuesPanel } from "@/components/review/issues-panel";
import { Button } from "@/components/ui/button";
import { useWorkspaceOutput } from "@/contexts/workspace-output";
import { useWorkspaceWorkflow } from "@/contexts/workspace-workflow";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
import { languageNames } from "@/types-and-constants/languages";

/** Render the selected output without owning or remounting the compiler. */
export function WorkspacePreview() {
  const {
    navigation,
    issues: { setIssuesOpen },
    view: { resumeWorkspace },
  } = useWorkspaceWorkflow();
  const { variant, locale } = navigation;
  const {
    compiler,
    validation,
    busy,
    sync: { autoSync, setAutoSync },
  } = useWorkspaceOutput();
  return (
    <div className="flex h-full min-h-0 flex-col">
      {!resumeWorkspace && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b p-2">
          <span className="text-xs text-muted-foreground">
            Previewing {variant.name || "Untitled resume"} ·{" "}
            {languageNames[locale]}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              navigation.open({
                kind: "resume",
                resumeId: variant.id,
                page: "content",
              })
            }
          >
            Open resume
          </Button>
        </div>
      )}
      <PreviewPane
        compiler={compiler}
        validation={validation}
        autoSync={autoSync}
        setAutoSync={setAutoSync}
        busy={busy}
        locale={locale}
        onIssues={() => setIssuesOpen(true)}
      />
    </div>
  );
}

/** Render output issues with shared issue navigation and panel visibility. */
export function WorkspaceIssues() {
  const {
    state: { document },
  } = useWorkspace();
  const {
    navigation: { variant },
    issues: { issuesOpen, setIssuesOpen, onIssue },
    view: { blocked, fullWidth },
  } = useWorkspaceWorkflow();
  const { validations, compiler } = useWorkspaceOutput();
  if (fullWidth) return null;
  return (
    <IssuesPanel
      document={document}
      variant={variant}
      validation={validations}
      compiler={compiler}
      open={issuesOpen}
      setOpen={setIssuesOpen}
      onIssue={onIssue}
      disabled={blocked}
    />
  );
}
