"use client";

import { cn } from "cn";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Filter,
  ListChecks,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";

import { LanguageFlag } from "@/components/resume/language-flag";
import { ResumeIcon } from "@/components/resume/resume-icon";
import { SectionIcon } from "@/components/resume/section-icon";
import { ContentStatusBadge } from "@/components/resume/semantic-badges/content-status-badge";
import { ReviewStatusBadge } from "@/components/resume/semantic-badges/review-status-badge";
import { SectionBadge } from "@/components/resume/semantic-badges/section-badge";
import { VariantWordingField } from "@/components/resume/variant-wording-field";
import { WordingField } from "@/components/resume/wording-field";
import { WordingStatus } from "@/components/resume/wording-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
import { plain } from "@/lib/resume/localization";
import {
  matchesReviewFilters,
  reviewItems,
  reviewOutputLabel,
} from "@/lib/resume/review-queue";
import { sharedWording, variantWording } from "@/lib/resume/wording";
import type { EditorProps } from "@/types-and-constants/editor";
import { languageNames } from "@/types-and-constants/languages";
import type { WorkspaceFocusTarget } from "@/types-and-constants/navigation";
import type { ResumeDocument } from "@/types-and-constants/resume";
import type {
  ReviewFilters,
  ReviewItem,
  ReviewReturnContext,
} from "@/types-and-constants/review";
import { reviewCategoryLabels } from "@/types-and-constants/review";

export function TranslationsEditor({
  document,
  update,
  variant,
  confirm,
  scope,
  sectionId,
  context,
  onContext,
  onOwner,
  queueContext,
}: Pick<EditorProps, "document" | "update" | "variant" | "confirm"> & {
  scope: "queue" | "library" | "resume";
  sectionId?: string;
  context: ReviewReturnContext;
  onContext: (context: ReviewReturnContext) => void;
  onOwner: (target: WorkspaceFocusTarget) => void;
  queueContext?: ReviewReturnContext;
}) {
  const { state } = useWorkspace();
  const outputResumeId =
    queueContext?.outputResumeId ?? context.outputResumeId ?? variant.id;
  const outputResume = document.variants.find(
    (resume) => resume.id === outputResumeId,
  );
  const all = reviewItems(document, false, context.current ?? undefined).sort(
    (a, b) =>
      Number(b.usedBy.includes(outputResumeId)) -
      Number(a.usedBy.includes(outputResumeId)),
  );
  const fields = all.filter(
    (item) =>
      scope === "queue" ||
      (scope === "library"
        ? !item.resumeId && item.field.sectionId === sectionId
        : item.resumeId === variant.id ||
          (!item.resumeId &&
            !variantWording(variant, item.path)?.overrides[item.locale])),
  );
  const { filters, current } = context;
  const matchesFilters = (item: ReviewItem, filters: ReviewFilters) =>
    matchesReviewFilters(item, filters, outputResumeId);
  const matches = (item: ReviewItem) => matchesFilters(item, filters);
  const candidates = (queueContext ? all : fields).filter(
    (item) =>
      matchesFilters(item, queueContext?.filters ?? filters) &&
      item.reasons.length > 0,
  );
  const currentItem =
    current &&
    all.find(
      (item) =>
        item.path === current.path &&
        item.locale === current.locale &&
        item.resumeId === current.resumeId,
    );
  const index = currentItem
    ? all.findIndex((item) => item.id === currentItem.id)
    : -1;
  const previous = candidates.findLast((item) => all.indexOf(item) < index);
  const next = candidates.find((item) => all.indexOf(item) > index);
  const visible = scope === "queue" ? candidates : fields.filter(matches);
  const detail = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const restoredPage = useRef<string | null>(null);
  const pageKey =
    scope === "resume"
      ? `resume:${variant.id}`
      : scope === "library"
        ? `library:${sectionId}`
        : "queue";
  useEffect(() => {
    if (!current) return;
    detail.current
      ?.querySelector<HTMLElement>("[data-issue-field]")
      ?.focus({ preventScroll: true });
  }, [current, scope, sectionId]);
  useLayoutEffect(() => {
    // Restore once on entry. Replaying saved offsets during wheel or thumb
    // movement can overwrite a newer browser position with an older render.
    if (restoredPage.current === pageKey) return;
    const scroller = list.current?.closest<HTMLElement>(
      "[data-workspace-scroll]",
    );
    if (!scroller) return;
    restoredPage.current = pageKey;
    scroller.scrollTop = context.pageScroll ?? 0;
    if (list.current) list.current.scrollTop = context.scroll;
  }, [pageKey, context.pageScroll, context.scroll]);
  const select = (item: ReviewItem) => {
    onContext({
      ...context,
      pageScroll: scope === "queue" ? context.pageScroll : undefined,
      current: {
        path: item.path,
        locale: item.locale,
        resumeId: item.resumeId,
      },
    });
    if (scope === "queue" || queueContext) onOwner(item);
  };
  const filter = (key: keyof ReviewFilters, value: string) =>
    onContext({ ...context, filters: { ...filters, [key]: value } });
  const filterControls = (
    scope === "queue"
      ? [
          {
            key: "owner" as keyof ReviewFilters,
            label: "Text belongs to",
            options: [
              ["all", "All career details and resumes"],
              ["library", "Career details"],
              ...document.variants.map((resume) => [
                `resume:${resume.id}`,
                resume.name || "Untitled resume",
              ]),
            ],
          },
          {
            key: "section" as keyof ReviewFilters,
            label: "Section",
            options: [
              ["all", "All sections"],
              ["profile", "Summary"],
              ...document.sections.map((section) => [
                section.id,
                section.heading["en-US"].spans
                  .map((span) => span.text)
                  .join("") || "Untitled section",
              ]),
            ],
          },
        ]
      : []
  )
    .concat([
      {
        key: "language",
        label: "Language",
        options: [
          ["all", "Both languages"],
          ["en-US", "English"],
          ["pt-BR", "Portuguese"],
        ],
      },
      {
        key: "reason",
        label: "Review type",
        options: [
          ["all", scope === "queue" ? "All review types" : "All text"],
          ...Object.entries(reviewCategoryLabels),
        ],
      },
      {
        key: "archive",
        label: "Archive status",
        options: [
          ["active", "Active content"],
          ["archived", "Archived content"],
          ["all", "Active and archived"],
        ],
      },
      {
        key: "output",
        label: "Used in",
        options: [
          [
            "selected",
            `Selected resume: ${outputResume?.name || "Unavailable resume"}`,
          ],
          ["any", "Any resume"],
          ["all", "All content, including content outside resumes"],
          ["unused", "Unused by any resume"],
        ],
      },
    ] as {
      key: keyof ReviewFilters;
      label: string;
      options: string[][];
    }[])
    .map(({ key, label, options }) => {
      const filterItems = options.map(([value, label]) => ({
        value,
        label,
        resumeColor:
          key === "owner"
            ? document.variants.find(
                (resume) => `resume:${resume.id}` === value,
              )?.color
            : key === "output" && value === "selected"
              ? outputResume?.color
              : undefined,
        sectionIcon:
          key === "section"
            ? document.sections.find((section) => section.id === value)?.icon
            : undefined,
        sectionKind:
          key === "section" && value !== "all"
            ? value === "profile"
              ? ("summary" as const)
              : document.sections.find((section) => section.id === value)?.kind
            : undefined,
      }));
      const selectedSection = filterItems.find(
        (option) => option.value === filters[key],
      );
      return {
        key,
        element: (
          <Field key={key}>
            <FieldLabel htmlFor={`review-${key}`}>{label}</FieldLabel>
            <Select
              items={filterItems}
              value={filters[key]}
              disabled={state.replacing || !!state.pending}
              onValueChange={(value) => {
                if (value === null || state.replacing || state.pending) return;
                filter(key, value);
              }}
            >
              <SelectTrigger
                appearance="utility"
                id={`review-${key}`}
                className="w-full"
              >
                {selectedSection?.sectionKind && (
                  <SectionIcon
                    kind={selectedSection.sectionKind}
                    icon={selectedSection.sectionIcon}
                  />
                )}
                {selectedSection?.resumeColor && (
                  <ResumeIcon color={selectedSection.resumeColor} />
                )}
                <SelectValue className="min-w-0 truncate" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {filterItems.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.sectionKind && (
                        <SectionIcon
                          kind={option.sectionKind}
                          icon={option.sectionIcon}
                        />
                      )}
                      {option.resumeColor && (
                        <ResumeIcon color={option.resumeColor} />
                      )}
                      <span className="max-w-64 truncate">{option.label}</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        ),
      };
    });
  const advancedCount =
    Number(filters.owner !== "all") +
    Number(filters.section !== "all") +
    Number(filters.archive !== "active") +
    Number(filters.output !== (scope === "resume" ? "selected" : "all"));
  const visibleIds = new Set(visible.map((item) => item.id));
  const listItems = all.filter(
    (item) => visibleIds.has(item.id) || item.id === currentItem?.id,
  );
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <FieldGroup className="grid gap-3 @sm:grid-cols-2">
        {filterControls
          .filter(({ key }) => key === "language" || key === "reason")
          .map(({ element }) => element)}
      </FieldGroup>
      <Collapsible>
        <div className="flex flex-wrap items-center gap-2">
          <CollapsibleTrigger
            render={<Button variant="outline" size="sm" />}
            className="group"
          >
            <Filter data-icon="inline-start" />
            Filters{" "}
            {advancedCount > 0 && (
              <Badge variant="secondary">{advancedCount}</Badge>
            )}
            <ChevronRight
              data-icon="inline-end"
              className="transition-transform duration-200 group-data-panel-open:rotate-90 motion-reduce:transition-none"
            />
          </CollapsibleTrigger>
          <span className="text-xs text-muted-foreground">
            {filters.output === "selected"
              ? outputResume?.name || "Unavailable resume"
              : filters.output === "all"
                ? "All content"
                : filters.output === "any"
                  ? "Any resume"
                  : "Unused content"}
            {" · "}
            {filters.archive === "active"
              ? "Active"
              : filters.archive === "archived"
                ? "Archived"
                : "Active and archived"}
            {filters.owner !== "all" &&
              ` · ${filters.owner === "library" ? "Career details" : document.variants.find((resume) => `resume:${resume.id}` === filters.owner)?.name || "Unavailable content"}`}
            {filters.section !== "all" && (
              <span className="inline-flex items-center gap-1.5 align-middle [&>svg]:size-3 [&>svg]:shrink-0">
                {" · "}
                <SectionIcon
                  icon={
                    document.sections.find(
                      (section) => section.id === filters.section,
                    )?.icon
                  }
                  kind={
                    filters.section === "profile"
                      ? "summary"
                      : (document.sections.find(
                          (section) => section.id === filters.section,
                        )?.kind ?? "custom")
                  }
                />
                {filters.section === "profile"
                  ? "Summary"
                  : document.sections
                      .find((section) => section.id === filters.section)
                      ?.heading["en-US"].spans.map((span) => span.text)
                      .join("") || "Unavailable section"}
              </span>
            )}
          </span>
          <InfoHint label="review item filters">
            Only text matching all your filters appears. Each item is counted
            once for its language and the career details or resume it belongs
            to, even if it needs more than one kind of review. Missing required
            text can prevent downloading. Translation and shared text reminders
            do not. The sidebar count includes all career details and resumes.
          </InfoHint>
        </div>
        <CollapsibleContent>
          <FieldGroup className="mt-3 grid gap-3 @sm:grid-cols-2">
            {filterControls
              .filter(({ key }) => key !== "language" && key !== "reason")
              .map(({ element }) => element)}
          </FieldGroup>
        </CollapsibleContent>
      </Collapsible>
      <div className="flex flex-wrap items-center gap-2">
        <p
          role="status"
          aria-live="polite"
          className="text-xs text-muted-foreground"
        >
          {candidates.length} items left
          {queueContext ? " across all reviews" : " matching your filters"}
        </p>
        {Object.entries(reviewCategoryLabels).map(([category, label]) => {
          const count = candidates.filter((item) =>
            item.categories.some((value) => value === category),
          ).length;
          return count ? (
            <Badge key={category} variant="attention">
              <ListChecks data-icon="inline-start" />
              {label}: {count}
            </Badge>
          ) : null;
        })}
      </div>
      <div
        className={cn(
          "grid min-w-0 items-start gap-4",
          current && "@3xl:grid-cols-[16rem_minmax(0,1fr)]",
        )}
      >
        <div
          ref={list}
          className={cn(
            "flex min-w-0 flex-col gap-3 overflow-y-auto p-1",
            current && "max-h-80 @3xl:max-h-[60dvh]",
          )}
          role="region"
          aria-label="Text to review"
          onScroll={(event) => {
            if (event.currentTarget.scrollTop !== context.scroll)
              onContext({ ...context, scroll: event.currentTarget.scrollTop });
          }}
        >
          {!visible.length && !currentItem && (
            <Empty role="status">
              <EmptyHeader>
                <EmptyTitle>No matching text</EmptyTitle>
                <EmptyDescription>
                  Change filters to see other content.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {listItems.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={state.replacing || !!state.pending}
              aria-current={item.id === currentItem?.id ? "true" : undefined}
              onClick={() => select(item)}
              className={cn(
                "flex w-full min-w-0 shrink-0 cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left text-card-foreground shadow-sm transition-colors hover:border-ring hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
                item.id === currentItem?.id &&
                  "border-primary bg-accent ring-1 ring-primary",
              )}
            >
              <span className="flex min-w-0 flex-col gap-2">
                <span className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <span className="min-w-0 text-sm leading-snug font-semibold wrap-anywhere">
                    {item.field.label}
                  </span>
                  <ReviewItemBadges item={item} document={document} />
                </span>
              </span>
              <span
                lang={item.locale}
                className="line-clamp-2 text-sm leading-relaxed wrap-anywhere"
              >
                {plain(item.field.value, item.locale) || "No text yet"}
              </span>
              <span className="mt-auto flex flex-col items-start gap-2 border-t pt-3">
                <WordingStatus
                  showHelp={false}
                  missing={item.categories.includes("missing")}
                  review={item.categories.includes("translation")}
                  library={item.categories.includes("library")}
                />
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {item.archived ? "Archived · " : ""}
                  {reviewOutputLabel(item, outputResumeId)}
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className="min-w-0" hidden={!current}>
          {current && (
            <Card ref={detail} className="min-w-0">
              <CardHeader className="flex flex-wrap items-start gap-2">
                <CardTitle className="min-w-0 flex-1 basis-32 wrap-anywhere">
                  {currentItem?.field.label || "Current item"}
                </CardTitle>
                {currentItem && (
                  <div className="ml-auto flex max-w-full min-w-0 flex-wrap justify-end gap-2">
                    <ReviewItemBadges item={currentItem} document={document} />
                    {!currentItem.reasons.length && (
                      <ReviewStatusBadge state="resolved" />
                    )}
                  </div>
                )}
                {!currentItem && (
                  <CardDescription className="min-w-0 basis-full leading-relaxed wrap-anywhere">
                    This item is unavailable. Its content or resume was removed.
                  </CardDescription>
                )}
              </CardHeader>
              {currentItem && (
                <>
                  <CardContent className="flex flex-col gap-4">
                    {!matches(currentItem) && (
                      <p className="text-xs leading-normal text-muted-foreground">
                        Current item is outside these filters. It stays open
                        until you open another item or leave this page.
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{currentItem.provenance}</span>
                      <span>
                        {reviewOutputLabel(currentItem, outputResumeId)}
                      </span>
                      {currentItem.archived && (
                        <ContentStatusBadge state="archived" />
                      )}
                    </div>
                    {currentItem.resumeId ||
                    (scope === "resume" &&
                      sharedWording(document, currentItem.path)) ? (
                      <VariantWordingField
                        key={currentItem.id}
                        document={document}
                        variant={
                          document.variants.find(
                            (resume) => resume.id === currentItem.resumeId,
                          ) ?? variant
                        }
                        path={currentItem.path}
                        locale={currentItem.locale}
                        update={update}
                        confirm={confirm}
                        showReference
                        label={currentItem.field.label}
                        required={currentItem.field.required}
                        multiline={currentItem.field.multiline}
                      />
                    ) : scope === "resume" ? (
                      <div className="flex flex-col gap-3">
                        <p
                          lang={currentItem.locale}
                          className="text-sm whitespace-pre-wrap"
                        >
                          {plain(currentItem.field.value, currentItem.locale) ||
                            "No shared text yet"}
                        </p>
                        <Button
                          variant="outline"
                          onClick={() =>
                            onOwner({
                              path: currentItem.path,
                              locale: currentItem.locale,
                            })
                          }
                        >
                          Review in career details
                        </Button>
                      </div>
                    ) : (
                      <WordingField
                        key={currentItem.id}
                        document={document}
                        path={currentItem.path}
                        locale={currentItem.locale}
                        update={update}
                        label={currentItem.field.label}
                        required={currentItem.field.required}
                        multiline={currentItem.field.multiline}
                        showReference
                      />
                    )}
                  </CardContent>
                  <CardFooter className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!previous}
                      onClick={() => previous && select(previous)}
                    >
                      <ArrowLeft data-icon="inline-start" />
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      disabled={!next}
                      onClick={() => next && select(next)}
                    >
                      Next task
                      <ArrowRight data-icon="inline-end" />
                    </Button>
                    {scope === "queue" && (
                      <Button
                        variant="outline"
                        onClick={() => onOwner(currentItem)}
                      >
                        Open in editor
                      </Button>
                    )}
                  </CardFooter>
                </>
              )}
              {!currentItem && (
                <CardFooter>
                  <Button variant="outline" onClick={() => onOwner(current)}>
                    Return to text reviews
                  </Button>
                </CardFooter>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewItemBadges({
  item,
  document,
}: {
  item: ReviewItem;
  document: ResumeDocument;
}) {
  const section = document.sections.find(
    (section) => section.id === item.field.sectionId,
  );

  return (
    <span className="flex max-w-full min-w-0 flex-wrap items-center gap-1.5">
      <SectionBadge
        section={item.path === "profile.summary" ? "summary" : section}
      />
      <span className="inline-flex shrink-0" title={languageNames[item.locale]}>
        <LanguageFlag locale={item.locale} ratio="1x1" rounded />
        <span className="sr-only">{languageNames[item.locale]}</span>
      </span>
    </span>
  );
}
