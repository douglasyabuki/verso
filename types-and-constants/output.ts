import type { z } from "zod";

import type { settingsSchema } from "@/lib/resume/model";
import type { renderLatex } from "@/lib/resume/render";
import type { CompileResult } from "@/tools/compiler-proof/compiler.mjs";
import type { Locale } from "@/types-and-constants/languages";

export type TemplateSettings = z.infer<typeof settingsSchema>;

export const headingColors = [
  "template-default",
  "black",
  "dark-navy",
  "dark-teal",
  "dark-burgundy",
] as const;

export const bodyColors = ["template-default", "black", "dark-gray"] as const;

export const pdfColorPresets = {
  "template-default": { label: "Template default", hex: null },
  black: { label: "Black", hex: "#000000" },
  "dark-navy": { label: "Dark navy", hex: "#1E3A5F" },
  "dark-teal": { label: "Dark teal", hex: "#115E59" },
  "dark-burgundy": { label: "Dark burgundy", hex: "#701A32" },
  "dark-gray": { label: "Dark gray", hex: "#404040" },
} as const;

export const defaultSettings: TemplateSettings = {
  headingColor: "template-default",
  bodyColor: "template-default",
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
  headingColor: "Heading color",
  bodyColor: "Body text color",
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
export const numericLayoutControls = [
  {
    key: "targetPages",
    label: "Page target",
    min: 1,
    max: 10,
    increment: 1,
    unit: "pages",
    description:
      "Warning threshold only; no automatic fitting or content removal.",
  },
  {
    key: "marginTop",
    label: "Top margin",
    min: 10,
    max: 35,
    increment: 0.1,
    unit: "mm",
  },
  {
    key: "marginBottom",
    label: "Bottom margin",
    min: 10,
    max: 35,
    increment: 0.1,
    unit: "mm",
  },
  {
    key: "marginSide",
    label: "Side margins",
    min: 10,
    max: 35,
    increment: 0.1,
    unit: "mm",
  },
  {
    key: "fontSize",
    label: "Text size",
    min: 9,
    max: 12,
    increment: 0.5,
    unit: "pt",
  },
  {
    key: "lineHeight",
    label: "Line height",
    min: 1,
    max: 1.4,
    increment: 0.05,
    unit: "×",
    description: "Multiplier of the text line height.",
  },
  {
    key: "sectionGap",
    label: "Section spacing",
    min: 0,
    max: 8,
    increment: 0.1,
    unit: "mm",
    description: "Space above section headings.",
  },
] as const;

export const layoutPaperSizes = {
  a4: { label: "A4", width: 210, height: 297, dimensions: "210 × 297 mm" },
  letter: {
    label: "US Letter",
    width: 215.9,
    height: 279.4,
    dimensions: "8.5 × 11 in",
  },
} as const;
