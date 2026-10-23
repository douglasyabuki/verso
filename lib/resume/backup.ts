import { z } from "zod";

import {
  documentSchema,
  legacyDocumentSchema,
  schema2DocumentSchema,
  schema3DocumentSchema,
  schema4DocumentSchema,
  templateIdentity,
} from "@/lib/resume/model";
import type { ResumeDocument } from "@/types-and-constants/resume";

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
  if (![1, 2, 3, 4, 5].includes(header.data.schemaVersion))
    throw new Error(
      `Workspace schema ${header.data.schemaVersion} is unsupported. This release imports schemas 1, 2, 3, 4, and 5.`,
    );
  const template = header.data.template;
  if (
    template.id !== templateIdentity.id ||
    template.version !==
      (header.data.schemaVersion === 1
        ? "1.0.0-proof.2"
        : templateIdentity.version)
  )
    throw new Error(
      `Template ${template.id}@${template.version} is unavailable. This app bundles ${templateIdentity.id}@${templateIdentity.version}. The workspace has not changed.`,
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
            : documentSchema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue.path.join(".");
    const incompatible = path.includes("settings") || path.includes("Settings");
    throw new Error(
      `${incompatible ? "Incompatible template settings" : "Invalid backup"} at ${path}: ${issue.message}`,
    );
  }
  const doc =
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
          `Resume ${variant.name} has an unavailable wording override achievement reference.`,
        );
    const sectionIds = new Set<string>();
    if (variant.sections.length !== doc.sections.length)
      throw new Error(
        `Resume ${variant.name || "Untitled"} must contain a selection for every library section, including hidden sections.`,
      );
    for (const selected of variant.sections) {
      if (sectionIds.has(selected.sectionId))
        throw new Error("A resume contains a duplicate section reference.");
      sectionIds.add(selected.sectionId);
      const section = doc.sections.find(
        (section) => section.id === selected.sectionId,
      );
      if (!section)
        throw new Error(
          `Resume ${variant.name} references an unavailable section.`,
        );
      const entryIds = new Set<string>();
      for (const selection of selected.entries) {
        if (entryIds.has(selection.entryId))
          throw new Error("A resume contains a duplicate entry reference.");
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
            `Resume ${variant.name} has an invalid entry or achievement reference.`,
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
      "Schema-1 migration requires the bundled yabuki-reference@1.0.0-proof.2 template.",
    );
  return schema2DocumentSchema.parse({
    ...legacy,
    schemaVersion: 2,
    template: { ...templateIdentity },
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
): ResumeDocument {
  return documentSchema.parse({
    ...legacy,
    schemaVersion: 5,
    variants: legacy.variants.map((variant) => ({
      ...variant,
      color: "indigo",
    })),
  });
}
