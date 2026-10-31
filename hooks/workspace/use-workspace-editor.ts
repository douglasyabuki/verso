"use client";

import { useWorkspaceOutput } from "@/contexts/workspace-output";
import { useWorkspaceWorkflow } from "@/contexts/workspace-workflow";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
import type { CareerTarget } from "@/types-and-constants/resume";

/** Derive editor inputs from their existing store, workflow and output owners.
 * @returns Current editor data and commands, without owning state.
 * @example const { document, navigation, validation } = useWorkspaceEditor();
 */
export function useWorkspaceEditor() {
  const { state, controller } = useWorkspace();
  const { document } = state;
  const {
    navigation,
    actions,
    issues,
    view: workspaceView,
  } = useWorkspaceWorkflow();
  const { editorValidation: validation } = useWorkspaceOutput();
  const { view, activeSectionId: sectionId, variant } = navigation;
  const summary = navigation.destination.kind === "career-summary";
  const career =
    summary ||
    navigation.destination.kind === "career-profile" ||
    navigation.destination.kind === "career-section";
  const careerTarget: CareerTarget | undefined =
    navigation.destination.kind === "career-section"
      ? { kind: "section", sectionId: navigation.destination.sectionId }
      : summary
        ? { kind: "summary" }
        : navigation.destination.kind === "career-profile"
          ? { kind: "profile" }
          : undefined;
  const section =
    navigation.destination.kind === "career-section"
      ? document.sections.find((item) => item.id === sectionId)
      : undefined;

  return {
    document,
    view,
    sectionId,
    locale: workspaceView.editorLocale,
    variant,
    update: controller.edit,
    confirm: actions.confirm,
    validation,
    disabled: workspaceView.blocked,
    issueNavigation: issues.current,
    onIssueFocused: issues.onIssueFocused,
    onOpen: issues.onIssue,
    navigation,
    onOwner: issues.onOwner,
    resumeActions: actions.resume,
    careerActions: actions.career,
    summary,
    career,
    careerTarget,
    section,
  };
}
