"use client";

import { cn } from "cn";
import {
  ChevronRight,
  Eraser,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { CareerOverview } from "@/components/content/career-overview";
import { CareerSectionIcon } from "@/components/content/career-section-icon";
import { CareerSectionIconPicker } from "@/components/content/career-section-icon-picker";
import { ContentEditor } from "@/components/content/content-editor";
import { ProfileEditor } from "@/components/content/profile-editor";
import { SummaryEditor } from "@/components/content/summary-editor";
import { CompilerSettings } from "@/components/output/template-editor";
import { SettingsEditor } from "@/components/output/template-editor";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FieldSet } from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ResumeCollection } from "@/components/variants/resume-collection";
import { ResumeIcon } from "@/components/variants/resume-icon";
import { VariantsEditor } from "@/components/variants/variants-editor";
import { TranslationsEditor } from "@/components/wording/translations-editor";
import { useIssueFocus } from "@/hooks/review/use-issue-focus";
import type { useCareerActions } from "@/hooks/workspace/use-career-actions";
import type { useResumeActions } from "@/hooks/workspace/use-resume-actions";
import type { useWorkspaceNavigation } from "@/hooks/workspace/use-workspace-navigation";
import { careerSectionLabel } from "@/lib/content/section-fields";
import { validateOutput } from "@/lib/review/validation";
import { resolveOwnerDestination } from "@/lib/workspace/destinations";
import type { ConfirmAction } from "@/types-and-constants/editor";
import type { Locale } from "@/types-and-constants/languages";
import type { WorkspaceFocusTarget } from "@/types-and-constants/navigation";
import type { IssueNavigation } from "@/types-and-constants/navigation";
import type {
  CareerTarget,
  ResumeDocument,
} from "@/types-and-constants/resume";
import type { ReviewReturnContext } from "@/types-and-constants/review";
import type { Issue } from "@/types-and-constants/review";
import type { WorkspaceEdit } from "@/types-and-constants/workspace";

export function EditorPane({
  document,
  view,
  sectionId,
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
  careerActions,
}: {
  document: ResumeDocument;
  view: ReturnType<typeof useWorkspaceNavigation>["view"];
  sectionId: string;
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
  careerActions: ReturnType<typeof useCareerActions>;
}) {
  useIssueFocus({
    navigation: issueNavigation,
    disabled,
    onFocused: onIssueFocused,
  });
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
  const reviewKey = career ? sectionId : variant.id;
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
      view === "career-translations" &&
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
        navigation.setCareerContexts((current) => ({
          ...current,
          [sectionId]: {
            entryId: entry.id,
            query: "",
            showArchived: current[sectionId]?.showArchived || entry.archived,
          },
        }));
    }
  };
  const section =
    navigation.destination.kind === "career-section"
      ? document.sections.find((item) => item.id === sectionId)
      : undefined;
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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 basis-48">
            <div className="flex items-center gap-2 [&>svg]:size-8 [&>svg]:shrink-0">
              {navigation.destination.kind === "career-profile" ? (
                <CareerSectionIcon kind="profile" />
              ) : summary ? (
                <CareerSectionIcon kind="summary" />
              ) : section ? (
                section.kind === "custom" ? (
                  <CareerSectionIconPicker
                    key={section.id}
                    section={section}
                    update={update}
                    disabled={disabled}
                  />
                ) : (
                  <CareerSectionIcon kind={section.kind} icon={section.icon} />
                )
              ) : navigation.destination.kind === "resume" ? (
                <ResumeIcon color={variant.color} />
              ) : null}
              <h1 tabIndex={-1} data-workspace-heading>
                {view === "profile"
                  ? "Profile"
                  : summary
                    ? "Summary"
                    : view === "content" || view === "career-translations"
                      ? section
                        ? careerSectionLabel(section)
                        : "Career details"
                      : view === "variants"
                        ? `${variant.name || "Untitled resume"} · Content & order`
                        : view === "resume-translations"
                          ? `${variant.name || "Untitled resume"} · Text to review`
                          : (
                              {
                                "career-overview": "Career details · Overview",
                                resumes: "All resumes",
                                review: "Text to review",
                                data: "Backups & settings",
                                template: "Layout",
                                "shared-defaults": "Default layout",
                              } as Record<string, string>
                            )[view]}
              </h1>
            </div>
            {navigation.destination.kind !== "resume" && (
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{career ? "Career details" : "Workspace"}</span>
                <InfoHint label="this workspace view" size="sm">
                  {career ||
                  view === "career-translations" ||
                  view === "career-overview"
                    ? "Edits update shared career details used by your resumes. Add new content to each resume in Content & order."
                    : view === "review"
                      ? "Find missing text, translations to check, and shared text changes. Use the filters to review a resume or other career details, including archived content."
                      : view === "shared-defaults"
                        ? "These layout settings apply to multiple resumes. Custom settings for a resume still take priority."
                        : "Your work stays in this browser. Download a backup (JSON) to keep all editable career details, resumes, and settings."}
                </InfoHint>
              </div>
            )}
          </div>
          {(view === "career-overview" || view === "resumes") && (
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
          {careerTarget && (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!careerActions.canClear(careerTarget)}
                onClick={(event) =>
                  careerActions.clear(careerTarget, event.currentTarget)
                }
              >
                <Eraser data-icon="inline-start" />
                Clear content
              </Button>
              {section?.kind === "custom" && (
                <Button
                  variant="destructive"
                  size="sm"
                  aria-label="Delete custom section"
                  onClick={(event) =>
                    careerActions.remove(section.id, event.currentTarget)
                  }
                >
                  <Trash2 data-icon="inline-start" />
                  Delete section
                </Button>
              )}
            </div>
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
        {(navigation.destination.kind === "career-section" ||
          navigation.destination.kind === "career-summary") && (
          <ToggleGroup
            value={[navigation.destination.tab]}
            onValueChange={(values) => {
              if (
                values[0] &&
                (navigation.destination.kind === "career-section" ||
                  navigation.destination.kind === "career-summary")
              ) {
                if (
                  values[0] === "review" &&
                  !navigation.reviewContext &&
                  !navigation.scopedReviews[sectionId]
                ) {
                  const entry = summary
                    ? undefined
                    : navigation.careerContexts[sectionId]?.entryId ||
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
                          : summary
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
                  navigation.setCareerLocale(reviewContext.current.locale);
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
        {view === "career-overview" && (
          <CareerOverview
            document={document}
            open={navigation.open}
            onReview={(destination, locale) => {
              const sectionId =
                destination.kind === "career-summary"
                  ? "profile"
                  : destination.sectionId;
              navigation.setCareerLocale(locale);
              navigation.open(destination);
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
        {view === "profile" && (
          <ProfileEditor
            document={document}
            update={update}
            confirm={confirm}
            errors={validation.errors}
          />
        )}
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
        {["review", "career-translations", "resume-translations"].includes(
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
                : view === "career-translations"
                  ? "career"
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
