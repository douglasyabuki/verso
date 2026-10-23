"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

import { VariantWordingField } from "@/components/resume/variant-wording-field";
import { WordingField } from "@/components/resume/wording-field";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { localizedFields, plain } from "@/lib/resume/localization";
import { reviewItems } from "@/lib/resume/review-queue";
import { sharedWording, variantWording } from "@/lib/resume/wording";
import type { EditorProps } from "@/types-and-constants/editor";
import type {
  ReviewFilters,
  ReviewItem,
  ReviewReturnContext,
  WorkspaceFocusTarget,
} from "@/types-and-constants/navigation";

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
  const all = reviewItems(document, false, context.current ?? undefined);
  const output = localizedFields(document, variant);
  const fields = all.filter(
    (item) =>
      scope === "queue" ||
      (scope === "library"
        ? !item.resumeId && item.field.sectionId === sectionId
        : output.some(
            (field) =>
              field.path === item.path &&
              (field.required || plain(field.value, item.locale).trim()),
          ) &&
          item.resumeId ===
            (variantWording(variant, item.path) ? variant.id : undefined)),
  );
  const { filters, current } = context;
  const matchesFilters = (item: ReviewItem, filters: ReviewFilters) =>
    (filters.owner === "all" ||
      (item.resumeId ? `resume:${item.resumeId}` : "library") ===
        filters.owner) &&
    (filters.language === "all" || item.locale === filters.language) &&
    (filters.section === "all" || item.field.sectionId === filters.section) &&
    (filters.reason === "all" || item.reasons.includes(filters.reason)) &&
    (filters.output === "all" || item.output === (filters.output === "used"));
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
  const pageScroll = useRef(context.pageScroll);
  useEffect(() => {
    pageScroll.current = context.pageScroll;
  }, [context.pageScroll]);
  useEffect(() => {
    if (!current) return;
    if (pageScroll.current === undefined)
      detail.current?.scrollIntoView({ block: "nearest" });
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
  }, [pageKey, context.pageScroll]);
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
  return (
    <div className="flex flex-col gap-5">
      <FieldGroup className="grid gap-3 sm:grid-cols-2">
        {(scope === "queue"
          ? [
              {
                key: "owner" as keyof ReviewFilters,
                label: "Owner / resume",
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
                ["pt-BR", "Português"],
              ],
            },
            {
              key: "reason",
              label: "Reason",
              options: [
                [
                  "all",
                  scope === "queue" ? "All unresolved reasons" : "All wording",
                ],
                ...[
                  "Missing required wording",
                  "Translation needs review",
                  "Library wording changed beneath customization",
                ].map((reason) => [reason, reason]),
              ],
            },
            {
              key: "output",
              label: "Output use",
              options: [
                ["all", "All output use"],
                ["used", "Used in output"],
                ["excluded", "Excluded from output"],
              ],
            },
          ] as {
            key: keyof ReviewFilters;
            label: string;
            options: string[][];
          }[])
          .map(({ key, label, options }) => (
            <Field key={key}>
              <FieldLabel htmlFor={`review-${key}`}>{label}</FieldLabel>
              <NativeSelect
                id={`review-${key}`}
                value={filters[key]}
                onChange={(event) => filter(key, event.target.value)}
              >
                {options.map(([value, text]) => (
                  <NativeSelectOption key={value} value={value}>
                    {text}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          ))}
      </FieldGroup>
      <p className="text-sm text-muted-foreground">
        {candidates.length} unresolved in{" "}
        {queueContext
          ? "your global queue filters. Previous/Next follow that queue"
          : "these filters"}
        . Optional empty summaries remain valid. Reviews warn without blocking
        valid downloads.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={!previous}
          onClick={() => previous && select(previous)}
        >
          Previous unresolved
        </Button>
        <Button
          variant="outline"
          disabled={!next}
          onClick={() => next && select(next)}
        >
          Next unresolved
        </Button>
      </div>
      {current && (
        <Card ref={detail}>
          <CardHeader>
            <CardTitle>
              Current item{" "}
              {currentItem && !currentItem.reasons.length && (
                <Badge variant="secondary">Resolved</Badge>
              )}
            </CardTitle>
            <CardDescription>
              {currentItem
                ? `${currentItem.owner} · ${currentItem.field.source} · ${currentItem.field.label} · ${currentItem.locale}`
                : "This item is unavailable. Its content or resume was removed."}
            </CardDescription>
          </CardHeader>
          {currentItem && (
            <>
              <CardContent className="flex flex-col gap-4">
                {!matches(currentItem) && (
                  <p className="text-sm text-muted-foreground">
                    Current item is outside these filters. It stays open until
                    you open another item or leave this review context.
                  </p>
                )}
                <p className="text-sm">
                  {currentItem.provenance} ·{" "}
                  {currentItem.output
                    ? "Used in output"
                    : "Excluded from output"}{" "}
                  · Reference:{" "}
                  {currentItem.locale === "en-US" ? "pt-BR" : "en-US"}
                </p>
                <p className="text-sm">
                  {currentItem.reasons.join(" · ") || "Resolved"}
                </p>
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
              {scope === "queue" && (
                <CardFooter>
                  <Button
                    variant="outline"
                    onClick={() => onOwner(currentItem)}
                  >
                    Open owning editor
                  </Button>
                </CardFooter>
              )}
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
      <div ref={list} className="flex flex-col gap-2">
        {!visible.length && (
          <p role="status">No unresolved work matches these filters.</p>
        )}
        {visible
          .filter((item) => item.id !== currentItem?.id)
          .map((item) => (
            <Button
              key={item.id}
              variant="outline"
              className="h-auto min-h-8 justify-start py-2 text-left whitespace-normal"
              onClick={() => select(item)}
            >
              {item.owner} · {item.field.source} · {item.field.label} ·{" "}
              {item.locale} · {item.reasons.join(" · ") || "Resolved"}
            </Button>
          ))}
      </div>
    </div>
  );
}
