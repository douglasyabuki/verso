"use client";

import type { useWorkspaceNavigation } from "@/hooks/workspace/use-workspace-navigation";
import {
  clearCareerContent,
  deleteCareerSection,
  hasCareerContent,
} from "@/lib/content/career";
import { plain } from "@/lib/wording/localization";
import type { WorkspaceController } from "@/stores/workspace/controller";
import type { ConfirmAction } from "@/types-and-constants/editor";
import type { CareerTarget } from "@/types-and-constants/resume";

type CareerActionsOptions = {
  controller: WorkspaceController;
  navigation: ReturnType<typeof useWorkspaceNavigation>;
  confirm: ConfirmAction;
  onChanged: () => void;
};

/** Coordinate confirmed career edits shared by navigation and editor headers.
 * @param options Workspace controller, navigation, confirmation presenter, and stale issue cleanup.
 * @returns Guarded clear/delete commands and content availability for each target.
 * @example const actions = useCareerActions({ controller, navigation, confirm, onChanged });
 */
export function useCareerActions({
  controller,
  navigation,
  confirm,
  onChanged,
}: CareerActionsOptions) {
  const resetContext = (target: CareerTarget) => {
    const key = target.kind === "section" ? target.sectionId : "profile";
    navigation.setCareerContexts((current) => {
      const next = { ...current };
      if (target.kind === "section") delete next[key];
      return next;
    });
    navigation.setScopedReviews((current) => {
      const next = { ...current };
      if (target.kind !== "profile") delete next[key];
      return next;
    });
    navigation.setReviewContext(null);
    onChanged();
  };

  const request = (
    target: CareerTarget,
    deleting: boolean,
    returnFocus?: HTMLElement | null,
  ) => {
    const initial = controller.getSnapshot();
    if (
      initial.replacing ||
      initial.pending ||
      !controller.commitEditorDrafts()
    )
      return;
    const requested = controller.getSnapshot().document;
    const section =
      target.kind === "section"
        ? requested.sections.find((item) => item.id === target.sectionId)
        : undefined;
    if (target.kind === "section" && !section) return;
    if (
      deleting
        ? section?.kind !== "custom"
        : !hasCareerContent(requested, target)
    )
      return;
    const name = section
      ? plain(section.heading, "en-US").trim() || "Untitled section"
      : target.kind === "profile"
        ? "Profile"
        : "Summary";
    const description = deleting
      ? "All entries, achievements, and references to this section will be removed from every resume."
      : target.kind === "profile"
        ? "All shared contact details and links will be cleared from every resume. Your summary stays unchanged."
        : target.kind === "summary"
          ? "Shared summary text in both languages will be cleared. Resumes using shared wording will update; resume-specific summary customizations will be kept."
          : "All entries, including archived entries, achievements, and links will be removed from this section and every resume using them. The section and its heading will be kept.";
    confirm(
      deleting ? `Delete ${name}?` : `Clear ${name} content?`,
      `${description} You can undo this action.`,
      () => {
        const state = controller.getSnapshot();
        if (state.replacing || state.pending || state.document !== requested)
          return;
        if (
          !controller.commitEditorDrafts() ||
          controller.getSnapshot().document !== requested
        )
          return;
        controller.edit((draft) => {
          if (deleting && target.kind === "section")
            deleteCareerSection(draft, target.sectionId);
          else clearCareerContent(draft, target);
        });
        resetContext(target);
        if (
          deleting &&
          target.kind === "section" &&
          navigation.destination.kind === "career-section" &&
          navigation.destination.sectionId === target.sectionId
        )
          navigation.open({ kind: "career-overview" });
      },
      returnFocus,
    );
  };

  return {
    canClear: (target: CareerTarget) => {
      const state = controller.getSnapshot();
      return (
        !state.replacing &&
        !state.pending &&
        hasCareerContent(state.document, target)
      );
    },
    clear: (target: CareerTarget, returnFocus?: HTMLElement | null) =>
      request(target, false, returnFocus),
    remove: (sectionId: string, returnFocus?: HTMLElement | null) =>
      request({ kind: "section", sectionId }, true, returnFocus),
  };
}
