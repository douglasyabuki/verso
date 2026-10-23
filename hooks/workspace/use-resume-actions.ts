"use client";

import { useRef, useState } from "react";

import type { useWorkspaceNavigation } from "@/hooks/workspace/use-workspace-navigation";
import type { WorkspaceController } from "@/stores/workspace/controller";
import type { ConfirmAction } from "@/types-and-constants/editor";
import type { ResumeColor, ResumeDocument } from "@/types-and-constants/resume";

type ResumeActionsOptions = {
  controller: WorkspaceController;
  navigation: ReturnType<typeof useWorkspaceNavigation>;
  confirm: ConfirmAction;
};

/** Share resume identity and deletion commands across navigation and collection.
 * @param options Workspace owner, navigation, and confirmation presenter.
 * @returns Dialog selection and guarded, undoable resume commands.
 * @example const actions = useResumeActions({ controller, navigation, confirm });
 */
export function useResumeActions({
  controller,
  navigation,
  confirm,
}: ResumeActionsOptions) {
  const [session, setSession] = useState<{
    id: string;
    document: ResumeDocument;
  } | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const snapshot = controller.getSnapshot();
  const blocked = snapshot.replacing || !!snapshot.pending;
  if (session && (blocked || session.document !== snapshot.document)) {
    setSession(null);
  }
  const editing = snapshot.document.variants.find(
    (resume) => resume.id === session?.id,
  );
  return {
    editing:
      blocked || session?.document !== snapshot.document ? undefined : editing,
    returnFocus,
    edit: (id: string, trigger: HTMLElement | null) => {
      if (!blocked) {
        returnFocus.current = trigger;
        setSession({ id, document: snapshot.document });
      }
    },
    close: () => setSession(null),
    save: (id: string, name: string, color: ResumeColor) => {
      const state = controller.getSnapshot();
      if (
        state.replacing ||
        state.pending ||
        state.document !== session?.document ||
        !name.trim() ||
        name.trim().length > 100
      )
        return;
      controller.edit((draft) => {
        const resume = draft.variants.find((item) => item.id === id);
        if (resume) {
          resume.name = name.trim();
          resume.color = color;
        }
      });
      setSession(null);
    },
    duplicate: (id: string) => {
      const state = controller.getSnapshot();
      const resume = state.document.variants.find((item) => item.id === id);
      if (!state.replacing && !state.pending && resume)
        navigation.createResume(resume);
    },
    remove: (id: string) => {
      if (blocked || snapshot.document.variants.length <= 1) return;
      const resume = snapshot.document.variants.find((item) => item.id === id);
      if (!resume) return;
      const requestedDocument = snapshot.document;
      confirm(
        `Delete ${resume.name || "this resume"}?`,
        "Its selections, customizations, reviews, and layout settings will be removed. Shared career content remains available.",
        () => {
          const state = controller.getSnapshot();
          if (
            state.replacing ||
            state.pending ||
            state.document !== requestedDocument
          )
            return;
          controller.edit((draft) => {
            if (draft.variants.length > 1)
              draft.variants = draft.variants.filter((item) => item.id !== id);
          });
        },
      );
    },
  };
}
