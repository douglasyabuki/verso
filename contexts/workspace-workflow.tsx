"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

import { WorkflowLinksContext } from "@/contexts/workflow-links";
import { useCareerActions } from "@/hooks/workspace/use-career-actions";
import { useResumeActions } from "@/hooks/workspace/use-resume-actions";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
import { useWorkspaceHistory } from "@/hooks/workspace/use-workspace-history";
import { useWorkspaceIssueNavigation } from "@/hooks/workspace/use-workspace-issue-navigation";
import { useWorkspaceNavigation } from "@/hooks/workspace/use-workspace-navigation";
import type { ConfirmAction, Confirmation } from "@/types-and-constants/editor";

/** Compose workflow owners and transient confirmations without copying navigation state.
 * @returns Provider value for the current mounted workspace.
 * @example const workflow = useWorkflowState();
 */
function useWorkflowState() {
  const { state, controller } = useWorkspace();
  const blocked = state.replacing || !!state.pending;
  const navigation = useWorkspaceNavigation({
    document: state.document,
    controller,
    blocked,
  });
  const shortcuts = useWorkspaceHistory();
  const issues = useWorkspaceIssueNavigation({ navigation });
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const confirm: ConfirmAction = (
    title,
    description,
    action,
    returnFocus,
    destructive,
  ) =>
    setConfirmation({ title, description, action, returnFocus, destructive });
  const resume = useResumeActions({ controller, navigation, confirm });
  const career = useCareerActions({
    controller,
    navigation,
    confirm,
    onChanged: issues.clear,
  });
  const fullWidth = ["career-overview", "resumes", "review", "data"].includes(
    navigation.view,
  );
  const careerDestination = [
    "career-section",
    "career-summary",
    "career-profile",
  ].includes(navigation.destination.kind);
  return {
    navigation,
    selection: {
      setVariantId: issues.setVariantId,
      setLocale: issues.setLocale,
    },
    actions: { resume, career, confirm },
    issues,
    dialogs: { confirmation, dismiss: () => setConfirmation(undefined) },
    view: {
      blocked,
      fullWidth,
      resumeWorkspace: navigation.destination.kind === "resume",
      editorLocale: careerDestination
        ? navigation.careerLocale
        : navigation.locale,
    },
    shortcuts,
  };
}

const WorkspaceWorkflowContext = createContext<ReturnType<
  typeof useWorkflowState
> | null>(null);

/** Coordinate mounted workspace workflows while navigation retains its state.
 * @param props Children mounted after document readiness.
 * @returns Workflow and narrow owner-link providers, without presentation.
 * @example <WorkspaceWorkflowProvider><WorkspaceView /></WorkspaceWorkflowProvider>
 */
export function WorkspaceWorkflowProvider({
  children,
}: {
  children: ReactNode;
}) {
  const workflow = useWorkflowState();
  return (
    <WorkspaceWorkflowContext.Provider value={workflow}>
      <WorkflowLinksContext.Provider
        value={{ editCareer: workflow.issues.editCareer }}
      >
        {children}
      </WorkflowLinksContext.Provider>
    </WorkspaceWorkflowContext.Provider>
  );
}

/** Access workflow coordination without duplicating store or navigation state.
 * @returns Workflow groups; throws outside WorkspaceWorkflowProvider.
 * @example const { navigation, actions } = useWorkspaceWorkflow();
 */
export function useWorkspaceWorkflow() {
  const workflow = useContext(WorkspaceWorkflowContext);
  if (!workflow) throw new Error("WorkspaceWorkflowProvider is required");
  return workflow;
}
