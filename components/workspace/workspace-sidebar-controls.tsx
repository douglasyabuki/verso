"use client";

import { WorkspaceBackupControls } from "@/components/workspace/workspace-backup-controls";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { AppearanceControl } from "@/components/workspace/workspace-utility-rail";
import { useWorkspaceWorkflow } from "@/contexts/workspace-workflow";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
import { reviewItems } from "@/lib/review/review-queue";

/** Connect sidebar presentation to navigation, career/resume actions, and shared backups. */
export function WorkspaceSidebarControls() {
  const { state } = useWorkspace();
  const { document } = state;
  const {
    navigation,
    actions: { resume: resumeActions, career: careerActions },
    issues,
  } = useWorkspaceWorkflow();
  const { variant, addSection: createSection } = navigation;
  const reviewCount = reviewItems(document).length;
  const dataMenu = <WorkspaceBackupControls />;
  return (
    <WorkspaceSidebar
      actions={resumeActions}
      careerActions={careerActions}
      blocked={state.replacing || !!state.pending}
      document={document}
      destination={navigation.destination}
      open={(destination) => {
        issues.clear();
        navigation.open(destination);
      }}
      resumeId={variant.id}
      createResume={navigation.createResume}
      addSection={() => {
        issues.cancelFocus();
        createSection();
      }}
      reviewCount={reviewCount}
      utilities={
        <div className="flex items-center gap-2">
          {dataMenu}
          <AppearanceControl />
          <span className="text-xs text-muted-foreground">
            Data & appearance
          </span>
        </div>
      }
    />
  );
}
