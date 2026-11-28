import { careerFieldLabel } from "@/lib/career/labels";
import { type RichText, wordingText } from "@/lib/career/wording";
import type {
  CareerAchievement,
  CareerLink,
  CareerSection,
} from "@/types-and-constants/career";

export type CareerTerms = {
  /** Entry creation action, e.g. "Add role". */
  addEntry: string;
  /** Lower-case entry noun for menus and empty states, e.g. "role". */
  entry: string;
  /** Detail row noun used for numbered fallbacks, e.g. "Project detail". */
  detail: string;
  /** Detail creation action, e.g. "Add project detail". */
  addDetail: string;
  /** Heading for the details group. */
  details: string;
  /** Heading for the entry link group. */
  links: string;
  /** Link creation action. */
  addLink: string;
  /** Short explanation shown under the link group heading. */
  linkHint: string;
  /** Groups shown even when empty; the rest live behind Add more. */
  primary: readonly ("details" | "links" | "evidence")[];
};

const LINKS_FOR_ENTRY = "Links for this entry";

/** Interface vocabulary per Career section kind. English UI only. */
export const CAREER_TERMS: Record<CareerSection["kind"], CareerTerms> = {
  experience: {
    addEntry: "Add role",
    entry: "role",
    detail: "Achievement",
    addDetail: "Add achievement",
    details: "Achievements",
    links: LINKS_FOR_ENTRY,
    addLink: "Add link",
    linkHint: "Optional links to public work, case studies, or publications.",
    primary: ["details"],
  },
  projects: {
    addEntry: "Add project",
    entry: "project",
    detail: "Project detail",
    addDetail: "Add project detail",
    details: "Project details",
    links: "Project links",
    addLink: "Add link",
    linkHint: "Repositories, live demos, and case studies.",
    primary: ["details", "links"],
  },
  education: {
    addEntry: "Add education entry",
    entry: "education entry",
    detail: "Education detail",
    addDetail: "Add education detail",
    details: "Education details",
    links: LINKS_FOR_ENTRY,
    addLink: "Add link",
    linkHint: "Optional links to a thesis, publication, or program.",
    primary: [],
  },
  skills: {
    addEntry: "Add skill",
    entry: "skill",
    detail: "Skill detail",
    addDetail: "Add skill detail",
    details: "Skill details",
    links: LINKS_FOR_ENTRY,
    addLink: "Add link",
    linkHint: "Optional links to work samples or assessments.",
    primary: [],
  },
  certifications: {
    addEntry: "Add certification",
    entry: "certification",
    detail: "Certification detail",
    addDetail: "Add certification detail",
    details: "Certification details",
    links: "Credential verification",
    addLink: "Add verification link",
    linkHint: "Where employers can verify this credential.",
    primary: ["links"],
  },
  languages: {
    addEntry: "Add language",
    entry: "language",
    detail: "Language detail",
    addDetail: "Add language detail",
    details: "Language details",
    links: LINKS_FOR_ENTRY,
    addLink: "Add link",
    linkHint: "Add verification links on the test or certificate instead.",
    primary: ["evidence"],
  },
  custom: {
    addEntry: "Add entry",
    entry: "entry",
    detail: "Detail",
    addDetail: "Add detail",
    details: "Details",
    links: LINKS_FOR_ENTRY,
    addLink: "Add link",
    linkHint: "Optional links for this entry.",
    primary: [],
  },
};

export const PROFILE_LINK_TERMS = {
  links: "Profile links",
  addLink: "Add link",
  linkHint:
    "Professional profiles, portfolio homepages, and personal sites. They appear with your contact details.",
} as const;

export const EVIDENCE_TERMS = {
  group: "Tests and certificates",
  add: "Add test or certificate",
  attach: "Attach existing certification",
  create: "Create test or certificate",
  item: "Test or certificate",
} as const;

/** Label a field for its section, e.g. "Language" for a languages title.
 * @param key Built-in field key.
 * @param kind Owning section kind, when known.
 * @returns {string} Interface label.
 * @example sectionFieldLabel("title", "languages") // "Language"
 */
export function sectionFieldLabel(
  key: string,
  kind?: CareerSection["kind"],
): string {
  if (kind === "languages" && key === "title") return "Language";
  return careerFieldLabel(key);
}

/** Shorten wording to a single-line excerpt.
 * @param value Rich or plain wording.
 * @param length Maximum characters before an ellipsis.
 * @returns {string} Collapsed excerpt, empty when there is no text.
 * @example excerpt("A long achievement…", 20)
 */
export function excerpt(value: RichText | undefined, length = 60): string {
  const text = value ? wordingText(value).replace(/\s+/g, " ").trim() : "";
  return text.length > length
    ? `${text.slice(0, length - 1).trimEnd()}…`
    : text;
}

export type RowLabel = {
  /** Recognizable row name: internal name, content, or numbered fallback. */
  title: string;
  /** Secondary description, empty when the title already shows it. */
  detail: string;
};

/** Name an achievement/detail row in editors. Internal names never reach PDFs.
 * @param kind Owning section kind.
 * @param item Achievement or detail.
 * @param index Zero-based position for the fallback.
 * @param wording Applicable wording (with resume override) for the excerpt.
 * @returns {RowLabel} Internal name then excerpt, else excerpt, else e.g. "Skill detail 2".
 * @example detailRowLabel("skills", item, 1, item.wording["en-US"])
 */
export function detailRowLabel(
  kind: CareerSection["kind"],
  item: Pick<CareerAchievement, "name">,
  index: number,
  wording: RichText | undefined,
): RowLabel {
  const name = item.name?.trim() ?? "";
  const text = excerpt(wording);
  if (name) return { title: name, detail: text };
  return {
    title: text || `${CAREER_TERMS[kind].detail} ${index + 1}`,
    detail: "",
  };
}

/** Name a link row in editors: internal name, then display label, then URL.
 * @param link Shared link.
 * @param index Zero-based position for the fallback.
 * @param label Applicable display label (with resume override).
 * @returns {RowLabel} Title plus the remaining "label · URL" description.
 * @example linkRowLabel(link, 2, "Portfolio")
 */
export function linkRowLabel(
  link: Pick<CareerLink, "name" | "url">,
  index: number,
  label: RichText | undefined,
): RowLabel {
  const parts = [
    link.name?.trim() ?? "",
    label ? wordingText(label).trim() : "",
    link.url.trim(),
  ].filter(Boolean);
  if (!parts.length) return { title: `Link ${index + 1}`, detail: "" };
  return { title: parts[0], detail: parts.slice(1).join(" · ") };
}
