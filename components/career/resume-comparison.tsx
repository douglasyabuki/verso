"use client";

import { cn } from "cn";
import { FileText } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

import { CareerSectionIcon } from "@/components/content/career-section-icon";
import { AnimatedListItem } from "@/components/ui/animated-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DisclosureChevron,
  DisclosureGuide,
  DisclosureLabel,
  disclosureTriggerClassName,
} from "@/components/ui/disclosure";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useListEntrance } from "@/hooks/use-list-entrance";
import {
  buildResumeComparison,
  compareWording,
  type ComparisonChange,
  type ComparisonFilters,
  type ComparisonGroup,
  type ComparisonRow,
  filterResumeComparison,
} from "@/lib/career/resume-comparison";
import type {
  CareerDocument,
  CareerResume,
} from "@/types-and-constants/career";

const sides = ["Left", "Right"] as const;
const initialFilters: ComparisonFilters = {
  show: "content",
  section: "all",
  change: "all",
};
const showOptions: { value: ComparisonFilters["show"]; label: string }[] = [
  { value: "content", label: "Content differences" },
  { value: "all", label: "All rows" },
];
const changeOptions: { value: ComparisonFilters["change"]; label: string }[] = [
  { value: "all", label: "All change types" },
  { value: "wording", label: "Wording" },
  { value: "inclusion", label: "Inclusion" },
  { value: "order", label: "Order" },
  { value: "source", label: "Wording source" },
];
const changeLabels: Record<ComparisonChange, string> = {
  wording: "Wording changed",
  inclusion: "Inclusion changed",
  order: "Order changed",
  source: "Wording source changed",
};

function resumeLabel(resume: CareerResume) {
  return `${resume.name || "Untitled resume"} (${resume.language})`;
}

function ResumeIdentity({
  resume,
  option = false,
}: {
  resume: CareerResume;
  option?: boolean;
}) {
  return (
    <>
      <FileText
        aria-hidden="true"
        className={cn(
          "text-(--resume-color)",
          option && "text-(--resume-color)!",
        )}
        data-resume-color={resume.color ?? "indigo"}
      />
      <span className="min-w-0 truncate" title={resumeLabel(resume)}>
        {resumeLabel(resume)}
      </span>
    </>
  );
}

function FilterSelect<T extends string>({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: T;
  items: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <Field className="min-w-0">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value}
        items={items}
        onValueChange={(next) => next !== null && onChange(next)}
      >
        <SelectTrigger id={id} className="w-full min-w-0">
          <SelectValue className="min-w-0">
            <span className="truncate">
              {items.find((item) => item.value === value)?.label}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function ComparisonCard({
  row,
  resumes,
  nested = false,
}: {
  row: ComparisonRow;
  resumes: readonly [CareerResume, CareerResume];
  nested?: boolean;
}) {
  const id = useId();
  const wordingChanged = row.changes.includes("wording");
  const segments =
    row.kind === "wording" &&
    wordingChanged &&
    resumes[0].language === resumes[1].language
      ? compareWording(
          [row.cells[0].value, row.cells[1].value],
          resumes[0].language,
        )
      : undefined;
  const showInclusion =
    row.changes.includes("inclusion") ||
    row.cells.every((cell) => cell.included === false);
  const markClassName =
    "bg-background text-foreground underline decoration-muted-foreground underline-offset-2";
  return (
    <AnimatedListItem itemId={row.id} data-list-id={row.id} surface="plain">
      <Card size="sm" role="group" aria-labelledby={id}>
        <CardHeader>
          <CardTitle
            id={id}
            className="wrap-anywhere"
            role="heading"
            aria-level={nested ? 4 : 3}
          >
            {row.label}
          </CardTitle>
          {row.changes.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {row.changes.map((change) => changeLabels[change]).join(" · ")}
            </p>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 @lg/comparison:grid-cols-2">
          {resumes.map((resume, side) => (
            <div
              key={resume.id}
              className="flex min-w-0 flex-col gap-2 rounded-lg border border-s-2 border-border [border-inline-start-color:var(--resume-color)] bg-muted/50 p-3"
              data-resume-color={resume.color ?? "indigo"}
            >
              <div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1">
                <p className="min-w-0 text-xs font-medium wrap-anywhere text-muted-foreground">
                  {sides[side]} · {resumeLabel(resume)}
                </p>
                {showInclusion && (
                  <Badge
                    variant={row.cells[side].included ? "secondary" : "outline"}
                  >
                    {row.cells[side].included ? "Included" : "Excluded"}
                  </Badge>
                )}
                {row.kind === "wording" && row.changes.includes("source") && (
                  <Badge variant="outline">
                    {row.cells[side].source === "custom"
                      ? "Custom wording"
                      : "Career wording"}
                  </Badge>
                )}
              </div>
              {row.kind === "order" ? (
                row.cells[side].items.length > 0 ? (
                  <ol
                    lang={resume.language}
                    className={cn(
                      "list-decimal ps-5 text-base wrap-anywhere",
                      row.changes.includes("order") && "font-medium",
                    )}
                  >
                    {row.cells[side].items.map(({ id, label }) => (
                      <li key={id}>{label}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">No items</p>
                )
              ) : row.cells[side].value ? (
                <p
                  lang={resume.language}
                  className="text-base wrap-anywhere whitespace-pre-wrap"
                >
                  {segments ? (
                    segments[side].map(({ text, changed }, index) =>
                      changed ? (
                        <mark key={index} className={markClassName}>
                          {text}
                        </mark>
                      ) : (
                        text
                      ),
                    )
                  ) : wordingChanged ? (
                    <mark className={markClassName}>
                      {row.cells[side].value}
                    </mark>
                  ) : (
                    row.cells[side].value
                  )}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {row.kind === "wording"
                    ? "No saved wording"
                    : "No saved value"}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </AnimatedListItem>
  );
}

function ComparisonGroupContent({
  group,
  resumes,
}: {
  group: ComparisonGroup;
  resumes: readonly [CareerResume, CareerResume];
}) {
  const list = useRef<HTMLDivElement>(null);
  useListEntrance({
    getElements: () =>
      Array.from(
        list.current?.querySelectorAll<HTMLElement>("[data-list-id]") ?? [],
      ),
    contextKey: group.id,
    stagger: "responsive",
  });

  return (
    <DisclosureGuide ref={list} className="flex flex-col gap-3">
      {group.rows.map((row) => (
        <ComparisonCard key={row.id} row={row} resumes={resumes} />
      ))}
      {group.entries.map((entry) => (
        <section key={entry.id} className="flex min-w-0 flex-col gap-3">
          <h3 className="text-sm font-medium wrap-anywhere">{entry.label}</h3>
          {entry.rows.map((row) => (
            <ComparisonCard key={row.id} row={row} resumes={resumes} nested />
          ))}
        </section>
      ))}
    </DisclosureGuide>
  );
}

export function ResumeComparison({
  document,
  initialLeftId,
}: {
  document: CareerDocument;
  initialLeftId?: string;
}) {
  const id = useId();
  const [pair, setPair] = useState<[string?, string?]>([
    initialLeftId,
    undefined,
  ]);
  const [filters, setFilters] = useState(initialFilters);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const left =
    document.resumes.find((resume) => resume.id === pair[0]) ??
    document.resumes[0];
  const right =
    document.resumes.find(
      (resume) => resume.id === pair[1] && resume.id !== left?.id,
    ) ?? document.resumes.find((resume) => resume.id !== left?.id);
  const groups = useMemo(
    () => (left && right ? buildResumeComparison(document, [left, right]) : []),
    [document, left, right],
  );
  const section = groups.some((group) => group.id === filters.section)
    ? filters.section
    : "all";
  const results = useMemo(
    () => filterResumeComparison(groups, { ...filters, section }),
    [filters, groups, section],
  );
  if (!left || !right) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Two saved resumes needed</EmptyTitle>
          <EmptyDescription>
            Create or duplicate a second resume to compare saved content.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  const resumes = [left, right] as const;
  const items = document.resumes.map((resume) => ({
    value: resume.id,
    label: resumeLabel(resume),
  }));
  const noDifferences =
    filters.show === "content" && results.contentDifferences === 0;
  return (
    <div className="@container/comparison flex min-w-0 flex-col gap-4">
      <p className="text-sm text-muted-foreground">Comparing saved content.</p>
      <FieldGroup className="grid grid-cols-1 gap-4 @lg/comparison:grid-cols-2">
        {resumes.map((resume, side) => (
          <Field key={side} className="min-w-0">
            <FieldLabel htmlFor={`${id}-resume-${side}`}>
              {sides[side]} resume
            </FieldLabel>
            <Select
              value={resume.id}
              items={items}
              onValueChange={(next) => {
                if (next === null) return;
                if (next === resumes[1 - side].id) setPair([right.id, left.id]);
                else setPair(side === 0 ? [next, right.id] : [left.id, next]);
              }}
            >
              <SelectTrigger
                id={`${id}-resume-${side}`}
                className="w-full min-w-0"
              >
                <SelectValue className="min-w-0">
                  <ResumeIdentity resume={resume} />
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {document.resumes.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <ResumeIdentity resume={item} option />
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        ))}
      </FieldGroup>
      <FieldGroup className="grid grid-cols-1 gap-4 @md/comparison:grid-cols-2 @xl/comparison:grid-cols-3">
        <FilterSelect
          label="Show"
          value={filters.show}
          items={showOptions}
          onChange={(show) => setFilters((current) => ({ ...current, show }))}
        />
        <FilterSelect
          label="Section"
          value={section}
          items={[
            { value: "all", label: "All sections" },
            ...groups.map(({ id, label }) => ({ value: id, label })),
          ]}
          onChange={(section) => {
            setFilters((current) => ({ ...current, section }));
            if (section !== "all")
              setExpanded((current) => ({ ...current, [section]: true }));
          }}
        />
        <FilterSelect
          label="Change type"
          value={filters.change}
          items={changeOptions}
          onChange={(change) =>
            setFilters((current) => ({ ...current, change }))
          }
        />
      </FieldGroup>
      <p role="status" className="text-sm text-muted-foreground">
        {results.matching} of {results.total} rows
      </p>
      {results.groups.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>
              {noDifferences
                ? "No content differences"
                : "No rows match these filters"}
            </EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setFilters(
                  noDifferences
                    ? { ...initialFilters, show: "all" }
                    : { ...initialFilters, show: filters.show },
                )
              }
            >
              {noDifferences ? "Show all rows" : "Clear filters"}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        results.groups.map((group, index) => {
          const open = expanded[group.id] ?? index === 0;
          return (
            <Collapsible
              key={group.id}
              open={open}
              onOpenChange={(value) =>
                setExpanded((current) => ({ ...current, [group.id]: value }))
              }
            >
              <h2 className="min-w-0">
                <CollapsibleTrigger
                  render={<Button variant="ghost" />}
                  className={cn(disclosureTriggerClassName, "min-h-8")}
                >
                  <DisclosureChevron />
                  {group.owner === "resume" ? (
                    <FileText aria-hidden="true" data-icon="inline-start" />
                  ) : (
                    <CareerSectionIcon
                      kind={group.owner}
                      icon={group.icon}
                      data-icon="inline-start"
                    />
                  )}
                  <DisclosureLabel>
                    {group.label}{" "}
                    <span className="text-muted-foreground">
                      ({group.count})
                    </span>
                  </DisclosureLabel>
                </CollapsibleTrigger>
              </h2>
              <CollapsibleContent>
                {open && (
                  <ComparisonGroupContent group={group} resumes={resumes} />
                )}
              </CollapsibleContent>
            </Collapsible>
          );
        })
      )}
    </div>
  );
}
