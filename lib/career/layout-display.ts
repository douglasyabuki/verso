import type { CareerResume } from "@/types-and-constants/career";
import { pdfColorPresets } from "@/types-and-constants/output";

type Appearance = Omit<CareerResume["layout"], "defaults">;
export type LayoutColor = Extract<keyof Appearance, `${string}Color`>;

const templateDimensions: Record<string, string | number> = {
  nameSize: 20,
  nameContactGap: 8,
  headerGap: "Automatic spacing",
  sectionSize: 12,
  sectionBelow: "Automatic section spacing",
  dividerThickness: 1,
  entryTitleSize: "Body text size",
  entrySubtitleSize: "Body text size",
  headingSubtitleGap: 0,
  beforeDetailsGap: "Automatic spacing",
  entryGap: "0.7 × body text size",
  paragraphGap: "Flexible spacing",
  bulletIndent: "2 × body text size",
  bulletTextGap: "0.5 × body text size",
  bulletGap: 0,
  listAbove: "Automatic list spacing",
  listBelow: "Automatic list spacing",
};

const explanations: Record<string, string> = {
  headerGap: "Spacing adjusts with the header alignment and surrounding text.",
  sectionBelow:
    "2 mm after the heading, with the template's font-relative entry adjustment.",
  beforeDetailsGap:
    "Uses the spacing between the preceding paragraph and list.",
  paragraphGap: "Starts at 0 pt and can stretch by 1 pt to lay out the page.",
  bulletIndent:
    "Uses the template's font-relative list positioning, rather than a fixed margin.",
  listAbove:
    "Uses the document's flexible list spacing; the first list also follows its paragraph boundary.",
  listBelow: "Uses the document's flexible list spacing.",
};

/** Describe a template dimension without converting automatic behavior to a fixed override.
 * @param key Appearance dimension key.
 * @returns A concrete number or readable relative/automatic value.
 * @example templateDimensionDisplay("entryTitleSize") // "Body text size"
 */
export function templateDimensionDisplay(key: string): string | number {
  return templateDimensions[key] ?? "Automatic spacing";
}

/** Explain relative template behavior in user-facing language.
 * @param key Appearance dimension key.
 * @returns An explanation when the value needs context, otherwise undefined.
 * @example templateDimensionExplanation("paragraphGap")
 */
export function templateDimensionExplanation(key: string): string | undefined {
  return explanations[key];
}

/** Resolve a PDF color role using the pinned template's aliases and explicit colors.
 * @param layout Appearance supplying role and dependent colors.
 * @param key Color role to display.
 * @returns Named color and an RGB swatch approximation; PDF color rendering remains authoritative.
 * @example resolvedLayoutColor(resume.layout, "linkColor")
 */
export function resolvedLayoutColor(
  layout: Appearance,
  key: LayoutColor,
): { label: string; hex: string } {
  const selected = pdfColorPresets[layout[key]];
  if (!selected) return { label: "Invalid color", hex: "transparent" };
  if (selected.hex) return { label: selected.label, hex: selected.hex };
  if (key === "headingColor")
    // Pinned dvipsnam.def: Sepia CMYK 0, .83, 1, .70; xcolor RGB conversion.
    return { label: "Sepia", hex: "#4D0000" };
  if (key === "bodyColor") return { label: "Black", hex: "#000000" };
  if (key === "linkColor") return resolvedLayoutColor(layout, "headingColor");
  if (
    (key === "secondaryColor" || key === "iconColor") &&
    layout.bodyColor !== "template-default"
  )
    return resolvedLayoutColor(layout, "bodyColor");
  return key === "secondaryColor"
    ? { label: "Dark gray", hex: "#404040" }
    : { label: "Gray", hex: "#808080" };
}
