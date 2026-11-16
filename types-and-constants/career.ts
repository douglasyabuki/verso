import type { z } from "zod";

import type {
  careerDocumentSchema,
  draftSchema,
  entrySchema,
  fieldSchema,
  sectionSchema,
  starterCreationSchema,
} from "@/lib/career/model";

export type CareerDocument = z.infer<typeof careerDocumentSchema>;
export type CareerEntry = z.infer<typeof entrySchema>;
export type CareerField = z.infer<typeof fieldSchema>;
export type CareerSection = z.infer<typeof sectionSchema>;
export type CareerDraft = z.infer<typeof draftSchema>;
export type CareerResume = CareerDocument["resumes"][number];
export type StarterCreationRequest = z.infer<typeof starterCreationSchema>;

export type ResumeOutputTarget = { destination: string; fieldId: string };

export type ResumeOutputIssue = {
  id: string;
  code: "missing-resume" | "unverified-language" | "missing-wording";
  message: string;
  recordId: string;
  target?: ResumeOutputTarget;
};

export type ResumeOutputAssessment = {
  ready: boolean;
  issues: ResumeOutputIssue[];
};
export const CAREER_FIELD_LABELS: Readonly<Record<string, string>> = {
  fullName: "Full name",
  email: "Email",
  phone: "Phone",
  city: "City",
  country: "Country",
  title: "Title",
  organization: "Organization",
  location: "Location",
  start: "Start date",
  end: "End date",
  degree: "Degree / qualification",
  institution: "Institution",
  url: "Website",
  level: "Proficiency",
  credential: "Credential ID",
  issued: "Issue date",
  expires: "Expiration date",
};

export const RESUME_COLORS = [
  "indigo",
  "emerald",
  "amber",
  "rose",
  "sky",
  "violet",
] as const;

/** Workspace document and backup-file ceiling (UTF-8 bytes), sized to fit one
 * hosted request; real workspaces are typically around 100 KB. */
export const WORKSPACE_BYTES = 4 * 1024 * 1024;
/** Individual recovery draft ceiling, including baseline and metadata. */
export const DRAFT_BYTES = 8 * 1024 * 1024;
/** Recovery export/import file ceiling. */
export const RECOVERY_BYTES = 32 * 1024 * 1024;
/** Total career entries across all sections. */
export const CAREER_ENTRY_LIMIT = 2_000;

/** Format a byte ceiling for messages, e.g. "4 MiB".
 * @param bytes Whole-MiB byte ceiling.
 * @returns {string} Human-readable MiB label.
 * @example mib(WORKSPACE_BYTES) // "4 MiB"
 */
export function mib(bytes: number): string {
  return `${bytes / (1024 * 1024)} MiB`;
}
export const SECTION_KINDS = [
  "experience",
  "education",
  "projects",
  "skills",
  "certifications",
  "custom",
] as const;
export const FIELD_TYPES = [
  "text",
  "date",
  "url",
  "email",
  "phone",
  "credential",
] as const;
export const BUILTIN_FIELDS = {
  experience: ["title", "organization", "location", "start", "end"],
  education: ["degree", "institution", "location", "start", "end"],
  projects: ["title", "organization", "url", "start", "end"],
  skills: ["title", "level"],
  certifications: [
    "title",
    "organization",
    "credential",
    "issued",
    "expires",
    "url",
  ],
  custom: ["title", "organization", "location", "start", "end", "url"],
} as const;

export const VERIFIED_OUTPUT_LANGUAGES = ["en-US", "pt-BR"] as const;

export const CAREER_OUTPUT_CAPABILITIES: Record<
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
