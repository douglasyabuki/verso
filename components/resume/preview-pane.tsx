"use client";

import { cn } from "cn";
import {
  ChevronRight,
  CircleAlert,
  FileText,
  ListChecks,
  RefreshCw,
} from "lucide-react";
import dynamic from "next/dynamic";

import { PreviewStatusBadge } from "@/components/resume/semantic-badges/preview-status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
} from "@/components/ui/code-block";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useResumeCompiler } from "@/hooks/resume/use-resume-compiler";
import { formatCount } from "@/lib/format-count";
import { validateOutput } from "@/lib/resume/validation";
import type { Locale } from "@/types-and-constants/languages";
import { languageNames } from "@/types-and-constants/languages";

const PdfPreview = dynamic(() => import("@/components/resume/pdf-preview"), {
  ssr: false,
  loading: () => (
    <p className="p-8 text-sm text-muted-foreground">Loading PDF viewer…</p>
  ),
});
const statusLabels: Record<string, string> = {
  idle: "Ready",
  queued: "Preview queued",
  initializing: "Starting PDF tools",
  ready: "Ready to create PDF",
  compiling: "Creating PDF",
  successful: "Preview ready",
  failed: "Needs attention",
  "timed-out": "PDF creation took too long",
};

export function PreviewPane({
  compiler,
  validation,
  autoSync,
  setAutoSync,
  busy,
  locale,
  onIssues,
}: {
  compiler: ReturnType<typeof useResumeCompiler>;
  validation: ReturnType<typeof validateOutput>;
  autoSync: boolean;
  setAutoSync: (value: boolean) => void;
  busy: boolean;
  locale: Locale;
  onIssues: () => void;
}) {
  const compilerLog = compiler.error?.log || compiler.preview?.log;

  return (
    <section
      className="flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto"
      aria-label="PDF preview"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b bg-background px-3 py-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <FileText className="size-4 shrink-0" />
          <span className="text-sm font-medium">PDF preview</span>
          {compiler.preview && (
            <>
              <PreviewStatusBadge
                state={compiler.stale ? "stale" : "current"}
              />
              <span className="text-xs text-muted-foreground">
                Version {compiler.preview.revision} ·{" "}
                {compiler.preview.locale === "pt-BR"
                  ? languageNames["pt-BR"]
                  : compiler.preview.locale === "en-US"
                    ? languageNames["en-US"]
                    : compiler.preview.locale}
              </span>
            </>
          )}
        </div>
        <span className="text-xs text-muted-foreground" role="status">
          {!autoSync && compiler.stale && !busy && !compiler.error
            ? "Auto-update paused · Refresh to update"
            : statusLabels[compiler.status] || compiler.status}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Field orientation="horizontal" className="w-auto">
            <Checkbox
              id="preview-auto-sync"
              checked={autoSync}
              onCheckedChange={setAutoSync}
              aria-describedby="preview-auto-sync-help"
            />
            <FieldLabel htmlFor="preview-auto-sync">
              Auto-update<span className="sr-only"> preview</span>
            </FieldLabel>
            <span id="preview-auto-sync-help" className="sr-only">
              Update the PDF preview after 800 milliseconds without changes.
              Turn off to refresh manually.
            </span>
          </Field>
          <Button
            variant="ghost"
            size="sm"
            onClick={compiler.refresh}
            disabled={busy}
            aria-busy={compiler.isPending}
          >
            <RefreshCw
              data-icon="inline-start"
              className={cn(compiler.isPending && "motion-safe:animate-spin")}
            />
            {compiler.isPending ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>
      {validation.errors.length > 0 && (
        <Alert
          variant="destructive"
          className="shrink-0 rounded-none border-x-0"
        >
          <CircleAlert aria-hidden="true" />
          <AlertTitle>
            Check this resume’s {languageNames[locale]} details
          </AlertTitle>
          <AlertDescription>
            {validation.errors
              .slice(0, 3)
              .map((error) => error.message)
              .join(" ")}
            {validation.errors.length > 3
              ? ` +${validation.errors.length - 3} more issues.`
              : ""}{" "}
            <Button variant="outline" size="sm" onClick={onIssues}>
              Review blocking issues
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {validation.warnings.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
          <Badge variant="attention">
            <ListChecks data-icon="inline-start" />
            {formatCount(
              validation.warnings.length,
              "review item",
              "text to review",
            )}
            <InfoHint label="text to review and downloads" variant="badge">
              You can still preview and download a resume with review reminders.
            </InfoHint>
          </Badge>
          <Button variant="ghost" size="sm" onClick={onIssues}>
            Review issues
          </Button>
        </div>
      )}
      {compiler.error && validation.errors.length === 0 && (
        <Alert variant="destructive" className="shrink-0 rounded-none">
          <AlertTitle>Could not create the PDF</AlertTitle>
          <AlertDescription>
            {compiler.error.message} Your previous preview is still available.
            Open PDF generation details for technical information.
          </AlertDescription>
        </Alert>
      )}
      <PdfPreview key={compiler.preview?.key} output={compiler.preview} />
      {compilerLog && (
        <Collapsible className="min-w-0 shrink-0 border-t bg-background px-3 py-2">
          <CollapsibleTrigger
            render={<Button variant="ghost" size="xs" />}
            className="group"
          >
            <ChevronRight
              data-icon="inline-start"
              className="transition-transform group-data-panel-open:rotate-90"
            />
            PDF generation details
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CodeBlock size="sm" className="mt-2">
              <CodeBlockActions>
                <CodeBlockCopyButton value={compilerLog} />
              </CodeBlockActions>
              <ScrollArea
                className="max-h-[min(12rem,20dvh)] min-w-0"
                viewportProps={{
                  role: "region",
                  "aria-label": "PDF generation details log",
                }}
              >
                <CodeBlockContent
                  wrap
                  tabIndex={-1}
                  className="overflow-visible pe-10 wrap-anywhere"
                >
                  {compilerLog}
                </CodeBlockContent>
              </ScrollArea>
            </CodeBlock>
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  );
}
