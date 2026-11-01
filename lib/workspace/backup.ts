import { z } from "zod";

import { defaultProfileOrder, profileItemId } from "@/lib/content/profile";
import { documentSchema, templateIdentity } from "@/lib/resume/model";
import type { ResumeDocument } from "@/types-and-constants/resume";

/**
 * Serialize complete editable state, excluding interface/compiler state.
 * @param doc Workspace.
 * @returns {string} Versioned JSON backup.
 * @example serializeBackup(doc)
 */
export function serializeBackup(doc: ResumeDocument): string {
  return JSON.stringify(doc, null, 2) + "\n";
}

/**
 * Validate a portable backup before any mutation.
 * @param source JSON text up to 5 MB.
 * @returns {ResumeDocument} A normalized document; throws actionable schema, template, or reference errors.
 * @example parseBackup(fileText)
 */
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
  if (header.data.schemaVersion !== 1)
    throw new Error(
      "This backup uses an unsupported format. Your current work has not changed.",
    );
  if (
    header.data.template.id !== templateIdentity.id ||
    header.data.template.version !== templateIdentity.version
  )
    throw new Error(
      "This backup needs a resume template that is not available in this version of Verso. Your current work has not changed.",
    );
  const result = documentSchema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue.path.join(".");
    const incompatible = path.includes("settings") || path.includes("Settings");
    throw new Error(
      `${incompatible ? "This backup contains unsupported layout settings" : "This backup contains missing or invalid details"}. Choose another Verso backup. Your current work has not changed. Details: ${path}: ${issue.message}`,
    );
  }
  const doc = result.data;
  const seen = new Set<string>();

  /**
   * Reject duplicate content identifiers within the imported workspace.
   * @param value Content identifier to register.
   * @returns {void} Records the identifier; throws if it was already encountered.
   * @example unique(section.id);
   */
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
    const profileLinkIds = new Set(doc.profile.links.map((link) => link.id));
    const orderIds = variant.profileSelection.order.map(profileItemId);
    const expectedIds = new Set(
      defaultProfileOrder(doc.profile).map(profileItemId),
    );
    if (
      orderIds.length !== expectedIds.size ||
      new Set(orderIds).size !== orderIds.length ||
      orderIds.some((id) => !expectedIds.has(id))
    )
      throw new Error(
        `Resume ${variant.name || "Untitled"} has missing, repeated, or invalid Profile order references. Your current work has not changed.`,
      );
    const hiddenLinkIds = variant.profileSelection.hiddenLinkIds;
    if (
      new Set(hiddenLinkIds).size !== hiddenLinkIds.length ||
      hiddenLinkIds.some((id) => !profileLinkIds.has(id))
    )
      throw new Error(
        `Resume ${variant.name || "Untitled"} has repeated or missing Profile link selections. Choose another Verso backup. Your current work has not changed.`,
      );
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
