import { z } from "zod";

import {
  documentSchema,
  legacyDocumentSchema,
  schema2DocumentSchema,
  schema3DocumentSchema,
  schema4DocumentSchema,
  schema5DocumentSchema,
  schema6DocumentSchema,
  templateIdentity,
} from "@/lib/resume/model";
import { defaultSettings } from "@/types-and-constants/output";
import type { ResumeDocument } from "@/types-and-constants/resume";

/** Serialize complete editable state, excluding interface/compiler state. @param doc Workspace. @returns Versioned JSON backup. @example serializeBackup(doc) */
export function serializeBackup(doc: ResumeDocument): string {
  return JSON.stringify(doc, null, 2) + "\n";
}

/** Validate a portable backup before any mutation. @param source JSON text up to 5 MB. @returns A normalized document; throws actionable schema, template, or reference errors. @example parseBackup(fileText) */
export function parseBackup(source: string): ResumeDocument {
  if (new TextEncoder().encode(source).length > 5_000_000)
    throw new Error(
      "This backup is larger than 5 MB. Choose a smaller Verso backup.",
    );
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch {
    throw new Error(
      "This file could not be read as a backup. Choose a JSON backup downloaded from Verso.",
    );
  }
  const header = z
    .object({
      schemaVersion: z.number(),
      template: z.object({ id: z.string(), version: z.string() }),
    })
    .safeParse(data);
  if (!header.success)
    throw new Error(
      "This file is not a supported Verso backup. Choose a JSON backup downloaded from Verso.",
    );
  if (![1, 2, 3, 4, 5, 6, 7].includes(header.data.schemaVersion))
    throw new Error(
      `This backup uses an unsupported format (version ${header.data.schemaVersion}). Open it with a compatible version of Verso. Your current work has not changed.`,
    );
  const template = header.data.template;
  if (
    template.id !== templateIdentity.id ||
    template.version !==
      (header.data.schemaVersion === 1
        ? "1.0.0-proof.2"
        : header.data.schemaVersion < 6
          ? "1.0.0-proof.3"
          : header.data.schemaVersion === 6
            ? "1.0.0-proof.4"
            : templateIdentity.version)
  )
    throw new Error(
      `This backup needs a resume template that is not available in this version of Verso. Open it with a compatible version. Your current work has not changed.`,
    );
  const result =
    header.data.schemaVersion === 1
      ? legacyDocumentSchema.safeParse(data)
      : header.data.schemaVersion === 2
        ? schema2DocumentSchema.safeParse(data)
        : header.data.schemaVersion === 3
          ? schema3DocumentSchema.safeParse(data)
          : header.data.schemaVersion === 4
            ? schema4DocumentSchema.safeParse(data)
            : header.data.schemaVersion === 5
              ? schema5DocumentSchema.safeParse(data)
              : header.data.schemaVersion === 6
                ? schema6DocumentSchema.safeParse(data)
                : documentSchema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue.path.join(".");
    const incompatible = path.includes("settings") || path.includes("Settings");
    throw new Error(
      `${incompatible ? "This backup contains unsupported layout settings" : "This backup contains missing or invalid details"}. Choose another Verso backup. Your current work has not changed. Details: ${path}: ${issue.message}`,
    );
  }
  const migrated =
    result.data.schemaVersion === 1
      ? migrateSchema4(
          migrateSchema3(migrateSchema2(migrateSchema1(result.data))),
        )
      : result.data.schemaVersion === 2
        ? migrateSchema4(migrateSchema3(migrateSchema2(result.data)))
        : result.data.schemaVersion === 3
          ? migrateSchema4(migrateSchema3(result.data))
          : result.data.schemaVersion === 4
            ? migrateSchema4(result.data)
            : result.data;
  const colored =
    migrated.schemaVersion === 5 ? migrateSchema5(migrated) : migrated;
  const doc = colored.schemaVersion === 6 ? migrateSchema6(colored) : colored;
  const seen = new Set<string>();
  const unique = (value: string) => {
    if (seen.has(value))
      throw new Error(
        `This backup contains repeated content IDs (${value}). Choose another Verso backup. Your current work has not changed.`,
      );
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
    const bulletIds = new Set(
      doc.sections.flatMap((section) =>
        section.entries.flatMap((entry) =>
          entry.bullets.map((bullet) => bullet.id),
        ),
      ),
    );
    for (const bulletId of Object.keys(variant.wording.achievements))
      if (!bulletIds.has(bulletId))
        throw new Error(
          `Resume ${variant.name} has custom text for an achievement that is missing from the backup. Choose another Verso backup.`,
        );
    const sectionIds = new Set<string>();
    if (variant.sections.length !== doc.sections.length)
      throw new Error(
        `Resume ${variant.name || "Untitled"} is missing section settings, including settings for hidden sections. Choose another Verso backup.`,
      );
    for (const selected of variant.sections) {
      if (sectionIds.has(selected.sectionId))
        throw new Error(
          "A resume in this backup lists the same section twice. Choose another Verso backup.",
        );
      sectionIds.add(selected.sectionId);
      const section = doc.sections.find(
        (section) => section.id === selected.sectionId,
      );
      if (!section)
        throw new Error(
          `Resume ${variant.name} uses a section that is missing from this backup. Choose another Verso backup.`,
        );
      const entryIds = new Set<string>();
      for (const selection of selected.entries) {
        if (entryIds.has(selection.entryId))
          throw new Error(
            "A resume in this backup lists the same career entry twice. Choose another Verso backup.",
          );
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
            `Resume ${variant.name} uses a career entry or achievement that is missing or repeated in this backup. Choose another Verso backup.`,
          );
      }
    }
  }
  return doc;
}

/** Upgrade validated schema-1 content without interpreting legacy facts or changing identifiers.
 * @param legacy Validated old document with its supported template identity.
 * @returns A schema-2 document; the input remains untouched.
 * @example const current = migrateSchema1(legacyDocumentSchema.parse(data));
 */
export function migrateSchema1(
  legacy: z.infer<typeof legacyDocumentSchema>,
): z.infer<typeof schema2DocumentSchema> {
  if (
    legacy.template.id !== templateIdentity.id ||
    legacy.template.version !== "1.0.0-proof.2"
  )
    throw new Error(
      "This older backup needs a different resume template. Open it with a compatible version of Verso.",
    );
  return schema2DocumentSchema.parse({
    ...legacy,
    schemaVersion: 2,
    template: { id: templateIdentity.id, version: "1.0.0-proof.3" },
    sections: legacy.sections.map((section) => ({
      ...section,
      entries: section.entries.map((entry) =>
        section.kind === "certifications"
          ? { ...entry, certification: { credentialId: "", dates: null } }
          : entry,
      ),
    })),
  });
}

/** Add unknown review baselines without inventing history or changing existing flags.
 * @param legacy Validated schema-2 document.
 * @returns A fresh schema-3 document with unchanged wording, identifiers, and revisions.
 * @example const current = migrateSchema2(schema2DocumentSchema.parse(data));
 */
export function migrateSchema2(
  legacy: z.infer<typeof schema2DocumentSchema>,
): z.infer<typeof schema3DocumentSchema> {
  const upgrade = (
    value: z.infer<typeof schema2DocumentSchema>["profile"]["summary"],
  ) => ({
    "en-US": { ...value["en-US"], reviewedCounterpart: null },
    "pt-BR": { ...value["pt-BR"], reviewedCounterpart: null },
  });
  return schema3DocumentSchema.parse({
    ...legacy,
    schemaVersion: 3,
    profile: { ...legacy.profile, summary: upgrade(legacy.profile.summary) },
    sections: legacy.sections.map((section) => ({
      ...section,
      heading: upgrade(section.heading),
      entries: section.entries.map((entry) => ({
        ...entry,
        title: upgrade(entry.title),
        bullets: entry.bullets.map((bullet) => ({
          ...bullet,
          body: upgrade(bullet.body),
        })),
      })),
    })),
  });
}

/** Add empty variant wording without copying library content or inventing review history.
 * @param legacy Validated schema-3 workspace.
 * @returns A schema-4 workspace with unchanged facts, wording, IDs, and revisions.
 * @example migrateSchema3(schema3DocumentSchema.parse(data))
 */
export function migrateSchema3(
  legacy: z.infer<typeof schema3DocumentSchema>,
): z.infer<typeof schema4DocumentSchema> {
  return schema4DocumentSchema.parse({
    ...legacy,
    schemaVersion: 4,
    variants: legacy.variants.map((variant) => ({
      ...variant,
      wording: { achievements: {} },
    })),
  });
}

/** Add a default navigation color without changing content or review history.
 * @param legacy Validated schema-4 workspace.
 * @returns A schema-5 workspace with indigo resume identities.
 * @example migrateSchema4(schema4DocumentSchema.parse(data))
 */
export function migrateSchema4(
  legacy: z.infer<typeof schema4DocumentSchema>,
): z.infer<typeof schema5DocumentSchema> {
  return schema5DocumentSchema.parse({
    ...legacy,
    schemaVersion: 5,
    variants: legacy.variants.map((variant) => ({
      ...variant,
      color: "indigo",
    })),
  });
}

/** Preserve original PDF styling while adding supported color settings.
 * @param legacy Validated schema-5 document with its supported template identity.
 * @returns A schema-6 document with template-default colors and unchanged overrides, content, and revision.
 * @example migrateSchema5(schema5DocumentSchema.parse(data))
 */
export function migrateSchema5(
  legacy: z.infer<typeof schema5DocumentSchema>,
): z.infer<typeof schema6DocumentSchema> {
  return schema6DocumentSchema.parse({
    ...legacy,
    schemaVersion: 6,
    template: { id: templateIdentity.id, version: "1.0.0-proof.4" },
    settings: {
      ...legacy.settings,
      headingColor: "template-default",
      bodyColor: "template-default",
    },
  });
}

/** Split only present side-margin overrides and add compatibility values at base scope.
 * @param legacy Validated schema-6 workspace with the supported proof.4 identity.
 * @returns A validated schema-7 copy preserving content, revisions and partial overrides.
 * @example migrateSchema6(schema6DocumentSchema.parse(data))
 */
export function migrateSchema6(
  legacy: z.infer<typeof schema6DocumentSchema>,
): ResumeDocument {
  const validated = schema6DocumentSchema.parse(legacy);
  if (
    validated.template.id !== templateIdentity.id ||
    validated.template.version !== "1.0.0-proof.4"
  )
    throw new Error("Unsupported schema-6 template identity.");
  /** Preserve partial scopes while replacing a present shared side margin.
   * @param settings Validated historical settings or overrides.
   * @returns Settings with equal side margins only when marginSide existed.
   * @example split({ marginSide: 20 })
   */
  const split = ({
    marginSide,
    ...settings
  }: Partial<z.infer<typeof schema6DocumentSchema>["settings"]>) => ({
    ...settings,
    ...(marginSide === undefined
      ? {}
      : { marginLeft: marginSide, marginRight: marginSide }),
  });
  /** Migrate only the language overrides present in the historical workspace.
   * @param settings Validated locale settings.
   * @returns Locale records preserving absent overrides and other settings.
   * @example languages(legacy.localeSettings)
   */
  const languages = (
    settings: z.infer<typeof schema6DocumentSchema>["localeSettings"],
  ) =>
    Object.fromEntries(
      Object.entries(settings).map(([locale, value]) => [locale, split(value)]),
    );
  return documentSchema.parse({
    ...validated,
    schemaVersion: 7,
    template: { ...templateIdentity },
    settings: { ...defaultSettings, ...split(validated.settings) },
    localeSettings: languages(validated.localeSettings),
    variants: validated.variants.map((variant) => ({
      ...variant,
      settings: split(variant.settings),
      localeSettings: languages(variant.localeSettings),
    })),
  });
}
