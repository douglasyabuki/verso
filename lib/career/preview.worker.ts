import { ZodError } from "zod";

import { checkWordingReferences, previewResumeScope } from "@/lib/career/model";
import { renderCareerOutput } from "@/lib/career/output";
import type {
  PreviewRequest,
  PreviewWorkerInput,
  PreviewWorkerOutput,
} from "@/lib/career/preview-protocol";
import { assessResumeOutput } from "@/lib/career/readiness";
import { BrowserCompiler } from "@/tools/compiler-proof/compiler.mjs";
import {
  type CareerDocument,
  type CareerEntry,
  type CareerResume,
  type CareerSection,
  mib,
  type ResumeOutputIssue,
  WORKSPACE_BYTES,
} from "@/types-and-constants/career";
import { compilerTimeouts } from "@/types-and-constants/settings";

const projection = new Map<string, unknown>();
let patches: Map<string, string | null> | undefined;
let latest = 0;
const compiler = new BrowserCompiler({
  assetBase: "/compiler/",
  ...compilerTimeouts,
});
const send = (message: PreviewWorkerOutput, transfer: Transferable[] = []) =>
  (
    self as unknown as {
      postMessage(message: PreviewWorkerOutput, transfer: Transferable[]): void;
    }
  ).postMessage(message, transfer);

/** Reconstruct the projected rendering inputs and prepare one version.
 * @param request Frozen version and eligible retained fingerprints.
 * @returns Emits the result, versioned issues, or a failure.
 * @example await run(request)
 */
async function run(request: PreviewRequest) {
  const { id, draft, resumeId, revision, reuse } = request;
  const fresh = () => latest === id;
  const parse = <T>(key: string): T => projection.get(key) as T;
  const resume: CareerResume = { overrides: {} } as CareerResume;
  const sections = new Map<string, CareerSection>();
  const entries: [string, CareerEntry][] = [];
  const values = Object.create(null);
  const targets = new Map<string, "plain" | "rich">();
  for (const key of projection.keys()) {
    const slash = key.indexOf("/");
    if (slash < 0) continue;
    const name = key.slice(slash + 1);
    switch (key.slice(0, slash)) {
      case "resume":
        Object.assign(resume, { [name]: parse(key) });
        break;
      case "override":
        Object.defineProperty(resume.overrides, name, {
          value: parse(key),
          enumerable: true,
        });
        break;
      case "section":
        sections.set(name, {
          ...parse<Omit<CareerSection, "entries">>(key),
          entries: [],
        });
        break;
      case "entry":
        entries.push(parse(key));
        break;
      case "draft":
        values[name] = parse(key);
        break;
      case "target":
        targets.set(name, parse(key));
        break;
    }
  }
  for (const [section, entry] of entries)
    sections.get(section)?.entries.push(entry);
  const document = {
    profile: parse<CareerDocument["profile"]>("profile"),
    summary: parse<CareerDocument["summary"]>("summary"),
    sections: [...sections.values()],
    resumes: [resume],
  };
  try {
    const baselineIssues =
      draft?.scope === "resume-content"
        ? new Set(
            assessResumeOutput(document, resumeId).issues.map(
              (issue) => issue.id,
            ),
          )
        : null;
    if (draft) {
      const issues: ResumeOutputIssue[] = [];
      const add = (message: string, fieldId = "") =>
        issues.push({
          id: `validation-${issues.length}`,
          code: "invalid-draft",
          recordId: fieldId,
          message,
          target: fieldId
            ? { destination: `${draft.scope}/${resumeId}`, fieldId }
            : undefined,
        });
      try {
        const input =
          projection.get("draftShape") === "record"
            ? { ...values }
            : projection.has("draftValue")
              ? parse("draftValue")
              : undefined;
        Object.assign(
          resume,
          previewResumeScope(document, resume, draft.scope, input),
        );
        if (draft.scope === "resume-wording")
          checkWordingReferences(
            resume.overrides,
            (key) => targets.get(key),
            add,
          );
        if (
          parse<number>("outsideBytes") +
            new TextEncoder().encode(JSON.stringify(resume)).length >
          WORKSPACE_BYTES
        )
          add(`Workspace exceeds ${mib(WORKSPACE_BYTES)}.`);
      } catch (error) {
        if (error instanceof ZodError)
          for (const issue of error.issues)
            add(issue.message, String(issue.path[0] ?? ""));
        else add(error instanceof Error ? error.message : String(error));
      }
      if (issues.length) {
        send({ kind: "blocked", id, issues });
        return;
      }
    }
    const assessment = assessResumeOutput(document, resumeId);
    if (!assessment.ready) {
      const fullName = document.profile.fields.find(
        (field) => field.key === "fullName",
      )?.id;
      const issues = assessment.issues.map((issue) =>
        baselineIssues &&
        !baselineIssues.has(issue.id) &&
        issue.target &&
        issue.recordId !== fullName
          ? {
              ...issue,
              wordingTarget: issue.target,
              target: {
                destination: `resume-content/${resumeId}`,
                fieldId: issue.recordId,
              },
            }
          : issue,
      );
      send({ kind: "blocked", id, issues });
      return;
    }
    if (request.inspect) {
      send({ kind: "inspected", id });
      return;
    }
    const { source, fingerprint } = renderCareerOutput(
      document,
      resumeId,
      draft ? null : revision,
    );
    const result = {
      id,
      fingerprint,
      targetPages: resume.layout.targetPages,
      template: resume.template,
    };
    const matching =
      reuse.saved === fingerprint
        ? "saved"
        : draft && reuse.draft === fingerprint
          ? "draft"
          : null;
    if (matching) {
      send({ kind: "ready", result: { ...result, reuse: matching } });
      return;
    }
    // Let supersession messages through before starting initialization/TeX.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (!fresh()) {
      send({ kind: "obsolete", id });
      return;
    }
    const compiled = await compiler.compile({
      source,
      snapshotId: String(id),
      locale: resume.language,
      current: fresh,
    });
    if (fresh())
      send({ kind: "ready", result: { ...result, bytes: compiled.bytes } }, [
        compiled.bytes.buffer as ArrayBuffer,
      ]);
    else send({ kind: "obsolete", id });
  } catch (error) {
    if (!fresh()) send({ kind: "obsolete", id });
    else
      send({
        kind: "failed",
        id,
        message: String(error),
        log: String((error as { log?: string }).log ?? ""),
      });
  }
}

self.onmessage = ({ data }: MessageEvent<PreviewWorkerInput>) => {
  const id = data.kind === "run" ? data.request.id : data.id;
  if (data.kind === "supersede") {
    latest = Math.max(latest, id + 1);
    patches = undefined;
    return;
  }
  if (data.kind === "begin") {
    latest = id;
    patches = new Map();
    send({ kind: "ack", id });
  } else if (data.kind === "pieces" && patches && latest === id) {
    for (const [key, text, append] of data.pieces)
      patches.set(key, append ? patches.get(key) + text! : text);
    send({ kind: "ack", id });
  } else if (data.kind === "run" && patches && latest === id) {
    for (const [key, value] of patches) {
      if (value === null) projection.delete(key);
      else projection.set(key, JSON.parse(value));
    }
    patches = undefined;
    void run(data.request).catch((error) =>
      send({ kind: "failed", id, message: String(error), log: "" }),
    );
  }
};
