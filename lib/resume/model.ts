import { z } from "zod";

import { certificationDateErrors } from "@/lib/resume/certification";
import {
  locales,
  resumeColors,
  sectionKinds,
} from "@/types-and-constants/resume";

export const templateIdentity = {
  id: "yabuki-reference",
  version: "1.0.0-proof.3",
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
const legacyEntrySchema = z.strictObject({
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
const entrySchema = legacyEntrySchema.extend({
  certification: certificationSchema.optional(),
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
export const schema2DocumentSchema = z.strictObject({
  schemaVersion: z.literal(2),
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

export const legacyDocumentSchema = schema2DocumentSchema.extend({
  schemaVersion: z.literal(1),
  sections: z
    .array(
      sectionSchema.extend({
        entries: z.array(legacyEntrySchema).max(300),
      }),
    )
    .max(30),
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
const reviewedEntrySchema = entrySchema.extend({
  title: reviewedLocalizedSchema,
  bullets: z
    .array(bulletSchema.extend({ body: reviewedLocalizedSchema }))
    .max(100),
});
export const schema3DocumentSchema = schema2DocumentSchema.extend({
  schemaVersion: z.literal(3),
  profile: schema2DocumentSchema.shape.profile.extend({
    summary: reviewedLocalizedSchema,
  }),
  sections: z
    .array(
      sectionSchema.extend({
        heading: reviewedLocalizedSchema,
        entries: z.array(reviewedEntrySchema).max(300),
      }),
    )
    .max(30),
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
export const schema4DocumentSchema = schema3DocumentSchema.extend({
  schemaVersion: z.literal(4),
  variants: z
    .array(
      variantSchema.extend({
        wording: z.strictObject({
          summary: variantWordingSchema.optional(),
          achievements: z.record(id, variantWordingSchema),
        }),
      }),
    )
    .min(1)
    .max(30),
});

export const documentSchema = schema4DocumentSchema.extend({
  schemaVersion: z.literal(5),
  variants: z
    .array(
      schema4DocumentSchema.shape.variants.element.extend({
        color: z.enum(resumeColors),
      }),
    )
    .min(1)
    .max(30),
});
