import {
  localizedFields,
  plain,
  translationStatus,
} from "@/lib/resume/localization";
import {
  effectiveWording,
  sharedWordingChanged,
  variantWording,
} from "@/lib/resume/wording";
import { locales } from "@/types-and-constants/languages";
import type { WorkspaceFocusTarget } from "@/types-and-constants/navigation";
import type { ResumeDocument } from "@/types-and-constants/resume";
import type { ReviewFilters, ReviewItem } from "@/types-and-constants/review";
import { reviewCategoryLabels } from "@/types-and-constants/review";

/** Derive review ownership without merging independent resume reviews or duplicating inherited missing text.
 * @param document Current workspace, including archived library and retained resume wording.
 * @param unresolvedOnly Exclude resolved records by default; false supports a retained current item.
 * @param retained Optional current item whose last customization was explicitly reset; its owner and library target must still exist.
 * @returns Stable owner/field/language items in library then resume order.
 * @example const badge = reviewItems(document).length;
 */
export function reviewItems(
  document: ResumeDocument,
  unresolvedOnly = true,
  retained?: WorkspaceFocusTarget,
): ReviewItem[] {
  const library = localizedFields(document);
  const archivedPaths = new Set(
    document.sections.flatMap((section) =>
      section.entries
        .filter((entry) => entry.archived)
        .flatMap((entry) => [
          `entries.${entry.id}.title`,
          ...entry.bullets.map((bullet) => `bullets.${bullet.id}.body`),
        ]),
    ),
  );
  const outputPaths = new Map(
    document.variants.map((variant) => {
      const fields = localizedFields(document, variant);
      const paths = (locale: "en-US" | "pt-BR") =>
        new Set(
          fields
            .filter(
              (field) => field.required || plain(field.value, locale).trim(),
            )
            .map((field) => field.path),
        );
      return [
        variant.id,
        { "en-US": paths("en-US"), "pt-BR": paths("pt-BR") },
      ] as const;
    }),
  );
  const result: ReviewItem[] = [];
  for (const variant of [undefined, ...document.variants]) {
    for (const shared of library) {
      const wording = variant && variantWording(variant, shared.path);
      if (
        variant &&
        !wording &&
        !(retained?.resumeId === variant.id && retained.path === shared.path)
      )
        continue;
      const field = variant
        ? {
            ...shared,
            value: effectiveWording(shared.value, variant, shared.path),
            sharedReview: {
              "en-US": sharedWordingChanged(
                shared.value,
                variant,
                shared.path,
                "en-US",
              ),
              "pt-BR": sharedWordingChanged(
                shared.value,
                variant,
                shared.path,
                "pt-BR",
              ),
            },
          }
        : shared;
      for (const locale of locales) {
        if (variant && !wording && retained?.locale !== locale) continue;
        const status = translationStatus(field, locale);
        const categories: ReviewItem["categories"] =
          variant && !wording
            ? []
            : [
                status.missing && (!variant || wording?.overrides[locale])
                  ? ("missing" as const)
                  : null,
                status.review ? ("translation" as const) : null,
                status.sharedReview ? ("library" as const) : null,
              ].filter((category) => category !== null);
        const reasons = categories.map(
          (category) => reviewCategoryLabels[category],
        );
        const usedBy = document.variants
          .filter(
            (resume) =>
              (!variant || resume.id === variant.id) &&
              outputPaths.get(resume.id)![locale].has(shared.path) &&
              (!!variant ||
                !variantWording(resume, shared.path)?.overrides[locale]),
          )
          .map((resume) => resume.id);
        if (unresolvedOnly && !reasons.length) continue;
        result.push({
          id: JSON.stringify([
            variant ? "resume" : "library",
            variant?.id ?? null,
            shared.path,
            locale,
          ]),
          path: shared.path,
          locale,
          resumeId: variant?.id,
          owner: variant ? variant.name || "Untitled resume" : "Career library",
          field,
          reasons,
          categories,
          usedBy,
          archived: archivedPaths.has(shared.path),
          output: usedBy.length > 0,
          provenance: variant
            ? wording?.overrides[locale]
              ? "Customized for this resume"
              : wording
                ? "Uses library text · independent resume review"
                : "Uses library text · customization reset"
            : "Library text",
        });
      }
    }
  }
  return result;
}

/** Intersect independent ownership, output, archive, language, section, and task filters.
 * @param item Derived owner/field/language item. @param filters Current filters. @param selectedResumeId Resume whose output is selected, retained across editor excursions.
 * @returns Whether the item matches every dimension; selected output never includes another resume's independent reviews.
 * @example matchesReviewFilters(item, filters, variant.id)
 */
export function matchesReviewFilters(
  item: ReviewItem,
  filters: ReviewFilters,
  selectedResumeId: string,
): boolean {
  return (
    (filters.owner === "all" ||
      (item.resumeId ? `resume:${item.resumeId}` : "library") ===
        filters.owner) &&
    (filters.language === "all" || item.locale === filters.language) &&
    (filters.section === "all" || item.field.sectionId === filters.section) &&
    (filters.reason === "all" ||
      item.categories.some((category) => category === filters.reason)) &&
    (filters.archive === "all" ||
      item.archived === (filters.archive === "archived")) &&
    (filters.output === "all" ||
      (filters.output === "selected"
        ? item.usedBy.includes(selectedResumeId)
        : filters.output === "any"
          ? item.output
          : !item.output))
  );
}

/** Describe output relevance without confusing retained customizations with unused library wording.
 * @param item Derived task. @param selectedResumeId Selected output resume.
 * @returns A readable relevance label for list rows and details.
 * @example reviewOutputLabel(item, variant.id)
 */
export function reviewOutputLabel(
  item: ReviewItem,
  selectedResumeId: string,
): string {
  if (item.usedBy.includes(selectedResumeId)) return "Used by selected resume";
  if (item.resumeId)
    return item.output
      ? "Used by its owning resume"
      : "Excluded from its owning resume";
  return item.output
    ? "Inherited by another resume's output"
    : "Not inherited by any resume's output";
}
