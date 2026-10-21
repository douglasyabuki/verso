"use client";

import { ChevronDown, ListChecks } from "lucide-react";
import { useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import type { useResumeCompiler } from "@/hooks/resume/use-resume-compiler";
import { resolveSettings } from "@/lib/resume/settings";
import type { validateOutput } from "@/lib/resume/validation";
import type {
  Issue,
  Locale,
  ResumeDocument,
  Variant,
} from "@/types-and-constants/resume";
import { locales } from "@/types-and-constants/resume";

type IssuesPanelProps = {
  document: ResumeDocument;
  variant: Variant;
  validation: Record<Locale, ReturnType<typeof validateOutput>>;
  compiler: ReturnType<typeof useResumeCompiler>;
  open: boolean;
  setOpen: (open: boolean) => void;
  onIssue: (issue: Issue) => void;
  disabled: boolean;
};

export function IssuesPanel({
  document,
  variant,
  validation,
  compiler,
  open,
  setOpen,
  onIssue,
  disabled,
}: IssuesPanelProps) {
  const id = useId();
  const [checking, setChecking] = useState(false);
  const languages = locales.map((locale) => {
    const layout = compiler.layoutFor(locale);
    const target = resolveSettings(document, variant, locale).targetPages;
    const pages = layout.result?.pageCount;
    const overflow: Issue[] =
      pages !== undefined && pages > target
        ? [
            {
              id: `${locale}:layout:targetPages`,
              category: "layout",
              locale,
              path: "settings.targetPages",
              section: "Whole output",
              entry: "Whole output",
              field: "Template page target",
              message: `${pages} pages exceeds the target of ${target}. Shorten wording, change variant selections, or adjust layout settings. Downloads remain available.`,
            },
          ]
        : [];
    const layoutTitle = layout.pending
      ? "Checking layout..."
      : layout.result?.error
        ? "Layout unavailable"
        : pages !== undefined
          ? overflow.length
            ? "Page target exceeded"
            : "Within page target"
          : layout.outdated
            ? "Layout out of date"
            : "Layout not checked";
    const layoutDescription = layout.pending
      ? "Waiting for the current compiled PDF and its page count."
      : (layout.result?.error ??
        (pages !== undefined
          ? `${pages} ${pages === 1 ? "page" : "pages"} / target ${target}. This checks page count, not clipping or overlapping text.`
          : validation[locale].errors.length
            ? "Fix this language's blocking errors before checking its layout."
            : "Check layout to compile this language. Older PDFs do not describe the current draft."));
    return {
      locale,
      ...validation[locale],
      layout,
      overflow,
      layoutTitle,
      layoutDescription,
    };
  });
  const errors = languages.reduce(
    (count, language) => count + language.errors.length,
    0,
  );
  const reviews = languages.reduce(
    (count, language) => count + language.warnings.length,
    0,
  );
  const layouts = languages.reduce(
    (count, language) => count + language.overflow.length,
    0,
  );
  const checkLayout = async (locale: Locale) => {
    setChecking(true);
    try {
      await compiler.getPdf(structuredClone(document), variant.id, locale);
    } catch {
      // The compiler exposes snapshot-scoped failures in this language's layout status.
    } finally {
      setChecking(false);
    }
  };
  return (
    <section
      className="flex shrink-0 flex-col border-t"
      aria-label="Active variant issues"
    >
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          <ListChecks data-icon="inline-start" />
          Issues ({errors + reviews + layouts})
          <ChevronDown data-icon="inline-end" />
        </Button>
        <div
          className="flex flex-wrap items-center gap-2"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <Badge variant={errors ? "destructive" : "outline"}>
            {errors} blocking
          </Badge>
          <Badge variant="secondary">{reviews} translation review</Badge>
          <Badge variant="outline">{layouts} layout</Badge>
        </div>
      </div>
      <div
        id={id}
        hidden={!open}
        className="max-h-[40dvh] overflow-auto overscroll-contain border-t px-4 py-3"
      >
        {open && (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              {variant.name || "Untitled variant"} / Only content used by this
              variant is checked. Shared-field issues affect both languages.
              Warnings never block downloads.
            </p>
            <div className="grid gap-6 lg:grid-cols-2">
              {languages.map((language) => (
                <section
                  key={language.locale}
                  className="flex min-w-0 flex-col gap-3"
                  aria-label={`${language.locale === "en-US" ? "English" : "Portuguese"} issues`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold">
                      {language.locale === "en-US" ? "English" : "Portuguese"}{" "}
                      <span className="text-muted-foreground">
                        {language.locale}
                      </span>
                    </h2>
                    <Badge
                      variant={
                        language.errors.length ? "destructive" : "outline"
                      }
                    >
                      {language.errors.length
                        ? "Output blocked"
                        : "Valid for export"}
                    </Badge>
                  </div>
                  <IssueGroup
                    title="Output-blocking errors"
                    issues={language.errors}
                    emptyTitle="No blocking errors"
                    emptyDescription="This language can be compiled and downloaded."
                    onIssue={onIssue}
                    disabled={disabled}
                  />
                  <IssueGroup
                    title="Translation-review warnings"
                    issues={language.warnings}
                    emptyTitle="No translation reviews"
                    emptyDescription="No included wording is flagged for review in this language."
                    onIssue={onIssue}
                    disabled={disabled}
                  />
                  <IssueGroup
                    title="Layout warnings"
                    issues={language.overflow}
                    emptyTitle={language.layoutTitle}
                    emptyDescription={language.layoutDescription}
                    onIssue={onIssue}
                    disabled={disabled}
                  />
                  {language.overflow.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {language.layoutDescription}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-start"
                    disabled={
                      disabled ||
                      checking ||
                      compiler.isPending ||
                      language.errors.length > 0
                    }
                    onClick={() => void checkLayout(language.locale)}
                  >
                    {language.layout.pending
                      ? "Checking layout..."
                      : "Check layout"}{" "}
                    ({language.locale === "en-US" ? "EN" : "PT"})
                  </Button>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function IssueGroup({
  title,
  issues,
  emptyTitle,
  emptyDescription,
  onIssue,
  disabled,
}: {
  title: string;
  issues: Issue[];
  emptyTitle: string;
  emptyDescription: string;
  onIssue: (issue: Issue) => void;
  disabled: boolean;
}) {
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <h3 className="text-xs font-medium">
        {title} ({issues.length})
      </h3>
      {issues.length ? (
        <ul className="flex flex-col gap-2">
          {issues.map((issue) => (
            <li
              key={issue.id}
              className="flex min-w-0 flex-col gap-1 rounded-lg border p-3"
            >
              <p className="text-xs text-muted-foreground">
                {issue.section} / {issue.entry} / {issue.locale}
              </p>
              {issue.target ? (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto justify-start self-start px-0 text-start whitespace-normal"
                  disabled={disabled}
                  onClick={() => onIssue(issue)}
                >
                  {issue.field}
                </Button>
              ) : (
                <p className="text-sm font-medium">{issue.field}</p>
              )}
              <p className="text-sm wrap-anywhere">{issue.message}</p>
            </li>
          ))}
        </ul>
      ) : (
        <Empty className="items-start p-3 text-start">
          <EmptyHeader className="items-start">
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            <EmptyDescription>{emptyDescription}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  );
}
