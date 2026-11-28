import { describe, expect, it } from "vitest";

import { detectLinkIcon, resolveLinkIcon } from "@/lib/career/link-icons";
import {
  applyScope,
  createCareerDocument,
  createEntry,
  parsePortable,
  readScope,
  validateDocument,
} from "@/lib/career/model";
import { renderCareerResume } from "@/lib/career/output";
import { assessResumeOutput } from "@/lib/career/readiness";
import { resumeWordingFields, resumeWordingGroups } from "@/lib/career/resumes";
import { detailsForNewEntries } from "@/lib/career/starters";
import { detailRowLabel, linkRowLabel } from "@/lib/career/terminology";
import type {
  CareerDocument,
  CareerEntry,
  CareerResume,
} from "@/types-and-constants/career";

/** Workspace with a project, a TOEFL certification, and an English language entry. */
function fixture(language = "en-US") {
  const document = createCareerDocument(language);
  document.languages.push({
    tag: language === "en-US" ? "pt-BR" : "en-US",
    active: true,
  });
  document.profile.fields[0].wording[language] = "Ana Silva";
  const project = createEntry("projects");
  project.fields.find((field) => field.key === "title")!.wording[language] =
    "Field Notes";
  project.fields.find((field) => field.key === "url")!.fact =
    "https://example.com/project";
  project.links.push({
    id: "project-link",
    archived: false,
    name: "Demo link for product roles",
    url: "https://Example.com/project",
    label: { [language]: "Live demo" },
  });
  project.achievements.push({
    id: "project-detail",
    archived: false,
    name: "Pitch",
    wording: { [language]: "A small writing tool." },
  });
  const toefl = createEntry("certifications");
  toefl.id = "toefl";
  toefl.fields.find((field) => field.key === "title")!.wording[language] =
    "TOEFL iBT";
  toefl.fields.find((field) => field.key === "organization")!.wording[
    language
  ] = "ETS";
  toefl.fields.find((field) => field.key === "score")!.fact = "110/120";
  const english = createEntry("languages");
  english.id = "english";
  english.fields[0].wording[language] = "English";
  english.fields[1].wording[language] = "Advanced";
  english.evidence = [
    { id: "english-toefl", entryId: "toefl", archived: false },
  ];
  const sections = document.sections;
  sections
    .find((section) => section.kind === "projects")!
    .entries.push(project);
  sections
    .find((section) => section.kind === "certifications")!
    .entries.push(toefl);
  sections.push({
    id: "languages",
    kind: "languages",
    icon: "languages",
    name: "Languages",
    heading: {},
    archived: false,
    entries: [english],
  });
  const select = (kind: string, entry: CareerEntry, extra = {}) => ({
    sectionId: sections.find((section) => section.kind === kind)!.id,
    entryIds: [entry.id],
    fieldIds: entry.fields.map((field) => field.id),
    achievementIds: entry.achievements.map((item) => item.id),
    linkIds: entry.links.map((item) => item.id),
    ...extra,
  });
  const resume: CareerResume = {
    id: "resume",
    name: "Application",
    language,
    template: "yabuki-reference@1.0.3",
    selection: [
      select("projects", project),
      select("languages", english, { evidenceIds: ["english-toefl"] }),
    ],
    profileSelection: [],
    overrides: {},
    layout: { ...document.defaults },
  };
  document.resumes.push(resume);
  return { document: validateDocument(document), project, toefl, english };
}

describe("link icons", () => {
  it.each([
    ["https://www.linkedin.com/in/ana", "linkedin"],
    ["https://LINKEDIN.com/in/ana", "linkedin"],
    ["https://github.com/ana", "github"],
    ["https://gist.github.com/ana", "github"],
    ["https://youtu.be/abc", "youtube"],
    ["https://x.com/ana", "x-twitter"],
    ["https://twitter.com/ana", "x-twitter"],
    ["https://scholar.google.com/citations?user=1", "google-scholar"],
    ["https://scholar.google.com.br/citations?user=1", "google-scholar"],
    ["https://ana.dev", "website"],
    ["https://github.com.evil.example", "website"],
    ["https://notgithub.com/ana", "website"],
    ["https://linkedin.co/in/ana", "website"],
    ["https://google.com/scholar", "website"],
    ["mailto:ana@github.com", "website"],
    ["not a url", "website"],
    ["", "website"],
  ])("detects %s as %s", (url, icon) => {
    expect(detectLinkIcon(url)).toBe(icon);
  });

  it("uses an explicit override over detection", () => {
    expect(
      resolveLinkIcon({ url: "https://github.com/ana", icon: "website" }),
    ).toBe("website");
    expect(resolveLinkIcon({ url: "https://ana.dev", icon: "medium" })).toBe(
      "medium",
    );
  });

  it("renders brand icons only while Contact icons is on", () => {
    const document = createCareerDocument();
    document.sections = [];
    document.profile.fields[0].wording["en-US"] = "Ana";
    document.profile.links.push(
      {
        id: "github",
        archived: false,
        url: "https://github.com/ana",
        label: { "en-US": "github.com/ana" },
      },
      {
        id: "site",
        archived: false,
        url: "https://linkedin.com/in/ana",
        icon: "website",
        label: {},
      },
    );
    document.resumes.push({
      id: "resume",
      name: "",
      language: "en-US",
      template: "yabuki-reference@1.0.3",
      selection: [],
      profileSelection: ["github", "site"],
      overrides: {},
      layout: { ...document.defaults, contactIcons: "on" },
    });
    const on = renderCareerResume(validateDocument(document), "resume", 1);
    expect(on).toContain(
      "{\\color{icnclr}\\VersoBrand{F09B}}\\enspace \\href{https://github.com/ana}{github.com/ana}",
    );
    // The override wins and a blank label shows the breakable URL.
    expect(on).toContain(
      "{\\color{icnclr}\\faLink}\\enspace \\href{https://linkedin.com/in/ana}{https:",
    );
    expect(on).not.toContain("\\VersoBrand{F0E1}");
    document.resumes[0].layout.contactIcons = "off";
    const off = renderCareerResume(document, "resume", 1);
    expect(off).not.toContain("VersoBrand{F09B}");
    expect(off).not.toContain("\\faLink");
  });
});

describe("internal names", () => {
  it("label editor rows without reaching the PDF", () => {
    const { document } = fixture();
    const output = renderCareerResume(document, "resume", 1);
    expect(output).not.toContain("Demo link for product roles");
    expect(output).not.toContain("Pitch");
    expect(output).toContain("A small writing tool.");
    const rows = resumeWordingFields(document, "en-US");
    expect(rows.find((row) => row.id === "project-detail")?.shortLabel).toBe(
      "Pitch",
    );
    expect(rows.find((row) => row.id === "project-link")?.shortLabel).toBe(
      "Demo link for product roles label",
    );
  });

  it("falls back to wording and section-specific numbering", () => {
    expect(detailRowLabel("skills", {}, 1, "")).toEqual({
      title: "Skill detail 2",
      detail: "",
    });
    expect(
      detailRowLabel("experience", { name: "Launch" }, 0, "Led it"),
    ).toEqual({ title: "Launch", detail: "Led it" });
    expect(detailRowLabel("projects", {}, 0, "Built it")).toEqual({
      title: "Built it",
      detail: "",
    });
    expect(linkRowLabel({ url: "" }, 2, "")).toEqual({
      title: "Link 3",
      detail: "",
    });
    expect(
      linkRowLabel(
        { name: "Portfolio link for design roles", url: "https://a.dev" },
        0,
        "Portfolio",
      ),
    ).toEqual({
      title: "Portfolio link for design roles",
      detail: "Portfolio · https://a.dev",
    });
  });

  it("renaming keeps identities, selections, and rendered output", () => {
    const { document, project } = fixture();
    const before = renderCareerResume(document, "resume", 1);
    const renamed = applyScope(document, `entry/${project.id}`, {
      ...project,
      achievements: [{ ...project.achievements[0], name: "Renamed" }],
      links: [{ ...project.links[0], name: undefined }],
    });
    expect(renderCareerResume(renamed, "resume", 1)).toBe(before);
    expect(renamed.resumes[0].selection).toEqual(document.resumes[0].selection);
  });
});

describe("Website and entry-link duplicates", () => {
  const render = (
    url: string,
    linkSelected: boolean,
    websiteSelected = true,
  ) => {
    const { document, project } = fixture();
    const next = structuredClone(document) as CareerDocument;
    const entry = next.sections
      .flatMap((section) => section.entries)
      .find((item) => item.id === project.id)!;
    entry.links[0].url = url;
    const selection = next.resumes[0].selection[0];
    const website = entry.fields.find((field) => field.key === "url")!.id;
    if (!linkSelected) selection.linkIds = [];
    if (!websiteSelected)
      selection.fieldIds = selection.fieldIds.filter((id) => id !== website);
    return renderCareerResume(validateDocument(next), "resume", 1);
  };
  const hrefs = (source: string) =>
    source
      .match(/\\href\{[^}]*\}/g)
      ?.map((value) => value.slice(6, -1).replace(/\\([#%&_])/g, "$1")) ?? [];

  it("renders a shared destination once with its label", () => {
    const source = render("https://EXAMPLE.com/project", true);
    expect(hrefs(source)).toEqual(["https://EXAMPLE.com/project"]);
    expect(source).toContain("{Live demo}");
  });

  it("renders whichever one is selected", () => {
    expect(hrefs(render("https://example.com/project", false))).toEqual([
      "https://example.com/project",
    ]);
    expect(hrefs(render("https://example.com/project", true, false))).toEqual([
      "https://example.com/project",
    ]);
  });

  it.each([
    "https://example.com/project/",
    "https://example.com/project?ref=cv",
    "https://example.com/project#demo",
    "https://example.com/other",
  ])("keeps both when the destination differs: %s", (url) => {
    expect(hrefs(render(url, true))).toEqual([
      "https://example.com/project",
      url,
    ]);
  });
});

describe("spoken languages and attached tests", () => {
  it("renders the language, proficiency, and attached result beneath it", () => {
    const { document } = fixture();
    const source = renderCareerResume(document, "resume", 1);
    expect(source).toMatch(/\\section\{Languages\}/i);
    expect(source).toContain("\\noindent \\textbf{English} · Advanced\\par");
    expect(source).toContain("{\\small TOEFL iBT · ETS · 110/120}");
  });

  it("renders a language without proficiency or a test, and a test without a URL", () => {
    const { document, english } = fixture();
    const next = structuredClone(document) as CareerDocument;
    const entry = next.sections
      .flatMap((section) => section.entries)
      .find((item) => item.id === english.id)!;
    entry.fields[1].wording["en-US"] = "";
    next.resumes[0].selection[1].evidenceIds = [];
    const source = renderCareerResume(validateDocument(next), "resume", 1);
    expect(source).toContain("\\noindent \\textbf{English}\\par");
    expect(source).not.toContain("TOEFL");
  });

  it("uses Portuguese headings and wording on Portuguese resumes", () => {
    const { document } = fixture("pt-BR");
    expect(renderCareerResume(document, "resume", 1)).toMatch(
      /\\section\{Idiomas\}/i,
    );
  });

  it("keeps Languages and Certifications selections independent", () => {
    const { document, toefl } = fixture();
    const certifications = document.sections.find(
      (section) => section.kind === "certifications",
    )!;
    const next = applyScope(document, "resume-content/resume", {
      selection: [
        ...document.resumes[0].selection,
        {
          sectionId: certifications.id,
          entryIds: [toefl.id],
          fieldIds: [toefl.fields.find((field) => field.key === "title")!.id],
          achievementIds: [],
          linkIds: [],
        },
      ],
      profileSelection: [],
      summaryIncluded: false,
    });
    const source = renderCareerResume(next, "resume", 1);
    expect(source).toMatch(/\\section\{Certifications\}/i);
    expect(source).toContain("\\subsection{TOEFL iBT}");
    expect(source).toContain("{\\small TOEFL iBT · ETS · 110/120}");
    // Removing it from Languages leaves the Certifications selection untouched.
    const withoutEvidence = applyScope(next, "resume-content/resume", {
      selection: next.resumes[0].selection.map((item) =>
        item.evidenceIds ? { ...item, evidenceIds: [] } : item,
      ),
      profileSelection: [],
      summaryIncluded: false,
    });
    const other = renderCareerResume(withoutEvidence, "resume", 1);
    expect(other).toContain("\\subsection{TOEFL iBT}");
    expect(other).not.toContain("{\\small TOEFL");
  });

  it("reaches every resume after one shared edit", () => {
    const { document, toefl } = fixture();
    const edited = applyScope(document, `entry/${toefl.id}`, {
      ...toefl,
      fields: toefl.fields.map((field) =>
        field.key === "score" ? { ...field, fact: "112/120" } : field,
      ),
    });
    expect(renderCareerResume(edited, "resume", 1)).toContain("112/120");
  });

  it("blocks output when the attached test has no name in the resume language", () => {
    const { document, toefl } = fixture();
    const next = structuredClone(document) as CareerDocument;
    next.sections
      .flatMap((section) => section.entries)
      .find((item) => item.id === toefl.id)!
      .fields.find((field) => field.key === "title")!.wording = {};
    const issues = assessResumeOutput(validateDocument(next), "resume").issues;
    expect(issues.map((issue) => issue.message)).toEqual([
      expect.stringContaining("attached test or certificate name"),
    ]);
  });

  it("validates attachments", () => {
    const { document, project, english } = fixture();
    const attach = (entryId: string) => {
      const next = structuredClone(document) as CareerDocument;
      next.sections
        .flatMap((section) => section.entries)
        .find((item) => item.id === english.id)!
        .evidence!.push({ id: "second", entryId, archived: false });
      return () => validateDocument(next);
    };
    expect(attach(project.id)).toThrow(/must be a certification/);
    expect(attach("toefl")).toThrow(/attached to a language once/);
    expect(attach("missing")).toThrow(/must be a certification/);
    const misplaced = structuredClone(document) as CareerDocument;
    misplaced.sections
      .flatMap((section) => section.entries)
      .find((item) => item.id === project.id)!.evidence = [
      { id: "misplaced", entryId: "toefl", archived: false },
    ];
    expect(() => validateDocument(misplaced)).toThrow(/Only language entries/);
  });

  it("detaches by archiving and blocks new selections of detached results", () => {
    const { document, english } = fixture();
    expect(() =>
      applyScope(document, `entry/${english.id}`, { ...english, evidence: [] }),
    ).toThrow(/Archive shared content/);
    const detached = applyScope(document, `entry/${english.id}`, {
      ...english,
      evidence: [{ ...english.evidence![0], archived: true }],
    });
    // Existing selections keep rendering.
    expect(renderCareerResume(detached, "resume", 1)).toContain("TOEFL iBT");
    const cleared = applyScope(detached, "resume-content/resume", {
      selection: detached.resumes[0].selection.map((item) => ({
        ...item,
        evidenceIds: [],
      })),
      profileSelection: [],
    });
    expect(() =>
      applyScope(cleared, "resume-content/resume", {
        selection: detached.resumes[0].selection,
        profileSelection: [],
      }),
    ).toThrow(/Archived content/);
    expect(() =>
      applyScope(document, `entry/${english.id}`, {
        ...english,
        evidence: [{ ...english.evidence![0], entryId: "other" }],
      }),
    ).toThrow(/cannot change its certification/);
  });

  it("selects active attachments when a language is first selected", () => {
    const { document, english } = fixture();
    const section = document.sections.find(
      (item) => item.kind === "languages",
    )!;
    const empty = {
      sectionId: section.id,
      entryIds: [],
      fieldIds: [],
      achievementIds: [],
      linkIds: [],
    };
    expect(
      detailsForNewEntries(section, empty, [english.id], document.sections)
        .evidenceIds,
    ).toEqual(["english-toefl"]);
    const archived = structuredClone(document.sections);
    archived
      .flatMap((item) => item.entries)
      .find((item) => item.id === "toefl")!.archived = true;
    expect(
      detailsForNewEntries(section, empty, [english.id], archived).evidenceIds,
    ).toEqual([]);
  });
});

describe("create and attach a test in one transaction", () => {
  const request = (document: CareerDocument, languageEntryId: string) => {
    const entry = createEntry("certifications");
    entry.fields.find((field) => field.key === "title")!.wording["en-US"] =
      "IELTS Academic";
    entry.fields.find((field) => field.key === "score")!.fact = "Band 8";
    return {
      languageEntryId,
      sectionId: document.sections.find(
        (section) => section.kind === "certifications",
      )!.id,
      attachmentId: crypto.randomUUID(),
      entry,
    };
  };

  it("creates, undoes, and redoes the certification and attachment together", () => {
    const { document, english } = fixture();
    const values = request(document, english.id);
    const scope = `language-evidence/${values.entry.id}`;
    expect(readScope(document, scope)).toBeNull();
    const created = applyScope(document, scope, values);
    expect(readScope(created, scope)).toEqual(values);
    const language = created.sections
      .flatMap((section) => section.entries)
      .find((item) => item.id === english.id)!;
    expect(language.evidence?.map((item) => item.entryId)).toEqual([
      "toefl",
      values.entry.id,
    ]);
    const undone = applyScope(created, scope, null);
    const archived = readScope(undone, scope) as typeof values;
    expect(archived.entry.archived).toBe(true);
    expect(
      undone.sections
        .flatMap((section) => section.entries)
        .find((item) => item.id === english.id)!
        .evidence!.find((item) => item.id === values.attachmentId)!.archived,
    ).toBe(true);
    expect(applyScope(undone, scope, values)).toEqual(created);
  });

  it("requires a saved language and an active Certifications section", () => {
    const { document } = fixture();
    expect(() =>
      applyScope(document, "language-evidence/new", {
        ...request(document, "unsaved"),
        entry: { ...createEntry("certifications"), id: "new" },
      }),
    ).toThrow(/Save the language/);
    const values = request(document, "english");
    expect(() =>
      applyScope(document, `language-evidence/${values.entry.id}`, {
        ...values,
        sectionId: document.sections.find(
          (section) => section.kind === "projects",
        )!.id,
      }),
    ).toThrow(/Certifications section/);
  });
});

describe("compatibility", () => {
  it("accepts certifications saved before Score or result existed", () => {
    const { document, toefl } = fixture();
    const next = structuredClone(document) as CareerDocument;
    const entry = next.sections
      .flatMap((section) => section.entries)
      .find((item) => item.id === toefl.id)!;
    entry.fields = entry.fields.filter((field) => field.key !== "score");
    expect(() => validateDocument(next)).not.toThrow();
    entry.fields = entry.fields.filter((field) => field.key !== "credential");
    expect(() => validateDocument(next)).toThrow(/built-in fields/);
  });

  it("round-trips names, icons, and evidence through a workspace backup", () => {
    const { document } = fixture();
    document.profile.links.push({
      id: "profile-link",
      archived: false,
      name: "Main profile",
      icon: "linkedin",
      url: "https://ana.dev",
      label: {},
    });
    const source = JSON.stringify({
      format: "verso.workspace",
      schemaVersion: 2,
      exportedAt: new Date(0).toISOString(),
      workspaceId: "workspace",
      document,
    });
    const envelope = parsePortable(source, "workspace");
    if (envelope.format !== "verso.workspace") throw new Error("workspace");
    expect(envelope.document).toEqual(validateDocument(document));
  });
});

describe("Wording for attached results", () => {
  it("lists a certification shown beneath a language as included", () => {
    const { document, toefl } = fixture();
    const certifications = resumeWordingGroups(
      document,
      document.resumes[0],
    ).find((group) => group.owner === "certifications")!;
    expect(certifications.included).toBe(true);
    const entry = certifications.entries.find((item) => item.id === toefl.id)!;
    expect(entry.included).toBe(true);
    expect(entry.rows.find((row) => row.shortLabel === "Title")?.included).toBe(
      true,
    );
  });
});
