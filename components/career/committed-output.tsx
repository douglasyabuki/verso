"use client";

import { FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
import { outputCapabilities, renderCareerResume } from "@/lib/career/output";
import type { CareerHead } from "@/stores/career/persistence";
import { BrowserCompiler } from "@/tools/compiler-proof/compiler.mjs";

export function CommittedOutput({ head }: { head: CareerHead }) {
  const [resumeId, setResumeId] = useState("");
  const [output, setOutput] = useState<{
    url: string;
    key: string;
    revision: number;
    resumeId: string;
    resumeName: string;
    language: string;
    generation: number;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const compiler = useRef<BrowserCompiler | null>(null);
  const latest = useRef("");
  const mounted = useRef(true);
  const active =
    head.document.resumes.find((resume) => resume.id === resumeId) ??
    head.document.resumes[0];
  let source = "";
  let sourceError = "";
  try {
    if (active)
      source = renderCareerResume(head.document, active.id, head.revision);
  } catch (error) {
    sourceError = String(error);
  }
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
    setError("");
    const jobKey = key;
    try {
      compiler.current ??= new BrowserCompiler({
        assetBase: "/compiler/",
        initializationTimeoutMs: 120_000,
        compilationTimeoutMs: 30_000,
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
      className="flex flex-col gap-3"
      aria-label="Committed resume output"
    >
      <h2 className="text-xl font-semibold">Committed resume output</h2>
      <p>
        Manual refresh. Unsaved forms never enter output. Activation does not
        revoke supported PDF output.
      </p>
      <Field>
        <FieldLabel htmlFor="existing-resume">Existing resume</FieldLabel>
        <Select
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
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {head.document.resumes.map((resume) => (
                <SelectItem key={resume.id} value={resume.id}>
                  <FileText aria-hidden="true" />
                  {resume.name} ({resume.language})
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      {!outputCapabilities[active.language] && (
        <p>PDF unavailable · language rendering is unverified.</p>
      )}
      <Button disabled={pending || !source} onClick={() => void compile()}>
        {pending ? "Compiling committed snapshot…" : "Refresh preview"}
      </Button>
      {(sourceError || error) && <p role="alert">{sourceError || error}</p>}
      {output && (
        <>
          <p>
            Last successful preview · {output.resumeName} ({output.language}) ·
            revision {output.revision} · generation {output.generation}
            {output.key !== key ? " · Outdated" : " · Current"}
          </p>
          <a
            href={output.url}
            download={`verso-${output.resumeId}-${output.language}-${output.revision}.pdf`}
          >
            Download PDF · revision {output.revision}
          </a>
          <iframe
            title="Last successful resume preview"
            src={output.url}
            className="h-[600px] w-full rounded-lg border"
          />
        </>
      )}
    </section>
  );
}
