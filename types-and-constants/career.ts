import type { z } from "zod";

import type {
  careerDocumentSchema,
  draftSchema,
  entrySchema,
  fieldSchema,
  sectionSchema,
} from "@/lib/career/model";

export type CareerDocument = z.infer<typeof careerDocumentSchema>;
export type CareerEntry = z.infer<typeof entrySchema>;
export type CareerField = z.infer<typeof fieldSchema>;
export type CareerSection = z.infer<typeof sectionSchema>;
export type CareerDraft = z.infer<typeof draftSchema>;

export const WORKSPACE_BYTES = 64 * 1024 * 1024;
export const RECOVERY_BYTES = 256 * 1024 * 1024;
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
