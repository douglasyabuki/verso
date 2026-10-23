"use client";

import { cn } from "cn";
import { Trash2 } from "lucide-react";

import { ContentEditor } from "@/components/resume/content-editor";
import { ResumeCollection } from "@/components/resume/resume-collection";
import { CompilerSettings } from "@/components/resume/template-editor";
import { SettingsEditor } from "@/components/resume/template-editor";
import { TranslationsEditor } from "@/components/resume/translations-editor";
import { VariantsEditor } from "@/components/resume/variants-editor";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LibraryOverview } from "@/components/workspace/library-overview";
import { librarySectionLabel } from "@/components/workspace/navigation";
import { useIssueFocus } from "@/hooks/resume/use-issue-focus";
import type { useResumeActions } from "@/hooks/workspace/use-resume-actions";
import type { useWorkspaceNavigation } from "@/hooks/workspace/use-workspace-navigation";
import { resolveOwnerDestination } from "@/lib/resume/destinations";
import { validateOutput } from "@/lib/resume/validation";
import type { ConfirmAction } from "@/types-and-constants/editor";
import type {
  ReviewReturnContext,
  WorkspaceFocusTarget,
} from "@/types-and-constants/navigation";
import type {
  Issue,
  IssueNavigation,
  Locale,
  ResumeDocument,
} from "@/types-and-constants/resume";
import type { WorkspaceEdit } from "@/types-and-constants/workspace";

export function EditorPane({
  document,
  view,
  sectionId,
  setSectionId,
  locale,
  variant,
  update,
  confirm,
  validation,
  disabled,
  issueNavigation,
  onIssueFocused,
  onOpen,
  navigation,
  dataMenu,
  onOwner,
  resumeActions,
}: {
  document: ResumeDocument;
  view: ReturnType<typeof useWorkspaceNavigation>["view"];
  sectionId: string;
  setSectionId: (id: string) => void;
  locale: Locale;
  variant: ResumeDocument["variants"][number];
  update: WorkspaceEdit;
  confirm: ConfirmAction;
  validation: ReturnType<typeof validateOutput>;
  disabled: boolean;
  issueNavigation?: IssueNavigation;
  onIssueFocused: (id: string) => void;
  onOpen: (issue: Issue) => void;
  navigation: ReturnType<typeof useWorkspaceNavigation>;
  dataMenu: React.ReactNode;
  onOwner: (target: WorkspaceFocusTarget) => void;
  resumeActions: ReturnType<typeof useResumeActions>;
}) {
  useIssueFocus({
    navigation: issueNavigation,
    disabled,
    onFocused: onIssueFocused,
  });
  const reviewKey = view === "library-translations" ? sectionId : variant.id;
  const defaultContext: ReviewReturnContext = {
    current: null,
    filters: {
      owner: "all",
      language: locale,
      section: "all",
      reason: "all",
      output: "all",
    },
    scroll: 0,
  };
  const scopedContext = navigation.scopedReviews[reviewKey] ?? defaultContext;
  const reviewContext =
    view === "review"
      ? (navigation.reviewContext ?? defaultContext)
      : navigation.reviewContext
        ? { ...scopedContext, current: navigation.reviewContext.current }
        : scopedContext;
  const changeReviewContext = (context: ReviewReturnContext) => {
    if (view === "review") navigation.setReviewContext(context);
    else {
      navigation.setScopedReviews((current) => ({
        ...current,
        [reviewKey]: context,
      }));
      if (navigation.reviewContext)
        navigation.setReviewContext({
          ...navigation.reviewContext,
          current: context.current,
        });
    }
    if (
      view === "library-translations" &&
      context.current &&
      context.current !== reviewContext.current
    ) {
      const target = context.current;
      const entry = document.sections
        .find((section) => section.id === sectionId)
        ?.entries.find(
          (entry) =>
            target.path === `entries.${entry.id}.title` ||
            entry.bullets.some(
              (bullet) => target.path === `bullets.${bullet.id}.body`,
            ),
        );
      if (entry)
        navigation.setLibraryContexts((current) => ({
          ...current,
          [sectionId]: {
            entryId: entry.id,
            query: "",
            showArchived: current[sectionId]?.showArchived || entry.archived,
          },
        }));
    }
  };
  const section = document.sections.find((item) => item.id === sectionId);
  return (
    <div
      className="@container h-full overflow-auto p-4 sm:p-6"
      data-workspace-scroll
      onScroll={(event) => {
        if (
          event.target === event.currentTarget &&
          ["review", "library-translations", "resume-translations"].includes(
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
      <fieldset
        disabled={disabled}
        className={cn(
          "mx-auto flex min-w-0 flex-col gap-6 disabled:opacity-70",
          ["library-overview", "resumes", "review", "data"].includes(view)
            ? "max-w-5xl"
            : "max-w-3xl",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {view === "content" || view === "library-translations"
                ? sectionId === "profile"
                  ? "Profile & summary"
                  : section
                    ? librarySectionLabel(section)
                    : "Career library"
                : view === "variants"
                  ? `${variant.name || "Untitled resume"} · Content & order`
                  : view === "resume-translations"
                    ? `${variant.name || "Untitled resume"} · Translations`
                    : (
                        {
                          "library-overview": "Career library · Overview",
                          resumes: "All resumes",
                          review: "Translation review",
                          data: "Data & backups",
                          template: "Layout",
                          "shared-defaults": "Shared defaults",
                        } as Record<string, string>
                      )[view]}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {view === "content" ||
              view === "library-translations" ||
              view === "library-overview"
                ? "Edits affect shared career content used by resumes. Include new content explicitly in Content & order."
                : navigation.destination.kind === "resume"
                  ? `${variant.name || "Untitled resume"} · ${locale}`
                  : view === "review"
                    ? "Unresolved library and resume wording across both languages, including archived and excluded content."
                    : view === "shared-defaults"
                      ? "These defaults affect multiple resumes. Resume overrides keep their precedence."
                      : "Your editable workspace stays in this browser. JSON preserves its complete content and settings."}
            </p>
          </div>
          {view === "content" && section?.kind === "custom" && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete custom section"
              onClick={() =>
                confirm(
                  "Delete this custom section?",
                  "All entries, achievements, and references to this section will be removed from every resume.",
                  () => {
                    update((draft) => {
                      draft.sections = draft.sections.filter(
                        (item) => item.id !== section.id,
                      );
                      draft.variants.forEach((variant) => {
                        variant.sections = variant.sections.filter(
                          (item) => item.sectionId !== section.id,
                        );
                      });
                    });
                    setSectionId("profile");
                  },
                )
              }
            >
              <Trash2 />
            </Button>
          )}
        </div>
        {(navigation.returnDestination ||
          (navigation.reviewContext && view !== "review")) && (
          <Button
            variant="outline"
            className="self-start"
            onClick={() => {
              navigation.open(
                navigation.reviewContext
                  ? { kind: "review" }
                  : navigation.returnDestination!,
                true,
              );
              navigation.setReturnDestination(null);
            }}
          >
            Return to{" "}
            {navigation.reviewContext
              ? "translation review"
              : navigation.returnDestination?.kind === "resume"
                ? "resume"
                : "previous page"}
          </Button>
        )}
        {navigation.reviewContext?.current &&
          !resolveOwnerDestination(
            document,
            navigation.reviewContext.current,
          ) && (
            <p role="status" className="text-sm text-muted-foreground">
              The current review item is unavailable because its content or
              resume was removed. Return to translation review to continue with
              the remaining work.
            </p>
          )}
        {navigation.destination.kind === "library-section" && (
          <ToggleGroup
            value={[navigation.destination.tab]}
            onValueChange={(values) => {
              if (
                values[0] &&
                navigation.destination.kind === "library-section"
              ) {
                if (
                  values[0] === "review" &&
                  !navigation.reviewContext &&
                  !navigation.scopedReviews[sectionId]
                ) {
                  const entry =
                    navigation.libraryContexts[sectionId]?.entryId ||
                    document.sections
                      .find((section) => section.id === sectionId)
                      ?.entries.find((entry) => !entry.archived)?.id;
                  navigation.setScopedReviews((current) => ({
                    ...current,
                    [sectionId]: {
                      ...defaultContext,
                      current: {
                        path: entry
                          ? `entries.${entry}.title`
                          : sectionId === "profile"
                            ? "profile.summary"
                            : `sections.${sectionId}.heading`,
                        locale,
                      },
                    },
                  }));
                }
                navigation.open(
                  {
                    ...navigation.destination,
                    tab: values[0] as "edit" | "review",
                  },
                  true,
                );
                if (values[0] === "edit" && reviewContext.current)
                  navigation.setLibraryLocale(reviewContext.current.locale);
              }
            }}
            variant="outline"
            aria-label="Library section tab"
          >
            <ToggleGroupItem value="edit">Edit content</ToggleGroupItem>
            <ToggleGroupItem value="review">
              Review translations
            </ToggleGroupItem>
          </ToggleGroup>
        )}
        {view === "library-overview" && (
          <LibraryOverview
            document={document}
            open={navigation.open}
            addSection={navigation.addSection}
            onReview={(sectionId, locale) => {
              navigation.open({
                kind: "library-section",
                sectionId,
                tab: "review",
              });
              navigation.setScopedReviews((current) => ({
                ...current,
                [sectionId]: {
                  ...defaultContext,
                  filters: { ...defaultContext.filters, language: locale },
                },
              }));
            }}
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
        {view === "data" && (
          <>
            <p>
              JSON backup freshness: export the complete workspace regularly.
              PDF and LaTeX downloads do not update JSON backup freshness.
            </p>
            {dataMenu}
            <CompilerSettings document={document} update={update} />
          </>
        )}
        {view === "template" && (
          <Button
            variant="outline"
            className="self-start"
            onClick={() => {
              navigation.open({ kind: "shared-defaults" }, true);
              navigation.setReturnDestination(navigation.destination);
            }}
          >
            Edit shared defaults
          </Button>
        )}
        {view === "content" && (
          <ContentEditor
            key={`${sectionId}:${issueNavigation?.id ?? ""}`}
            context={
              navigation.libraryContexts[sectionId] ?? {
                entryId: issueNavigation?.issue.target?.entryId ?? "",
                query: "",
                showArchived: !!issueNavigation?.issue.target?.entryId,
              }
            }
            onContext={(context) =>
              navigation.setLibraryContexts((current) => ({
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
        {["review", "library-translations", "resume-translations"].includes(
          view,
        ) && (
          <TranslationsEditor
            document={document}
            update={update}
            variant={variant}
            confirm={confirm}
            scope={
              view === "review"
                ? "queue"
                : view === "library-translations"
                  ? "library"
                  : "resume"
            }
            sectionId={sectionId}
            context={reviewContext}
            onContext={changeReviewContext}
            onOwner={onOwner}
            queueContext={
              view !== "review"
                ? (navigation.reviewContext ?? undefined)
                : undefined
            }
          />
        )}
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
      </fieldset>
    </div>
  );
}
