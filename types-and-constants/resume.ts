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

export type Bullet = Entry["bullets"][number];

export type ResumeLink = ResumeDocument["profile"]["links"][number];

export type LocalizedText = ResumeDocument["profile"]["summary"];

export type Span = LocalizedText[Locale]["spans"][number];

export type Variant = ResumeDocument["variants"][number];

export type DocumentUpdate = (draft: ResumeDocument) => void;

export type Issue = { path: string; message: string };

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
