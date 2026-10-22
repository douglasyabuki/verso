import type { z } from "zod";

import type { documentSchema, settingsSchema } from "@/lib/resume/model";
import type { renderLatex } from "@/lib/resume/render";
import type { CompileResult } from "@/tools/compiler-proof/compiler.mjs";

export const locales = ["en-US", "pt-BR"] as const;

export type Locale = (typeof locales)[number];

export type ResumeDocument = z.infer<typeof documentSchema>;

export type TemplateSettings = z.infer<typeof settingsSchema>;

export type Section = ResumeDocument["sections"][number];

export type Entry = Section["entries"][number];

export type CertificationDates = NonNullable<
  NonNullable<Entry["certification"]>["dates"]
>;

export type Bullet = Entry["bullets"][number];

export type ResumeLink = ResumeDocument["profile"]["links"][number];

export type LocalizedText = ResumeDocument["profile"]["summary"];

export type ReviewSnapshot = NonNullable<
  LocalizedText[Locale]["reviewedCounterpart"]
>;

export type Span = LocalizedText[Locale]["spans"][number];

export type Variant = ResumeDocument["variants"][number];

export type DocumentUpdate = (draft: ResumeDocument) => void;

export type Issue = {
  id: string;
  path: string;
  message: string;
  category: "error" | "translation" | "layout";
  locale: Locale;
  section: string;
  entry: string;
  field: string;
  target?: { sectionId: string; entryId?: string; fieldKey: string };
};

export type IssueNavigation = {
  id: string;
  issue: Issue;
  pending: boolean;
};

export type OutputLayout = {
  key: string;
  locale: Locale;
  pageCount?: number;
  error?: string;
};

export const sectionKinds = [
  "experience",
  "projects",
  "education",
  "skills",
  "certifications",
  "custom",
] as const;

export const defaultSettings: TemplateSettings = {
  pageSize: "a4",
  fontSize: 11,
  marginTop: 18,
  marginBottom: 25.4,
  marginSide: 25,
  lineHeight: 1.2,
  sectionGap: 4,
  targetPages: 3,
};

export type ResumeOutput = CompileResult & {
  key: string;
  rendered: ReturnType<typeof renderLatex>;
  revision: number;
};

export const entryTerminology = {
  experience: {
    singular: "experience",
    title: "Role",
    organization: "Company",
    item: "Achievement",
    items: "Achievements",
    ongoing: "Currently working here",
    description: "Describe your employment, responsibilities, and impact.",
    example: "Frontend Engineer",
    empty: "Add your first role and describe the impact of your work.",
  },
  education: {
    singular: "education",
    title: "Degree / program",
    organization: "Institution",
    item: "Highlight",
    items: "Education highlights",
    ongoing: "Currently studying here",
    description:
      "Record your studies, qualifications, and academic highlights.",
    example: "BSc · Software Engineering",
    empty: "Add a degree, program, or course of study.",
  },
  projects: {
    singular: "project",
    title: "Project name",
    organization: "Organization (optional)",
    item: "Highlight",
    items: "Project highlights",
    ongoing: "Ongoing project",
    description: "Show what you built, the tools you used, and the results.",
    example: "Field Notes",
    empty: "Add a project to share what you built.",
  },
  skills: {
    singular: "skill category",
    title: "Category",
    organization: "Organization (optional)",
    item: "Skill",
    items: "Localized skills",
    ongoing: "Ongoing",
    description:
      "Group shared tool names and individually selectable bilingual skills.",
    example: "Tools & technologies",
    empty: "Add a category, then shared tools or localized skills.",
  },
  certifications: {
    singular: "certification",
    title: "Certification name",
    organization: "Issuer",
    item: "Detail",
    items: "Certification details",
    ongoing: "Ongoing (retained range)",
    description:
      "Record your credential, issuer, verification links, and optional certification dates.",
    example: "Cloud Developer Certification",
    empty: "Add a certification and its issuer or verification link.",
  },
  custom: {
    singular: "entry",
    title: "Title",
    organization: "Organization (optional)",
    item: "Detail",
    items: "Details",
    ongoing: "Ongoing",
    description: "Create a flexible bilingual entry for this custom section.",
    example: "Volunteer mentor",
    empty: "Add an entry for volunteering, awards, or another topic.",
  },
} as const;

export type LocalizedFieldDescriptor = {
  path: string;
  label: string;
  source: string;
  sectionId: string;
  value: LocalizedText;
  multiline: boolean;
  required: boolean;
};
