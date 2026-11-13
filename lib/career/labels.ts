import { CAREER_FIELD_LABELS } from "@/types-and-constants/career";

/** Resolve English interface labels for built-in and unfamiliar field keys.
 * @param key Stored field key, independent of the resume content language.
 * @returns Readable built-in label or a spaced, initially capitalized fallback.
 * @example careerFieldLabel("fullName") // "Full name"
 */
export function careerFieldLabel(key: string): string {
  const fallback = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_+/g, " ")
    .trim();

  return Object.hasOwn(CAREER_FIELD_LABELS, key)
    ? CAREER_FIELD_LABELS[key]
    : fallback.charAt(0).toUpperCase() + fallback.slice(1);
}
