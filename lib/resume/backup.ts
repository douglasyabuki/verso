import { z } from "zod";

import {
  documentSchema,
  legacyDocumentSchema,
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
  if (![1, 2].includes(header.data.schemaVersion))
    throw new Error(
      `Workspace schema ${header.data.schemaVersion} is unsupported. This release imports schemas 1 and 2.`,
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
    result.data.schemaVersion === 1 ? migrateSchema1(result.data) : result.data;
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

/** Upgrade validated schema-1 content without interpreting legacy facts or changing identifiers.
 * @param legacy Validated old document with its supported template identity.
 * @returns A schema-2 document; the input remains untouched.
 * @example const current = migrateSchema1(legacyDocumentSchema.parse(data));
 */
export function migrateSchema1(
  legacy: z.infer<typeof legacyDocumentSchema>,
): ResumeDocument {
  if (
    legacy.template.id !== templateIdentity.id ||
    legacy.template.version !== "1.0.0-proof.2"
  )
    throw new Error(
      "Schema-1 migration requires the bundled yabuki-reference@1.0.0-proof.2 template.",
    );
  return documentSchema.parse({
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
