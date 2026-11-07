import { afterEach, describe, expect, it, vi } from "vitest";

import {
  contactRows,
  layoutAppearance,
  layoutDefaults,
  layoutFromPreset,
  sameAppearance,
  sameLayout,
  templateSettings,
} from "@/lib/career/layout";
import {
  resolvedLayoutColor,
  templateDimensionDisplay,
  templateDimensionExplanation,
} from "@/lib/career/layout-display";
import {
  applyScope,
  createCareerDocument,
  createEntry,
  parsePortable,
  readScope,
  resumeLayoutSchema,
  validateDocument,
} from "@/lib/career/model";
import { renderCareerResume } from "@/lib/career/output";
import { copyResume, createResume } from "@/lib/career/resumes";
import {
  captureStarter,
  fieldsForNewEntries,
  prepareStarterResume,
  starterMappings,
} from "@/lib/career/starters";
import { CareerController } from "@/stores/career/controller";
import * as persistence from "@/stores/career/persistence";

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
const controllers: CareerController[] = [];
afterEach(() => {
  controllers.splice(0).forEach((controller) => controller.dispose());
  vi.restoreAllMocks();
});

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

  it("distinguishes baseline-only loads without changing generated output", () => {
    const { document, resume } = fixture();
    resume.layout.marginLeft = 18;
    const loaded = layoutFromPreset(layoutAppearance(resume.layout));
    expect(sameAppearance(resume.layout, loaded)).toBe(true);
    expect(sameLayout(resume.layout, loaded)).toBe(false);
    const before = renderCareerResume(document, resume.id, 1);
    const next = applyScope(document, `resume-layout/${resume.id}`, loaded);
    expect(renderCareerResume(next, resume.id, 1)).toBe(before);
    expect(next.resumes[0].layout.defaults?.marginLeft).toBe(18);
    expect(sameLayout(next.resumes[0].layout, loaded)).toBe(true);
  });

  it("initializes only missing baselines from saved appearance without mutating old requests", () => {
    const { document, resume } = fixture();
    resume.layout = { ...layoutAppearance(resume.layout), marginLeft: 19 };
    expect(validateDocument(document).resumes[0].layout).not.toHaveProperty(
      "defaults",
    );
    const values = { ...resume.layout, marginLeft: 21 };
    const fingerprint = JSON.stringify(values);
    const next = applyScope(document, `resume-layout/${resume.id}`, values);
    expect(next.resumes[0].layout.defaults?.marginLeft).toBe(19);
    expect(next.resumes[0].layout.marginLeft).toBe(21);
    expect(JSON.stringify(values)).toBe(fingerprint);
    expect(document.resumes[0].layout).not.toHaveProperty("defaults");
    const later = applyScope(next, `resume-layout/${resume.id}`, {
      ...values,
      marginLeft: 22,
    });
    expect(later.resumes[0].layout.defaults?.marginLeft).toBe(19);
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

  it("preserves malformed recovered values, both baseline versions and immutable retry context", () => {
    const { resume } = fixture();
    const baseline = { ...layoutAppearance(resume.layout), marginLeft: 19 };
    const values = {
      ...layoutFromPreset({ ...baseline, marginLeft: 18 }),
      marginLeft: "unfinished",
    };
    const draft = {
      draftId: "draft",
      draftVersion: 3,
      workspaceId: "workspace",
      scope: `resume-layout/${resume.id}`,
      baseline,
      baselineRevision: 4,
      generation: 1,
      values,
      operationId: "operation",
      fingerprint: "immutable-original-fingerprint",
    };
    const envelope = {
      format: "verso.recovery",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      sourceWorkspaceId: "workspace",
      drafts: [draft],
    };
    const result = parsePortable(JSON.stringify(envelope), "recovery");
    expect(result).toEqual(envelope);
    expect(resumeLayoutSchema.safeParse(values).success).toBe(false);
    expect(draft.baseline).not.toHaveProperty("defaults");
    expect(draft.values.defaults?.marginLeft).toBe(18);
  });

  it("keeps preset defaults and appearance in one cancelable, undoable Save", async () => {
    vi.spyOn(persistence, "openCareerStorage").mockRejectedValue(
      new Error("Unavailable"),
    );
    const controller = new CareerController();
    controllers.push(controller);
    await controller.initialize();
    const document = controller.getSnapshot().head!.document;
    const resume = createResume(document, "en-US");
    controller.open(`resume/${resume.id}`);
    controller.change(resume);
    expect(await controller.save(true)).toBe(true);
    await controller.cancel();
    const original = structuredClone(
      controller.getSnapshot().head!.document.resumes[0].layout,
    );
    const loaded = layoutFromPreset({ ...document.defaults, marginLeft: 18 });
    controller.open(`resume-layout/${resume.id}`);
    controller.change(loaded);
    await controller.cancel();
    expect(controller.getSnapshot().head!.document.resumes[0].layout).toEqual(
      original,
    );
    controller.open(`resume-layout/${resume.id}`);
    controller.change(loaded);
    const steps = controller.getSnapshot().undoCount;
    expect(await controller.save(true)).toBe(true);
    expect(controller.getSnapshot().undoCount).toBe(steps + 1);
    await controller.cancel();
    expect(await controller.history("undo")).toBe(true);
    expect(controller.getSnapshot().head!.document.resumes[0].layout).toEqual(
      original,
    );
    expect(await controller.history("redo")).toBe(true);
    expect(controller.getSnapshot().head!.document.resumes[0].layout).toEqual(
      loaded,
    );
  });

  it("describes relative and elastic defaults without replacing them with fixed values", () => {
    expect(templateDimensionDisplay("nameSize")).toBe(20);
    expect(templateDimensionDisplay("entryTitleSize")).toBe("Body text size");
    expect(templateDimensionDisplay("entryGap")).toBe("0.7 × body text size");
    expect(templateDimensionExplanation("paragraphGap")).toContain(
      "stretch by 1 pt",
    );
    const { resume } = fixture();
    expect(resume.layout.entryGap).toBe("template-default");
  });

  it("resolves template color dependencies rather than displaying transparent defaults", () => {
    const { resume } = fixture();
    expect(resolvedLayoutColor(resume.layout, "headingColor")).toEqual({
      label: "Sepia",
      hex: "#4D0000",
    });
    expect(resolvedLayoutColor(resume.layout, "secondaryColor").hex).toBe(
      "#404040",
    );
    expect(
      resolvedLayoutColor(
        { ...resume.layout, headingColor: "dark-teal" },
        "linkColor",
      ).hex,
    ).toBe("#115E59");
    expect(
      resolvedLayoutColor(
        { ...resume.layout, bodyColor: "dark-navy" },
        "iconColor",
      ).hex,
    ).toBe("#1E3A5F");
    expect(layoutDefaults(resume.layout).fontSize).toBe(10);
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
  it("groups fixed and custom contact rows with overflow and no empty trailing rows", () => {
    const layout = fixture().resume.layout;
    expect(
      contactRows(["a", "b", "c", "d", "e"], { ...layout, contactRows: "3" }),
    ).toEqual([
      ["a", "b", "c"],
      ["d", "e"],
    ]);
    expect(
      contactRows(["a", "b", "c", "d"], {
        ...layout,
        contactRows: "custom",
        contactRowSizes: [1, 2],
      }),
    ).toEqual([["a"], ["b", "c"], ["d"]]);
    expect(
      contactRows(["a"], {
        ...layout,
        contactRows: "custom",
        contactRowSizes: [2, 3],
      }),
    ).toEqual([["a"]]);
    expect(contactRows([], layout)).toEqual([]);
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
  it.each([
    ["paper", "letter", "letterpaper"],
    ["font", "source-serif", "SourceSerif4-Regular.otf"],
    ["fontSize", 12, "\\fontsize{12}{14.400}"],
    ["marginLeft", 15, "left=15mm"],
    ["marginRight", 16, "right=16mm"],
    ["marginTop", 17, "top=17mm"],
    ["marginBottom", 18, "bottom=18mm"],
    ["lineHeight", 1.4, "\\fontsize{10}{14.000}"],
    ["nameSize", 24, "\\fontsize{24}{26.400}"],
    ["headerAlignment", "left", "\\begin{flushleft}"],
    ["nameContactGap", 12, "\\vspace{12pt}"],
    ["headerGap", 14, "\\endgroup\\vspace{14pt}"],
    ["sectionSize", 14, "\\fontsize{14}{16.333}"],
    ["sectionBelow", 3, "{3mm}"],
    ["sectionGap", 6, "{6mm}"],
    ["dividerThickness", 0.5, "{0.5pt}"],
    ["entryTitleSize", 13, "\\fontsize{13}{15.600}"],
    ["entrySubtitleSize", 11, "\\fontsize{11}{13.200}"],
    ["headingSubtitleGap", 4, "{4pt}"],
    ["beforeDetailsGap", 5, "\\vspace{5pt}"],
    ["entryGap", 9, "\\par\\vspace{9pt}"],
    ["paragraphGap", 3, "\\setlength{\\parskip}{3pt}"],
    ["bulletIndent", 4, "labelindent=4mm"],
    ["bulletTextGap", 2, "labelsep=2mm"],
    ["bulletGap", 3, "itemsep=3pt"],
    ["listAbove", 4, "\\vspace{4pt}"],
    ["listBelow", 5, "\\vspace{5pt}"],
    ["headingColor", "dark-navy", "{headingclr}{HTML}{1E3A5F}"],
    ["bodyColor", "dark-gray", "{bodyclr}{HTML}{404040}"],
    ["secondaryColor", "dark-teal", "{roleclr}{HTML}{115E59}"],
    ["linkColor", "dark-burgundy", "{linkclr}{HTML}{701A32}"],
    ["iconColor", "dark-navy", "{icnclr}{HTML}{1E3A5F}"],
    ["dividerColor", "dark-teal", "{dividerclr}{HTML}{115E59}"],
    ["sectionCasing", "original", "\\section{Experience}"],
    ["pageNumbering", "shown", "\\def\\@oddfoot"],
    ["contactRows", "1", "alex@example.com\\par\\vspace{0pt}"],
    ["contactRowGap", 4, "\\par\\vspace{4pt}"],
    ["contactSeparator", "bar", "\\enspace | \\enspace"],
  ] as const)(
    "renders %s through the active output path",
    (key, value, expected) => {
      const { document, resume } = fixture();
      resume.layout = { ...resume.layout, [key]: value };
      if (key === "contactRowGap") resume.layout.contactRows = "1";
      expect(renderCareerResume(document, resume.id, 7)).toContain(expected);
    },
  );
  it("renders contact icons only when requested and retains selected subtitle text", () => {
    const { document, resume } = fixture();
    expect(renderCareerResume(document, resume.id, 1)).toContain(
      "\\faEnvelope",
    );
    resume.layout.contactIcons = "off";
    const source = renderCareerResume(document, resume.id, 1);
    expect(source).not.toContain("\\faEnvelope");
    expect(source).toContain("\\subsubsection{Organization}");
    resume.layout.sectionDivider = "off";
    expect(renderCareerResume(document, resume.id, 1)).not.toContain(
      "~\\xrfill",
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
  it("keeps invalid layout drafts, and makes starter creation one undoable controller step", async () => {
    vi.spyOn(persistence, "openCareerStorage").mockRejectedValue(
      new Error("Storage unavailable"),
    );
    const controller = new CareerController();
    controllers.push(controller);
    await controller.initialize();
    const document = controller.getSnapshot().head!.document;
    const resume = createResume(document, "en-US");
    controller.open(`resume/${resume.id}`);
    controller.change(resume);
    expect(await controller.save(true)).toBe(true);
    controller.open(`resume-layout/${resume.id}`);
    controller.change({ ...resume.layout, marginLeft: "bad" });
    expect(await controller.save()).toBe(false);
    expect(controller.getSnapshot().draft?.values).toMatchObject({
      marginLeft: "bad",
    });
    await controller.cancel();
    const starter = {
      id: "starter",
      name: "Empty",
      template: resume.template,
      layout: layoutAppearance(resume.layout),
      summaryIncluded: false,
      sections: [
        {
          id: "work-slot",
          label: "Work",
          kind: "experience" as const,
          icon: "briefcase-business" as const,
          hidden: false,
          visibleFields: ["title"],
        },
      ],
    };
    const request = prepareStarterResume(document, starter, ["new"], "en-US");
    const before = controller.getSnapshot().undoCount;
    controller.open(`starter-create/${request.resume.id}`);
    controller.change(request);
    expect(await controller.save(true)).toBe(true);
    expect(controller.getSnapshot().undoCount).toBe(before + 1);
    await controller.cancel();
    expect(await controller.history("undo")).toBe(true);
    expect(
      controller.getSnapshot().head!.document.sections.at(-1)?.archived,
    ).toBe(true);
    expect(await controller.history("redo")).toBe(true);
    expect(controller.getSnapshot().head!.document.resumes.at(-1)?.id).toBe(
      request.resume.id,
    );
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
