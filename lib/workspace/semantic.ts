import { documentSchema } from "@/lib/resume/model";
import type { ResumeDocument } from "@/types-and-constants/resume";

/** Compare normalized editable meaning while preserving references and ordered selections.
 * @param document Valid workspace to canonicalize.
 * @returns {string} Stable structural identity, excluding numerical revisions only.
 * @example semanticIdentity(createEmptyDocument())
 */
export function semanticIdentity(document: ResumeDocument): string {
  const doc = documentSchema.parse(document);
  const ids = new Map<string, string>();
  doc.profile.links.forEach((link, i) => ids.set(link.id, `profile/link/${i}`));
  doc.sections.forEach((section, s) => {
    ids.set(section.id, `section/${s}`);
    section.entries.forEach((entry, e) => {
      ids.set(entry.id, `section/${s}/entry/${e}`);
      entry.links.forEach((link, l) =>
        ids.set(link.id, `section/${s}/entry/${e}/link/${l}`),
      );
      entry.bullets.forEach((bullet, b) =>
        ids.set(bullet.id, `section/${s}/entry/${e}/bullet/${b}`),
      );
    });
  });
  doc.variants.forEach((variant, i) => ids.set(variant.id, `resume/${i}`));
  /** Normalize schema fields without rewriting user text or semantic identifiers.
   * @param value Schema value. @param key Owning field.
   * @returns {unknown} Ordered value with canonical references and sorted object keys.
   * @example normalize(doc)
   */
  function normalize(value: unknown, key = ""): unknown {
    if (Array.isArray(value)) {
      const values = value.map((item) => normalize(item, key));
      return key === "hiddenLinkIds" ? [...new Set(values)].sort() : values;
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value)
          .filter(
            ([name, item]) =>
              key === "achievements" ||
              name !== "revision" ||
              typeof item !== "number",
          )
          .map(([name, item]) => [
            key === "achievements" ? (ids.get(name) ?? name) : name,
            normalize(item, name),
          ])
          .sort(([a], [b]) => String(a).localeCompare(String(b))),
      );
    }
    if (
      typeof value === "string" &&
      [
        "id",
        "sectionId",
        "entryId",
        "linkId",
        "bulletIds",
        "hiddenLinkIds",
      ].includes(key)
    ) {
      // Template identity is semantic and handled separately below.
      return ids.get(value) ?? value;
    }
    return value;
  }
  const result = normalize(doc) as Record<string, unknown>;
  result.template = doc.template;
  return JSON.stringify(result);
}

/** Compare editable meaning independently of exact JSON backup identity.
 * @param left First validated workspace. @param right Second validated workspace.
 * @returns {boolean} True only for equivalent content, relationships, review state and settings.
 * @example semanticallyEqual(current, imported)
 */
export function semanticallyEqual(
  left: ResumeDocument,
  right: ResumeDocument,
): boolean {
  return semanticIdentity(left) === semanticIdentity(right);
}
