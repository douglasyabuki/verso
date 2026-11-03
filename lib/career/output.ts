import {
  renderWording,
  type RichText,
  wordingText,
} from "@/lib/career/wording";
import { escapeLatex, escapeLatexUrl } from "@/lib/output/encoding";
import { renderTemplate } from "@/lib/output/template";
import type { CareerDocument } from "@/types-and-constants/career";
import { defaultSettings } from "@/types-and-constants/output";

export const outputCapabilities: Record<
  string,
  {
    languageNumber: number;
    pageLabel: string;
    ofLabel: string;
    summaryLabel: string;
    labels: Record<string, string>;
  }
> = {
  "en-US": {
    languageNumber: 0,
    pageLabel: "Page",
    ofLabel: "of",
    summaryLabel: "About me",
    labels: {
      experience: "Experience",
      education: "Education",
      projects: "Projects",
      skills: "Skills",
      certifications: "Certifications",
    },
  },
  "pt-BR": {
    languageNumber: 1,
    pageLabel: "Página",
    ofLabel: "de",
    summaryLabel: "Sobre mim",
    labels: {
      experience: "Experiência",
      education: "Formação",
      projects: "Projetos",
      skills: "Competências",
      certifications: "Certificações",
    },
  },
};

/** Render one committed schema-2 resume through the pinned template, retaining selected archived content.
 * @param document Committed validated workspace, never form-draft values.
 * @param resumeId Independent resume identity.
 * @param revision Committed revision displayed in PDF metadata.
 * @returns {string} Deterministic trusted TeX; throws for unsupported output languages or missing selected wording. Activation never changes output capability.
 * @example renderCareerResume(document, resume.id, 4)
 */
export function renderCareerResume(
  document: CareerDocument,
  resumeId: string,
  revision: number,
): string {
  const resume = document.resumes.find((item) => item.id === resumeId);
  if (!resume) throw new Error("Resume not found.");
  const capability = outputCapabilities[resume.language];
  if (!capability)
    throw new Error(
      "PDF unavailable: language rendering has not been verified.",
    );
  const wording = (id: string, values: Record<string, RichText>) =>
    resume.overrides[id] ?? values[resume.language] ?? "";
  const fields = document.profile.fields;
  const nameField = fields.find((field) => field.key === "fullName")!;
  const name = wordingText(wording(nameField.id, nameField.wording));
  if (!name.trim())
    throw new Error("Add the selected language's full name before output.");
  const contacts = fields
    .filter((field) => field.key !== "fullName")
    .map((field) =>
      escapeLatex(
        field.type === "text"
          ? wordingText(wording(field.id, field.wording))
          : field.fact,
      ),
    )
    .filter(Boolean);
  for (const link of document.profile.links.filter((item) => !item.archived))
    if (link.url)
      contacts.push(
        `\\href{${escapeLatexUrl(link.url)}}{${escapeLatex(wordingText(wording(link.id, link.label)) || link.url)}}`,
      );
  const body: string[] = [];
  const summary = wording(document.summary.id, document.summary.wording);
  if (wordingText(summary).trim())
    body.push(
      `\\section{${escapeLatex(capability.summaryLabel.toLocaleUpperCase(resume.language))}}\n${renderWording(summary)}\\par`,
    );
  for (const selection of resume.selection) {
    const section = document.sections.find(
      (item) => item.id === selection.sectionId,
    )!;
    if (!selection.entryIds.length) continue;
    const heading =
      wordingText(wording(section.id, section.heading)) ||
      capability.labels[section.kind];
    if (!heading)
      throw new Error(
        "Add this custom section's heading in the selected language before output.",
      );
    body.push(
      `\\section{${escapeLatex(heading.toLocaleUpperCase(resume.language))}}`,
    );
    for (const entryId of selection.entryIds) {
      const entry = section.entries.find((item) => item.id === entryId)!;
      const selectedFields = selection.fieldIds
        .map((id) => entry.fields.find((field) => field.id === id))
        .filter((field) => field !== undefined);
      const title = selectedFields.find((field) =>
        ["title", "degree"].includes(field.key),
      );
      const titleText = title
        ? wordingText(wording(title.id, title.wording))
        : "";
      if (title && !titleText.trim())
        throw new Error(
          `Add selected ${title.key} wording in ${resume.language} before output.`,
        );
      if (titleText) body.push(`\\subsection{${escapeLatex(titleText)}}`);
      const details = selectedFields
        .filter((field) => field !== title)
        .map((field) => {
          const value =
            field.type === "text"
              ? wordingText(wording(field.id, field.wording))
              : field.fact;
          if (field.type !== "date" || !value || value.length === 4)
            return escapeLatex(value);
          const date = new Date(
            `${value.length === 7 ? value + "-01" : value}T12:00:00Z`,
          );
          return escapeLatex(
            new Intl.DateTimeFormat(resume.language, {
              month: "short",
              year: "numeric",
              ...(value.length === 10 ? { day: "numeric" as const } : {}),
              timeZone: "UTC",
            }).format(date),
          );
        })
        .filter(Boolean);
      if (details.length) body.push(`\\noindent ${details.join(" · ")}\\par`);
      const achievements = selection.achievementIds
        .map((id) => entry.achievements.find((item) => item.id === id))
        .filter((item) => item !== undefined);
      if (achievements.length) {
        const text = achievements.map((item) => wording(item.id, item.wording));
        if (text.some((value) => !wordingText(value).trim()))
          throw new Error(
            `Add selected achievement wording in ${resume.language} before output.`,
          );
        body.push(
          `\\begin{achievements}\n${text.map((value) => `\\item ${renderWording(value)}`).join("\n")}\n\\end{achievements}`,
        );
      }
      for (const id of selection.linkIds) {
        const link = entry.links.find((item) => item.id === id);
        if (link?.url)
          body.push(
            `\\noindent \\href{${escapeLatexUrl(link.url)}}{${escapeLatex(wordingText(wording(link.id, link.label)) || link.url)}}\\par`,
          );
      }
      body.push("\\par\\vspace{0.7em}");
    }
  }
  return renderTemplate({
    settings: {
      ...defaultSettings,
      pageSize: resume.layout.paper,
      fontSize: resume.layout.fontSize,
      fontFamily:
        resume.layout.font === "inter"
          ? "inter"
          : resume.layout.font === "source-sans"
            ? "source-sans-3"
            : "source-serif-4",
    },
    name,
    resumeName: resume.name,
    revision,
    locale: resume.language,
    ...capability,
    contacts,
    body,
  });
}
