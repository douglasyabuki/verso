import { describe, expect, it } from "vitest";

import { createCareerDocument, createEntry } from "@/lib/career/model";
import { renderCareerResume } from "@/lib/career/output";
import { assessResumeOutput } from "@/lib/career/readiness";
import { createResume } from "@/lib/career/resumes";

/** Create selected custom content with independently addressable missing wording. */
function fixture() {
  const document = createCareerDocument();
  const section = document.sections[0];
  section.kind = "custom";
  section.icon = "file-text";
  section.heading = {};
  const entry = createEntry("custom");
  entry.achievements = [{ id: "detail", archived: false, wording: {} }];
  section.entries = [entry];
  const resume = createResume(document, "en-US");
  resume.selection = [
    {
      sectionId: section.id,
      entryIds: [entry.id],
      fieldIds: entry.fields.map((field) => field.id),
      achievementIds: ["detail"],
      linkIds: [],
    },
  ];
  document.resumes = [resume];
  return { document, section, entry, resume, name: document.profile.fields[0] };
}

describe("committed resume output readiness", () => {
  it("collects every blocker in output order with stable identities and precise repair targets", () => {
    const { document, section, entry, resume, name } = fixture();
    resume.language = "fr-FR";
    const result = assessResumeOutput(document, resume.id);
    expect(result.ready).toBe(false);
    expect(result.issues.map((issue) => issue.recordId)).toEqual([
      resume.id,
      name.id,
      section.id,
      entry.fields[0].id,
      "detail",
    ]);
    expect(result.issues[0].target).toBeUndefined();
    expect(result.issues.slice(1).map((issue) => issue.target)).toEqual(
      [name.id, section.id, entry.fields[0].id, "detail"].map((fieldId) => ({
        destination: `resume-wording/${resume.id}`,
        fieldId,
      })),
    );
    expect(assessResumeOutput(structuredClone(document), resume.id)).toEqual(
      result,
    );
    expect(() => renderCareerResume(document, resume.id, 1)).toThrow(
      result.issues.map((issue) => issue.message).join("\n"),
    );
  });

  it("honors explicit empty custom wording and never substitutes wording from another language", () => {
    const { document, resume, name } = fixture();
    name.wording = { "pt-BR": "Ana" };
    expect(
      assessResumeOutput(document, resume.id).issues.some(
        (issue) => issue.recordId === name.id,
      ),
    ).toBe(true);
    name.wording["en-US"] = "Ana";
    resume.overrides[name.id] = "   ";
    expect(
      assessResumeOutput(document, resume.id).issues.some(
        (issue) => issue.recordId === name.id,
      ),
    ).toBe(true);
    delete resume.overrides[name.id];
    expect(
      assessResumeOutput(document, resume.id).issues.some(
        (issue) => issue.recordId === name.id,
      ),
    ).toBe(false);
  });

  it("ignores hidden parents, hidden entries, unselected children, unused content and other resumes", () => {
    const { document, resume, name } = fixture();
    name.wording["en-US"] = "Ana";
    document.resumes.push({
      ...structuredClone(resume),
      id: "other",
      language: "fr-FR",
    });
    const selection = resume.selection[0];
    selection.hidden = true;
    expect(assessResumeOutput(document, resume.id).ready).toBe(true);
    selection.hidden = false;
    selection.hiddenEntryIds = [...selection.entryIds];
    expect(assessResumeOutput(document, resume.id).ready).toBe(true);
    selection.hiddenEntryIds = [];
    document.sections[0].heading["en-US"] = "Custom";
    selection.fieldIds = [];
    selection.achievementIds = [];
    expect(assessResumeOutput(document, resume.id).ready).toBe(true);
    expect(() => renderCareerResume(document, resume.id, 1)).not.toThrow();
  });

  it("retains built-in headings, URL-label fallback, optional empty values and archived inactive-language output", () => {
    const { document, section, entry, resume, name } = fixture();
    section.kind = "education";
    section.icon = "graduation-cap";
    entry.fields = createEntry("education").fields;
    resume.selection[0].fieldIds = entry.fields.map((field) => field.id);
    name.wording["en-US"] = "Ana";
    entry.fields[0].wording["en-US"] = "Degree";
    entry.achievements[0].wording["en-US"] = [
      { text: "Detail", emphasis: true, href: "" },
    ];
    entry.links = [
      { id: "url", archived: false, label: {}, url: "https://example.com" },
    ];
    resume.selection[0].linkIds = ["url"];
    resume.summaryIncluded = true;
    expect(assessResumeOutput(document, resume.id)).toEqual({
      ready: true,
      issues: [],
    });
    const source = renderCareerResume(document, resume.id, 1);
    expect(source).toContain("EDUCATION");
    expect(source).toContain("{https://example.com}");
    document.languages[0].active = false;
    section.archived =
      entry.archived =
      entry.achievements[0].archived =
      entry.links[0].archived =
        true;
    expect(assessResumeOutput(document, resume.id).ready).toBe(true);
    expect(renderCareerResume(document, resume.id, 1)).toBe(source);
    entry.fields[0].wording = {};
    expect(
      assessResumeOutput(document, resume.id).issues.map(
        (issue) => issue.recordId,
      ),
    ).toEqual([entry.fields[0].id]);
  });

  it("requires custom headings and achievements containing real text, and handles removed resumes", () => {
    const { document, section, entry, resume, name } = fixture();
    name.wording["en-US"] = "Ana";
    section.heading["en-US"] = "  ";
    entry.fields[0].wording["en-US"] = "Title";
    entry.achievements[0].wording["en-US"] = [
      { text: " \n", emphasis: true, href: "" },
    ];
    expect(
      assessResumeOutput(document, resume.id).issues.map(
        (issue) => issue.recordId,
      ),
    ).toEqual([section.id, "detail"]);
    expect(assessResumeOutput(document, "removed")).toEqual({
      ready: false,
      issues: [
        {
          id: "removed:missing-resume",
          code: "missing-resume",
          recordId: "removed",
          message: "Resume not found.",
        },
      ],
    });
    expect(() => renderCareerResume(document, "removed", 1)).toThrow(
      "Resume not found.",
    );
  });
});
