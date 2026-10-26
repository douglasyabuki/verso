import { plain } from "@/lib/resume/localization";
import { entryLabel } from "@/lib/resume/section-fields";
import type { Locale } from "@/types-and-constants/languages";
import type { ResumeDocument } from "@/types-and-constants/resume";
import type { Issue } from "@/types-and-constants/review";
import { entryTerminology } from "@/types-and-constants/sections";

/** Describe a validation path using stable editor targets and current labels.
 * @param document Current workspace.
 * @param locale Affected output language.
 * @param path Stable validation path.
 * @param message Actionable explanation.
 * @param category Blocking error or translation warning.
 * @returns A labeled issue, with a target when the referenced field exists.
 * @example outputIssue(doc, "en-US", "profile.name", "Add your name.", "error")
 */
export function outputIssue(
  document: ResumeDocument,
  locale: Locale,
  path: string,
  message: string,
  category: "error" | "translation" | "shared-wording",
): Issue {
  const parts = path.split(".");
  let sectionName = "Profile";
  let entryName = "Profile";
  let sectionId = "profile";
  let entryId: string | undefined;
  let field = parts.at(-1) ?? "Field";
  let fieldKey = path;
  let localized = path === "profile.summary";
  let links = document.profile.links;
  let found = parts[0] === "profile";
  const labels: Record<string, string> = {
    name: "Full name",
    email: "Email",
    phone: "Phone",
    country: "Country code",
    summary: "Summary",
    heading: "Section heading",
    start: "Start date",
    end: "End date",
    issued: "Issue date",
    expiration: "Expiration date",
  };
  field = labels[field] ?? field;
  for (const section of document.sections) {
    const entry = section.entries.find((item) =>
      parts[0] === "entries"
        ? item.id === parts[1]
        : parts[0] === "bullets" &&
          item.bullets.some((bullet) => bullet.id === parts[1]),
    );
    if (!(parts[0] === "sections" && section.id === parts[1]) && !entry)
      continue;
    found = true;
    sectionId = section.id;
    sectionName =
      plain(section.heading, locale).trim() || `${section.kind} section`;
    entryName = entry
      ? entryLabel(entry, section.kind, locale)
      : "Whole section";
    entryId = entry?.id;
    links = entry?.links ?? [];
    if (parts[0] === "sections") localized = true;
    if (entry && parts.at(-1) === "title") {
      field = entryTerminology[section.kind].title;
      localized = true;
    }
    if (entry && parts[0] === "bullets") {
      field = `${entryTerminology[section.kind].item} ${entry.bullets.findIndex((bullet) => bullet.id === parts[1]) + 1}`;
      localized = true;
    }
    break;
  }
  if (
    (parts[0] === "profile" && parts[1] === "links") ||
    (parts[0] === "entries" && parts[2] === "links")
  ) {
    const linkId = parts.at(-1)!;
    const index = links.findIndex((link) => link.id === linkId);
    field = `${links[index]?.label.trim() || `Link ${index + 1}`} URL`;
    fieldKey = `links.${linkId}.url`;
  }
  if (localized) fieldKey += `.${locale}`;
  return {
    id: `${locale}:${category}:${path}:${message}`,
    path,
    message,
    category,
    locale,
    section: sectionName,
    entry: entryName,
    field,
    target: found ? { sectionId, entryId, fieldKey } : undefined,
  };
}
