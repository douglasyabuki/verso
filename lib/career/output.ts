import { contactRows, templateSettings } from "@/lib/career/layout";
import { assessResumeOutput } from "@/lib/career/readiness";
import {
  effectiveResume,
  profileContacts,
  resolveResumeWording,
} from "@/lib/career/resumes";
import {
  renderWording,
  type RichText,
  wordingText,
} from "@/lib/career/wording";
import { escapeLatex, escapeLatexUrl } from "@/lib/output/encoding";
import { renderTemplate } from "@/lib/output/template";
import {
  CAREER_OUTPUT_CAPABILITIES,
  type CareerDocument,
} from "@/types-and-constants/career";

export const outputCapabilities = CAREER_OUTPUT_CAPABILITIES;

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
  const assessment = assessResumeOutput(document, resumeId);
  if (!assessment.ready)
    throw new Error(assessment.issues.map((issue) => issue.message).join("\n"));
  const stored = document.resumes.find((item) => item.id === resumeId);
  if (!stored) throw new Error("Resume not found.");
  const resume = effectiveResume(document, stored);
  const capability = outputCapabilities[resume.language];
  const wording = (id: string, values: Record<string, RichText>) =>
    resolveResumeWording(resume, id, values);
  const nameField = document.profile.fields.find(
    (field) => field.key === "fullName",
  )!;
  const name = wordingText(wording(nameField.id, nameField.wording));
  const icons = resume.layout.contactIcons === "on";
  const contacts = profileContacts(document, resume).map((item) => {
    if (item.kind === "link")
      return `${icons ? "{\\color{icnclr}\\faLink}\\enspace " : ""}\\href{${escapeLatexUrl(item.url)}}{${escapeLatex(item.text || item.url)}}`;
    const icon =
      item.kind === "email"
        ? "Envelope"
        : item.kind === "phone"
          ? "Phone"
          : "MapMarker*";
    return `${icons ? `{\\color{icnclr}\\fa${icon}}\\enspace ` : ""}${escapeLatex(item.text)}`;
  });
  const body: string[] = [];
  const summary = wording(document.summary.id, document.summary.wording);
  if (resume.summaryIncluded && wordingText(summary).trim())
    body.push(
      `\\section{${escapeLatex(resume.layout.sectionCasing === "uppercase" ? capability.summaryLabel.toLocaleUpperCase(resume.language) : capability.summaryLabel)}}\n${renderWording(summary)}\\par`,
    );
  for (const selection of resume.selection) {
    const section = document.sections.find(
      (item) => item.id === selection.sectionId,
    )!;
    if (!selection.entryIds.length) continue;
    const heading =
      wordingText(wording(section.id, section.heading)) ||
      capability.labels[section.kind];
    body.push(
      `\\section{${escapeLatex(resume.layout.sectionCasing === "uppercase" ? heading.toLocaleUpperCase(resume.language) : heading)}}`,
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
      if (titleText) body.push(`\\subsection{${escapeLatex(titleText)}}`);
      const subtitle = selectedFields.find((field) =>
        ["organization", "institution"].includes(field.key),
      );
      const subtitleText = subtitle
        ? wordingText(wording(subtitle.id, subtitle.wording))
        : "";
      if (subtitleText)
        body.push(`\\subsubsection{${escapeLatex(subtitleText)}}`);
      const details = selectedFields
        .filter((field) => field !== title && field !== subtitle)
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
      if (
        (achievements.length || selection.linkIds.length) &&
        resume.layout.beforeDetailsGap !== "template-default"
      )
        body.push(`\\vspace{${resume.layout.beforeDetailsGap}pt}`);
      if (achievements.length) {
        const text = achievements.map((item) => wording(item.id, item.wording));
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
      body.push(
        `\\par\\vspace{${resume.layout.entryGap === "template-default" ? "0.7em" : `${resume.layout.entryGap}pt`}}`,
      );
    }
  }
  return renderTemplate({
    settings: templateSettings(resume.layout),
    name,
    resumeName: resume.name,
    revision,
    locale: resume.language,
    ...capability,
    contacts: contactRows(contacts, resume.layout).map((row) =>
      row.join(
        resume.layout.contactSeparator === "dot"
          ? " \\enspace \u00b7 \\enspace "
          : resume.layout.contactSeparator === "bar"
            ? " \\enspace | \\enspace "
            : " \\quad ",
      ),
    ),
    contactRowGap: resume.layout.contactRowGap,
    body,
  });
}

/** Render one committed resume and derive its revision-independent output fingerprint.
 * The fingerprint ignores only the committed revision embedded in PDF metadata, so
 * Saves that do not change this resume's rendered source keep the same fingerprint.
 * @param document Committed validated workspace, never form-draft values.
 * @param resumeId Independent resume identity.
 * @param revision Committed revision displayed in PDF metadata.
 * @returns {{ source: string; fingerprint: string }} Trusted TeX plus a stable hash; throws like renderCareerResume.
 * @example renderCareerOutput(document, resume.id, 4).fingerprint
 */
export function renderCareerOutput(
  document: CareerDocument,
  resumeId: string,
  revision: number,
): { source: string; fingerprint: string } {
  const source = renderCareerResume(document, resumeId, revision);
  return {
    source,
    fingerprint: outputFingerprint(
      source.replace(
        `pdfsubject={Verso revision ${revision};`,
        "pdfsubject={Verso revision;",
      ),
    ),
  };
}

function outputFingerprint(value: string) {
  let first = 0xdeadbeef;
  let second = 0x41c6ce57;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 2654435761);
    second = Math.imul(second ^ code, 1597334677);
  }
  first =
    Math.imul(first ^ (first >>> 16), 2246822507) ^
    Math.imul(second ^ (second >>> 13), 3266489909);
  second =
    Math.imul(second ^ (second >>> 16), 2246822507) ^
    Math.imul(first ^ (first >>> 13), 3266489909);
  return `${value.length.toString(36)}-${(second >>> 0).toString(36)}${(first >>> 0).toString(36)}`;
}
