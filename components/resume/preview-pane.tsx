"use client";

import { RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { useResumeCompiler } from "@/hooks/resume/use-resume-compiler";
import type { Locale } from "@/lib/resume/model";
import { validateOutput } from "@/lib/resume/model";

const PdfPreview = dynamic(() => import("@/components/resume/pdf-preview"), {
  ssr: false,
  loading: () => (
    <p className="p-8 text-sm text-muted-foreground">Loading PDF viewer…</p>
  ),
});
const statusLabels: Record<string, string> = {
  idle: "Ready",
  queued: "Preview queued",
  initializing: "Loading compiler",
  ready: "Compiler ready",
  compiling: "Compiling PDF",
  successful: "Preview ready",
  failed: "Needs attention",
  "timed-out": "Compilation timed out",
};

export function PreviewPane({
  compiler,
  validation,
  autoSync,
  setAutoSync,
  busy,
  locale,
}: {
  compiler: ReturnType<typeof useResumeCompiler>;
  validation: ReturnType<typeof validateOutput>;
  autoSync: boolean;
  setAutoSync: (value: boolean) => void;
  busy: boolean;
  locale: Locale;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background px-4 py-3">
        <span className="text-xs text-muted-foreground" role="status">
          {!autoSync && compiler.stale && !busy && !compiler.error
            ? "Auto-update paused · Refresh to update"
            : statusLabels[compiler.status] || compiler.status}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <Field orientation="horizontal" className="w-auto">
            <Checkbox
              id="preview-auto-sync"
              checked={autoSync}
              onCheckedChange={setAutoSync}
              aria-describedby="preview-auto-sync-help"
            />
            <FieldLabel htmlFor="preview-auto-sync">
              Auto-update preview
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
          >
            <RefreshCw data-icon="inline-start" />
            Refresh
          </Button>
        </div>
      </div>
      {validation.errors.length > 0 && (
        <Alert className="rounded-none border-x-0">
          <AlertTitle>Draft needs {locale} content</AlertTitle>
          <AlertDescription>
            {validation.errors
              .slice(0, 3)
              .map((error) => error.message)
              .join(" ")}
            {validation.errors.length > 3
              ? ` +${validation.errors.length - 3} more issues.`
              : ""}{" "}
            A valid individual language can still be downloaded.
          </AlertDescription>
        </Alert>
      )}
      {validation.warnings.length > 0 && (
        <Alert className="rounded-none border-x-0">
          <AlertTitle>
            {validation.warnings.length} translation review flag
            {validation.warnings.length === 1 ? "" : "s"}
          </AlertTitle>
          <AlertDescription>
            You can preview and download this draft while reviewing its wording.
          </AlertDescription>
        </Alert>
      )}
      {compiler.error && validation.errors.length === 0 && (
        <Alert variant="destructive" className="rounded-none">
          <AlertTitle>Compilation could not finish</AlertTitle>
          <AlertDescription>
            {compiler.error.message} Previous preview retained. If assets are
            missing, run npm run compiler:prepare.
          </AlertDescription>
        </Alert>
      )}
      <div className="min-h-0 flex-1">
        <PdfPreview
          key={compiler.preview?.key}
          output={compiler.preview}
          stale={compiler.stale}
        />
      </div>
      {(compiler.error?.log || compiler.preview?.log) && (
        <details className="border-t bg-background p-3">
          <summary className="cursor-pointer text-xs">
            Compiler diagnostics
          </summary>
          <pre className="mt-3 max-h-60 overflow-auto text-xs whitespace-pre-wrap">
            {compiler.error?.log || compiler.preview?.log}
          </pre>
        </details>
      )}
    </div>
  );
}
