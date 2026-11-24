import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createCareerDocument,
  createEntry,
  parsePortable,
  validateDocument,
} from "@/lib/career/model";
import { renderCareerResume } from "@/lib/career/output";
import { oversizedRecovery, recoveryFiles } from "@/lib/career/recovery-export";
import {
  renderWording,
  richTextSchema,
  wordingText,
} from "@/lib/career/wording";
import {
  type CareerDraft,
  DRAFT_BYTES,
  RECOVERY_BYTES,
  WORKSPACE_BYTES,
} from "@/types-and-constants/career";

function draft(index: number): CareerDraft {
  return {
    draftId: `draft-${index}`,
    draftVersion: 2,
    workspaceId: "workspace",
    scope: "summary",
    baselineRevision: 0,
    generation: 0,
    baseline: {},
    values: { wording: { "en-US": "á🙂\n".repeat(100) } },
  };
}

describe("career wording and recovery files", () => {
  it("round-trips rich prose and plain short wording without permitting unsafe marks", () => {
    const document = createCareerDocument();
    const spans = [
      {
        text: "Ação & delivery",
        emphasis: true,
        href: "https://example.com/?a=1&b=2",
      },
    ];
    document.summary.wording["en-US"] = spans;
    const entry = createEntry("experience");
    entry.achievements.push({
      id: "achievement",
      archived: false,
      wording: { "en-US": spans },
    });
    document.sections[0].entries.push(entry);
    const source = JSON.stringify({
      format: "verso.workspace",
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      workspaceId: "workspace",
      document,
    });
    expect(parsePortable(source, "workspace")).toMatchObject({ document });
    expect(wordingText(spans)).toBe("Ação & delivery");
    expect(renderWording(spans)).toContain("\\textit{Ação \\& delivery}");
    expect(renderWording("\\input{evil}")).toContain("\\textbackslash{}");
    expect(
      richTextSchema.safeParse([{ ...spans[0], href: "javascript:alert(1)" }])
        .success,
    ).toBe(false);
    expect(
      richTextSchema.safeParse([{ ...spans[0], text: "x".repeat(20_001) }])
        .success,
    ).toBe(false);
    document.resumes.push({
      id: "resume",
      name: "",
      language: "en-US",
      template: "yabuki-reference@1.0.3",
      selection: [],
      overrides: { [document.profile.fields[0].id]: spans },
      layout: document.defaults,
    });
    expect(() => validateDocument(document)).toThrow(/only in summaries/);
    document.resumes[0].overrides = { [document.summary.id]: spans };
    expect(() => validateDocument(document)).not.toThrow();
  });

  it("splits recovery into independently importable bounded files with a complete manifest", () => {
    const drafts = [draft(1), draft(2), draft(3)];
    const files = [
      ...recoveryFiles(drafts, "workspace", {
        fileBytes: 2200,
        draftBytes: 2000,
      }),
    ];
    expect(
      files.every(
        (file) => new TextEncoder().encode(file.content).byteLength <= 2200,
      ),
    ).toBe(true);
    const envelopes = files.map((file) => JSON.parse(file.content));
    const normal = envelopes.filter((item) => item.format === "verso.recovery");
    expect(normal.length).toBeGreaterThan(1);
    expect(
      normal.flatMap((item) =>
        (() => {
          const parsed = parsePortable(JSON.stringify(item), "recovery");
          return parsed.format === "verso.recovery" ? parsed.drafts : [];
        })(),
      ),
    ).toEqual(drafts);
    expect(
      envelopes
        .filter((item) => item.format === "verso.recovery.manifest")
        .flatMap((item) => item.files)
        .flatMap((item) => item.drafts),
    ).toEqual(
      drafts.map(({ draftId, draftVersion }) => ({ draftId, draftVersion })),
    );
  });

  it("preserves every UTF-16 unit of oversized malformed recovery in explicit raw chunks", () => {
    const value = draft(4);
    expect(oversizedRecovery([value], 300)).toEqual([value.draftId]);
    const before = structuredClone(value);
    const files = [
      ...recoveryFiles([value], "workspace", {
        fileBytes: 1100,
        draftBytes: 300,
      }),
    ];
    const chunks = files
      .map((file) => JSON.parse(file.content))
      .filter((item) => item.format === "verso.recovery.raw");
    expect(chunks.length).toBeGreaterThan(1);
    expect(
      JSON.parse(
        chunks
          .sort((a, b) => a.index - b.index)
          .map((item) => item.data)
          .join(""),
      ),
    ).toEqual(value);
    expect(
      files.every(
        (file) => new TextEncoder().encode(file.content).byteLength <= 1100,
      ),
    ).toBe(true);
    expect(value).toEqual(before);
    expect(() =>
      parsePortable(JSON.stringify(chunks[0]), "recovery"),
    ).toThrow();
  });

  it("paginates even one normal file's large manifest inventory without dropping draft versions", () => {
    const drafts = Array.from({ length: 30 }, (_, i) => ({
      ...draft(i),
      baseline: null,
      values: "",
    }));
    const files = [
      ...recoveryFiles(drafts, "w".repeat(120), {
        fileBytes: 1800,
        draftBytes: 1500,
      }),
    ];
    const inventory = files
      .map((file) => {
        expect(
          new TextEncoder().encode(file.content).byteLength,
        ).toBeLessThanOrEqual(1800);
        return JSON.parse(file.content);
      })
      .filter((item) => item.format === "verso.recovery.manifest");
    expect(inventory.length).toBeGreaterThan(1);
    expect(inventory.map((item) => item.page)).toEqual(
      inventory.map((_, i) => i + 1),
    );
    expect(inventory.every((item) => item.pages === inventory.length)).toBe(
      true,
    );
    expect(
      inventory.flatMap((item) => item.files).flatMap((item) => item.drafts),
    ).toEqual(
      drafts.map(({ draftId, draftVersion }) => ({ draftId, draftVersion })),
    );
  });
});

it("accepts exact UTF-8 file ceilings including envelope overhead and rejects one extra byte", () => {
  for (const kind of ["workspace", "recovery"] as const) {
    const ceiling = kind === "workspace" ? WORKSPACE_BYTES : RECOVERY_BYTES;
    const envelope =
      kind === "workspace"
        ? {
            format: "verso.workspace",
            schemaVersion: 2,
            exportedAt: "2026-11-03T12:00:00.000Z",
            workspaceId: "boundary",
            document: createCareerDocument(),
          }
        : {
            format: "verso.recovery",
            schemaVersion: 1,
            exportedAt: "2026-11-03T12:00:00.000Z",
            sourceWorkspaceId: "boundary",
            drafts: [],
          };
    const json = JSON.stringify(envelope);
    const source =
      json + " ".repeat(ceiling - new TextEncoder().encode(json).byteLength);
    expect(() => parsePortable(source, kind)).not.toThrow();
    expect(() => parsePortable(source + " ", kind)).toThrow(/byte limit/);
  }
}, 60_000);

it("preserves an exact 8-MiB recovery draft and exports the next byte only as explicit raw chunks", () => {
  const ceiling = DRAFT_BYTES;
  const draft: CareerDraft = {
    draftId: "boundary",
    draftVersion: 1,
    workspaceId: "workspace",
    scope: "summary",
    generation: 0,
    baselineRevision: 0,
    baseline: null,
    values: "",
  };
  draft.values = "x".repeat(
    ceiling - new TextEncoder().encode(JSON.stringify(draft)).byteLength,
  );
  const normal = recoveryFiles([draft], "workspace").next().value!;
  const parsed = parsePortable(normal.content, "recovery");
  expect(parsed.format === "verso.recovery" && parsed.drafts[0].draftId).toBe(
    "boundary",
  );
  draft.values += "x";
  const raw = recoveryFiles([draft], "workspace").next().value!;
  expect(JSON.parse(raw.content).format).toBe("verso.recovery.raw");
  const oversized = JSON.stringify({
    format: "verso.recovery",
    schemaVersion: 1,
    exportedAt: "2026-11-03T12:00:00.000Z",
    sourceWorkspaceId: "workspace",
    drafts: [draft],
  });
  expect(() => parsePortable(oversized, "recovery")).toThrow(
    /draft exceeds 8 MiB/,
  );
}, 60_000);

it("reassembles Unicode raw chunks in any order and rejects incomplete or duplicate chunks without overwriting", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "verso-recovery-"));
  const script = path.resolve("tools/reassemble-recovery.mjs");
  const destination = path.join(directory, "draft.json");
  const draft = { draftId: "draft", draftVersion: 1, values: "A\ud83d\ude42B" };
  const source = JSON.stringify(draft);
  const split = source.indexOf("\ud83d") + 1;
  const paths = [
    path.join(directory, "chunk1.json"),
    path.join(directory, "chunk2.json"),
  ];
  try {
    for (let i = 0; i < 2; i++)
      await writeFile(
        paths[i],
        JSON.stringify({
          format: "verso.recovery.raw",
          schemaVersion: 1,
          encoding: "json-text-fragment",
          sourceWorkspaceId: "workspace",
          draftId: "draft",
          draftVersion: 1,
          index: i,
          chunks: 2,
          data: i ? source.slice(split) : source.slice(0, split),
        }),
      );
    expect(() =>
      execFileSync(process.execPath, [script, destination, paths[0]], {
        stdio: "pipe",
      }),
    ).toThrow();
    expect(() =>
      execFileSync(
        process.execPath,
        [script, destination, paths[0], paths[0]],
        { stdio: "pipe" },
      ),
    ).toThrow();
    execFileSync(process.execPath, [script, destination, paths[1], paths[0]], {
      stdio: "pipe",
    });
    expect(JSON.parse(await readFile(destination, "utf8"))).toEqual(draft);
    expect(() =>
      execFileSync(process.execPath, [script, destination, ...paths], {
        stdio: "pipe",
      }),
    ).toThrow();
    expect(JSON.parse(await readFile(destination, "utf8"))).toEqual(draft);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("accepts 120 independent resumes, 2,000 entries, and maximum nested shapes without truncation", () => {
  const document = createCareerDocument();
  document.sections = [];
  for (let sectionIndex = 0; sectionIndex < 7; sectionIndex++) {
    const entries = Array.from({ length: sectionIndex === 6 ? 200 : 300 }, () =>
      createEntry("experience"),
    );
    document.sections.push({
      id: `section-${sectionIndex}`,
      kind: "experience",
      icon: "briefcase-business",
      name: "",
      archived: false,
      heading: {},
      entries,
    });
  }
  const entry = document.sections[0].entries[0];
  entry.achievements = Array.from({ length: 100 }, (_, index) => ({
    id: `achievement-${index}`,
    archived: false,
    wording: { "en-US": "A".repeat(8_000) },
  }));
  entry.links = Array.from({ length: 30 }, (_, index) => ({
    id: `link-${index}`,
    archived: false,
    url: "https://example.com/" + "x".repeat(3980),
    label: { "en-US": "L".repeat(4_000) },
  }));
  document.resumes = Array.from({ length: 120 }, (_, index) => ({
    id: `resume-${index}`,
    name: "",
    language: "en-US",
    template: "yabuki-reference@1.0.3",
    selection: [],
    overrides: {},
    layout: { ...document.defaults },
  }));
  const result = validateDocument(document);
  expect(result.resumes).toHaveLength(120);
  expect(result.sections.flatMap((section) => section.entries)).toHaveLength(
    2_000,
  );
  expect(result.sections[0].entries[0].achievements).toHaveLength(100);
  expect(result.sections[0].entries[0].links).toHaveLength(30);
  result.sections[6].entries.push(createEntry("experience"));
  expect(() => validateDocument(result)).toThrow(/2,000 career entries/);
  result.sections[6].entries.pop();
  result.resumes.push({ ...result.resumes[0], id: "overflow" });
  expect(() => validateDocument(result)).toThrow();
}, 20_000);

it("imports the downloadable schema-2 sample and renders both complete language selections", () => {
  const source = readFileSync(
    "public/examples/alex-morgan.schema-2.json",
    "utf8",
  );
  const envelope = parsePortable(source, "workspace");
  if (envelope.format !== "verso.workspace")
    throw new Error("Expected workspace");
  const { document } = envelope;

  expect(document.sections.map((section) => section.kind)).toEqual([
    "experience",
    "projects",
    "education",
    "skills",
    "certifications",
    "custom",
  ]);
  expect(document.sections.map((section) => section.entries.length)).toEqual([
    3, 3, 3, 3, 3, 1,
  ]);
  expect(document.resumes.map((resume) => resume.language)).toEqual([
    "en-US",
    "pt-BR",
  ]);
  expect(document.resumes.map((resume) => resume.name)).toEqual([
    "Alex Morgan · English",
    "Alex Morgan · Português",
  ]);
  expect(document.resumes.map((resume) => resume.color)).toEqual([
    "rose",
    "emerald",
  ]);
  expect(
    document.resumes.map((resume) => resume.layout.contactLocation),
  ).toEqual(["combined", "combined"]);
  expect(source).not.toContain("?");
  for (const resume of document.resumes) {
    const output = renderCareerResume(document, resume.id, 1);
    expect(output).toContain("Alex Morgan");
    // The pinned fontawesome5 package exposes alternate icons with a star,
    // rather than an Alt-suffixed control sequence.
    expect(output).toContain("\\faMapMarker*");
    expect(output).not.toContain("\\faMapMarkerAlt");
    expect(output).toContain(
      resume.language === "en-US" ? "Curitiba, Brazil" : "Curitiba, Brasil",
    );
    expect(output).toContain("DEMO-2024-001");
    expect(output).toContain("https://example.com/project");
    expect(output).toContain(
      resume.language === "en-US" ? "Frontend Engineer" : "Engenheiro Frontend",
    );
    expect(output).toContain(
      resume.language === "en-US" ? "Volunteer mentor" : "Mentoria voluntária",
    );
    expect(output).toContain("\\textit{");
    for (const section of document.sections) {
      const selected = resume.selection.find(
        (item) => item.sectionId === section.id,
      )!;
      expect(selected.entryIds).toHaveLength(section.entries.length);
      for (const entry of section.entries) {
        for (const field of entry.fields.filter((item) => item.type === "text"))
          expect(field.wording[resume.language]).toBeDefined();
        for (const achievement of entry.achievements)
          expect(achievement.wording[resume.language]).toBeDefined();
      }
    }
  }
});
