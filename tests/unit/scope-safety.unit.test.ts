import { expect, it } from "vitest";

import {
  applyScope,
  createCareerDocument,
  createEntry,
  parsePortable,
  readScope,
  validateDocument,
} from "@/lib/career/model";

function fixture() {
  const document = createCareerDocument();
  document.sections = [];
  const first = createEntry("experience");
  first.achievements.push({ id: "achievement", archived: false, wording: {} });
  first.links.push({ id: "link", archived: false, url: "", label: {} });
  document.sections.push({
    id: "section",
    kind: "experience",
    icon: "briefcase-business",
    name: "",
    heading: {},
    archived: false,
    entries: [first, createEntry("experience")],
  });
  return document;
}

it("rejects whole-workspace Save and unsupported recovery scope grammar", () => {
  const document = fixture();
  for (const scope of [
    "document",
    "entry/id/extra",
    "entries/section/extra",
    "new-entry/section",
    "unknown",
  ]) {
    expect(readScope(document, scope)).toBeUndefined();
    expect(() => applyScope(document, scope, document)).toThrow();
    expect(() =>
      parsePortable(
        JSON.stringify({
          format: "verso.recovery",
          schemaVersion: 1,
          exportedAt: "2026-11-02T12:00:00Z",
          sourceWorkspaceId: "workspace",
          drafts: [
            {
              draftId: "draft",
              draftVersion: 1,
              workspaceId: "workspace",
              scope,
              baseline: null,
              baselineRevision: 0,
              generation: 0,
              values: document,
            },
          ],
        }),
        "recovery",
      ),
    ).toThrow(/scope/);
  }
});

it("ordering contains only identities, preserves independently edited entry wording, and forbids deletion", () => {
  const document = fixture();
  const [first, second] = document.sections[0].entries;
  const order = readScope(document, "entries/section");
  expect(order).toEqual([first.id, second.id]);
  const edited = applyScope(document, `entry/${first.id}`, {
    ...first,
    name: "Changed elsewhere",
  });
  const reordered = applyScope(edited, "entries/section", [
    second.id,
    first.id,
  ]);
  expect(reordered.sections[0].entries[1].name).toBe("Changed elsewhere");
  expect(() => applyScope(document, "entries/section", [first.id])).toThrow(
    /retain/,
  );
  expect(() => applyScope(document, "sections", [])).toThrow(/retain/);
});

it("rejects deletion/reidentification of shared achievements, links, fields, and parent records", () => {
  const document = fixture();
  const entry = document.sections[0].entries[0];
  for (const key of ["fields", "links", "achievements"] as const)
    expect(() =>
      applyScope(document, `entry/${entry.id}`, { ...entry, [key]: [] }),
    ).toThrow(/Archive/);
  expect(() =>
    applyScope(document, `entry/${entry.id}`, {
      ...entry,
      fields: entry.fields.map((field, index) =>
        index ? field : { ...field, id: "new-id" },
      ),
    }),
  ).toThrow(/Archive/);
  expect(() =>
    applyScope(document, "profile", { ...document.profile, id: "other" }),
  ).toThrow(/identity/);
  expect(() =>
    applyScope(document, "summary", { ...document.summary, id: "other" }),
  ).toThrow(/identity/);
});

it("rejects retyping built-in fields and permits archive without changing selections or wording", () => {
  const document = fixture();
  const entry = document.sections[0].entries[0];
  expect(() =>
    applyScope(document, `entry/${entry.id}`, {
      ...entry,
      fields: entry.fields.map((field, index) =>
        index ? field : { ...field, type: "url" },
      ),
    }),
  ).toThrow(/field/);
  document.resumes.push({
    id: "resume",
    name: "",
    language: "en-US",
    template: "yabuki-reference@1.0.3",
    selection: [
      {
        sectionId: "section",
        entryIds: [entry.id],
        achievementIds: ["achievement"],
        fieldIds: [entry.fields[0].id],
        linkIds: ["link"],
      },
    ],
    overrides: { [entry.fields[0].id]: "Tailored wording" },
    layout: { ...document.defaults },
  });
  const archived = applyScope(document, `entry/${entry.id}`, {
    ...entry,
    archived: true,
  });
  expect(archived.resumes).toEqual(document.resumes);
  expect(archived.sections[0].entries[0].fields).toEqual(entry.fields);
  expect(
    validateDocument(archived).resumes[0].overrides[entry.fields[0].id],
  ).toBe("Tailored wording");
});
