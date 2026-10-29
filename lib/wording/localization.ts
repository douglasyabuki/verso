import { entryLabel } from "@/lib/content/section-fields";
import { equivalentSpans, normalizeSpans } from "@/lib/wording/spans";
import { effectiveWording, sharedWordingChanged } from "@/lib/wording/wording";
import type { Locale } from "@/types-and-constants/languages";
import type {
  LocalizedFieldDescriptor,
  LocalizedText,
  ResumeDocument,
  ReviewSnapshot,
  Span,
  Variant,
} from "@/types-and-constants/resume";
import { entryTerminology } from "@/types-and-constants/sections";

/**
 * Create separate language records.
 * @param en English text.
 * @param pt Portuguese text.
 * @returns {LocalizedText} Independent en-US and pt-BR records with one plain span, revision zero, and no review baseline.
 * @example localized("Projects", "Projetos")
 */
export function localized(en = "", pt = ""): LocalizedText {
  /**
   * Create an independent initial wording record for one language.
   * @param value Plain text for the language.
   * @returns {LocalizedText[Locale]} One plain span with revision zero, no review flag, and no counterpart baseline.
   * @example make("Projects");
   */
  const make = (value: string) => ({
    spans: [{ text: value, emphasis: false, href: "" }],
    revision: 0,
    needsReview: false,
    reviewedCounterpart: null,
  });
  return { "en-US": make(en), "pt-BR": make(pt) };
}

/**
 * Read plain wording without formatting.
 * @param value Localized record.
 * @param locale Language.
 * @returns {string} All span text joined in source order for the requested language; an empty string for empty wording.
 * @example plain(entry.title, "en-US")
 */
export function plain(value: LocalizedText, locale: Locale): string {
  return value[locale].spans.map((span) => span.text).join("");
}

/**
 * Update one language and flag an existing counterpart.
 * @param value Mutable draft record.
 * @param locale Changed language.
 * @param spans Structured text.
 * @returns {void} Mutates changed wording, increments its revision, and flags a nonempty counterpart; equivalent spans leave the record unchanged.
 * @example editTranslation(title, "en-US", spans)
 */
export function editTranslation(
  value: LocalizedText,
  locale: Locale,
  spans: Span[],
): void {
  if (equivalentSpans(value[locale].spans, spans)) return;
  value[locale].spans = normalizeSpans(spans);
  value[locale].revision++;
  const counterpart = locale === "en-US" ? "pt-BR" : "en-US";
  if (plain(value, counterpart).trim()) value[counterpart].needsReview = true;
}

/**
 * List localized fields in career-content or active-output order, preserving identifier-based associations.
 * @param doc Workspace.
 * @param variant Optional variant to restrict fields to its actual output.
 * @returns {LocalizedFieldDescriptor[]} Field descriptors with source context and requiredness; summary is always optional.
 * @example localizedFields(doc, doc.variants[0])
 */
export function localizedFields(
  doc: ResumeDocument,
  variant?: Variant,
): LocalizedFieldDescriptor[] {
  const fields: LocalizedFieldDescriptor[] = [
    {
      sharedReview: variant
        ? {
            "en-US": sharedWordingChanged(
              doc.profile.summary,
              variant,
              "profile.summary",
              "en-US",
            ),
            "pt-BR": sharedWordingChanged(
              doc.profile.summary,
              variant,
              "profile.summary",
              "pt-BR",
            ),
          }
        : undefined,
      path: "profile.summary",
      label: "Summary",
      source: "Summary",
      sectionId: "profile",
      value: variant
        ? effectiveWording(doc.profile.summary, variant, "profile.summary")
        : doc.profile.summary,
      multiline: true,
      required: false,
    },
  ];
  const sections = variant
    ? variant.sections
        .filter((selected) => selected.visible)
        .flatMap((selected) => {
          const section = doc.sections.find(
            (section) => section.id === selected.sectionId,
          );
          return section ? [{ section, selected }] : [];
        })
    : doc.sections.map((section) => ({ section, selected: undefined }));
  for (const { section, selected } of sections) {
    const entries = selected
      ? selected.entries.flatMap((selection) => {
          const entry = section.entries.find(
            (entry) => entry.id === selection.entryId && !entry.archived,
          );
          return entry ? [{ entry, selection }] : [];
        })
      : section.entries.map((entry) => ({ entry, selection: undefined }));
    if (selected && !entries.length) continue;
    const name =
      plain(section.heading, "en-US") ||
      plain(section.heading, "pt-BR") ||
      "Untitled section";
    fields.push({
      path: `sections.${section.id}.heading`,
      label: "Heading",
      source: name,
      sectionId: section.id,
      value: section.heading,
      multiline: false,
      required: true,
    });
    for (const { entry, selection } of entries) {
      const source = [
        name,
        plain(entry.title, "en-US") ||
          plain(entry.title, "pt-BR") ||
          entryLabel(entry, section.kind, "en-US"),
        entry.organization,
        entry.archived ? "Archived" : "",
      ]
        .filter(Boolean)
        .join(" · ");
      fields.push({
        path: `entries.${entry.id}.title`,
        label: entryTerminology[section.kind].title,
        source,
        sectionId: section.id,
        value: entry.title,
        multiline: false,
        required: true,
      });
      const bullets = selection
        ? selection.bulletIds.flatMap((id) =>
            entry.bullets.filter((bullet) => bullet.id === id),
          )
        : entry.bullets;
      for (const bullet of bullets)
        fields.push({
          sharedReview: variant
            ? {
                "en-US": sharedWordingChanged(
                  bullet.body,
                  variant,
                  `bullets.${bullet.id}.body`,
                  "en-US",
                ),
                "pt-BR": sharedWordingChanged(
                  bullet.body,
                  variant,
                  `bullets.${bullet.id}.body`,
                  "pt-BR",
                ),
              }
            : undefined,
          path: `bullets.${bullet.id}.body`,
          label: entryTerminology[section.kind].item,
          source,
          sectionId: section.id,
          value: variant
            ? effectiveWording(
                bullet.body,
                variant,
                `bullets.${bullet.id}.body`,
              )
            : bullet.body,
          multiline: section.kind !== "skills",
          required: true,
        });
    }
  }
  return fields;
}

/**
 * Classify target wording for filtering and navigation without turning optional omissions into errors.
 * @param field Localized field descriptor.
 * @param locale Target language.
 * @returns {{ missing: boolean; review: boolean; sharedReview: boolean; unresolved: boolean }} missing flags required empty wording; review and sharedReview flag independent review work; unresolved is true when any flag is true.
 * @example translationStatus(field, "pt-BR").unresolved
 */
export function translationStatus(
  field: LocalizedFieldDescriptor,
  locale: Locale,
) {
  const populated = !!plain(field.value, locale).trim();
  const missing = field.required && !populated;
  const review = populated && field.value[locale].needsReview;
  const sharedReview = !!field.sharedReview?.[locale];
  return {
    missing,
    review,
    sharedReview,
    unresolved: missing || review || sharedReview,
  };
}

/**
 * Capture the explicitly selected language as an immutable review version.
 * @param value Bilingual wording.
 * @param locale Selected reference or target language.
 * @returns {ReviewSnapshot} An independent locale, revision, and spans snapshot.
 * @example translationSnapshot(title, "en-US")
 */
export function translationSnapshot(
  value: LocalizedText,
  locale: Locale,
): ReviewSnapshot {
  return {
    locale,
    revision: value[locale].revision,
    spans: value[locale].spans.map((span) => ({ ...span })),
  };
}

/**
 * Acknowledge only the exact target and selected reference displayed to the reviewer.
 * @param doc Mutable workspace draft.
 * @param path Stable localized field path.
 * @param target Displayed target version.
 * @param reference Displayed reference version.
 * @param referenceLocale Currently selected reference locale, which must still match the displayed snapshot.
 * @returns {boolean} Whether review was accepted; rejected calls leave the draft unchanged.
 * @example markTranslationReviewed(doc, path, target, reference, "en-US")
 */
export function markTranslationReviewed(
  doc: ResumeDocument,
  path: string,
  target: ReviewSnapshot,
  reference: ReviewSnapshot,
  referenceLocale: Locale,
): boolean {
  const value = findLocalized(doc, path);
  if (
    !value ||
    target.locale === referenceLocale ||
    reference.locale !== referenceLocale
  )
    return false;

  /**
   * Compare a displayed review snapshot with the current language record.
   * @param snapshot Displayed locale, revision, and structured wording.
   * @returns {boolean} True when revision and normalized spans still match; otherwise false.
   * @example matches(target);
   */
  const matches = (snapshot: ReviewSnapshot) =>
    value[snapshot.locale].revision === snapshot.revision &&
    equivalentSpans(value[snapshot.locale].spans, snapshot.spans);
  if (
    !matches(target) ||
    !matches(reference) ||
    !plain(value, target.locale).trim()
  )
    return false;
  value[target.locale].reviewedCounterpart = {
    ...reference,
    spans: reference.spans.map((span) => ({ ...span })),
  };
  value[target.locale].needsReview = false;
  return true;
}

/**
 * Confirm both directions of exactly the displayed shared bilingual pair atomically.
 * @param doc Mutable workspace.
 * @param path Stable field path.
 * @param target Displayed target.
 * @param reference Displayed counterpart.
 * @returns {boolean} True when both displayed versions are confirmed; false without mutation if either is stale or either language is empty.
 * @example confirmTranslationPair(doc, "profile.summary", target, reference)
 */
export function confirmTranslationPair(
  doc: ResumeDocument,
  path: string,
  target: ReviewSnapshot,
  reference: ReviewSnapshot,
): boolean {
  const candidate = structuredClone(doc);
  if (
    !markTranslationReviewed(
      candidate,
      path,
      target,
      reference,
      reference.locale,
    ) ||
    !markTranslationReviewed(candidate, path, reference, target, target.locale)
  )
    return false;
  const value = findLocalized(doc, path)!;
  const checked = findLocalized(candidate, path)!;
  for (const locale of [target.locale, reference.locale]) {
    value[locale].needsReview = false;
    value[locale].reviewedCounterpart = checked[locale].reviewedCounterpart;
  }
  return true;
}

/**
 * Find a localized record inside a draft by its stable path.
 * @param doc Workspace.
 * @param path Field path.
 * @returns {LocalizedText | undefined} Matching record, or undefined after deletion.
 * @example findLocalized(doc, "profile.summary")
 */
export function findLocalized(
  doc: ResumeDocument,
  path: string,
): LocalizedText | undefined {
  return localizedFields(doc).find((field) => field.path === path)?.value;
}
