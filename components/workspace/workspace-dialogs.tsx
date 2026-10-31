"use client";

import { ResumeIdentityDialog } from "@/components/variants/resume-identity-dialog";
import { WorkspaceOverlays } from "@/components/workspace/workspace-overlays";
import { useWorkspaceWorkflow } from "@/contexts/workspace-workflow";

/** Render workflow dialogs while their actions and confirmation state remain shared. */
export function WorkspaceDialogs() {
  const {
    actions: { resume: resumeActions },
    dialogs: { confirmation, dismiss },
  } = useWorkspaceWorkflow();
  return (
    <>
      {resumeActions.editing && (
        <ResumeIdentityDialog
          key={resumeActions.editing.id}
          resume={resumeActions.editing}
          close={resumeActions.close}
          returnFocus={resumeActions.returnFocus}
          save={resumeActions.save}
        />
      )}
      <WorkspaceOverlays confirmation={confirmation} dismiss={dismiss} />
    </>
  );
}
