import { type Locale } from "@/types-and-constants/languages";
import { type Entry, type Section } from "@/types-and-constants/resume";
import { entryTerminology } from "@/types-and-constants/sections";

/** Name an entry using the same section-aware heading priority as its output.
 * @param entry Library record.
 * @param kind Section kind.
 * @param locale Wording language.
 * @returns Nonempty heading or a section-specific placeholder.
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
