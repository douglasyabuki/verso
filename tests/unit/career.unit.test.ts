import { describe, expect, it } from "vitest";

import {
  applyScope,
  createCareerDocument,
  createEntry,
  duplicateEntry,
  parsePortable,
  readScope,
  validateDocument,
} from "@/lib/career/model";

describe("schema-2 career information", () => {
  it("works with one language and separates facts from independent wording", () => {
    const document = createCareerDocument("pt-BR");
    document.sections = [];
    const entry = createEntry("experience");
    entry.fields[0].wording = { "pt-BR": "Engenheira" };
    entry.fields[3].fact = "2024-02-29";
    document.sections.push({
      id: "section",
      kind: "experience",
      icon: "briefcase-business",
      name: "Work",
      archived: false,
      heading: { "pt-BR": "Experiência" },
      entries: [entry],
    });
    expect(validateDocument(document).languages).toEqual([
      { tag: "pt-BR", active: true },
    ]);
    document.languages.push({ tag: "fr-FR", active: true });
    expect(
      validateDocument(document).sections[0].entries[0].fields[0].wording[
        "fr-FR"
      ],
    ).toBeUndefined();
    expect(document.sections[0].entries[0].fields[3].fact).toBe("2024-02-29");
  });

  it("rejects malformed dates and unsafe links but permits incomplete records", () => {
    const document = createCareerDocument();
    document.sections = [];
    const entry = createEntry("experience");
    document.sections.push({
      id: "section",
      kind: "experience",
      icon: "briefcase-business",
      name: "",
      archived: false,
      heading: {},
      entries: [entry],
    });
    expect(() => validateDocument(document)).not.toThrow();
    entry.fields[3].fact = "2023-02-29";
    expect(() => validateDocument(document)).toThrow(/valid.*date/);
    entry.fields[3].fact = "";
    entry.links.push({
      id: "link",
      archived: false,
      label: {},
      url: "javascript:alert(1)",
    });
    expect(() => validateDocument(document)).toThrow(/http/);
  });

  it("preserves identities through rename/archive/localization, duplicates independently", () => {
    const document = createCareerDocument();
    document.sections = [];
    const entry = createEntry("education");
    entry.achievements.push({
      id: "achievement",
      archived: false,
      wording: { "en-US": "Graduated" },
    });
    entry.links.push({
      id: "link",
      archived: false,
      url: "https://example.com",
      label: { "en-US": "School" },
    });
    document.sections.push({
      id: "section",
      kind: "education",
      icon: "graduation-cap",
      name: "Education",
      archived: false,
      heading: {},
      entries: [entry],
    });
    const updated = applyScope(document, `entry/${entry.id}`, {
      ...entry,
      name: "Renamed",
      archived: true,
    });
    expect(
      updated.sections[0].entries[0].fields.map((field) => field.id),
    ).toEqual(entry.fields.map((field) => field.id));
    const copy = duplicateEntry(entry);
    expect(copy.id).not.toBe(entry.id);
    expect(copy.fields[0].id).not.toBe(entry.fields[0].id);
    expect(copy.achievements[0].id).not.toBe("achievement");
    expect(copy.links[0].id).not.toBe("link");
    expect(copy.links[0].url).toBe("https://example.com");
  });

  it("round-trips schema 2 with independent layouts/customizations and rejects unsupported formats", () => {
    const document = createCareerDocument();
    document.sections = [];
    document.languages.push({ tag: "pt-BR", active: false });
    const entry = createEntry("projects");
    document.sections.push({
      id: "section",
      kind: "projects",
      icon: "folder-kanban",
      name: "Projects",
      archived: false,
      heading: {},
      entries: [entry],
    });
    document.resumes = ["en-US", "pt-BR"].map((language, index) => ({
      id: `resume-${index}`,
      name: "Resume",
      language,
      template: "yabuki-reference@1.0.3",
      selection: [
        {
          sectionId: "section",
          entryIds: [entry.id],
          achievementIds: [],
          fieldIds: [entry.fields[0].id],
          linkIds: [],
        },
      ],
      overrides: { [entry.fields[0].id]: "Customized" },
      layout: {
        ...document.defaults,
        paper: index ? "letter" : "a4",
        font: "inter",
        fontSize: index ? 12 : 10,
      },
    }));
    const envelope = {
      format: "verso.workspace",
      schemaVersion: 2,
      workspaceId: "workspace",
      exportedAt: "2026-11-02T12:00:00.000Z",
      document,
    };
    expect(parsePortable(JSON.stringify(envelope), "workspace")).toEqual(
      envelope,
    );
    expect(() =>
      parsePortable(
        JSON.stringify({ ...envelope, schemaVersion: 1 }),
        "workspace",
      ),
    ).toThrow();
    document.resumes[0].selection[0].entryIds.push("missing");
    expect(() => validateDocument(document)).toThrow(/dangling/);
  });

  it("rejects duplicate identities, unregistered languages, and extra credential fields", () => {
    const document = createCareerDocument();
    document.sections = [];
    document.profile.fields[1].id = document.profile.fields[0].id;
    expect(() => validateDocument(document)).toThrow(/Duplicate identity/);
    document.profile.fields[1].id = "email";
    document.summary.wording["de-DE"] = "Text";
    expect(() => validateDocument(document)).toThrow(/Unregistered/);
    delete document.summary.wording["de-DE"];
    expect(() =>
      validateDocument({ ...document, credential: "secret" }),
    ).toThrow();
  });

  it("applies only one scope while preserving unrelated content", () => {
    const document = createCareerDocument();
    document.sections = [];
    const summary = structuredClone(document.summary);
    summary.wording["en-US"] = "Saved";
    const next = applyScope(document, "summary", summary);
    expect(readScope(next, "profile")).toEqual(document.profile);
    expect(document.summary.wording).toEqual({});
    expect(next.summary.wording["en-US"]).toBe("Saved");
  });

  it("retains malformed recovery values but rejects unknown envelopes", () => {
    const envelope = {
      format: "verso.recovery",
      schemaVersion: 1,
      exportedAt: "2026-11-02T12:00:00.000Z",
      sourceWorkspaceId: "source",
      drafts: [
        {
          draftId: "draft",
          draftVersion: 3,
          workspaceId: "source",
          scope: "profile",
          baseline: null,
          baselineRevision: 1,
          generation: 0,
          values: { unsafeDate: "bad date" },
        },
      ],
    };
    expect(parsePortable(JSON.stringify(envelope), "recovery")).toEqual(
      envelope,
    );
    expect(() =>
      parsePortable(
        JSON.stringify({ ...envelope, schemaVersion: 2 }),
        "recovery",
      ),
    ).toThrow();
  });
});
