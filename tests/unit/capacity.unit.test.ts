import { expect, it } from "vitest";

import {
  createCareerDocument,
  createEntry,
  parsePortable,
  validateDocument,
} from "@/lib/career/model";

it("accepts 120 independent resumes, 10,000 entries, and maximum nested shapes without truncation", () => {
  const document = createCareerDocument();
  document.sections = [];
  for (let sectionIndex = 0; sectionIndex < 34; sectionIndex++) {
    const entries = Array.from(
      { length: sectionIndex === 33 ? 100 : 300 },
      () => createEntry("experience"),
    );
    document.sections.push({
      id: `section-${sectionIndex}`,
      kind: "experience",
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
    wording: { "en-US": "A".repeat(20_000) },
  }));
  entry.links = Array.from({ length: 30 }, (_, index) => ({
    id: `link-${index}`,
    archived: false,
    url: "https://example.com/" + "x".repeat(3980),
    label: { "en-US": "L".repeat(20_000) },
  }));
  document.resumes = Array.from({ length: 120 }, (_, index) => ({
    id: `resume-${index}`,
    name: "",
    language: "en-US",
    template: "yabuki-reference@1.0.2",
    selection: [],
    overrides: {},
    layout: { ...document.defaults },
  }));
  const result = validateDocument(document);
  expect(result.resumes).toHaveLength(120);
  expect(result.sections.flatMap((section) => section.entries)).toHaveLength(
    10_000,
  );
  expect(result.sections[0].entries[0].achievements).toHaveLength(100);
  expect(result.sections[0].entries[0].links).toHaveLength(30);
  result.resumes.push({ ...result.resumes[0], id: "overflow" });
  expect(() => validateDocument(result)).toThrow();
}, 20_000);

it("accepts a 64-MiB document and rejects one additional UTF-8 byte, without truncation", () => {
  const document = createCareerDocument();
  document.sections = [];
  for (let index = 0; index < 3400; index++) {
    const tag = `en-x-${index.toString().padStart(4, "0")}`;
    document.languages.push({ tag, active: false });
    document.summary.wording[tag] = "";
  }
  const limit = 64 * 1024 * 1024;
  let available =
    limit - new TextEncoder().encode(JSON.stringify(document)).byteLength;
  for (const tag of Object.keys(document.summary.wording)) {
    const length = Math.min(20_000, available);
    document.summary.wording[tag] = "x".repeat(length);
    available -= length;
  }
  expect(available).toBe(0);
  expect(new TextEncoder().encode(JSON.stringify(document)).byteLength).toBe(
    limit,
  );
  expect(validateDocument(document).summary.wording["en-x-0000"]).toHaveLength(
    20_000,
  );
  document.summary.wording["en-x-3399"] += "x";
  expect(() => validateDocument(document)).toThrow(/64 MiB/);
  expect(() =>
    parsePortable(
      JSON.stringify({
        format: "verso.workspace",
        schemaVersion: 2,
        exportedAt: "2026-11-02T12:00:00.000Z",
        workspaceId: "workspace",
        document,
      }),
      "workspace",
    ),
  ).toThrow(/byte limit/);
}, 30_000);
