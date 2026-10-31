"use client";

import { CareerOverview } from "@/components/content/career-overview";
import { ProfileEditor } from "@/components/content/profile-editor";
import { SettingsEditor } from "@/components/output/template-editor";
import { Button } from "@/components/ui/button";
import { ResumeCollection } from "@/components/variants/resume-collection";
import { VariantsEditor } from "@/components/variants/variants-editor";
import { CareerEditor } from "@/components/workspace/career-editor";
import { EditorReviewContent } from "@/components/workspace/editor-review-content";
import { WorkspaceSettings } from "@/components/workspace/workspace-settings";
import type { useEditorReview } from "@/hooks/workspace/use-editor-review";
import { useWorkspaceEditor } from "@/hooks/workspace/use-workspace-editor";

/** Select the existing domain editor for the current workspace destination. */
export function EditorDestinationContent({
  review,
}: {
  review: ReturnType<typeof useEditorReview>;
}) {
  const {
    navigation,
    view,
    document,
    resumeActions,
    update,
    confirm,
    validation,
    variant,
    locale,
    issueNavigation,
    onOpen,
  } = useWorkspaceEditor();
  const reviewEditor = <EditorReviewContent review={review} />;
  return (
    <>
      {(navigation.destination.kind === "career-section" ||
        navigation.destination.kind === "career-summary") && (
        <CareerEditor review={review} reviewEditor={reviewEditor} />
      )}
      {view === "career-overview" && (
        <CareerOverview
          document={document}
          open={navigation.open}
          onReview={review.openReview}
        />
      )}
      {view === "resumes" && (
        <ResumeCollection
          document={document}
          actions={resumeActions}
          onOpen={(id) =>
            navigation.open({ kind: "resume", resumeId: id, page: "content" })
          }
          onCreate={navigation.createResume}
        />
      )}
      {view === "data" && <WorkspaceSettings />}
      {view === "template" && (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => {
            navigation.open({ kind: "shared-defaults" }, true);
            navigation.setReturnDestination(navigation.destination);
          }}
        >
          Edit default layout
        </Button>
      )}
      {view === "profile" && (
        <ProfileEditor
          document={document}
          update={update}
          confirm={confirm}
          errors={validation.errors}
        />
      )}
      {["review", "resume-translations"].includes(view) && reviewEditor}
      {view === "variants" && (
        <VariantsEditor
          key={`${variant.id}:${issueNavigation?.id ?? ""}`}
          onOpen={onOpen}
          issueNavigation={issueNavigation}
          errors={validation.errors}
          document={document}
          locale={locale}
          variant={variant}
          update={update}
          confirm={confirm}
        />
      )}
      {(view === "template" || view === "shared-defaults") && (
        <SettingsEditor
          key={`${view}:${variant.id}:${issueNavigation?.id ?? ""}`}
          sharedDefaults={view === "shared-defaults"}
          initialScope={
            view === "shared-defaults"
              ? "base"
              : issueNavigation?.issue.target?.variantId
                ? "variant-locale"
                : "variant"
          }
          document={document}
          locale={locale}
          variant={variant}
          update={update}
        />
      )}
    </>
  );
}
