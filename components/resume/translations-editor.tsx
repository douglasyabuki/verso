"use client";

import { cn } from "cn";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Filter,
  ListChecks,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";

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
import type {
  ReviewFilters,
  ReviewItem,
  ReviewReturnContext,
  WorkspaceFocusTarget,
} from "@/types-and-constants/navigation";
import { reviewCategoryLabels } from "@/types-and-constants/navigation";
import { languageNames } from "@/types-and-constants/resume";

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
            label: "Owner",
            options: [
              ["all", "All owners"],
              ["library", "Career library"],
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
              ["profile", "Profile & summary"],
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
        label: "Target language",
        options: [
          ["all", "Both languages"],
          ["en-US", "English"],
          ["pt-BR", "Portuguese"],
        ],
      },
      {
        key: "reason",
        label: "Task category",
        options: [
          ["all", scope === "queue" ? "All unresolved reasons" : "All wording"],
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
        label: "Output scope",
        options: [
          [
            "selected",
            `Selected resume: ${outputResume?.name || "Unavailable resume"}`,
          ],
          ["any", "Any resume"],
          ["all", "All content (includes excluded)"],
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
      }));
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
              <SelectTrigger id={`review-${key}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {filterItems.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
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
            <ChevronDown
              data-icon="inline-end"
              className="transition-transform group-data-panel-open:rotate-180"
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
              ` · ${filters.owner === "library" ? "Career library" : document.variants.find((resume) => `resume:${resume.id}` === filters.owner)?.name || "Unavailable owner"}`}
            {filters.section !== "all" &&
              ` · ${
                filters.section === "profile"
                  ? "Profile"
                  : document.sections
                      .find((section) => section.id === filters.section)
                      ?.heading["en-US"].spans.map((span) => span.text)
                      .join("") || "Unavailable section"
              }`}
          </span>
          <InfoHint label="wording task filters">
            Filters intersect. Counts identify one field, language, and owner;
            categories may overlap. Missing required text can block its output.
            Translation and library-change reminders do not block valid
            downloads. Sidebar counts include the whole workspace.
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
          {candidates.length} unresolved
          {queueContext ? " in global queue" : " matching tasks"}
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
      <div className="grid min-w-0 items-start gap-4 @3xl:grid-cols-[16rem_minmax(0,1fr)]">
        <div
          ref={list}
          className="flex max-h-80 min-w-0 flex-col gap-2 overflow-y-auto @3xl:max-h-[60dvh]"
          role="region"
          aria-label="Wording items"
          onScroll={(event) => {
            if (event.currentTarget.scrollTop !== context.scroll)
              onContext({ ...context, scroll: event.currentTarget.scrollTop });
          }}
        >
          {!visible.length && !currentItem && (
            <Empty role="status">
              <EmptyHeader>
                <EmptyTitle>No matching wording</EmptyTitle>
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
                "flex w-full min-w-0 cursor-pointer flex-col gap-2 rounded-lg border border-l-2 border-l-transparent p-3 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
                item.id === currentItem?.id && "border-l-foreground bg-muted",
              )}
            >
              <span className="text-sm font-semibold">{item.field.label}</span>
              <span className="text-xs text-muted-foreground">
                {item.owner} · {item.field.source} ·{" "}
                {languageNames[item.locale]}
              </span>
              <span lang={item.locale} className="line-clamp-2 text-sm">
                {plain(item.field.value, item.locale) || "Empty wording"}
              </span>
              <WordingStatus
                missing={item.categories.includes("missing")}
                review={item.categories.includes("translation")}
                library={item.categories.includes("library")}
              />
              <span className="text-xs text-muted-foreground">
                {item.archived ? "Archived · " : ""}
                {reviewOutputLabel(item, outputResumeId)}
              </span>
            </button>
          ))}
        </div>
        <div className="min-w-0">
          {current && (
            <Card ref={detail} className="min-w-0">
              <CardHeader>
                <CardTitle>
                  {currentItem?.field.label || "Current item"}{" "}
                  {currentItem && !currentItem.reasons.length && (
                    <Badge variant="success">
                      <Check data-icon="inline-start" />
                      Resolved
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {currentItem
                    ? `${currentItem.owner} · ${currentItem.field.source} · ${currentItem.field.label} · ${languageNames[currentItem.locale]}`
                    : "This item is unavailable. Its content or resume was removed."}
                </CardDescription>
              </CardHeader>
              {currentItem && (
                <>
                  <CardContent className="flex flex-col gap-4">
                    {!matches(currentItem) && (
                      <p className="text-sm text-muted-foreground">
                        Current item is outside these filters. It stays open
                        until you open another item or leave this review
                        context.
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{currentItem.provenance}</span>
                      <span>
                        {reviewOutputLabel(currentItem, outputResumeId)}
                      </span>
                      {currentItem.archived && (
                        <Badge variant="outline">Archived</Badge>
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
                            "Empty library wording"}
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
                          Review in career library
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
                        Open owning editor
                      </Button>
                    )}
                  </CardFooter>
                </>
              )}
              {!currentItem && (
                <CardFooter>
                  <Button variant="outline" onClick={() => onOwner(current)}>
                    Return safely to review
                  </Button>
                </CardFooter>
              )}
            </Card>
          )}

          {!current && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Select wording</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>
    </div>
  );
}
