import { plain } from "@/lib/wording/localization";
import { type Locale } from "@/types-and-constants/languages";
import { type Entry, type Section } from "@/types-and-constants/resume";
import {
  careerSectionLabels,
  entryTerminology,
} from "@/types-and-constants/sections";

/**
 * Name a career section independently of the selected resume language.
 * @param section Career section with a fixed kind or a user-defined English heading.
 * @returns {string} English interface label; unnamed custom sections use "Custom section".
 * @example careerSectionLabel(section);
 */
export function careerSectionLabel(section: Section): string {
  return section.kind === "custom"
    ? plain(section.heading, "en-US").trim() || careerSectionLabels.custom
    : careerSectionLabels[section.kind];
}

/**
 * Name an entry using the same section-aware heading priority as its output.
 * @param entry Career record.
 * @param kind Section kind.
 * @param locale Wording language.
 * @returns {string} Nonempty heading or a section-specific placeholder.
 * @example entryLabel(entry, "projects", "en-US")
 */
export function entryLabel(
  entry: Entry,
  kind: Section["kind"],
  locale: Locale,
): string {
  const title = entry.title[locale].spans
    .map((span) => span.text)
    .join("")
    .trim();
  const organization = entry.organization.trim();
  return (
    (kind === "experience" || kind === "education"
      ? organization || title
      : title || organization) || `Untitled ${entryTerminology[kind].singular}`
  );
}
