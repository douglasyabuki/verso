"use client";

import { cn } from "cn";

import { FieldSet } from "@/components/ui/field";
import { EditorDestinationContent } from "@/components/workspace/editor-destination-content";
import { EditorHeader } from "@/components/workspace/editor-header";
import { EditorReturnNavigation } from "@/components/workspace/editor-return-navigation";
import { useIssueFocus } from "@/hooks/review/use-issue-focus";
import { useEditorReview } from "@/hooks/workspace/use-editor-review";
import { useWorkspaceEditor } from "@/hooks/workspace/use-workspace-editor";

export function EditorPane() {
  const editor = useWorkspaceEditor();
  const { view, disabled, issueNavigation, onIssueFocused } = editor;
  const review = useEditorReview(editor);
  const { reviewContext, changeReviewContext } = review;
  useIssueFocus({
    navigation: issueNavigation,
    disabled,
    onFocused: onIssueFocused,
  });
  return (
    <div
      className={cn(
        "@container h-full overflow-auto p-4 sm:p-6",
        ["career-overview", "resumes", "review", "data"].includes(view) &&
          "md:p-8 xl:p-10",
      )}
      data-workspace-scroll
      onScroll={(event) => {
        if (
          event.target === event.currentTarget &&
          ["review", "career-translations", "resume-translations"].includes(
            view,
          ) &&
          event.currentTarget.scrollTop !== reviewContext.pageScroll
        )
          changeReviewContext({
            ...reviewContext,
            pageScroll: event.currentTarget.scrollTop,
          });
      }}
    >
      <FieldSet
        disabled={disabled}
        className={cn(
          "mx-auto flex min-w-0 flex-col gap-6 disabled:opacity-70",
          ["career-overview", "resumes", "review", "data"].includes(view)
            ? "max-w-5xl"
            : ["career-translations", "resume-translations"].includes(view)
              ? "max-w-5xl"
              : "max-w-3xl",
        )}
      >
        <EditorHeader />
        <EditorReturnNavigation />
        <EditorDestinationContent review={review} />
      </FieldSet>
    </div>
  );
}
