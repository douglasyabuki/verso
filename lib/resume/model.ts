import { z } from "zod";

import { sectionKinds } from "@/types-and-constants/resume";

export const templateIdentity = {
  id: "yabuki-reference",
  version: "1.0.0-proof.2",
} as const;

const id = z.string().min(1).max(100);
const text = z.string().max(20_000);
const spanSchema = z.strictObject({
  text,
  emphasis: z.boolean(),
  href: z.string().max(2_000),
});
const translationSchema = z.strictObject({
  spans: z.array(spanSchema).min(1).max(100),
  revision: z.number().int().nonnegative(),
  needsReview: z.boolean(),
});
const localizedSchema = z.strictObject({
  "en-US": translationSchema,
  "pt-BR": translationSchema,
});
const linkSchema = z.strictObject({
  id,
  label: z.string().max(200),
  url: z.string().max(2_000),
});
const bulletSchema = z.strictObject({ id, body: localizedSchema });
const entrySchema = z.strictObject({
  id,
  organization: z.string().max(500),
  title: localizedSchema,
  city: z.string().max(200),
  country: z.string().max(2),
  start: z.string().max(7),
  end: z.string().max(7),
  ongoing: z.boolean(),
  technologies: z.array(z.string().max(2_000)).max(100),
  links: z.array(linkSchema).max(30),
  bullets: z.array(bulletSchema).max(100),
  archived: z.boolean(),
});
const sectionSchema = z.strictObject({
  id,
  kind: z.enum(sectionKinds),
  heading: localizedSchema,
  entries: z.array(entrySchema).max(300),
});
export const settingsSchema = z.strictObject({
  pageSize: z.enum(["a4", "letter"]),
  fontSize: z.number().min(9).max(12),
  marginTop: z.number().min(10).max(35),
  marginBottom: z.number().min(10).max(35),
  marginSide: z.number().min(10).max(35),
  lineHeight: z.number().min(1).max(1.4),
  sectionGap: z.number().min(0).max(8),
  targetPages: z.number().int().min(1).max(10),
});
const overridesSchema = settingsSchema.partial();
const localeOverridesSchema = z.strictObject({
  "en-US": overridesSchema.optional(),
  "pt-BR": overridesSchema.optional(),
});
const variantSchema = z.strictObject({
  id,
  name: z.string().max(100),
  sections: z
    .array(
      z.strictObject({
        sectionId: id,
        visible: z.boolean(),
        entries: z
          .array(
            z.strictObject({ entryId: id, bulletIds: z.array(id).max(100) }),
          )
          .max(300),
      }),
    )
    .max(30),
  settings: overridesSchema,
  localeSettings: localeOverridesSchema,
});
export const documentSchema = z.strictObject({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  template: z.strictObject({ id, version: z.string().min(1).max(100) }),
  profile: z.strictObject({
    name: z.string().max(200),
    email: z.string().max(300),
    phone: z.string().max(100),
    city: z.string().max(200),
    country: z.string().max(2),
    summary: localizedSchema,
    links: z.array(linkSchema).max(30),
  }),
  sections: z.array(sectionSchema).max(30),
  variants: z.array(variantSchema).min(1).max(30),
  settings: settingsSchema,
  localeSettings: localeOverridesSchema,
  compiler: z.strictObject({
    initializationTimeoutMs: z.number().min(100).max(600_000),
    compilationTimeoutMs: z.number().min(100).max(600_000),
  }),
});
