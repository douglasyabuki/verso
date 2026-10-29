import { plain } from "@/lib/wording/localization";
import type { Entry } from "@/types-and-constants/resume";

/**
 * Normalize searchable wording without changing stored content.
 * @param text Search query or entry text.
 * @returns {string} Lowercase text with combining accents removed.
 * @example normalizeSearch("Educação") === "educacao"
 */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * Match every query term against shared facts and both languages' wording.
 * @param entry Career entry to inspect.
 * @param query Whitespace-separated search terms.
 * @returns {boolean} True for an empty query or when all terms occur in the searchable content.
 * @example matchesEntry(entry, "react liderança")
 */
export function matchesEntry(entry: Entry, query: string): boolean {
  const terms = normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const content = normalizeSearch(
    [
      entry.organization,
      ...entry.technologies,
      plain(entry.title, "en-US"),
      plain(entry.title, "pt-BR"),
      ...entry.bullets.flatMap((bullet) => [
        plain(bullet.body, "en-US"),
        plain(bullet.body, "pt-BR"),
      ]),
    ].join("\n"),
  );
  return terms.every((term) => content.includes(term));
}

/**
 * Copy an entry without sharing mutable records or variant references.
 * @param entry Source entry, including any certification metadata.
 * @returns {Entry} An unarchived independent copy with fresh entry, achievement, and link IDs.
 * @example const copy = duplicateEntry(entry);
 */
export function duplicateEntry(entry: Entry): Entry {
  const copy = structuredClone(entry);
  copy.id = crypto.randomUUID();
  copy.archived = false;
  copy.bullets.forEach((bullet) => {
    bullet.id = crypto.randomUUID();
  });
  copy.links.forEach((link) => {
    link.id = crypto.randomUUID();
  });
  return copy;
}
