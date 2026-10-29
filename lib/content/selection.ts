import type { Entry } from "@/types-and-constants/resume";

/**
 * Select all achievements while preserving the current output order.
 * @param selected Existing selected IDs.
 * @param entry Career entry supplying missing IDs.
 * @returns {string[]} Selected IDs followed by missing IDs in source entry order.
 * @example selection.bulletIds = selectAllAchievements(selection.bulletIds, entry);
 */
export function selectAllAchievements(
  selected: string[],
  entry: Entry,
): string[] {
  return [
    ...selected,
    ...entry.bullets
      .map((bullet) => bullet.id)
      .filter((id) => !selected.includes(id)),
  ];
}
