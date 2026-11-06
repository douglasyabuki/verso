import { z } from "zod";

import { textColors } from "@/types-and-constants/output";

/**
 * Validate an explicit dimension or the original template behavior.
 * @param min Inclusive numeric lower bound.
 * @param max Inclusive numeric upper bound.
 * @returns {z.ZodUnion<[z.ZodLiteral<"template-default">, z.ZodNumber]>} A schema preserving the sentinel or an unrounded numeric value.
 * @example templateDimension(14, 36)
 */
const templateDimension = (min: number, max: number) =>
  z.union([z.literal("template-default"), z.number().min(min).max(max)]);
const weightSchema = z.enum(["regular", "bold", "black"]);
const switchSchema = z.enum(["on", "off"]);

export const settingsSchema = z.strictObject({
  pageSize: z.enum(["a4", "letter"]),
  fontSize: z.number().min(9).max(12),
  marginTop: z.number().min(10).max(35),
  marginBottom: z.number().min(10).max(35),
  lineHeight: z.number().min(1).max(1.4),
  sectionGap: z.number().min(0).max(8),
  targetPages: z.number().int().min(1).max(10),
  marginLeft: z.number().min(10).max(35),
  marginRight: z.number().min(10).max(35),
  fontFamily: z.enum(["inter", "source-sans-3", "source-serif-4"]),
  nameSize: templateDimension(14, 36),
  nameWeight: weightSchema,
  headerAlignment: z.enum(["left", "center"]),
  nameContactGap: templateDimension(0, 24),
  headerGap: templateDimension(0, 36),
  contactIcons: switchSchema,
  sectionSize: templateDimension(9, 20),
  sectionWeight: weightSchema,
  sectionCasing: z.enum(["original", "uppercase"]),
  sectionBelow: templateDimension(0, 8),
  sectionDivider: switchSchema,
  dividerThickness: templateDimension(0.1, 2),
  entryTitleSize: templateDimension(9, 16),
  entryTitleWeight: weightSchema,
  entrySubtitleSize: templateDimension(9, 16),
  entrySubtitleWeight: weightSchema,
  headingSubtitleGap: templateDimension(0, 12),
  beforeDetailsGap: templateDimension(0, 12),
  entryGap: templateDimension(0, 24),
  paragraphGap: templateDimension(0, 18),
  bulletMarker: z.enum(["disc", "dash", "hollow-circle"]),
  bulletIndent: templateDimension(0, 12),
  bulletTextGap: templateDimension(0, 4),
  bulletGap: templateDimension(0, 12),
  listAbove: templateDimension(0, 24),
  listBelow: templateDimension(0, 24),
  headingColor: z.enum(textColors),
  bodyColor: z.enum(textColors),
  secondaryColor: z.enum(textColors),
  linkColor: z.enum(textColors),
  iconColor: z.enum(textColors),
  dividerColor: z.enum(textColors),
  pageNumbering: z.enum(["hidden", "shown"]),
  pageNumberAlignment: z.enum(["left", "center", "right"]),
  pageNumberFormat: z.enum(["page-x", "page-x-of-y"]),
});
