import { z } from "zod";

import { certificationDateErrors } from "@/lib/content/certification";
import { settingsSchema } from "@/lib/output/schema";
import { locales } from "@/types-and-constants/languages";
import { linkTypes, resumeColors } from "@/types-and-constants/resume";
import {
  defaultSectionIcons,
  sectionIconIds,
} from "@/types-and-constants/section-icons";
import { sectionKinds } from "@/types-and-constants/sections";

export const templateIdentity = {
  id: "yabuki-reference",
  version: "1.0.3",
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
const linkSchema = z.strictObject({
  id,
  internalName: z.string().max(200).optional(),
  type: z.enum(linkTypes),
  label: z.string().max(200),
  url: z.string().max(2_000),
});
export const certificationDatesSchema = z
  .strictObject({
    issued: z.string().max(7),
    expiration: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("unspecified") }),
      z.strictObject({ kind: z.literal("never") }),
      z.strictObject({ kind: z.literal("date"), date: z.string().max(7) }),
    ]),
  })
  .superRefine((dates, context) => {
    const errors = certificationDateErrors(
      dates.issued,
      dates.expiration.kind,
      dates.expiration.kind === "date" ? dates.expiration.date : "",
    );
    for (const [field, message] of Object.entries(errors))
      context.addIssue({ code: "custom", path: [field], message });
  });
const certificationSchema = z.strictObject({
  credentialId: z.string().max(500),
  dates: certificationDatesSchema.nullable(),
});
const referenceSnapshotSchema = z.strictObject({
  locale: z.enum(locales),
  revision: translationSchema.shape.revision,
  spans: translationSchema.shape.spans,
});
const reviewedTranslationSchema = translationSchema.extend({
  reviewedCounterpart: referenceSnapshotSchema.nullable(),
});
const reviewedLocalizedSchema = z
  .strictObject({
    "en-US": reviewedTranslationSchema,
    "pt-BR": reviewedTranslationSchema,
  })
  .superRefine((value, context) => {
    for (const locale of locales) {
      if (value[locale].reviewedCounterpart?.locale === locale)
        context.addIssue({
          code: "custom",
          path: [locale, "reviewedCounterpart", "locale"],
          message: "The review reference must differ from the target language.",
        });
    }
  });
const entrySchema = z.strictObject({
  id,
  internalName: z.string().max(200).optional(),
  certification: certificationSchema.optional(),
  organization: z.string().max(500),
  title: reviewedLocalizedSchema,
  city: z.string().max(200),
  country: z.string().max(2),
  start: z.string().max(7),
  end: z.string().max(7),
  ongoing: z.boolean(),
  technologies: z.array(z.string().max(2_000)).max(100),
  links: z.array(linkSchema).max(30),
  bullets: z
    .array(
      z.strictObject({
        id,
        internalName: z.string().max(200).optional(),
        body: reviewedLocalizedSchema,
      }),
    )
    .max(100),
  archived: z.boolean(),
});
const sectionSchema = z
  .strictObject({
    id,
    kind: z.enum(sectionKinds),
    icon: z.enum(sectionIconIds),
    heading: reviewedLocalizedSchema,
    entries: z.array(entrySchema).max(300),
  })
  .superRefine((section, context) => {
    if (
      section.kind !== "custom" &&
      section.icon !== defaultSectionIcons[section.kind]
    )
      context.addIssue({
        code: "custom",
        path: ["icon"],
        message: "Built-in sections must use their default icon.",
      });
  });
const effectiveSnapshotSchema = referenceSnapshotSchema.extend({
  source: z.enum(["shared", "override"]),
});
const wordingOverrideSchema = z.strictObject({
  spans: translationSchema.shape.spans,
  revision: translationSchema.shape.revision,
  sharedBaseline: referenceSnapshotSchema,
});
const variantReviewSchema = z.strictObject({
  needsReview: z.boolean(),
  reviewedCounterpart: effectiveSnapshotSchema.nullable(),
});
const variantWordingSchema = z
  .strictObject({
    overrides: z.strictObject({
      "en-US": wordingOverrideSchema.optional(),
      "pt-BR": wordingOverrideSchema.optional(),
    }),
    review: z.strictObject({
      "en-US": variantReviewSchema,
      "pt-BR": variantReviewSchema,
    }),
  })
  .superRefine((value, context) => {
    if (!locales.some((locale) => value.overrides[locale]))
      context.addIssue({
        code: "custom",
        path: ["overrides"],
        message: "Wording must contain an explicit override.",
      });
    for (const locale of locales) {
      if (
        value.overrides[locale] &&
        value.overrides[locale].sharedBaseline.locale !== locale
      )
        context.addIssue({
          code: "custom",
          path: ["overrides", locale, "sharedBaseline"],
          message: "Shared baseline must use the override language.",
        });
      if (value.review[locale].reviewedCounterpart?.locale === locale)
        context.addIssue({
          code: "custom",
          path: ["review", locale],
          message: "Review reference must use the other language.",
        });
    }
  });
const layoutOverridesSchema = settingsSchema.partial();
const layoutLocaleOverridesSchema = z.strictObject({
  "en-US": layoutOverridesSchema.optional(),
  "pt-BR": layoutOverridesSchema.optional(),
});

const variantSchema = z.strictObject({
  id,
  name: z.string().max(100),
  color: z.enum(resumeColors),
  profileSelection: z.strictObject({
    email: z.boolean(),
    phone: z.boolean(),
    city: z.boolean(),
    country: z.boolean(),
    hiddenLinkIds: z.array(id).max(30),
    order: z
      .array(
        z.discriminatedUnion("kind", [
          z.strictObject({
            kind: z.literal("field"),
            field: z.enum(["city", "country", "email", "phone"]),
          }),
          z.strictObject({ kind: z.literal("link"), linkId: id }),
        ]),
      )
      .min(4)
      .max(34),
  }),
  wording: z.strictObject({
    summary: variantWordingSchema.optional(),
    achievements: z.record(id, variantWordingSchema),
  }),
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
  settings: layoutOverridesSchema,
  localeSettings: layoutLocaleOverridesSchema,
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
    summary: reviewedLocalizedSchema,
    links: z.array(linkSchema).max(30),
  }),
  sections: z.array(sectionSchema).max(30),
  variants: z.array(variantSchema).min(1).max(30),
  settings: settingsSchema,
  localeSettings: layoutLocaleOverridesSchema,
  compiler: z.strictObject({
    initializationTimeoutMs: z.number().min(100).max(600_000),
    compilationTimeoutMs: z.number().min(100).max(600_000),
  }),
});
