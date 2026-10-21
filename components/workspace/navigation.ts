import { FolderOpen, Languages, Layers2, Settings2 } from "lucide-react";

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

export const views = [
  {
    id: "content",
    label: "Content",
    icon: FolderOpen,
    description: "Build your career library",
  },
  {
    id: "translations",
    label: "Translations",
    icon: Languages,
    description: "Two languages. One story.",
  },
  {
    id: "variants",
    label: "Variants",
    icon: Layers2,
    description: "Choose what matters for each resume",
  },
  {
    id: "template",
    label: "Template",
    icon: Settings2,
    description: "Give your story room to breathe",
  },
];
