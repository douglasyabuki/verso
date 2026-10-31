"use client";

import { ListChecks, Pencil } from "lucide-react";
import type { ReactNode } from "react";

import { ContentEditor } from "@/components/content/content-editor";
import { SummaryEditor } from "@/components/content/summary-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { useEditorReview } from "@/hooks/workspace/use-editor-review";
import { useWorkspaceEditor } from "@/hooks/workspace/use-workspace-editor";

/** Render career edit/review tabs using the editor-owned review coordinator. */
export function CareerEditor({
  review,
  reviewEditor,
}: {
  review: ReturnType<typeof useEditorReview>;
  reviewEditor: ReactNode;
}) {
  const {
    navigation,
    disabled,
    view,
    document,
    locale,
    update,
    validation,
    sectionId,
    issueNavigation,
    confirm,
  } = useWorkspaceEditor();
  if (
    navigation.destination.kind !== "career-section" &&
    navigation.destination.kind !== "career-summary"
  )
    return null;
  return (
    <Tabs
      value={navigation.destination.tab}
      onValueChange={review.changeTab}
      className="min-w-0 gap-6"
    >
      <div className="max-w-full overflow-x-auto px-1 pt-1 pb-2">
        <TabsList variant="line" aria-label="Career details section tab">
          <TabsTrigger value="edit" disabled={disabled}>
            <Pencil data-icon="inline-start" />
            Edit content
          </TabsTrigger>
          <TabsTrigger value="review" disabled={disabled}>
            <ListChecks data-icon="inline-start" />
            Text to review
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="edit" className="min-w-0">
        {view === "summary" && (
          <SummaryEditor
            document={document}
            locale={locale}
            update={update}
            errors={validation.errors}
          />
        )}
        {view === "content" && (
          <ContentEditor
            key={`${sectionId}:${issueNavigation?.id ?? ""}`}
            context={
              navigation.careerContexts[sectionId] ?? {
                entryId: issueNavigation?.issue.target?.entryId ?? "",
                query: "",
                showArchived: !!issueNavigation?.issue.target?.entryId,
              }
            }
            onContext={(context) =>
              navigation.setCareerContexts((current) => ({
                ...current,
                [sectionId]: context,
              }))
            }
            issueTarget={
              issueNavigation?.pending
                ? issueNavigation.issue.target
                : undefined
            }
            document={document}
            locale={locale}
            update={update}
            confirm={confirm}
            sectionId={sectionId}
            errors={validation.errors}
          />
        )}
      </TabsContent>
      <TabsContent value="review" className="min-w-0">
        {reviewEditor}
      </TabsContent>
    </Tabs>
  );
}
