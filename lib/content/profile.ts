import type { ResumeDocument, Variant } from "@/types-and-constants/resume";
import { profileContactFields } from "@/types-and-constants/resume";

/**
 * Select a resume's contact facts without changing the shared career profile.
 * @param profile Shared career profile.
 * @param variant Resume whose choices apply to both output languages.
 * @returns {ResumeDocument["profile"]} A copy with hidden contact fields blank and hidden links omitted; name and summary remain shared.
 * @example selectedProfile(document.profile, document.variants[0]);
 */
export function selectedProfile(
  profile: ResumeDocument["profile"],
  variant: Variant,
): ResumeDocument["profile"] {
  const selected = { ...profile };
  for (const { key } of profileContactFields)
    if (!variant.profileSelection[key]) selected[key] = "";
  selected.links = profile.links.filter(
    (link) => !variant.profileSelection.hiddenLinkIds.includes(link.id),
  );
  return selected;
}

/**
 * Remove hidden-link references after a shared Profile link is deleted or cleared.
 * @param draft Mutable workspace after an edit.
 * @returns {void} Prunes missing link IDs in every resume without changing other selections.
 * @example reconcileProfileSelection(draft);
 */
export function reconcileProfileSelection(draft: ResumeDocument): void {
  const ids = new Set(draft.profile.links.map((link) => link.id));
  for (const variant of draft.variants)
    variant.profileSelection.hiddenLinkIds =
      variant.profileSelection.hiddenLinkIds.filter((id) => ids.has(id));
}
