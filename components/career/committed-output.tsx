"use client";

import { cn } from "cn";
import { FileText, RefreshCw } from "lucide-react";
import { memo, useEffect, useState } from "react";

import { ResumeReadiness } from "@/components/career/resume-readiness";
import PdfPreview from "@/components/output/lazy-pdf-preview";
import { PdfPreviewPlaceholder } from "@/components/output/pdf-preview-placeholder";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type CommittedPreview,
  useCommittedPreview,
} from "@/hooks/output/use-committed-preview";
import type { CareerHead } from "@/stores/career/persistence";
import type { ResumeOutputTarget } from "@/types-and-constants/career";
import {
  devicePreferenceDefaults,
  type DevicePreferences,
} from "@/types-and-constants/settings";

/** Standalone committed preview that owns its own coordinator.
 * The workspace mounts {@link CommittedOutputView} with a coordinator owned above
 * the shell instead, so hiding the preview keeps the last PDF.
 * @param props Committed head, device preferences, destination resume, and issue navigation.
 * @returns Preview pane bound to a coordinator disposed on unmount.
 * @example <CommittedOutput head={head} onIssue={openIssue} />
 */
export const CommittedOutput = memo(function CommittedOutput({
  head,
  activeResumeId,
  onIssue,
  preferences = devicePreferenceDefaults,
  visible = true,
}: {
  head: CareerHead;
  preferences?: DevicePreferences;
  activeResumeId?: string;
  onIssue: (target: ResumeOutputTarget) => void;
  visible?: boolean;
}) {
  const preview = useCommittedPreview({ head, preferences, activeResumeId });
  return (
    <CommittedOutputView
      preview={preview}
      visible={visible}
      showSelector={!activeResumeId}
      onIssue={onIssue}
    />
  );
});

/** Render committed preview state without owning compiler or URL lifecycles.
 * When not visible, the PDF viewer is unmounted so its document, canvases, and
 * worker are released while the coordinator retains the PDF and in-flight job.
 * @param props Coordinator-backed preview, visibility, selector flag, and issue navigation.
 * @returns Preview header, retained-PDF label, viewer, and Issues footer.
 * @example <CommittedOutputView preview={preview} visible onIssue={openIssue} />
 */
export const CommittedOutputView = memo(function CommittedOutputView({
  preview,
  visible,
  showSelector,
  onIssue,
}: {
  preview: CommittedPreview;
  visible: boolean;
  showSelector: boolean;
  onIssue: (target: ResumeOutputTarget) => void;
}) {
  const { coordinator, state, head, active, source, sourceError, key } =
    preview;
  const [documentVisible, setDocumentVisible] = useState(
    () => typeof document === "undefined" || !document.hidden,
  );
  useEffect(() => {
    const update = () => setDocumentVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    coordinator.setVisible(visible && documentVisible);
    return () => coordinator.setVisible(false);
  }, [coordinator, visible, documentVisible]);
  const output = state.output;
  const pending = state.active !== null;
  const phase =
    state.status.kind === "preparing" ? "initializing" : "compiling";
  const error = state.status.kind === "failed" ? state.status : null;
  const compile = preview.refresh;
  if (!head || !active) return null;
  return (
    <section
      className="flex h-full min-h-0 flex-1 flex-col"
      aria-label="Committed resume output"
    >
      <div className="flex shrink-0 flex-col gap-3 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">PDF preview</h2>
          <Button
            variant="ghost"
            size="sm"
            disabled={!source || state.active === key || state.queued === key}
            aria-busy={pending}
            onClick={compile}
          >
            <RefreshCw
              aria-hidden="true"
              data-icon="inline-start"
              className={cn(pending && "motion-safe:animate-spin")}
            />
            {pending ? "Refreshing…" : "Refresh"}
            <span className="sr-only"> preview</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {preview.automaticRefresh ? "Automatic refresh" : "Manual refresh"} ·
          Saved content only
          {state.automaticPending && " · Refresh pending"}
        </p>
        {showSelector && (
          <Field>
            <FieldLabel htmlFor="existing-resume">Existing resume</FieldLabel>
            <Select
              value={active.id}
              items={head.document.resumes.map((resume) => ({
                value: resume.id,
                label: `${resume.name} (${resume.language})`,
              }))}
              onValueChange={(value) => {
                if (value) preview.selectResume(value);
              }}
            >
              <SelectTrigger id="existing-resume">
                <SelectValue>
                  <FileText
                    aria-hidden="true"
                    className="resume-color text-(--resume-color)"
                    data-resume-color={active.color ?? "indigo"}
                  />
                  {active.name || "Untitled resume"} ({active.language})
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {head.document.resumes.map((resume) => (
                    <SelectItem key={resume.id} value={resume.id}>
                      <FileText
                        aria-hidden="true"
                        className="resume-color text-(--resume-color)!"
                        data-resume-color={resume.color ?? "indigo"}
                      />
                      {resume.name || "Untitled resume"} ({resume.language})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        )}
        {(sourceError || error) && (
          <Alert variant="destructive">
            <AlertTitle>Preview could not be generated</AlertTitle>
            <AlertDescription className="wrap-anywhere">
              {sourceError || error?.message}
              {error?.timedOut &&
                " The compiler was stopped and restarts on the next refresh."}
              {error?.log && (
                <details className="mt-2">
                  <summary className="cursor-pointer">Compiler log</summary>
                  <pre className="mt-1 max-h-40 overflow-auto text-xs whitespace-pre-wrap">
                    {error.log}
                  </pre>
                </details>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {pending && output && (
          <p
            role="status"
            className="shrink-0 px-3 pb-2 text-xs text-muted-foreground"
          >
            {phase === "initializing"
              ? "Preparing your preview..."
              : "Generating your PDF..."}{" "}
            Your last successful preview stays available.
            {state.queued && " Another refresh is queued."}
          </p>
        )}
        {!output &&
          (pending ? (
            <PdfPreviewPlaceholder
              busy
              title={
                phase === "initializing"
                  ? "Preparing your preview"
                  : "Generating your PDF"
              }
              description={
                phase === "initializing"
                  ? "The first preview can take a moment to prepare. You can keep editing while we get things ready."
                  : "Turning your saved resume into a PDF. You can keep editing while it finishes."
              }
            />
          ) : sourceError || error ? (
            <PdfPreviewPlaceholder
              title="Let's try that again"
              description="Your saved content is safe. Try refreshing the preview again."
              onGenerate={source ? compile : undefined}
              actionLabel="Try again"
            />
          ) : !source ? (
            <PdfPreviewPlaceholder
              title="A few details need attention"
              description="Open Issues below to see what needs wording before this resume can become a PDF."
            />
          ) : (
            <PdfPreviewPlaceholder onGenerate={compile} />
          ))}
        {output && (
          <>
            <p className="shrink-0 px-3 text-xs text-muted-foreground">
              Last successful preview · {output.resumeName} ({output.language})
              · revision {output.revision} · generation {output.tag.generation}
              {output.key !== key ? " · Outdated" : " · Current"}
            </p>
            {visible && (
              <PdfPreview
                pageWarningThreshold={output.targetPages}
                document={{
                  key: output.key,
                  url: output.url,
                  fileName: `verso-${output.tag.resumeId}-${output.language}-${output.revision}.pdf`,
                }}
              />
            )}
          </>
        )}
      </div>
      <ResumeReadiness
        document={head.document}
        resume={active}
        onIssue={onIssue}
      />
    </section>
  );
});
