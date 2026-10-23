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
import type {
  ReviewItem,
  WorkspaceFocusTarget,
} from "@/types-and-constants/navigation";
import type { ResumeDocument } from "@/types-and-constants/resume";
import { locales } from "@/types-and-constants/resume";

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
        const reasons =
          variant && !wording
            ? []
            : [
                status.missing && (!variant || wording?.overrides[locale])
                  ? "Missing required wording"
                  : "",
                status.review ? "Translation needs review" : "",
                status.sharedReview
                  ? "Library wording changed beneath customization"
                  : "",
              ].filter(Boolean);
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
          output: variant
            ? outputPaths.get(variant.id)![locale].has(shared.path)
            : document.variants.some(
                (resume) =>
                  outputPaths.get(resume.id)![locale].has(shared.path) &&
                  !variantWording(resume, shared.path)?.overrides[locale],
              ),
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
