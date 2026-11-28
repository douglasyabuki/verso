import { contactRows, templateSettings } from "@/lib/career/layout";
import { resolveLinkIcon, sameDestination } from "@/lib/career/link-icons";
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
  type CareerEntry,
  type CareerField,
  type CareerLink,
} from "@/types-and-constants/career";
import { LINK_BRAND_CODEPOINTS } from "@/types-and-constants/link-icons";

export const outputCapabilities = CAREER_OUTPUT_CAPABILITIES;

/** Emit a clickable link. A blank label shows the URL, which may wrap at delimiters.
 * @param url Validated safe-scheme destination.
 * @param label Display label.
 * @returns {string} Trusted hyperref source.
 * @example hyperlink("https://example.com/a", "Live demo")
 */
function hyperlink(url: string, label: string): string {
  const text = label.trim()
    ? escapeLatex(label.trim())
    : Array.from(url)
        .map(
          (char) =>
            escapeLatex(char) +
            (/[/@.?&=_-]/.test(char) ? "\\allowbreak{}" : ""),
        )
        .join("");
  return `\\href{${escapeLatexUrl(url)}}{${text}}`;
}

/** Render one committed schema-2 resume through the pinned template, retaining selected archived content.
 * @param document Committed validated workspace, never form-draft values.
 * @param resumeId Independent resume identity.
 * @param revision Committed revision displayed in PDF metadata.
 * @returns {string} Deterministic trusted TeX; throws for unsupported output languages or missing selected wording. Activation never changes output capability.
 * @example renderCareerResume(document, resume.id, 4)
 */
export function renderCareerResume(
  document: Pick<
    CareerDocument,
    "profile" | "summary" | "sections" | "resumes"
  >,
  resumeId: string,
  revision: number | null,
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
    if (item.kind === "link") {
      const icon = resolveLinkIcon(item);
      const glyph =
        icon === "website"
          ? "\\faLink"
          : `\\VersoBrand{${LINK_BRAND_CODEPOINTS[icon]}}`;
      return `${icons ? `{\\color{icnclr}${glyph}}\\enspace ` : ""}${hyperlink(item.url, item.text)}`;
    }
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
  const fieldValue = (field: CareerField) => {
    const value =
      field.type === "text"
        ? wordingText(wording(field.id, field.wording))
        : field.fact;
    if (field.type === "url") return value ? hyperlink(value, "") : "";
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
  };
  const linkSource = (link: CareerLink) =>
    hyperlink(link.url, wordingText(wording(link.id, link.label)));
  const certification = (entryId: string) => {
    for (const section of document.sections) {
      const entry = section.entries.find((item) => item.id === entryId);
      if (entry) return entry;
    }
  };
  /** One attached test or certificate beneath its language: name, issuer,
   * reported result, issue date, then verification links (Website deduplicated). */
  const evidenceLine = (entry: CareerEntry) => {
    const byKey = (key: string) =>
      entry.fields.find((field) => field.key === key);
    const links = entry.links.filter((link) => !link.archived && link.url);
    const website = byKey("url");
    const parts = [
      ...["title", "organization", "score", "issued"].map((key) => {
        const field = byKey(key);
        return field ? fieldValue(field) : "";
      }),
      ...(website?.fact &&
      !links.some((link) => sameDestination(link.url, website.fact))
        ? [fieldValue(website)]
        : []),
      ...links.map(linkSource),
    ].filter(Boolean);
    return parts.length
      ? `\\noindent\\hspace*{1em}{\\small ${parts.join(" · ")}}\\par`
      : "";
  };
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
      const selectedLinks = selection.linkIds
        .map((id) => entry.links.find((item) => item.id === id))
        .filter((link): link is CareerLink => !!link?.url);
      const title = selectedFields.find((field) =>
        ["title", "degree"].includes(field.key),
      );
      const titleText = title
        ? wordingText(wording(title.id, title.wording))
        : "";
      if (section.kind === "languages") {
        const level = selectedFields.find((field) => field.key === "level");
        const levelText = level ? fieldValue(level) : "";
        if (titleText || levelText)
          body.push(
            `\\noindent ${[titleText && `\\textbf{${escapeLatex(titleText)}}`, levelText].filter(Boolean).join(" · ")}\\par`,
          );
        for (const id of selection.evidenceIds ?? []) {
          const attachment = entry.evidence?.find((item) => item.id === id);
          const record = attachment && certification(attachment.entryId);
          const line = record ? evidenceLine(record) : "";
          if (line) body.push(line);
        }
      } else {
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
          .filter(
            (field) =>
              field !== title &&
              field !== subtitle &&
              // A selected entry link to the same destination replaces the Website value.
              !(
                field.type === "url" &&
                selectedLinks.some((link) =>
                  sameDestination(link.url, field.fact),
                )
              ),
          )
          .map(fieldValue)
          .filter(Boolean);
        if (details.length) body.push(`\\noindent ${details.join(" · ")}\\par`);
      }
      const achievements = selection.achievementIds
        .map((id) => entry.achievements.find((item) => item.id === id))
        .filter((item) => item !== undefined);
      if (
        (achievements.length || selectedLinks.length) &&
        resume.layout.beforeDetailsGap !== "template-default"
      )
        body.push(`\\vspace{${resume.layout.beforeDetailsGap}pt}`);
      if (achievements.length) {
        const text = achievements.map((item) => wording(item.id, item.wording));
        body.push(
          `\\begin{achievements}\n${text.map((value) => `\\item ${renderWording(value)}`).join("\n")}\n\\end{achievements}`,
        );
      }
      for (const link of selectedLinks)
        body.push(`\\noindent ${linkSource(link)}\\par`);
      body.push(
        `\\par\\vspace{${resume.layout.entryGap === "template-default" ? (section.kind === "languages" ? "0.3em" : "0.7em") : `${resume.layout.entryGap}pt`}}`,
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

/** Resolve the effective full-name wording a resume renders, for release file names.
 * @param document Committed validated workspace.
 * @param resumeId Independent resume identity.
 * @returns {string} Plain full name, or an empty string when the resume or wording is missing.
 * @example releaseFileName(resumeFullName(document, resume.id), resume.language, 3)
 */
export function resumeFullName(
  document: CareerDocument,
  resumeId: string,
): string {
  const stored = document.resumes.find((item) => item.id === resumeId);
  const field = document.profile.fields.find((item) => item.key === "fullName");
  if (!stored || !field) return "";
  return wordingText(
    resolveResumeWording(
      effectiveResume(document, stored),
      field.id,
      field.wording,
    ),
  );
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
  document: Pick<
    CareerDocument,
    "profile" | "summary" | "sections" | "resumes"
  >,
  resumeId: string,
  revision: number | null,
): { source: string; fingerprint: string } {
  const source = renderCareerResume(document, resumeId, revision);
  return {
    source,
    fingerprint: outputFingerprint(
      source.replace(
        revision === null
          ? "pdfsubject={Verso unsaved draft;"
          : `pdfsubject={Verso revision ${revision};`,
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
