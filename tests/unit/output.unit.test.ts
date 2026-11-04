import { expect, it } from "vitest";

import {
  applyScope,
  createCareerDocument,
  createEntry,
} from "@/lib/career/model";
import { renderCareerResume } from "@/lib/career/output";

export function outputFixture(language = "en-US") {
  const document = createCareerDocument(language);
  document.sections = [];
  document.profile.fields[0].wording[language] = "Ana São & Silva";
  const entry = createEntry("experience");
  entry.fields[0].wording[language] = "Engineering lead";
  entry.fields[1].wording[language] = "Example";
  entry.fields[3].fact = "2024-02";
  entry.achievements.push({
    id: "achievement",
    archived: false,
    wording: { [language]: "Built secure systems · ação" },
  });
  entry.links.push({
    id: "link",
    archived: false,
    url: "https://example.com/?a=1&b=2",
    label: { [language]: "Project" },
  });
  document.sections.push({
    id: "section",
    kind: "experience",
    icon: "briefcase-business",
    name: "Work",
    heading: {},
    archived: false,
    entries: [entry],
  });
  document.resumes.push({
    id: "resume",
    name: "Application",
    language,
    template: "yabuki-reference@1.0.2",
    selection: [
      {
        sectionId: "section",
        entryIds: [entry.id],
        fieldIds: entry.fields.map((field) => field.id),
        achievementIds: ["achievement"],
        linkIds: ["link"],
      },
    ],
    overrides: {},
    layout: { ...document.defaults },
  });
  return document;
}

it("selected archived content and inactive language retain exactly the same output", () => {
  const document = outputFixture();
  const source = renderCareerResume(document, "resume", 1);
  document.sections[0].archived = true;
  document.sections[0].entries[0].archived = true;
  document.sections[0].entries[0].achievements[0].archived = true;
  document.sections[0].entries[0].links[0].archived = true;
  document.languages[0].active = false;
  expect(renderCareerResume(document, "resume", 1)).toBe(source);
  expect(source).toContain("Ana São \\& Silva");
  expect(source).toContain("Engineering lead");
  expect(source).toContain("\\href{https://example.com/?a=1\\&b=2}");
});

it("selects explicit Portuguese capability and never falls back across missing or unsupported languages", () => {
  const document = outputFixture("pt-BR");
  const source = renderCareerResume(document, "resume", 3);
  expect(source).toContain("EXPERIÊNCIA");
  expect(source).toContain("\\language=1");
  expect(source).toContain("pdflang={pt-BR}");
  document.sections[0].entries[0].fields[0].wording = {
    "en-US": "English only",
  };
  expect(() => renderCareerResume(document, "resume", 3)).toThrow(/pt-BR/);
  document.resumes[0].language = "fr-FR";
  expect(() => renderCareerResume(document, "resume", 3)).toThrow(
    /not been verified/,
  );
});

it("preserves per-resume wording through shared edits and uses career wording after removing the override", () => {
  const document = outputFixture();
  const entry = document.sections[0].entries[0];
  const title = entry.fields[0];
  document.resumes[0].overrides[title.id] = "Tailored specialist";
  document.resumes[0].overrides.achievement = "Tailored achievement";
  const updated = applyScope(document, `entry/${entry.id}`, {
    ...entry,
    fields: entry.fields.map((field) =>
      field.id === title.id
        ? { ...field, wording: { "en-US": "Updated career title" } }
        : field,
    ),
    achievements: [
      {
        ...entry.achievements[0],
        wording: { "en-US": "Updated career achievement" },
      },
    ],
  });
  const tailored = renderCareerResume(updated, "resume", 2);
  expect(tailored).toContain("Tailored specialist");
  expect(tailored).toContain("Tailored achievement");
  expect(tailored).not.toContain("Updated career title");
  expect(tailored).not.toContain("Updated career achievement");
  delete updated.resumes[0].overrides[title.id];
  delete updated.resumes[0].overrides.achievement;
  const shared = renderCareerResume(updated, "resume", 3);
  expect(shared).toContain("Updated career title");
  expect(shared).toContain("Updated career achievement");
  expect(document.resumes[0].overrides[title.id]).toBe("Tailored specialist");
});

it("renders selected entry order and omits unselected content without changing career order", () => {
  const document = outputFixture();
  const first = document.sections[0].entries[0];
  const second = createEntry("experience");
  second.fields[0].wording["en-US"] = "Second selected role";
  const hidden = createEntry("experience");
  hidden.fields[0].wording["en-US"] = "Unselected secret role";
  document.sections[0].entries.push(second, hidden);
  const selection = document.resumes[0].selection[0];
  selection.entryIds = [second.id, first.id];
  selection.fieldIds.push(second.fields[0].id);
  selection.achievementIds = [];
  selection.linkIds = [];
  const source = renderCareerResume(document, "resume", 1);
  expect(source.indexOf("Second selected role")).toBeGreaterThan(-1);
  expect(source.indexOf("Engineering lead")).toBeGreaterThan(
    source.indexOf("Second selected role"),
  );
  expect(source).not.toContain("Unselected secret role");
  expect(source).not.toContain("Built secure systems");
  expect(source).not.toContain("https://example.com/");
  expect(document.sections[0].entries.map((entry) => entry.id)).toEqual([
    first.id,
    second.id,
    hidden.id,
  ]);
});
