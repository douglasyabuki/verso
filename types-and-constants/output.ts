import type { z } from "zod";

import type { settingsSchema } from "@/lib/resume/model";
import type { renderLatex } from "@/lib/resume/render";
import type { CompileResult } from "@/tools/compiler-proof/compiler.mjs";
import type { Locale } from "@/types-and-constants/languages";

export type TemplateSettings = z.infer<typeof settingsSchema>;

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

export const templateSettingLabels: Record<keyof TemplateSettings, string> = {
  pageSize: "Page size",
  fontSize: "Text size (pt)",
  marginTop: "Top margin (mm)",
  marginBottom: "Bottom margin (mm)",
  marginSide: "Side margins (mm)",
  lineHeight: "Line height",
  sectionGap: "Section spacing (mm)",
  targetPages: "Target number of pages",
};

export type ResumeOutput = CompileResult & {
  key: string;
  rendered: ReturnType<typeof renderLatex>;
  revision: number;
};

export type OutputLayout = {
  key: string;
  locale: Locale;
  pageCount?: number;
  error?: string;
};
