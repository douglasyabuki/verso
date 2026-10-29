import { templateIdentity } from "@/lib/resume/model";
import { localized } from "@/lib/wording/localization";
import { defaultSettings } from "@/types-and-constants/output";
import { type Entry, type ResumeDocument } from "@/types-and-constants/resume";
import { defaultSectionIcons } from "@/types-and-constants/sections";

/**
 * Create the deterministic empty workspace used during hydration.
 * @returns {ResumeDocument} An editable draft.
 * @example createEmptyDocument()
 */
export function createEmptyDocument(): ResumeDocument {
  const headings = [
    ["experience", "Experience", "Experiência"],
    ["projects", "Projects", "Projetos"],
    ["education", "Education", "Educação"],
    ["skills", "Skills", "Habilidades"],
    ["certifications", "Certifications", "Certificações"],
  ] as const;
  const sections = headings.map(([kind, en, pt]) => ({
    id: kind,
    kind,
    icon: defaultSectionIcons[kind],
    heading: localized(en, pt),
    entries: [],
  }));
  return {
    schemaVersion: 8,
    revision: 0,
    template: { ...templateIdentity },
    profile: {
      name: "",
      email: "",
      phone: "",
      city: "",
      country: "",
      summary: localized(),
      links: [],
    },
    sections,
    settings: { ...defaultSettings },
    localeSettings: {},
    compiler: {
      initializationTimeoutMs: 120_000,
      compilationTimeoutMs: 30_000,
    },
    variants: [
      {
        id: "general",
        name: "General",
        color: "indigo",
        sections: sections.map((section) => ({
          sectionId: section.id,
          visible: true,
          entries: [],
        })),
        wording: { achievements: {} },
        settings: {},
        localeSettings: {},
      },
    ],
  };
}

/**
 * Create a career entry outside reducer execution.
 * @returns {Entry} An empty entry with a stable ID.
 * @example const entry = createEntry()
 */
export function createEntry(): Entry {
  return {
    id: crypto.randomUUID(),
    organization: "",
    title: localized(),
    city: "",
    country: "",
    start: "",
    end: "",
    ongoing: false,
    technologies: [],
    links: [],
    bullets: [],
    archived: false,
  };
}
