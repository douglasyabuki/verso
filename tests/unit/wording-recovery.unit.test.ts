import { describe, expect, it } from "vitest";

import {
  createCareerDocument,
  createEntry,
  parsePortable,
  validateDocument,
} from "@/lib/career/model";
import { oversizedRecovery, recoveryFiles } from "@/lib/career/recovery-export";
import {
  renderWording,
  richTextSchema,
  wordingText,
} from "@/lib/career/wording";
import type { CareerDraft } from "@/types-and-constants/career";

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
  it("starts new workspaces with the five established empty sections and independent IDs", () => {
    const first = createCareerDocument();
    expect(first.sections.map((section) => section.kind)).toEqual([
      "experience",
      "projects",
      "education",
      "skills",
      "certifications",
    ]);
    expect(
      first.sections.every((section) => section.entries.length === 0),
    ).toBe(true);
    expect(
      new Set(
        [...first.sections, ...createCareerDocument().sections].map(
          (section) => section.id,
        ),
      ).size,
    ).toBe(10);
  });

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
