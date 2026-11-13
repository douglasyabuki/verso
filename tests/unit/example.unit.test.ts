import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { applyScope, parsePortable } from "@/lib/career/model";
import { renderCareerResume } from "@/lib/career/output";
import {
  fieldsForNewEntries,
  prepareStarterResume,
  starterMappings,
} from "@/lib/career/starters";

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
  expect(source).not.toContain("?");
  for (const resume of document.resumes) {
    const output = renderCareerResume(document, resume.id, 1);
    expect(output).toContain("Alex Morgan");
    // The pinned fontawesome5 package exposes alternate icons with a star,
    // rather than an Alt-suffixed control sequence.
    expect(output).toContain("\\faMapMarker*");
    expect(output).not.toContain("\\faMapMarkerAlt");
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

it("offers distinct appearance-only sample presets matching the saved resumes", () => {
  const envelope = parsePortable(
    readFileSync("public/examples/alex-morgan.schema-2.json", "utf8"),
    "workspace",
  );
  if (envelope.format !== "verso.workspace")
    throw new Error("Expected workspace");
  const { document } = envelope;
  expect(document.presets.map((preset) => preset.name)).toEqual([
    "Classic",
    "Compact navy",
  ]);
  expect(document.resumes[0].layout).toEqual(document.presets[0].layout);
  expect(document.resumes[1].layout).toEqual(document.presets[1].layout);
  expect(document.presets[0].layout).toMatchObject({
    font: "inter",
    contactRows: "3",
  });
  expect(document.presets[1].layout).toMatchObject({
    font: "source-sans",
    headingColor: "dark-navy",
    contactRows: "custom",
    contactRowSizes: [3, 2, 2],
  });
  const source = document.resumes[0];
  const applied = applyScope(
    document,
    `resume-layout/${source.id}`,
    document.presets[1].layout,
  );
  expect(applied.resumes[0].selection).toEqual(source.selection);
  expect(applied.resumes[0].overrides).toEqual(source.overrides);
  expect(renderCareerResume(applied, source.id, 1)).toContain(
    "SourceSans3-Regular.otf",
  );
  expect(Object.keys(document.presets[0]).sort()).toEqual([
    "id",
    "layout",
    "name",
    "template",
  ]);
});

it("creates empty sample starters in either language with reusable field defaults", () => {
  const envelope = parsePortable(
    readFileSync("public/examples/alex-morgan.schema-2.json", "utf8"),
    "workspace",
  );
  if (envelope.format !== "verso.workspace")
    throw new Error("Expected workspace");
  const { document } = envelope;
  expect(document.starters.map((starter) => starter.name)).toEqual([
    "Complete career",
    "Project focused",
  ]);
  const original = structuredClone(document);
  for (const starter of document.starters) {
    for (const language of ["en-US", "pt-BR"]) {
      const mappings = starterMappings(document, starter);
      expect(mappings).not.toContain("");
      const request = prepareStarterResume(
        document,
        starter,
        mappings,
        language,
      );
      const next = applyScope(
        document,
        `starter-create/${request.resume.id}`,
        request,
      );
      const created = next.resumes.at(-1)!;
      expect(created.language).toBe(language);
      expect(created.layout).toEqual({
        ...starter.layout,
        defaults: starter.layout,
      });
      expect(created.profileSelection).toEqual([]);
      expect(created.overrides).toEqual({});
      expect(created.selection).toHaveLength(starter.sections.length);
      for (const selection of created.selection) {
        expect(selection.entryIds).toEqual([]);
        expect(selection.achievementIds).toEqual([]);
        expect(selection.fieldIds).toEqual([]);
        expect(selection.linkIds).toEqual([]);
        expect(selection.fieldDefaults?.length).toBeGreaterThan(0);
        const section = next.sections.find(
          (item) => item.id === selection.sectionId,
        )!;
        const entry = section.entries[0];
        if (entry) {
          expect(fieldsForNewEntries(section, selection, [entry.id])).toEqual(
            entry.fields.map((field) => field.id),
          );
        }
      }
      if (starter.name === "Project focused") {
        expect(mappings.at(-1)).toBe("new");
        expect(request.sections).toHaveLength(1);
        expect(request.sections[0]).toMatchObject({
          name: "Research",
          icon: "flask-conical",
          heading: {},
          entries: [],
        });
      } else {
        expect(request.sections).toEqual([]);
      }
    }
  }
  expect(document).toEqual(original);
});
