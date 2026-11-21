import type { CareerDraft } from "@/types-and-constants/career";

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

/** Describe when a recovery version was last written, relative to now.
 * @param iso ISO timestamp from `CareerDraft.updatedAt`; undefined for older recovery without one.
 * @param now Reference time in milliseconds (default `Date.now()`).
 * @param locale Display locale (default the runtime locale).
 * @returns {string} "just now" under a minute, a relative phrase such as "5 minutes ago" or "yesterday", or "time unknown" when the timestamp is absent or invalid.
 * @example draftAge("2026-11-20T10:00:00.000Z", Date.parse("2026-11-20T10:05:00.000Z")) // "5 minutes ago"
 */
export function draftAge(
  iso: string | undefined,
  now = Date.now(),
  locale?: string,
): string {
  const time = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(time)) return "time unknown";
  const elapsed = now - time;
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, size] of units)
    if (Math.abs(elapsed) >= size)
      return format.format(-Math.round(elapsed / size), unit);
  return "just now";
}

/** Order recovery so the most recently written versions come first.
 * @param drafts Unresolved recovery records.
 * @returns {CareerDraft[]} A new array sorted by `updatedAt` descending; records without a timestamp keep their relative order after timestamped ones.
 * @example newestFirst(state.recovery)[0]
 */
export function newestFirst(drafts: readonly CareerDraft[]): CareerDraft[] {
  const time = (draft: CareerDraft) =>
    draft.updatedAt ? Date.parse(draft.updatedAt) : Number.NEGATIVE_INFINITY;
  return [...drafts].sort((a, b) => time(b) - time(a));
}

/** Find the newest stored draft for one editing scope, excluding the draft already open.
 * @param drafts Unresolved recovery records.
 * @param scope Editing scope of the open form.
 * @param openDraftId Identity of the open draft, which never offers itself.
 * @returns {CareerDraft | null} The most recently written other draft for that scope, or null when none exists.
 * @example recoveryForScope(state.recovery, "profile", state.draft?.draftId)
 */
export function recoveryForScope(
  drafts: readonly CareerDraft[],
  scope: string,
  openDraftId?: string,
): CareerDraft | null {
  return (
    newestFirst(
      drafts.filter(
        (draft) => draft.scope === scope && draft.draftId !== openDraftId,
      ),
    )[0] ?? null
  );
}
