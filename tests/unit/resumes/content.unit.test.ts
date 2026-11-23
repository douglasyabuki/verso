import { describe, expect, it } from "vitest";

import {
  applyScope,
  createCareerDocument,
  createEntry,
  readScope,
  validateDocument,
} from "@/lib/career/model";
import { renderCareerResume } from "@/lib/career/output";
import {
  buildResumeComparison,
  compareWording,
  type ComparisonGroup,
  filterResumeComparison,
} from "@/lib/career/resume-comparison";
import {
  copyResume,
  createResume,
  effectiveResume,
  resolveResumeWording,
} from "@/lib/career/resumes";

function comparisonRows(groups: ComparisonGroup[]) {
  return groups.flatMap((group) => [
    ...group.rows,
    ...group.entries.flatMap((entry) => entry.rows),
  ]);
}

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
    const title = () =>
      comparisonRows(buildResumeComparison(document, [resume, copy])).find(
        (row) => row.id === entry.fields[0].id,
      );
    expect(title()).toMatchObject({
      cells: [
        { value: "Engineer", included: true, source: "career" },
        { value: "Engenheira", included: true, source: "career" },
      ],
      changes: ["wording"],
      contentDifference: true,
    });
    copy.selection[0].hiddenEntryIds = [entry.id];
    expect(title()).toMatchObject({
      cells: [{ included: true }, { included: false }],
      changes: ["inclusion", "wording"],
      contentDifference: true,
    });
    resume.selection[0].hidden = true;
    expect(title()).toMatchObject({
      cells: [{ included: false }, { included: false }],
      changes: ["wording"],
      contentDifference: false,
    });
  });

  it("filters source-only, exclusion, and inclusion changes within their owning section", () => {
    const { document, resume, entry } = fixture();
    const copy = copyResume(resume);
    copy.overrides[entry.fields[0].id] = "Engineer";
    copy.overrides[entry.fields[1].id] = "Excluded employer";
    copy.selection[0].achievementIds = [];
    const groups = buildResumeComparison(document, [resume, copy]);
    const section = `section:${document.sections[0].id}`;
    const defaultView = filterResumeComparison(groups, {
      show: "content",
      section,
      change: "all",
    });
    expect(
      comparisonRows(defaultView.groups).map(({ id, changes }) => ({
        id,
        changes,
      })),
    ).toEqual([{ id: "achievement", changes: ["inclusion"] }]);
    expect(defaultView).toMatchObject({ matching: 1, contentDifferences: 1 });
    expect(defaultView.groups[0].entries[0].id).toBe(entry.id);
    const sources = filterResumeComparison(groups, {
      show: "all",
      section,
      change: "source",
    });
    expect(comparisonRows(sources.groups).map(({ id }) => id)).toEqual([
      entry.fields[0].id,
      entry.fields[1].id,
    ]);
    expect(
      filterResumeComparison(groups, {
        show: "all",
        section: "profile",
        change: "source",
      }).matching,
    ).toBe(0);
  });

  it("detects order by stable identities, even when shared labels are identical", () => {
    const { document, resume, entry } = fixture();
    const section = document.sections[0];
    const second = createEntry("experience");
    second.name = entry.name;
    const third = createEntry("experience");
    section.entries.push(second, third);
    resume.selection[0].entryIds.push(second.id);
    const copy = copyResume(resume);
    copy.selection[0].entryIds.unshift(third.id);
    copy.overrides[section.id] = "Renamed heading";
    const order = () =>
      comparisonRows(buildResumeComparison(document, [resume, copy]))
        .filter((row) => row.changes.includes("order"))
        .map((row) => row.id);
    expect(order()).toEqual([]);
    copy.selection[0].entryIds = [third.id, second.id, entry.id];
    expect(order()).toEqual([`order:entries:${section.id}`]);
  });

  it("preserves original punctuation, accents, and spacing while marking changed words", () => {
    const left = "A equipe  reduziu custos.\nE revisou alertas.";
    const right = "A equipe reduziu incidentes.\nE priorizou alertas.";
    const parts = compareWording([left, right], "pt-BR")!;
    expect(parts.map((side) => side.map(({ text }) => text).join(""))).toEqual([
      left,
      right,
    ]);
    expect(
      parts.map((side) =>
        side
          .filter(({ changed }) => changed)
          .map(({ text }) => text.trim())
          .filter(Boolean),
      ),
    ).toEqual([
      ["custos", "revisou"],
      ["incidentes", "priorizou"],
    ]);
    expect(
      compareWording(["x".repeat(4097), "Short"], "en-US"),
    ).toBeUndefined();
    expect(
      compareWording(["a ".repeat(150), "b ".repeat(150)], "en-US"),
    ).toBeUndefined();
  });
});
