"use client";

import { cn } from "cn";
import { FileText, RefreshCw } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";

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
import { renderCareerResume } from "@/lib/career/output";
import { assessResumeOutput } from "@/lib/career/readiness";
import type { CareerHead } from "@/stores/career/persistence";
import { BrowserCompiler } from "@/tools/compiler-proof/compiler.mjs";
import type { ResumeOutputTarget } from "@/types-and-constants/career";
import {
  devicePreferenceDefaults,
  type DevicePreferences,
} from "@/types-and-constants/settings";

export const CommittedOutput = memo(function CommittedOutput({
  head,
  activeResumeId,
  onIssue,
  preferences = devicePreferenceDefaults,
}: {
  head: CareerHead;
  preferences?: DevicePreferences;
  activeResumeId?: string;
  onIssue: (target: ResumeOutputTarget) => void;
}) {
  const [resumeId, setResumeId] = useState("");
  const [output, setOutput] = useState<{
    url: string;
    key: string;
    revision: number;
    resumeId: string;
    resumeName: string;
    language: string;
    generation: number;
    targetPages: number;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [phase, setPhase] = useState<"initializing" | "compiling">(
    "initializing",
  );
  const [error, setError] = useState("");
  const compiler = useRef<BrowserCompiler | null>(null);
  const compilerSettings = useRef("");
  const latest = useRef("");
  const mounted = useRef(true);
  const active =
    head.document.resumes.find(
      (resume) => resume.id === (activeResumeId ?? resumeId),
    ) ?? head.document.resumes[0];
  const { source, sourceError } = useMemo(() => {
    if (!active || !assessResumeOutput(head.document, active.id).ready)
      return { source: "", sourceError: "" };
    try {
      return {
        source: renderCareerResume(head.document, active.id, head.revision),
        sourceError: "",
      };
    } catch (error) {
      return { source: "", sourceError: String(error) };
    }
  }, [head.document, head.revision, active]);
  const key = JSON.stringify([head.generation, active?.id, source]);
  useEffect(() => {
    latest.current = key;
  }, [key]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      compiler.current?.close();
      compiler.current = null;
    };
  }, []);
  useEffect(
    () => () => {
      if (output) URL.revokeObjectURL(output.url);
    },
    [output],
  );
  useEffect(() => {
    compiler.current?.close();
    compiler.current = null;
  }, [head.generation]);
  const compile = async () => {
    if (!active || !source || pending) return;
    setPending(true);
    setPhase(compiler.current ? "compiling" : "initializing");
    setError("");
    const jobKey = key;
    try {
      const settingsKey = JSON.stringify([
        preferences.initializationTimeoutMs,
        preferences.compilationTimeoutMs,
      ]);
      if (compiler.current && compilerSettings.current !== settingsKey) {
        compiler.current.close();
        compiler.current = null;
      }
      compilerSettings.current = settingsKey;
      compiler.current ??= new BrowserCompiler({
        assetBase: "/compiler/",
        initializationTimeoutMs: preferences.initializationTimeoutMs,
        compilationTimeoutMs: preferences.compilationTimeoutMs,
        onState: (state) => {
          if (
            mounted.current &&
            (state === "initializing" || state === "compiling")
          )
            setPhase(state);
        },
      });
      const result = await compiler.current.compile({
        source,
        snapshotId: jobKey,
        locale: active.language,
      });
      if (!mounted.current || latest.current !== jobKey) return;
      const url = URL.createObjectURL(
        new Blob([result.bytes.slice().buffer], { type: "application/pdf" }),
      );
      setOutput({
        url,
        key: jobKey,
        revision: head.revision,
        resumeId: active.id,
        resumeName: active.name,
        language: active.language,
        generation: head.generation,
        targetPages: active.layout.targetPages,
      });
    } catch (error) {
      if (mounted.current && latest.current === jobKey) setError(String(error));
    } finally {
      if (mounted.current) setPending(false);
    }
  };
  if (!active) return null;
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
            disabled={pending || !source}
            aria-busy={pending}
            onClick={() => void compile()}
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
          Manual refresh · Saved content only
        </p>
        {!activeResumeId && (
          <Field>
            <FieldLabel htmlFor="existing-resume">Existing resume</FieldLabel>
            <Select
              disabled={Boolean(activeResumeId)}
              value={active.id}
              items={head.document.resumes.map((resume) => ({
                value: resume.id,
                label: `${resume.name} (${resume.language})`,
              }))}
              onValueChange={(value) => {
                if (value) setResumeId(value);
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
              {sourceError || error}
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
              onGenerate={source ? () => void compile() : undefined}
              actionLabel="Try again"
            />
          ) : !source ? (
            <PdfPreviewPlaceholder
              title="A few details need attention"
              description="Open Issues below to see what needs wording before this resume can become a PDF."
            />
          ) : (
            <PdfPreviewPlaceholder onGenerate={() => void compile()} />
          ))}
        {output && (
          <>
            <p className="shrink-0 px-3 text-xs text-muted-foreground">
              Last successful preview · {output.resumeName} ({output.language})
              · revision {output.revision} · generation {output.generation}
              {output.key !== key ? " · Outdated" : " · Current"}
            </p>
            <PdfPreview
              pageWarningThreshold={output.targetPages}
              document={{
                key: output.key,
                url: output.url,
                fileName: `verso-${output.resumeId}-${output.language}-${output.revision}.pdf`,
              }}
            />
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
