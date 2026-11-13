import { describe, expect, it } from "vitest";

import { careerFieldLabel } from "@/lib/career/labels";
import { sameLayout } from "@/lib/career/layout";
import {
  applyScope,
  createCareerDocument,
  createEntry,
  draftSchema,
  parsePortable,
  readScope,
  validateDocument,
} from "@/lib/career/model";
import { renderCareerOutput, renderCareerResume } from "@/lib/career/output";
import {
  copyResume,
  createResume,
  effectiveResume,
  profileContactLabels,
  resolveResumeWording,
  resumeComparisonRows,
  resumeFactFields,
  resumeWordingFields,
  resumeWordingGroups,
} from "@/lib/career/resumes";
import { sameScope } from "@/stores/career/persistence";

function fixture() {
  const document = createCareerDocument();
  document.languages.push({ tag: "pt-BR", active: true });
  document.profile.fields[0].wording = {
    "en-US": "Ana English",
    "pt-BR": "Ana Português",
  };
  document.profile.fields[1].fact = "ana@example.com";
  document.summary.wording = {
    "en-US": "English summary",
    "pt-BR": "Resumo português",
  };
  const entry = createEntry("experience");
  entry.name = "Engineering";
  entry.fields[0].wording = { "en-US": "Engineer", "pt-BR": "Engenheira" };
  entry.achievements = [
    {
      id: "achievement",
      archived: false,
      wording: { "en-US": "Shipped", "pt-BR": "Entregou" },
    },
  ];
  document.sections[0].entries = [entry];
  const resume = createResume(document, "en-US");
  resume.selection = [
    {
      sectionId: document.sections[0].id,
      entryIds: [entry.id],
      fieldIds: [entry.fields[0].id],
      achievementIds: ["achievement"],
      linkIds: [],
    },
  ];
  document.resumes = [resume];
  return { document, resume, entry };
}

describe("independent resumes", () => {
  it.each([
    ["fullName", "Full name"],
    ["start", "Start date"],
    ["degree", "Degree / qualification"],
    ["credential", "Credential ID"],
    ["issued", "Issue date"],
    ["expires", "Expiration date"],
    ["url", "Website"],
    ["preferredContact_method", "Preferred Contact method"],
    ["toString", "To String"],
  ])("labels field key %s as %s", (key, expected) => {
    expect(careerFieldLabel(key)).toBe(expected);
  });

  it("keeps readable wording labels attached to their career owners", () => {
    const { document, entry } = fixture();
    document.sections[0].name = "My professional history";
    entry.links.push({
      id: "entry-link",
      archived: false,
      url: "https://example.com",
      label: { "en-US": "Portfolio" },
    });
    document.profile.links.push({
      id: "profile-link",
      archived: false,
      url: "https://example.org",
      label: {},
    });
    const fields = resumeWordingFields(document, "en-US");
    expect(
      fields.find((field) => field.id === document.profile.fields[0].id),
    ).toMatchObject({
      label: "Profile · Full name",
      owner: "profile",
      destination: "profile",
    });
    expect(
      fields.find((field) => field.id === document.summary.id),
    ).toMatchObject({
      label: "Summary",
      owner: "summary",
      destination: "summary",
    });
    expect(
      fields.find((field) => field.id === document.sections[0].id),
    ).toMatchObject({
      label: "My professional history · Heading",
      owner: "experience",
    });
    expect(
      fields.find((field) => field.id === entry.fields[0].id),
    ).toMatchObject({
      label: "My professional history · Engineering · Title",
      owner: "experience",
      destination: `entry/${entry.id}`,
    });
    expect(fields.find((field) => field.id === "achievement")).toMatchObject({
      owner: "experience",
      rich: true,
    });
    expect(fields.find((field) => field.id === "entry-link")).toMatchObject({
      label: "My professional history · Engineering · Link 1 label",
      owner: "experience",
    });
    expect(fields.find((field) => field.id === "profile-link")).toMatchObject({
      owner: "profile",
    });
  });

  it("labels facts and order values with their owners without changing selection identities", () => {
    const { document, resume, entry } = fixture();
    const email = document.profile.fields.find(
      (field) => field.key === "email",
    )!;
    const start = entry.fields.find((field) => field.key === "start")!;
    start.fact = "2024-01";
    entry.links.push({
      id: "entry-link",
      archived: false,
      url: "https://example.com",
      label: {},
    });
    document.profile.links.push({
      id: "profile-link",
      archived: false,
      url: "https://example.org",
      label: {},
    });
    resume.profileSelection = [email.id, "profile-link"];
    resume.selection[0].fieldIds.push(start.id);
    resume.selection[0].linkIds.push("entry-link");
    const facts = resumeFactFields(document);
    expect(facts.find((field) => field.id === start.id)).toMatchObject({
      label: "Experience · Engineering · Start date",
      owner: "experience",
      value: "2024-01",
      destination: `entry/${entry.id}`,
    });
    expect(
      facts.find((field) => field.id === "url:profile-link"),
    ).toMatchObject({
      owner: "profile",
      selectionId: "profile-link",
      label: "Profile · Link 1 URL",
    });
    const rows = resumeComparisonRows(document, resume);
    expect(rows.find((row) => row.id === "order:contacts")).toMatchObject({
      owner: "profile",
      value: "Email → Link",
    });
    expect(rows.find((row) => row.id === "order:sections")).toMatchObject({
      owner: "resume",
    });
    expect(
      rows.find((row) => row.id === `order:entries:${document.sections[0].id}`),
    ).toMatchObject({ owner: "experience" });
    expect(
      rows.find((row) => row.id === `order:details:${entry.id}`),
    ).toMatchObject({
      owner: "experience",
      value: "Title → Start date; Achievement 1; Link 1",
    });
    expect(rows.find((row) => row.id === "url:entry-link")).toMatchObject({
      owner: "experience",
      status: "Included",
      source: "Shared fact",
    });
    expect(rows.find((row) => row.id === "url:profile-link")).toMatchObject({
      owner: "profile",
      status: "Included",
    });
    expect(rows.find((row) => row.id === document.summary.id)).toMatchObject({
      owner: "summary",
    });
  });

  it("compares canonical saved visibility with its draft by values rather than object key order", () => {
    const { document, resume } = fixture();
    const values = {
      selection: [
        { ...resume.selection[0], hidden: false, hiddenEntryIds: [] },
      ],
      profileSelection: [],
      summaryIncluded: false,
    };
    const saved = applyScope(document, `resume-content/${resume.id}`, values);
    expect(
      sameScope(readScope(saved, `resume-content/${resume.id}`), values),
    ).toBe(true);
    expect(sameScope(["first", "second"], ["second", "first"])).toBe(false);
    expect(sameScope({ missing: undefined }, {})).toBe(true);
    expect(sameScope({ present: null }, {})).toBe(false);
  });
  it("starts deliberately unselected and rejects inactive creation languages", () => {
    const { document } = fixture();
    const resume = createResume(document, "pt-BR");
    expect(resume).toMatchObject({
      color: "indigo",
      selection: [],
      profileSelection: [],
      summaryIncluded: false,
      overrides: {},
      layout: document.defaults,
    });
    document.languages[1].active = false;
    expect(() => createResume(document, "pt-BR")).toThrow(/active/);
    expect(() =>
      validateDocument({ ...document, resumes: [resume] }),
    ).not.toThrow();
  });

  it("duplicates configuration independently while retaining shared identities", () => {
    const { document, resume, entry } = fixture();
    resume.overrides[entry.fields[0].id] = "Custom";
    const copy = copyResume(resume);
    expect(copy.id).not.toBe(resume.id);
    expect(copy.selection).toEqual(resume.selection);
    copy.selection[0].entryIds = [];
    copy.overrides[entry.fields[0].id] = "Other";
    expect(resume.selection[0].entryIds).toEqual([entry.id]);
    expect(resume.overrides[entry.fields[0].id]).toBe("Custom");
    expect(document.sections[0].entries).toHaveLength(1);
  });

  it("copies into destination wording without source overrides or language fallback", () => {
    const { document, resume, entry } = fixture();
    resume.overrides[entry.fields[0].id] = "Customized source";
    const copy = copyResume(resume, "pt-BR");
    document.resumes.push(copy);
    expect(copy.overrides).toEqual({});
    expect(copy.selection).toEqual(resume.selection);
    expect(renderCareerResume(document, copy.id, 1)).toContain("Engenheira");
    delete entry.fields[0].wording["pt-BR"];
    expect(() => renderCareerResume(document, copy.id, 1)).toThrow(/wording/);
    expect(resume.overrides[entry.fields[0].id]).toBe("Customized source");
  });

  it("preserves explicit empty overrides until Use career wording removes them", () => {
    const { document, resume, entry } = fixture();
    const customized = applyScope(document, `resume-wording/${resume.id}`, {
      [entry.fields[0].id]: "",
    });
    expect(
      resolveResumeWording(
        customized.resumes[0],
        entry.fields[0].id,
        entry.fields[0].wording,
      ),
    ).toBe("");
    entry.fields[0].wording["en-US"] = "Updated shared";
    expect(
      resolveResumeWording(
        customized.resumes[0],
        entry.fields[0].id,
        entry.fields[0].wording,
      ),
    ).toBe("");
    const inherited = applyScope(customized, `resume-wording/${resume.id}`, {});
    expect(
      resolveResumeWording(
        inherited.resumes[0],
        entry.fields[0].id,
        entry.fields[0].wording,
      ),
    ).toBe("Updated shared");
  });

  it("never treats inherited object properties as wording overrides", () => {
    const { resume } = fixture();
    expect(
      resolveResumeWording(resume, "toString", { "en-US": "Career text" }),
    ).toBe("Career text");
    expect(
      resolveResumeWording(resume, "__proto__", { "pt-BR": "Outro idioma" }),
    ).toBe("");
  });

  it("retains hidden nested selections and excludes them only from effective output", () => {
    const { document, resume, entry } = fixture();
    const selection = [
      { ...resume.selection[0], hidden: false, hiddenEntryIds: [entry.id] },
    ];
    const changed = applyScope(document, `resume-content/${resume.id}`, {
      selection,
      profileSelection: [],
      summaryIncluded: false,
    });
    expect(changed.resumes[0].selection[0].achievementIds).toEqual([
      "achievement",
    ]);
    expect(
      effectiveResume(changed, changed.resumes[0]).selection[0].entryIds,
    ).toEqual([]);
    expect(renderCareerResume(changed, resume.id, 1)).not.toContain("Engineer");
    selection[0].hiddenEntryIds = [];
    selection[0].hidden = true;
    const hidden = applyScope(changed, `resume-content/${resume.id}`, {
      selection,
    });
    expect(effectiveResume(hidden, hidden.resumes[0]).selection).toEqual([]);
    expect(hidden.resumes[0].selection[0].entryIds).toEqual([entry.id]);
  });

  it("orders mixed contacts independently and omits unselected summary", () => {
    const { document, resume } = fixture();
    const city = document.profile.fields.find((field) => field.key === "city")!;
    city.wording["en-US"] = "London";
    const email = document.profile.fields.find(
      (field) => field.key === "email",
    )!;
    resume.profileSelection = [city.id, email.id];
    const source = renderCareerResume(document, resume.id, 1);
    expect(source.indexOf("London")).toBeLessThan(
      source.indexOf("ana@example.com"),
    );
    expect(source).not.toContain("English summary");
    expect(source).toContain("Ana English");
  });

  it("combines city and country into one location in selection order", () => {
    const { document, resume } = fixture();
    const field = (key: string) =>
      document.profile.fields.find((item) => item.key === key)!;
    field("city").wording["en-US"] = "São Paulo";
    field("country").wording["en-US"] = "Brazil";
    resume.profileSelection = [
      field("country").id,
      field("email").id,
      field("city").id,
    ];
    const separate = renderCareerResume(document, resume.id, 1);
    expect(separate.match(/faMapMarker\*/g)).toHaveLength(2);
    expect(profileContactLabels(document, resume)).toEqual([
      "Brazil",
      "ana@example.com",
      "São Paulo",
    ]);

    resume.layout.contactLocation = "combined";
    const combined = renderCareerResume(document, resume.id, 1);
    expect(combined.match(/faMapMarker\*/g)).toHaveLength(1);
    expect(combined).toContain("Brazil, São Paulo");
    expect(combined.indexOf("Brazil")).toBeLessThan(
      combined.indexOf("ana@example.com"),
    );
    expect(profileContactLabels(document, resume)).toEqual([
      "Brazil, São Paulo",
      "ana@example.com",
    ]);
    expect(renderCareerOutput(document, resume.id, 1)?.fingerprint).not.toBe(
      renderCareerOutput(
        {
          ...document,
          resumes: [
            {
              ...resume,
              layout: { ...resume.layout, contactLocation: "separate" },
            },
          ],
        },
        resume.id,
        1,
      )?.fingerprint,
    );

    resume.profileSelection = [field("city").id, field("country").id];
    expect(profileContactLabels(document, resume)).toEqual([
      "São Paulo, Brazil",
    ]);
    field("country").wording["en-US"] = "";
    expect(profileContactLabels(document, resume)).toEqual(["São Paulo"]);
    resume.profileSelection = [field("country").id];
    expect(profileContactLabels(document, resume)).toEqual([]);
  });

  it("treats a missing location grouping as separate items", () => {
    const { document, resume } = fixture();
    delete resume.layout.contactLocation;
    const city = document.profile.fields.find((item) => item.key === "city")!;
    const country = document.profile.fields.find(
      (item) => item.key === "country",
    )!;
    city.wording["en-US"] = "Lisbon";
    country.wording["en-US"] = "Portugal";
    resume.profileSelection = [city.id, country.id];
    expect(profileContactLabels(document, resume)).toEqual([
      "Lisbon",
      "Portugal",
    ]);
    expect(
      sameLayout(resume.layout, {
        ...resume.layout,
        contactLocation: "separate",
      }),
    ).toBe(true);
    expect(
      sameLayout(resume.layout, {
        ...resume.layout,
        contactLocation: "combined",
      }),
    ).toBe(false);
  });

  it("groups wording by career owner with selected content first", () => {
    const { document, resume, entry } = fixture();
    const excluded = createEntry("experience");
    excluded.name = "Earlier role";
    document.sections[0].entries.unshift(excluded);
    entry.achievements.push({
      id: "unselected",
      archived: true,
      wording: { "en-US": "Unselected" },
    });
    const groups = resumeWordingGroups(document, resume);
    expect(groups.slice(0, 3).map((group) => group.label)).toEqual([
      "Profile",
      "Summary",
      document.sections[0].name || document.sections[0].kind,
    ]);
    const [profile, summary, experience] = groups;
    expect(profile.rows[0].shortLabel).toBe("Full name");
    expect(profile.rows[0].included).toBe(true);
    expect(
      profile.rows.find((row) => row.shortLabel === "City")?.included,
    ).toBe(false);
    expect(summary.included).toBe(false);
    expect(experience.included).toBe(true);
    expect(experience.destination).toBe(`list/${document.sections[0].id}`);
    expect(experience.rows.map((row) => row.shortLabel)).toEqual(["Heading"]);
    expect(
      experience.entries.map((item) => [item.label, item.included]),
    ).toEqual([
      ["Engineering", true],
      ["Earlier role", false],
    ]);
    const rows = experience.entries[0].rows;
    expect(rows[0]).toMatchObject({
      id: entry.fields[0].id,
      included: true,
      label: `${experience.label} · Engineering · ${careerFieldLabel(entry.fields[0].key)}`,
    });
    expect(
      rows
        .filter((row) => row.shortLabel.startsWith("Achievement"))
        .map((row) => [row.id, row.included, row.archived]),
    ).toEqual([
      ["achievement", true, false],
      ["unselected", false, true],
    ]);
    expect(experience.entries[0].destination).toBe(`entry/${entry.id}`);
    expect(groups.slice(3).every((group) => !group.included)).toBe(true);
  });

  it("keeps older schema-2 defaults and selection requests unchanged", () => {
    const { document, resume } = fixture();
    delete resume.color;
    delete resume.profileSelection;
    delete resume.summaryIncluded;
    const before = JSON.stringify(document);
    const parsed = validateDocument(document);
    expect(JSON.stringify(document)).toBe(before);
    expect(parsed).toEqual(document);
    expect(renderCareerResume(parsed, resume.id, 0)).toContain(
      "English summary",
    );
    expect(renderCareerResume(parsed, resume.id, 0)).toContain(
      "ana@example.com",
    );
    expect(readScope(parsed, `selection/${resume.id}`)).toEqual(
      resume.selection,
    );
    expect(
      applyScope(parsed, `selection/${resume.id}`, []).resumes[0].selection,
    ).toEqual([]);
  });

  it("isolates identity, content, wording and lifecycle scopes", () => {
    const { document, resume, entry } = fixture();
    const content = readScope(document, `resume-content/${resume.id}`);
    const wording = readScope(document, `resume-wording/${resume.id}`);
    const changed = applyScope(document, `resume-details/${resume.id}`, {
      name: "New name",
      color: "rose",
    });
    expect(readScope(changed, `resume-content/${resume.id}`)).toEqual(content);
    expect(readScope(changed, `resume-wording/${resume.id}`)).toEqual(wording);
    expect(() => applyScope(changed, `resume/${resume.id}`, resume)).toThrow(
      /editing scopes/,
    );
    const removed = applyScope(changed, `resume/${resume.id}`, null);
    expect(removed.resumes).toEqual([]);
    expect(removed.sections[0].entries[0].id).toBe(entry.id);
    expect(
      applyScope(removed, `resume/${resume.id}`, changed.resumes[0]).resumes,
    ).toEqual(changed.resumes);
  });

  it("rejects invalid contacts, hidden identities, rich short text, and exceeded capacity", () => {
    const { document, resume, entry } = fixture();
    expect(() =>
      applyScope(document, `resume-content/${resume.id}`, {
        selection: resume.selection,
        profileSelection: ["missing"],
      }),
    ).toThrow(/contact/);
    expect(() =>
      applyScope(document, `resume-content/${resume.id}`, {
        selection: [{ ...resume.selection[0], hiddenEntryIds: ["missing"] }],
      }),
    ).toThrow(/Hidden/);
    expect(() =>
      applyScope(document, `resume-wording/${resume.id}`, {
        [entry.fields[0].id]: [{ text: "rich", emphasis: true, href: "" }],
      }),
    ).toThrow(/Inline formatting/);
    const full = {
      ...document,
      resumes: Array.from({ length: 120 }, () => copyResume(resume)),
    };
    const extra = copyResume(resume);
    expect(() => applyScope(full, `resume/${extra.id}`, extra)).toThrow();
  });

  it("preserves archived selections but prevents adding or reenabling archived content", () => {
    const { document, resume, entry } = fixture();
    entry.archived = true;
    expect(renderCareerResume(document, resume.id, 1)).toContain("Engineer");
    const hidden = applyScope(document, `resume-content/${resume.id}`, {
      selection: [{ ...resume.selection[0], hiddenEntryIds: [entry.id] }],
    });
    expect(() =>
      applyScope(hidden, `resume-content/${resume.id}`, {
        selection: resume.selection,
      }),
    ).toThrow(/Archived/);
    const copy = copyResume(resume);
    expect(
      applyScope(document, `resume/${copy.id}`, copy).resumes,
    ).toHaveLength(2);
  });

  it("compares each resume in its own language and excludes hidden values from inclusion", () => {
    const { document, resume, entry } = fixture();
    const copy = copyResume(resume, "pt-BR");
    document.resumes.push(copy);
    const left = resumeComparisonRows(document, resume).find(
      (row) => row.id === entry.fields[0].id,
    )!;
    const right = resumeComparisonRows(document, copy).find(
      (row) => row.id === entry.fields[0].id,
    )!;
    expect(left).toMatchObject({
      value: "Engineer",
      status: "Included",
      source: "Career wording",
    });
    expect(right).toMatchObject({ value: "Engenheira", status: "Included" });
    copy.selection[0].hidden = true;
    expect(
      resumeComparisonRows(document, copy).find(
        (row) => row.id === entry.fields[0].id,
      )?.status,
    ).toBe("Excluded");
  });

  it("round-trips the expanded workspace and recovery scopes without accepting schema 1", () => {
    const { document, resume } = fixture();
    const envelope = {
      format: "verso.workspace",
      schemaVersion: 2,
      exportedAt: "2026-11-03T12:00:00.000Z",
      workspaceId: "workspace",
      document,
    };
    const parsed = parsePortable(JSON.stringify(envelope), "workspace");
    expect(parsed.format === "verso.workspace" && parsed.document).toEqual(
      document,
    );
    expect(() =>
      parsePortable(
        JSON.stringify({ ...envelope, schemaVersion: 1 }),
        "workspace",
      ),
    ).toThrow();
    for (const kind of [
      "resume",
      "resume-content",
      "resume-wording",
      "resume-details",
    ]) {
      expect(
        draftSchema.safeParse({
          draftId: "draft",
          draftVersion: 1,
          workspaceId: "workspace",
          generation: 0,
          baselineRevision: 0,
          scope: `${kind}/${resume.id}`,
          baseline: null,
          values: {},
        }).success,
      ).toBe(true);
    }
  });
});
