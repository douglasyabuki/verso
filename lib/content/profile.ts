import type {
  ProfileOrderItem,
  ResumeDocument,
  Variant,
} from "@/types-and-constants/resume";
import {
  defaultProfileSelection,
  profileContactFields,
} from "@/types-and-constants/resume";

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
 * Identify a profile card without collisions between field keys and link IDs.
 * @param item Ordered contact reference.
 * @returns {string} Namespaced stable identity for sorting and reference checks.
 * @example profileItemId({ kind: "field", field: "city" });
 */
export function profileItemId(item: ProfileOrderItem): string {
  return item.kind === "field" ? `field:${item.field}` : `link:${item.linkId}`;
}

/**
 * Build the initial header order for a new resume.
 * @param profile Shared profile containing links in library order.
 * @returns {ProfileOrderItem[]} Independent field references followed by every profile link.
 * @example defaultProfileOrder(document.profile);
 */
export function defaultProfileOrder(
  profile: ResumeDocument["profile"],
): ProfileOrderItem[] {
  return [
    ...structuredClone(defaultProfileSelection.order),
    ...profile.links.map((link): ProfileOrderItem => ({
      kind: "link",
      linkId: link.id,
    })),
  ];
}

/**
 * Read whether a contact reference is included in a resume.
 * @param item Profile field or link reference.
 * @param variant Resume with shared-language inclusion choices.
 * @returns {boolean} True when the field or link is included, even if its value is empty.
 * @example profileItemIncluded(item, variant);
 */
export function profileItemIncluded(
  item: ProfileOrderItem,
  variant: Variant,
): boolean {
  return item.kind === "field"
    ? variant.profileSelection[item.field]
    : !variant.profileSelection.hiddenLinkIds.includes(item.linkId);
}

/**
 * Reconcile profile references after library edits without reordering existing cards.
 * @param draft Mutable workspace after an edit.
 * @returns {void} Prunes deleted links and appends new references in every resume; new links remain included.
 * @example reconcileProfileSelection(draft);
 */
export function reconcileProfileSelection(draft: ResumeDocument): void {
  const available = defaultProfileOrder(draft.profile);
  const ids = new Set(available.map(profileItemId));
  const linkIds = new Set(draft.profile.links.map((link) => link.id));
  for (const variant of draft.variants) {
    const seen = new Set<string>();
    variant.profileSelection.order = variant.profileSelection.order.filter(
      (item) => {
        const id = profileItemId(item);
        if (!ids.has(id) || seen.has(id)) return false;
        seen.add(id);
        return true;
      },
    );
    variant.profileSelection.order.push(
      ...available
        .filter((item) => !seen.has(profileItemId(item)))
        .map((item) => ({ ...item })),
    );
    variant.profileSelection.hiddenLinkIds =
      variant.profileSelection.hiddenLinkIds.filter((id) => linkIds.has(id));
  }
}
