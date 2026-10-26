/**
 * Formats a count with an explicit singular or plural label.
 * @param count Number of items to display.
 * @param singular Label used when the count is exactly one.
 * @param plural Label used for all other counts, including zero.
 * @returns The count followed by the selected label.
 * @example formatCount(2, "wording task", "wording tasks"); // "2 wording tasks"
 */
export function formatCount(
  count: number,
  singular: string,
  plural: string,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
