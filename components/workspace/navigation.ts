import { plain } from "@/lib/resume/localization";
import { librarySectionLabels } from "@/types-and-constants/editor";
import type { Section } from "@/types-and-constants/resume";

/** Name a library section independently of the selected resume language.
 * @param section Library section with a fixed kind or a user-defined English heading.
 * @returns English interface label; unnamed custom sections use "Custom section".
 * @example librarySectionLabel(section);
 */
export function librarySectionLabel(section: Section): string {
  return section.kind === "custom"
    ? plain(section.heading, "en-US").trim() || librarySectionLabels.custom
    : librarySectionLabels[section.kind];
}
