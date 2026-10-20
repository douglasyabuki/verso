import { z } from "zod";

export const locales = ["en-US", "pt-BR"] as const;
export type Locale = (typeof locales)[number];
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
export const sectionKinds = [
  "experience",
  "projects",
  "education",
  "skills",
  "certifications",
  "custom",
] as const;
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

export type Span = z.infer<typeof spanSchema>;
export type LocalizedText = z.infer<typeof localizedSchema>;
export type ResumeLink = z.infer<typeof linkSchema>;
export type Bullet = z.infer<typeof bulletSchema>;
export type Entry = z.infer<typeof entrySchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Variant = z.infer<typeof variantSchema>;
export type TemplateSettings = z.infer<typeof settingsSchema>;
export type ResumeDocument = z.infer<typeof documentSchema>;
export type DocumentUpdate = (draft: ResumeDocument) => void;
export type Issue = { path: string; message: string };

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

/** Create separate language records. @param en English text. @param pt Portuguese text. @returns Localized content. @example localized("Projects", "Projetos") */
export function localized(en = "", pt = ""): LocalizedText {
  const make = (value: string) => ({
    spans: [{ text: value, emphasis: false, href: "" }],
    revision: 0,
    needsReview: false,
  });
  return { "en-US": make(en), "pt-BR": make(pt) };
}

/** Read plain wording without formatting. @param value Localized record. @param locale Language. @returns Joined text. @example plain(entry.title, "en-US") */
export function plain(value: LocalizedText, locale: Locale): string {
  return value[locale].spans.map((span) => span.text).join("");
}

/** Update one language and flag an existing counterpart. @param value Mutable draft record. @param locale Changed language. @param spans Structured text. @returns Nothing. @example editTranslation(title, "en-US", spans) */
export function editTranslation(
  value: LocalizedText,
  locale: Locale,
  spans: Span[],
): void {
  if (JSON.stringify(value[locale].spans) === JSON.stringify(spans)) return;
  value[locale].spans = spans;
  value[locale].revision++;
  const counterpart = locale === "en-US" ? "pt-BR" : "en-US";
  if (plain(value, counterpart).trim()) value[counterpart].needsReview = true;
}

/** Create the deterministic empty workspace used during hydration. @returns An editable draft. @example createEmptyDocument() */
export function createEmptyDocument(): ResumeDocument {
  const headings = [
    ["experience", "Experience", "Experiência"],
    ["projects", "Projects", "Projetos"],
    ["education", "Education", "Educação"],
    ["skills", "Skills", "Habilidades"],
    ["certifications", "Certifications", "Certificações"],
  ] as const;
  const sections = headings.map(([kind, en, pt]) => ({
    id: kind,
    kind,
    heading: localized(en, pt),
    entries: [],
  }));
  return {
    schemaVersion: 1,
    revision: 0,
    template: { ...templateIdentity },
    profile: {
      name: "",
      email: "",
      phone: "",
      city: "",
      country: "",
      summary: localized(),
      links: [],
    },
    sections,
    settings: { ...defaultSettings },
    localeSettings: {},
    compiler: {
      initializationTimeoutMs: 120_000,
      compilationTimeoutMs: 30_000,
    },
    variants: [
      {
        id: "general",
        name: "General",
        sections: sections.map((section) => ({
          sectionId: section.id,
          visible: true,
          entries: [],
        })),
        settings: {},
        localeSettings: {},
      },
    ],
  };
}

/** Create a library entry outside reducer execution. @returns An empty entry with a stable ID. @example const entry = createEntry() */
export function createEntry(): Entry {
  return {
    id: crypto.randomUUID(),
    organization: "",
    title: localized(),
    city: "",
    country: "",
    start: "",
    end: "",
    ongoing: false,
    technologies: [],
    links: [],
    bullets: [],
    archived: false,
  };
}

/** Move an item without changing IDs. @param items Mutable draft array. @param index Current position. @param offset -1 or 1. @returns Nothing; boundary moves are ignored. @example move(items, 2, -1) */
export function move<T>(items: T[], index: number, offset: number): void {
  const target = index + offset;
  if (target < 0 || target >= items.length) return;
  [items[index], items[target]] = [items[target], items[index]];
}

/** Resolve supported settings in increasing specificity. @param doc Workspace. @param variant Variant. @param locale Language. @returns Base, locale, variant, then variant-locale settings combined. @example resolveSettings(doc, variant, "pt-BR") */
export function resolveSettings(
  doc: ResumeDocument,
  variant: Variant,
  locale: Locale,
): TemplateSettings {
  return {
    ...doc.settings,
    ...doc.localeSettings[locale],
    ...variant.settings,
    ...variant.localeSettings[locale],
  };
}

/** Validate supported clickable links. @param value URL. @returns An error or undefined, including for an empty optional value. @example urlError("javascript:alert(1)") */
export function urlError(value: string): string | undefined {
  if (!value) return;
  if (/[\u0000-\u0020\\]/.test(value))
    return "Use a URL without spaces, control characters, or backslashes.";
  try {
    const url = new URL(value);
    if (!["https:", "http:", "mailto:", "tel:"].includes(url.protocol))
      return "Use https, http, mailto, or tel links.";
    if (
      (url.protocol === "mailto:" || url.protocol === "tel:") &&
      !url.pathname
    )
      return "Add an email address or phone number.";
    if (url.username || url.password)
      return "Links cannot contain credentials.";
  } catch {
    return "Enter a complete URL, including its scheme.";
  }
}

/** Validate language-independent date facts. @param entry Draft entry. @returns An error or undefined. @example dateError(entry) */
export function dateError(entry: Entry): string | undefined {
  const pattern = /^(19|20|21|22)\d{2}(-(0[1-9]|1[0-2]))?$/;
  if ([entry.start, entry.end].some((value) => value && !pattern.test(value)))
    return "Use YYYY or YYYY-MM, between 1900 and 2299.";
  if (!entry.ongoing && entry.start && entry.end) {
    const end = entry.end.length === 4 ? entry.end + "-12" : entry.end;
    const start = entry.start.length === 4 ? entry.start + "-01" : entry.start;
    if (start > end) return "End date must be on or after the start date.";
  }
}

/** List all localized records for review tools. @param doc Workspace. @returns Labeled records with stable paths. @example localizedFields(doc) */
export function localizedFields(
  doc: ResumeDocument,
): { path: string; label: string; value: LocalizedText }[] {
  const fields = [
    {
      path: "profile.summary",
      label: "Profile · Summary",
      value: doc.profile.summary,
    },
  ];
  for (const section of doc.sections) {
    const name = plain(section.heading, "en-US") || "Untitled section";
    fields.push({
      path: `sections.${section.id}.heading`,
      label: `${name} · Heading`,
      value: section.heading,
    });
    for (const entry of section.entries) {
      fields.push({
        path: `entries.${entry.id}.title`,
        label: `${name} · ${entry.organization || "Untitled entry"}`,
        value: entry.title,
      });
      for (const bullet of entry.bullets)
        fields.push({
          path: `bullets.${bullet.id}.body`,
          label: `${entry.organization || name} · Achievement`,
          value: bullet.body,
        });
    }
  }
  return fields;
}

/** Find a localized record inside a draft by its stable path. @param doc Workspace. @param path Field path. @returns Matching record, or undefined after deletion. @example findLocalized(doc, "profile.summary") */
export function findLocalized(
  doc: ResumeDocument,
  path: string,
): LocalizedText | undefined {
  return localizedFields(doc).find((field) => field.path === path)?.value;
}

/** Validate only the selected output; counterpart translations never block it. @param doc Workspace. @param variant Variant. @param locale Language. @returns Blocking issues and nonblocking review warnings. @example validateOutput(doc, variant, "en-US") */
export function validateOutput(
  doc: ResumeDocument,
  variant: Variant,
  locale: Locale,
): { errors: Issue[]; warnings: string[] } {
  const errors: Issue[] = [];
  const warnings: string[] = [];
  const required = (value: LocalizedText, path: string, label: string) => {
    if (!plain(value, locale).trim())
      errors.push({ path, message: `${label} is missing in ${locale}.` });
  };
  const wording = (value: LocalizedText, path: string) => {
    if (value[locale].needsReview && plain(value, locale).trim())
      warnings.push(`${path} needs translation review.`);
    for (const span of value[locale].spans) {
      const error = urlError(span.href);
      if (error) errors.push({ path, message: error });
    }
  };
  const links = (values: ResumeLink[], path: string) =>
    values.forEach((link) => {
      const error = urlError(link.url);
      if (error) errors.push({ path: `${path}.${link.id}`, message: error });
    });
  if (!doc.profile.name.trim())
    errors.push({
      path: "profile.name",
      message: "Add your name to generate a PDF.",
    });
  if (doc.profile.email && !z.email().safeParse(doc.profile.email).success)
    errors.push({
      path: "profile.email",
      message: "Enter a valid email address.",
    });
  if (doc.profile.phone && !/\d/.test(doc.profile.phone))
    errors.push({
      path: "profile.phone",
      message: "Include a phone number with digits.",
    });
  if (doc.profile.country && !/^[A-Z]{2}$/.test(doc.profile.country))
    errors.push({
      path: "profile.country",
      message: "Use a two-letter country code, for example BR.",
    });
  wording(doc.profile.summary, "profile.summary");
  links(doc.profile.links, "profile.links");
  for (const selected of variant.sections.filter(
    (section) => section.visible,
  )) {
    const section = doc.sections.find(
      (section) => section.id === selected.sectionId,
    );
    if (!section) continue;
    const entries = selected.entries
      .map((selection) => ({
        selection,
        entry: section.entries.find((entry) => entry.id === selection.entryId),
      }))
      .filter((item) => item.entry && !item.entry.archived);
    if (!entries.length) continue;
    required(
      section.heading,
      `sections.${section.id}.heading`,
      "Section heading",
    );
    wording(section.heading, `sections.${section.id}.heading`);
    for (const { selection, entry } of entries) {
      if (!entry) continue;
      if (entry.country && !/^[A-Z]{2}$/.test(entry.country))
        errors.push({
          path: `entries.${entry.id}.country`,
          message: "Use a two-letter country code, for example BR.",
        });
      required(entry.title, `entries.${entry.id}.title`, "Entry title");
      wording(entry.title, `entries.${entry.id}.title`);
      const date = dateError(entry);
      if (date)
        errors.push({ path: `entries.${entry.id}.dates`, message: date });
      links(entry.links, `entries.${entry.id}.links`);
      for (const bulletId of selection.bulletIds) {
        const bullet = entry.bullets.find((bullet) => bullet.id === bulletId);
        if (!bullet) continue;
        required(
          bullet.body,
          `bullets.${bullet.id}.body`,
          "Selected achievement",
        );
        wording(bullet.body, `bullets.${bullet.id}.body`);
      }
    }
  }
  return { errors, warnings };
}

/** Serialize complete editable state, excluding interface/compiler state. @param doc Workspace. @returns Versioned JSON backup. @example serializeBackup(doc) */
export function serializeBackup(doc: ResumeDocument): string {
  return JSON.stringify(doc, null, 2) + "\n";
}

/** Validate a portable backup before any mutation. @param source JSON text up to 5 MB. @returns A normalized document; throws actionable schema, template, or reference errors. @example parseBackup(fileText) */
export function parseBackup(source: string): ResumeDocument {
  if (new TextEncoder().encode(source).length > 5_000_000)
    throw new Error("Backup exceeds the 5 MB limit.");
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  const header = z
    .object({
      schemaVersion: z.number(),
      template: z.object({ id: z.string(), version: z.string() }),
    })
    .safeParse(data);
  if (!header.success)
    throw new Error("This is not a versioned Verso workspace backup.");
  if (header.data.schemaVersion !== 1)
    throw new Error(
      `Workspace schema ${header.data.schemaVersion} is unsupported. This release imports schema 1; no automatic migration is available.`,
    );
  const template = header.data.template;
  if (
    template.id !== templateIdentity.id ||
    template.version !== templateIdentity.version
  )
    throw new Error(
      `Template ${template.id}@${template.version} is unavailable. This app bundles ${templateIdentity.id}@${templateIdentity.version}. The workspace has not changed.`,
    );
  const result = documentSchema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue.path.join(".");
    const incompatible = path.includes("settings") || path.includes("Settings");
    throw new Error(
      `${incompatible ? "Incompatible template settings" : "Invalid backup"} at ${path}: ${issue.message}`,
    );
  }
  const doc = result.data;
  const seen = new Set<string>();
  const unique = (value: string) => {
    if (seen.has(value)) throw new Error(`Duplicate identifier: ${value}`);
    seen.add(value);
  };
  doc.profile.links.forEach((link) => unique(link.id));
  for (const section of doc.sections) {
    unique(section.id);
    for (const entry of section.entries) {
      unique(entry.id);
      entry.bullets.forEach((bullet) => unique(bullet.id));
      entry.links.forEach((link) => unique(link.id));
    }
  }
  for (const variant of doc.variants) {
    unique(variant.id);
    const sectionIds = new Set<string>();
    if (variant.sections.length !== doc.sections.length)
      throw new Error(
        `Variant ${variant.name || "Untitled"} must contain a selection for every library section, including hidden sections.`,
      );
    for (const selected of variant.sections) {
      if (sectionIds.has(selected.sectionId))
        throw new Error("A variant contains a duplicate section reference.");
      sectionIds.add(selected.sectionId);
      const section = doc.sections.find(
        (section) => section.id === selected.sectionId,
      );
      if (!section)
        throw new Error(
          `Variant ${variant.name} references an unavailable section.`,
        );
      const entryIds = new Set<string>();
      for (const selection of selected.entries) {
        if (entryIds.has(selection.entryId))
          throw new Error("A variant contains a duplicate entry reference.");
        entryIds.add(selection.entryId);
        const entry = section.entries.find(
          (entry) => entry.id === selection.entryId,
        );
        if (
          !entry ||
          new Set(selection.bulletIds).size !== selection.bulletIds.length ||
          selection.bulletIds.some(
            (id) => !entry.bullets.some((bullet) => bullet.id === id),
          )
        )
          throw new Error(
            `Variant ${variant.name} has an invalid entry or achievement reference.`,
          );
      }
    }
  }
  return doc;
}
