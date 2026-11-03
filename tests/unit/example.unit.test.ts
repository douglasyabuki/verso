import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { parsePortable } from "@/lib/career/model";
import { renderCareerResume } from "@/lib/career/output";

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
