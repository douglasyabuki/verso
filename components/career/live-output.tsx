"use client";

import { Download, FileText, Globe, RefreshCw } from "lucide-react";
import { useLayoutEffect, useSyncExternalStore } from "react";

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
import type { useLivePreview } from "@/hooks/output/use-live-preview";
import type { PdfViewPosition } from "@/hooks/output/use-pdf-document";
import type { CareerHead } from "@/stores/career/persistence";
import type { ResumePreview, SavedPreview } from "@/stores/output/live-preview";
import type {
  CareerResume,
  ResumeOutputTarget,
} from "@/types-and-constants/career";

type ReadingPosition = { identity: string; ref: { current: PdfViewPosition } };

function savedFile(output: SavedPreview) {
  return `verso-${output.tag.resumeId}-${output.language}-${output.revision}.pdf`;
}

/** Render a workspace's saved and draft lanes, including its staged viewer. */
export function LiveOutput({
  preview,
  head,
  resume,
  visible,
  showSelector,
  canPublish,
  onIssue,
  reading,
}: {
  preview: ReturnType<typeof useLivePreview>;
  head: CareerHead;
  resume: CareerResume;
  visible: boolean;
  showSelector: boolean;
  canPublish: boolean;
  onIssue: (target: ResumeOutputTarget) => void;
  reading: ReadingPosition;
}) {
  const { coordinator } = preview;
  const state = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getSnapshot,
  );
  const position = reading.ref;
  useLayoutEffect(() => {
    const update = () => coordinator.setVisible(visible && !document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      coordinator.setVisible(false);
    };
  }, [coordinator, visible]);
  const download = () =>
    coordinator.requestSaved("download", (saved) => {
      const link = document.createElement("a");
      link.href = saved.url;
      link.download = savedFile(saved);
      document.body.append(link);
      link.click();
      link.remove();
    });
  const stage = (output: ResumePreview | null) =>
    output
      ? {
          source: {
            key: output.key,
            url: output.url,
            fileName:
              output.kind === "saved"
                ? savedFile(output)
                : "verso-unsaved-draft.pdf",
          },
          targetPages: output.targetPages,
          onRendered: (next: PdfViewPosition) => {
            if (coordinator.promote(output)) position.current = next;
          },
          onFailure: (message: string) =>
            coordinator.viewerFailed(output, message),
        }
      : null;
  const { displayed, candidate, phase } = state;
  const waiting = phase === "pending" || phase === "updating";
  const current = phase === "idle";
  const status =
    phase === "paused"
      ? "Draft preview paused · Resolve save conflict"
      : phase === "failed"
        ? "Couldn’t update preview"
        : phase === "blocked"
          ? state.draft
            ? "Draft preview blocked"
            : "Saved PDF blocked"
          : phase === "updating"
            ? displayed?.kind === "draft" && !state.draft
              ? "Saved PDF updating"
              : "Updating preview…"
            : phase === "pending"
              ? state.draft
                ? "Draft changes pending"
                : "Saved PDF updating"
              : state.matchesSaved
                ? "Draft matches saved PDF"
                : "";
  const version =
    displayed?.kind === "draft"
      ? current
        ? "Draft PDF · Unsaved"
        : "Showing previous draft"
      : displayed
        ? `${current ? "Saved PDF" : "Showing saved PDF"} · Revision ${displayed.revision}`
        : "";
  const failure = state.savedFailure ?? state.failure;
  return (
    <section
      className="flex h-full min-h-0 flex-1 flex-col"
      aria-label="Resume PDF output"
    >
      <div className="flex shrink-0 flex-col gap-2 border-b p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">PDF preview</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={phase === "paused"}
              onClick={preview.commands.update}
            >
              <RefreshCw
                aria-hidden="true"
                data-icon="inline-start"
                className="motion-safe:group-hover/button:animate-spin"
              />
              Update preview
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-busy={state.actions.includes("download")}
              onClick={download}
            >
              <Download data-icon="inline-start" />
              Download saved PDF
            </Button>
            {canPublish && (
              <Button
                variant="outline"
                size="sm"
                aria-busy={state.actions.includes("publish")}
                data-publish-saved-pdf=""
                onClick={coordinator.publishSaved}
              >
                <Globe data-icon="inline-start" />
                Publish saved PDF
              </Button>
            )}
          </div>
        </div>
        <p role="status" className="text-xs text-muted-foreground">
          {[
            version,
            status,
            state.actions.length ? "Preparing saved PDF…" : "",
            state.savedFailure ? "Couldn’t prepare saved PDF" : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {state.saved && state.downloadUrl === state.saved.url && (
          <a
            className="w-fit text-xs underline"
            href={state.saved.url}
            download={savedFile(state.saved)}
          >
            Download saved PDF directly
          </a>
        )}
        {failure && (
          <Alert variant="destructive">
            <AlertTitle>
              {state.savedFailure ? "Saved PDF error" : "Preview error"}
            </AlertTitle>
            <AlertDescription>
              <details>
                <summary>Technical details</summary>
                <p className="wrap-anywhere">{failure.message}</p>
                {failure.log && (
                  <pre className="max-h-40 overflow-auto text-xs whitespace-pre-wrap">
                    {failure.log}
                  </pre>
                )}
              </details>
            </AlertDescription>
          </Alert>
        )}
        {showSelector && (
          <Field>
            <FieldLabel htmlFor="existing-resume">Existing resume</FieldLabel>
            <Select
              value={resume.id}
              items={head.document.resumes.map((item) => ({
                value: item.id,
                label: item.name || "Untitled resume",
              }))}
              onValueChange={(id) => {
                if (id) preview.selectResume(id);
              }}
            >
              <SelectTrigger id="existing-resume">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {head.document.resumes.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <FileText aria-hidden="true" />
                      {item.name || "Untitled resume"} ({item.language})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>
      {visible && (displayed || candidate) ? (
        <PdfPreview
          key={reading.identity}
          staging={{
            displayed: stage(displayed),
            candidate: stage(candidate),
            position,
          }}
          savedAction={download}
        />
      ) : (
        <PdfPreviewPlaceholder
          busy={waiting}
          announce={false}
          title={
            waiting
              ? "Updating preview…"
              : phase === "blocked"
                ? "A few details need attention"
                : undefined
          }
          description={
            phase === "blocked"
              ? "Open Issues to find the fields that need attention."
              : undefined
          }
        />
      )}
      <ResumeReadiness
        document={head.document}
        resume={resume}
        issues={state.issues}
        draft={state.draft}
        pending={waiting}
        onIssue={onIssue}
      />
    </section>
  );
}
