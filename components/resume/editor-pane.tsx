"use client";

import { cn } from "cn";
import { ChevronRight, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";

import { ContentEditor } from "@/components/resume/content-editor";
import { ResumeCollection } from "@/components/resume/resume-collection";
import { CompilerSettings } from "@/components/resume/template-editor";
import { SettingsEditor } from "@/components/resume/template-editor";
import { TranslationsEditor } from "@/components/resume/translations-editor";
import { VariantsEditor } from "@/components/resume/variants-editor";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FieldSet } from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LibraryOverview } from "@/components/workspace/library-overview";
import { librarySectionLabel } from "@/components/workspace/navigation";
import { useIssueFocus } from "@/hooks/resume/use-issue-focus";
import type { useResumeActions } from "@/hooks/workspace/use-resume-actions";
import type { useWorkspaceNavigation } from "@/hooks/workspace/use-workspace-navigation";
import { resolveOwnerDestination } from "@/lib/resume/destinations";
import { validateOutput } from "@/lib/resume/validation";
import type { ConfirmAction } from "@/types-and-constants/editor";
import type { Locale } from "@/types-and-constants/languages";
import { languageNames } from "@/types-and-constants/languages";
import type { WorkspaceFocusTarget } from "@/types-and-constants/navigation";
import type { IssueNavigation } from "@/types-and-constants/navigation";
import type { ResumeDocument } from "@/types-and-constants/resume";
import type { ReviewReturnContext } from "@/types-and-constants/review";
import type { Issue } from "@/types-and-constants/review";
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
    outputResumeId: variant.id,
    current: null,
    filters: {
      owner: "all",
      language: locale,
      section: "all",
      reason: "all",
      output: view === "resume-translations" ? "selected" : "all",
      archive: "active",
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
      className={cn(
        "@container h-full overflow-auto p-4 sm:p-6",
        ["library-overview", "resumes", "review", "data"].includes(view) &&
          "md:p-8 xl:p-10",
      )}
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
      <FieldSet
        disabled={disabled}
        className={cn(
          "mx-auto flex min-w-0 flex-col gap-6 disabled:opacity-70",
          ["library-overview", "resumes", "review", "data"].includes(view)
            ? "max-w-5xl"
            : ["library-translations", "resume-translations"].includes(view)
              ? "max-w-5xl"
              : "max-w-3xl",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 basis-48">
            <h1>
              {view === "content" || view === "library-translations"
                ? sectionId === "profile"
                  ? "Profile & summary"
                  : section
                    ? librarySectionLabel(section)
                    : "Career details"
                : view === "variants"
                  ? `${variant.name || "Untitled resume"} · Content & order`
                  : view === "resume-translations"
                    ? `${variant.name || "Untitled resume"} · Text to review`
                    : (
                        {
                          "library-overview": "Career details · Overview",
                          resumes: "All resumes",
                          review: "Text to review",
                          data: "Backups & settings",
                          template: "Layout",
                          "shared-defaults": "Default layout",
                        } as Record<string, string>
                      )[view]}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {navigation.destination.kind === "resume"
                  ? languageNames[locale]
                  : navigation.destination.kind === "library-section"
                    ? "Career details"
                    : "Workspace"}
              </span>
              <InfoHint label="this workspace view" size="sm">
                {view === "content" ||
                view === "library-translations" ||
                view === "library-overview"
                  ? "Edits update shared career details used by your resumes. Add new content to each resume in Content & order."
                  : navigation.destination.kind === "resume"
                    ? `${variant.name || "Untitled resume"} · ${languageNames[locale]}`
                    : view === "review"
                      ? "Find missing text, translations to check, and shared text changes. Use the filters to review a resume or other career details, including archived content."
                      : view === "shared-defaults"
                        ? "These layout settings apply to multiple resumes. Custom settings for a resume still take priority."
                        : "Your work stays in this browser. Download a backup (JSON) to keep all editable career details, resumes, and settings."}
              </InfoHint>
            </div>
          </div>
          {(view === "library-overview" || view === "resumes") && (
            <Button
              disabled={
                view === "resumes"
                  ? document.variants.length >= 30
                  : document.sections.length >= 30
              }
              onClick={() =>
                view === "resumes"
                  ? navigation.createResume()
                  : navigation.addSection()
              }
            >
              <Plus data-icon="inline-start" />
              {view === "resumes" ? "Create resume" : "Add section"}
            </Button>
          )}
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
              ? "text to review"
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
              resume was removed. Return to text to review to continue with the
              remaining work.
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
            variant="segmented"
            aria-label="Career details section tab"
            spacing={0}
            multiple={false}
          >
            <ToggleGroupItem value="edit">
              <Pencil data-icon="inline-start" />
              Edit content
            </ToggleGroupItem>
            <ToggleGroupItem value="review">
              <ListChecks data-icon="inline-start" />
              Text to review
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
            <div className="flex items-center gap-2 text-sm font-medium">
              Backups
              <InfoHint label="editable backups">
                A backup (JSON) includes all editable career details, resumes,
                and settings. PDF and LaTeX downloads cannot restore your
                editable work and do not count as backups.
              </InfoHint>
            </div>
            {dataMenu}
            <Collapsible>
              <CollapsibleTrigger
                render={<Button variant="outline" />}
                className="group"
              >
                <ChevronRight
                  data-icon="inline-start"
                  className="transition-transform duration-200 group-data-panel-open:rotate-90 motion-reduce:transition-none"
                />
                Advanced PDF settings
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-4">
                  <CompilerSettings document={document} update={update} />
                </div>
              </CollapsibleContent>
            </Collapsible>
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
            Edit default layout
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
      </FieldSet>
    </div>
  );
}
