import { describe, expect, it } from "vitest";

import {
  applyScope,
  careerDocumentSchema,
  createCareerDocument,
  createEntry,
  duplicateEntry,
  parsePortable,
  readScope,
  sectionPropertiesSchema,
  validateDocument,
} from "@/lib/career/model";
import { urlError } from "@/lib/url-validation";
import { type CareerSection } from "@/types-and-constants/career";
import { sectionIconIds } from "@/types-and-constants/section-icons";

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

it("preserves the shared editor's optional-link and safe-protocol rules outside retired review state", () => {
  for (const value of [
    "",
    "https://example.com/path",
    "http://example.com",
    "mailto:ana@example.com",
    "tel:+5511999999999",
  ])
    expect(urlError(value)).toBeUndefined();
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "https://user:password@example.com",
    "https://example.com/a b",
    "https://example.com\\path",
    "mailto:",
    "tel:",
    "example.com",
  ])
    expect(urlError(value)).toEqual(expect.any(String));
});

function fixture() {
  const document = createCareerDocument();
  document.profile.fields[0].wording["en-US"] = "Ana";
  const sections: CareerSection[] = ["heart-handshake", "flask-conical"].map(
    (icon, index) => ({
      id: `custom-${index}`,
      kind: "custom",
      icon: icon as CareerSection["icon"],
      name: `Custom ${index}`,
      heading: { "en-US": `Heading ${index}` },
      archived: false,
      entries: [createEntry("custom"), createEntry("custom")],
    }),
  );
  document.sections.push(...sections);
  return { document: validateDocument(document), sections };
}

describe("shared custom-section icons", () => {
  it("requires catalog icons and fixed built-in icons in sections and starter structure", () => {
    expect(
      createCareerDocument().sections.map((section) => section.icon),
    ).toEqual([
      "briefcase-business",
      "folder-kanban",
      "graduation-cap",
      "code-2",
      "award",
    ]);
    const { document, sections } = fixture();
    const properties = readScope(
      document,
      `section/${sections[0].id}`,
    ) as object;
    for (const icon of sectionIconIds)
      expect(sectionPropertiesSchema.parse({ ...properties, icon }).icon).toBe(
        icon,
      );
    expect(
      sectionPropertiesSchema.safeParse({ ...properties, icon: "unknown" })
        .success,
    ).toBe(false);
    const { icon: omitted, ...missing } = { ...sections[0] };
    expect(omitted).toBe("heart-handshake");
    expect(
      careerDocumentSchema.safeParse({ ...document, sections: [missing] })
        .success,
    ).toBe(false);
    expect(() =>
      applyScope(document, `section/${document.sections[0].id}`, {
        ...(readScope(
          document,
          `section/${document.sections[0].id}`,
        ) as object),
        icon: "rocket",
      }),
    ).toThrow(/default icon/);
    document.starters = [
      {
        id: "starter",
        name: "Research",
        template: "yabuki-reference@1.0.3",
        summaryIncluded: false,
        sections: [
          {
            id: "custom-slot",
            label: "Custom",
            hidden: false,
            kind: "custom",
            icon: "flask-conical",
            visibleFields: ["title"],
          },
          {
            id: "experience-slot",
            label: "Experience",
            hidden: false,
            kind: "experience",
            icon: "briefcase-business",
            visibleFields: ["title"],
          },
        ],
        layout: { ...document.defaults },
      },
    ];
    expect(validateDocument(document).starters[0].sections[0].icon).toBe(
      "flask-conical",
    );
    document.starters[0].sections[1].icon = "rocket";
    expect(() => validateDocument(document)).toThrow(/default icon/);
  });
});
