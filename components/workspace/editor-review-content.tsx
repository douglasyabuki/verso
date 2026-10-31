"use client";

import { TranslationsEditor } from "@/components/wording/translations-editor";
import type { useEditorReview } from "@/hooks/workspace/use-editor-review";
import { useWorkspaceEditor } from "@/hooks/workspace/use-workspace-editor";

/** Connect translation review presentation to the editor-derived review context. */
export function EditorReviewContent({
  review,
}: {
  review: ReturnType<typeof useEditorReview>;
}) {
  const {
    document,
    update,
    variant,
    confirm,
    view,
    sectionId,
    onOwner,
    navigation,
  } = useWorkspaceEditor();
  const { reviewContext, changeReviewContext } = review;
  return (
    <TranslationsEditor
      document={document}
      update={update}
      variant={variant}
      confirm={confirm}
      scope={
        view === "review"
          ? "queue"
          : view === "career-translations"
            ? "career"
            : "resume"
      }
      sectionId={sectionId}
      context={reviewContext}
      onContext={changeReviewContext}
      onOwner={onOwner}
      queueContext={
        view !== "review" ? (navigation.reviewContext ?? undefined) : undefined
      }
    />
  );
}
