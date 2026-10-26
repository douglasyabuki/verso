import { equivalentSpans, normalizeSpans } from "@/lib/resume/spans";
import type { Locale } from "@/types-and-constants/languages";
import { locales } from "@/types-and-constants/languages";
import type {
  EffectiveSnapshot,
  LocalizedText,
  ResumeDocument,
  ReviewSnapshot,
  Span,
  Variant,
  VariantWording,
} from "@/types-and-constants/resume";

/** Find shared summary or achievement wording by stable identity.
 * @param doc Workspace. @param path Summary or achievement field path.
 * @returns Shared wording, or undefined for deleted or unsupported fields.
 * @example sharedWording(doc, "profile.summary")
 */
export function sharedWording(
  doc: ResumeDocument,
  path: string,
): LocalizedText | undefined {
  if (path === "profile.summary") return doc.profile.summary;
  if (!path.startsWith("bullets.") || !path.endsWith(".body")) return;
  const id = path.slice(8, -5);
  for (const section of doc.sections)
    for (const entry of section.entries) {
      const bullet = entry.bullets.find((item) => item.id === id);
      if (bullet) return bullet.body;
    }
}

/** Read variant metadata without creating an override.
 * @param variant Selected variant. @param path Stable field path.
 * @returns Stored wording metadata, or undefined when both languages inherit.
 * @example variantWording(variant, "profile.summary")
 */
export function variantWording(
  variant: Variant,
  path: string,
): VariantWording | undefined {
  if (path === "profile.summary") return variant.wording.summary;
  if (path.startsWith("bullets.") && path.endsWith(".body")) {
    const id = path.slice(8, -5);
    return Object.hasOwn(variant.wording.achievements, id)
      ? variant.wording.achievements[id]
      : undefined;
  }
}

/** Resolve effective bilingual wording and independent variant translation flags.
 * @param shared Library wording. @param variant Selected variant. @param path Stable field path.
 * @returns A fresh bilingual view; no library or override data is mutated.
 * @example effectiveWording(doc.profile.summary, variant, "profile.summary")
 */
export function effectiveWording(
  shared: LocalizedText,
  variant: Variant,
  path: string,
): LocalizedText {
  const field = variantWording(variant, path);
  const resolve = (locale: Locale) => {
    const override = field?.overrides[locale];
    return {
      ...shared[locale],
      ...(override
        ? { spans: override.spans, revision: override.revision }
        : {}),
      ...(field ? field.review[locale] : {}),
    };
  };
  return { "en-US": resolve("en-US"), "pt-BR": resolve("pt-BR") };
}

/** Capture the effective text and its provenance for stale-review protection.
 * @param shared Library wording. @param variant Selected variant. @param path Stable field path. @param locale Language.
 * @returns Independent snapshot including shared/override provenance.
 * @example effectiveSnapshot(shared, variant, path, "en-US")
 */
export function effectiveSnapshot(
  shared: LocalizedText,
  variant: Variant,
  path: string,
  locale: Locale,
): EffectiveSnapshot {
  const value = effectiveWording(shared, variant, path)[locale];
  return {
    locale,
    revision: value.revision,
    spans: structuredClone(value.spans),
    source: variantWording(variant, path)?.overrides[locale]
      ? "override"
      : "shared",
  };
}

/** Capture the shared text a new override inherits.
 * @param shared Library wording. @param locale Override language.
 * @returns A detached baseline; later library changes cannot mutate it.
 * @example sharedSnapshot(summary, "en-US")
 */
function sharedSnapshot(shared: LocalizedText, locale: Locale): ReviewSnapshot {
  return {
    locale,
    revision: shared[locale].revision,
    spans: structuredClone(shared[locale].spans),
  };
}

/** Explicitly copy one language into variant-owned wording; the other keeps inheriting.
 * @param doc Mutable draft. @param variantId Variant identity. @param path Stable field path. @param locale Language to override.
 * @returns Nothing; unavailable or already overridden fields are unchanged.
 * @example createWordingOverride(doc, "general", "profile.summary", "en-US")
 */
export function createWordingOverride(
  doc: ResumeDocument,
  variantId: string,
  path: string,
  locale: Locale,
): void {
  const variant = doc.variants.find((item) => item.id === variantId);
  const shared = sharedWording(doc, path);
  if (!variant || !shared) return;
  let field = variantWording(variant, path);
  if (!field) {
    field = {
      overrides: {},
      review: {
        "en-US": {
          needsReview: shared["en-US"].needsReview,
          reviewedCounterpart: shared["en-US"].reviewedCounterpart
            ? {
                ...structuredClone(shared["en-US"].reviewedCounterpart),
                source: "shared",
              }
            : null,
        },
        "pt-BR": {
          needsReview: shared["pt-BR"].needsReview,
          reviewedCounterpart: shared["pt-BR"].reviewedCounterpart
            ? {
                ...structuredClone(shared["pt-BR"].reviewedCounterpart),
                source: "shared",
              }
            : null,
        },
      },
    };
    if (path === "profile.summary") variant.wording.summary = field;
    else
      Object.defineProperty(variant.wording.achievements, path.slice(8, -5), {
        value: field,
        enumerable: true,
        configurable: true,
        writable: true,
      });
  }
  if (!field.overrides[locale])
    field.overrides[locale] = {
      spans: structuredClone(shared[locale].spans),
      revision: shared[locale].revision,
      sharedBaseline: sharedSnapshot(shared, locale),
    };
}

/** Edit only an existing explicit override, retaining its shared baseline.
 * @param doc Mutable draft. @param variantId Variant identity. @param path Stable field path. @param locale Language. @param spans Structured wording.
 * @returns Nothing; semantic no-ops do not increment revisions.
 * @example editWordingOverride(doc, "general", path, "en-US", spans)
 */
export function editWordingOverride(
  doc: ResumeDocument,
  variantId: string,
  path: string,
  locale: Locale,
  spans: Span[],
): void {
  const variant = doc.variants.find((item) => item.id === variantId);
  const override = variant && variantWording(variant, path)?.overrides[locale];
  if (!override || equivalentSpans(override.spans, spans)) return;
  override.spans = normalizeSpans(spans);
  override.revision++;
}

/** Remove one override; removing the final override restores library review behavior.
 * @param doc Mutable draft. @param variantId Variant identity. @param path Stable field path. @param locale Language.
 * @returns Nothing; deselection never calls this operation.
 * @example resetWordingOverride(doc, "general", path, "pt-BR")
 */
export function resetWordingOverride(
  doc: ResumeDocument,
  variantId: string,
  path: string,
  locale: Locale,
): void {
  const variant = doc.variants.find((item) => item.id === variantId);
  const field = variant && variantWording(variant, path);
  if (!variant || !field) return;
  delete field.overrides[locale];
  if (!locales.some((language) => field.overrides[language])) {
    if (path === "profile.summary") delete variant.wording.summary;
    else delete variant.wording.achievements[path.slice(8, -5)];
  }
}

/** Determine whether same-language library wording differs from an override's reviewed baseline.
 * @param shared Library wording. @param variant Variant. @param path Stable field path. @param locale Language.
 * @returns True only for a changed baseline beneath an existing override.
 * @example sharedWordingChanged(shared, variant, path, "en-US")
 */
export function sharedWordingChanged(
  shared: LocalizedText,
  variant: Variant,
  path: string,
  locale: Locale,
): boolean {
  const baseline = variantWording(variant, path)?.overrides[locale]
    ?.sharedBaseline;
  return !!baseline && !equivalentSpans(baseline.spans, shared[locale].spans);
}

/** Acknowledge the exact displayed shared wording without clearing translation review.
 * @param doc Mutable draft. @param variantId Variant identity. @param path Stable field path. @param displayed Displayed shared snapshot. @param customization Displayed customization to retain.
 * @returns Whether the unchanged displayed version was accepted.
 * @example acknowledgeSharedWording(doc, "general", path, snapshot, customization)
 */
export function acknowledgeSharedWording(
  doc: ResumeDocument,
  variantId: string,
  path: string,
  displayed: ReviewSnapshot,
  customization: EffectiveSnapshot,
): boolean {
  const variant = doc.variants.find((item) => item.id === variantId);
  const shared = sharedWording(doc, path);
  const override =
    variant && variantWording(variant, path)?.overrides[displayed.locale];
  if (
    !shared ||
    !override ||
    customization.locale !== displayed.locale ||
    customization.source !== "override" ||
    override.revision !== customization.revision ||
    !equivalentSpans(override.spans, customization.spans) ||
    shared[displayed.locale].revision !== displayed.revision ||
    !equivalentSpans(shared[displayed.locale].spans, displayed.spans)
  )
    return false;
  override.sharedBaseline = structuredClone(displayed);
  return true;
}

/** Acknowledge only the effective bilingual pair actually displayed, including provenance.
 * @param doc Mutable draft. @param variantId Variant identity. @param path Stable field path. @param target Displayed target. @param reference Displayed counterpart.
 * @returns False if either version/source changed or the target is empty.
 * @example markVariantTranslationReviewed(doc, "general", path, target, reference)
 */
export function markVariantTranslationReviewed(
  doc: ResumeDocument,
  variantId: string,
  path: string,
  target: EffectiveSnapshot,
  reference: EffectiveSnapshot,
): boolean {
  const variant = doc.variants.find((item) => item.id === variantId);
  const shared = sharedWording(doc, path);
  const field = variant && variantWording(variant, path);
  if (
    !variant ||
    !shared ||
    !field ||
    target.locale === reference.locale ||
    !target.spans.some((span) => span.text.trim())
  )
    return false;
  for (const snapshot of [target, reference]) {
    const current = effectiveSnapshot(shared, variant, path, snapshot.locale);
    if (
      current.source !== snapshot.source ||
      current.revision !== snapshot.revision ||
      !equivalentSpans(current.spans, snapshot.spans)
    )
      return false;
  }
  field.review[target.locale] = {
    needsReview: false,
    reviewedCounterpart: structuredClone(reference),
  };
  return true;
}

/** Confirm the displayed effective pair in both directions for one resume only.
 * @param doc Mutable workspace. @param variantId Resume owner. @param path Field identity. @param target Displayed target. @param reference Displayed counterpart.
 * @returns False without mutation if either language is empty or either version/provenance is stale.
 * @example confirmVariantTranslationPair(doc, variant.id, path, target, reference)
 */
export function confirmVariantTranslationPair(
  doc: ResumeDocument,
  variantId: string,
  path: string,
  target: EffectiveSnapshot,
  reference: EffectiveSnapshot,
): boolean {
  const candidate = structuredClone(doc);
  if (
    !markVariantTranslationReviewed(
      candidate,
      variantId,
      path,
      target,
      reference,
    ) ||
    !markVariantTranslationReviewed(
      candidate,
      variantId,
      path,
      reference,
      target,
    )
  )
    return false;
  const variant = doc.variants.find((item) => item.id === variantId)!;
  const checked = candidate.variants.find((item) => item.id === variantId)!;
  variantWording(variant, path)!.review = variantWording(checked, path)!.review;
  return true;
}

/** Reconcile every retained override after one workspace edit, including inherited counterpart edits and deletion cleanup.
 * @param before Previous workspace. @param after Mutable edited draft.
 * @returns Nothing; changes are part of the same history/save transaction.
 * @example reconcileVariantWording(previous, draft)
 */
export function reconcileVariantWording(
  before: ResumeDocument,
  after: ResumeDocument,
): void {
  for (const variant of after.variants) {
    const previous = before.variants.find((item) => item.id === variant.id);
    for (const id of Object.keys(variant.wording.achievements))
      if (!sharedWording(after, `bullets.${id}.body`))
        delete variant.wording.achievements[id];
    if (!previous) continue;
    const paths = [
      ...(variant.wording.summary ? ["profile.summary"] : []),
      ...Object.keys(variant.wording.achievements).map(
        (id) => `bullets.${id}.body`,
      ),
    ];
    for (const path of paths) {
      const shared = sharedWording(after, path);
      const oldShared = sharedWording(before, path);
      const field = variantWording(variant, path)!;
      if (!shared || !oldShared) continue;
      for (const locale of locales) {
        const old = effectiveSnapshot(oldShared, previous, path, locale);
        const current = effectiveSnapshot(shared, variant, path, locale);
        // Explicit creation copies unchanged effective text and must not invent review work.
        const created =
          !variantWording(previous, path)?.overrides[locale] &&
          !!field.overrides[locale];
        const changed =
          !equivalentSpans(old.spans, current.spans) ||
          (!created && old.source !== current.source);
        const other = locale === "en-US" ? "pt-BR" : "en-US";
        if (
          changed &&
          effectiveWording(shared, variant, path)[other].spans.some((span) =>
            span.text.trim(),
          )
        )
          field.review[other].needsReview = true;
      }
    }
  }
}
