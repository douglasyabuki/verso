import { describe, expect, it } from "vitest";

import {
  layoutAppearance,
  layoutFromPreset,
  templateSettings,
} from "@/lib/career/layout";
import {
  applyScope,
  createCareerDocument,
  createEntry,
  parsePortable,
  readScope,
  resumeLayoutSchema,
  validateDocument,
} from "@/lib/career/model";
import { copyResume, createResume } from "@/lib/career/resumes";
import {
  captureStarter,
  detailsForNewEntries,
  fieldsForNewEntries,
  prepareStarterResume,
  starterMappings,
} from "@/lib/career/starters";

function fixture() {
  const document = createCareerDocument();
  document.profile.fields[0].wording["en-US"] = "Alex";
  document.profile.fields[1].fact = "alex@example.com";
  document.profile.fields[2].fact = "5550100";
  document.profile.fields[3].wording["en-US"] = "Example City";
  const entry = createEntry("experience");
  entry.fields[0].wording["en-US"] = "Engineer";
  entry.fields[1].wording["en-US"] = "Organization";
  entry.achievements = [
    {
      id: "achievement",
      archived: false,
      wording: { "en-US": "Delivered value" },
    },
  ];
  document.sections[0].entries = [entry];
  const resume = createResume(document, "en-US");
  resume.name = "Application";
  resume.profileSelection = document.profile.fields
    .slice(1)
    .map((field) => field.id);
  resume.selection = [
    {
      sectionId: document.sections[0].id,
      entryIds: [entry.id],
      fieldIds: entry.fields.map((field) => field.id),
      achievementIds: ["achievement"],
      linkIds: [],
    },
  ];
  document.resumes = [resume];
  return { document, resume, entry };
}
describe("frozen layout defaults", () => {
  it("copies preset defaults independently and captures appearance without baseline metadata", () => {
    const { document, resume } = fixture();
    const preset = { ...document.defaults, marginLeft: 18, fontSize: 9 };
    const loaded = layoutFromPreset(preset);
    resume.layout = loaded;
    loaded.marginLeft = 20;
    preset.marginLeft = 24;
    expect(loaded.defaults?.marginLeft).toBe(18);
    expect(loaded.defaults?.fontSize).toBe(9);
    expect(layoutAppearance(loaded)).not.toHaveProperty("defaults");
    expect(captureStarter(document, resume).layout).not.toHaveProperty(
      "defaults",
    );
    const copy = copyResume(resume);
    copy.layout.defaults!.marginLeft = 22;
    expect(resume.layout.defaults!.marginLeft).toBe(18);
    expect(copyResume(resume, "pt-BR").layout.defaults?.fontSize).toBe(9);
  });

  it("round-trips frozen defaults in workspace backups and rejects recursive defaults", () => {
    const { document, resume } = fixture();
    resume.layout = layoutFromPreset({ ...document.defaults, marginLeft: 18 });
    resume.layout.marginLeft = 20;
    const portable = {
      format: "verso.workspace",
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      workspaceId: "workspace",
      document,
    };
    const parsed = parsePortable(JSON.stringify(portable), "workspace");
    expect(parsed).toMatchObject({
      document: {
        resumes: [{ layout: { marginLeft: 20, defaults: { marginLeft: 18 } } }],
      },
    });
    expect(
      resumeLayoutSchema.safeParse({
        ...resume.layout,
        defaults: resume.layout,
      }).success,
    ).toBe(false);
  });
});

describe("independent appearance and reusable structure", () => {
  it("validates boundaries without truncating or coercing drafts", () => {
    const { resume } = fixture();
    expect(
      resumeLayoutSchema.safeParse({ ...resume.layout, marginLeft: 9 }).success,
    ).toBe(false);
    expect(
      resumeLayoutSchema.safeParse({ ...resume.layout, contactRowSizes: [0] })
        .success,
    ).toBe(false);
    expect(
      resumeLayoutSchema.safeParse({ ...resume.layout, fontSize: "10" })
        .success,
    ).toBe(false);
    expect(
      resumeLayoutSchema.safeParse({ ...resume.layout, fontSize: 10.375 })
        .success,
    ).toBe(true);
    expect(
      templateSettings({
        ...resume.layout,
        paper: "letter",
        font: "source-serif",
      }),
    ).toMatchObject({ pageSize: "letter", fontFamily: "source-serif-4" });
  });
  it("changes layout without overwriting concurrent content, name, wording or contact selection", () => {
    const { document, resume } = fixture();
    const next = applyScope(document, `resume-layout/${resume.id}`, {
      ...resume.layout,
      contactRows: "3",
      paper: "letter",
    });
    expect(next.resumes[0]).toEqual({
      ...resume,
      layout: { ...resume.layout, contactRows: "3", paper: "letter" },
    });
    expect(next.sections).toEqual(document.sections);
    expect(document.resumes[0].layout.paper).toBe("a4");
    expect(readScope(next, `resume-content/${resume.id}`)).toEqual(
      readScope(document, `resume-content/${resume.id}`),
    );
  });
  it("copies presets without live inheritance or content-bearing properties", () => {
    const { document, resume } = fixture();
    const preset = {
      id: "preset",
      name: "Compact",
      template: resume.template,
      layout: { ...layoutAppearance(resume.layout), fontSize: 9 },
    };
    const saved = applyScope(document, "preset/preset", preset);
    const applied = applyScope(
      saved,
      `resume-layout/${resume.id}`,
      saved.presets[0].layout,
    );
    const removed = applyScope(applied, "preset/preset", null);
    expect(removed.resumes[0].layout.fontSize).toBe(9);
    expect(removed.resumes[0].selection).toEqual(resume.selection);
    expect(() =>
      applyScope(document, "preset/preset", {
        ...preset,
        selection: resume.selection,
      }),
    ).toThrow();
  });
  it("captures structural keys without personal wording, entries, facts, or record references", () => {
    const { document, resume, entry } = fixture();
    const starter = captureStarter(document, resume);
    expect(starter.sections).toEqual([
      {
        id: expect.any(String),
        kind: "experience",
        icon: "briefcase-business",
        label: "Experience",
        hidden: false,
        visibleFields: ["title", "organization", "location", "start", "end"],
      },
    ]);
    expect(JSON.stringify(starter)).not.toContain(entry.id);
    expect(JSON.stringify(starter)).not.toContain("Engineer");
    expect(JSON.stringify(starter)).not.toContain("alex@example.com");
    expect(starter.layout).not.toBe(resume.layout);
  });
  it("requires ambiguous mapping review and rejects duplicate or archived matches", () => {
    const { document, resume } = fixture();
    const starter = captureStarter(document, resume);
    expect(starterMappings(document, starter)).toEqual([
      document.sections[0].id,
    ]);
    document.sections.push({
      ...document.sections[0],
      id: "another",
      entries: [],
    });
    expect(starterMappings(document, starter)).toEqual([""]);
    expect(() =>
      prepareStarterResume(document, starter, [""], "en-US"),
    ).toThrow();
    document.sections[0].archived = true;
    expect(() =>
      prepareStarterResume(
        document,
        starter,
        [document.sections[0].id],
        "en-US",
      ),
    ).toThrow();
  });
  it("atomically creates empty sections and a resume, and archives only created identities on undo", () => {
    const { document, resume } = fixture();
    const starter = captureStarter(document, resume);
    const request = prepareStarterResume(document, starter, ["new"], "en-US");
    const scope = `starter-create/${request.resume.id}`;
    const next = applyScope(document, scope, request);
    expect(next.sections).toHaveLength(document.sections.length + 1);
    expect(next.resumes.at(-1)?.selection[0].entryIds).toEqual([]);
    expect(next.sections.at(-1)?.heading).toEqual({});
    const other = copyResume(next.resumes.at(-1)!);
    next.resumes.push(other);
    const undone = applyScope(next, scope, null);
    expect(undone.sections.at(-1)?.archived).toBe(true);
    expect(undone.resumes.some((item) => item.id === other.id)).toBe(true);
    const redone = applyScope(undone, scope, readScope(next, scope));
    expect(redone.sections.at(-1)?.id).toBe(request.sections[0].id);
    expect(redone.sections.at(-1)?.archived).toBe(false);
    expect(redone.sections[0].archived).toBe(false);
  });
  it("rejects stale reviewed mapping and capacity failures without partial changes", () => {
    const { document, resume } = fixture();
    const starter = captureStarter(document, resume);
    const request = prepareStarterResume(
      document,
      starter,
      [document.sections[0].id],
      "en-US",
    );
    document.sections[0].name = "Renamed";
    const before = structuredClone(document);
    expect(() =>
      applyScope(document, `starter-create/${request.resume.id}`, request),
    ).toThrow(/reviewed section changed/);
    expect(document).toEqual(before);
    const fresh = prepareStarterResume(document, starter, ["new"], "en-US");
    while (document.sections.length < 100)
      document.sections.push({
        ...document.sections[1],
        id: `capacity-${document.sections.length}`,
        entries: [],
      });
    expect(() =>
      applyScope(document, `starter-create/${fresh.resume.id}`, fresh),
    ).toThrow();
    expect(document.sections).toHaveLength(100);
    expect(document.resumes).toHaveLength(1);
  });
  it("uses starter field defaults only for new entries and preserves explicit deselection on reselection", () => {
    const { document, entry } = fixture();
    const selection = {
      sectionId: document.sections[0].id,
      entryIds: [],
      fieldIds: [],
      achievementIds: [],
      linkIds: [],
      fieldDefaults: ["organization"],
    };
    expect(
      fieldsForNewEntries(document.sections[0], selection, [entry.id]),
    ).toEqual([entry.fields[1].id]);
    expect(
      fieldsForNewEntries(
        document.sections[0],
        { ...selection, entryIds: [entry.id] },
        [entry.id],
      ),
    ).toEqual([]);
  });
  describe("details for newly selected entries", () => {
    function detailed() {
      const { document, entry } = fixture();
      entry.achievements = [
        { id: "a1", archived: false, wording: { "en-US": "First" } },
        { id: "a2", archived: true, wording: { "en-US": "Archived" } },
        { id: "a3", archived: false, wording: {} },
      ];
      entry.links = [
        { id: "l1", archived: true, url: "https://a.example", label: {} },
        { id: "l2", archived: false, url: "https://b.example", label: {} },
      ];
      const selection = {
        sectionId: document.sections[0].id,
        entryIds: [] as string[],
        fieldIds: [] as string[],
        achievementIds: [] as string[],
        linkIds: [] as string[],
      };
      return { section: document.sections[0], entry, selection };
    }

    it("includes every field and non-archived achievement and link in career order", () => {
      const { section, entry, selection } = detailed();
      expect(detailsForNewEntries(section, selection, [entry.id])).toEqual({
        fieldIds: entry.fields.map((field) => field.id),
        achievementIds: ["a1", "a3"],
        linkIds: ["l2"],
      });
    });

    it("follows starter field defaults while still including achievements and links", () => {
      const { section, entry, selection } = detailed();
      expect(
        detailsForNewEntries(
          section,
          { ...selection, fieldDefaults: ["organization"] },
          [entry.id],
        ),
      ).toEqual({
        fieldIds: [entry.fields[1].id],
        achievementIds: ["a1", "a3"],
        linkIds: ["l2"],
      });
    });

    it("keeps earlier choices when a hidden entry is selected again", () => {
      const { section, entry, selection } = detailed();
      const previous = {
        ...selection,
        entryIds: [entry.id],
        hiddenEntryIds: [entry.id],
        fieldIds: [entry.fields[0].id],
        achievementIds: ["a3"],
        linkIds: [],
      };
      expect(detailsForNewEntries(section, previous, [entry.id])).toEqual({
        fieldIds: [entry.fields[0].id],
        achievementIds: ["a3"],
        linkIds: [],
      });
    });

    it("appends after existing choices without duplicating or reordering them", () => {
      const { section, entry, selection } = detailed();
      const other = createEntry("experience");
      section.entries.push(other);
      const result = detailsForNewEntries(
        section,
        {
          ...selection,
          entryIds: [other.id],
          fieldIds: [other.fields[1].id, entry.fields[0].id],
          achievementIds: ["a3"],
        },
        [other.id, entry.id],
      );
      expect(result.fieldIds).toEqual([
        other.fields[1].id,
        entry.fields[0].id,
        ...entry.fields.slice(1).map((field) => field.id),
      ]);
      expect(result.achievementIds).toEqual(["a3", "a1"]);
      expect(result.linkIds).toEqual(["l2"]);
    });
  });
  it("round-trips current setups while rejecting earlier template/layout data", () => {
    const { document, resume } = fixture();
    document.starters = [captureStarter(document, resume)];
    document.presets = [
      {
        id: "preset",
        name: "Appearance",
        template: resume.template,
        layout: layoutAppearance(resume.layout),
      },
    ];
    const envelope = {
      format: "verso.workspace",
      schemaVersion: 2,
      workspaceId: "workspace",
      exportedAt: "2026-11-05T12:00:00Z",
      document,
    };
    expect(parsePortable(JSON.stringify(envelope), "workspace")).toEqual(
      envelope,
    );
    const old = structuredClone(document);
    (old.resumes[0] as unknown as { template: string }).template =
      "yabuki-reference@1.0.2";
    expect(() => validateDocument(old)).toThrow();
  });
});

it("rejects content-bearing composite requests without changing committed records", () => {
  const document = createCareerDocument();
  const resume = createResume(document, "en-US");
  const starter = {
    id: "starter",
    name: "Structure",
    template: resume.template,
    layout: layoutAppearance(resume.layout),
    summaryIncluded: false,
    sections: [
      {
        id: "work-row",
        label: "Work",
        kind: "experience" as const,
        icon: "briefcase-business" as const,
        hidden: false,
        visibleFields: [],
      },
    ],
  };
  const request = prepareStarterResume(document, starter, ["new"], "en-US");
  request.resume.profileSelection = [document.profile.fields[1].id];
  expect(() =>
    applyScope(document, `starter-create/${request.resume.id}`, request),
  ).toThrow(/cannot copy content/);
  expect(document.resumes).toEqual([]);
  expect(document.sections).toHaveLength(5);
});
