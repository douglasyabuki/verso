import { entryLabel } from "@/lib/resume/section-fields";
import { equivalentSpans, normalizeSpans } from "@/lib/resume/spans";
import type {
  Locale,
  LocalizedFieldDescriptor,
  LocalizedText,
  ResumeDocument,
  ReviewSnapshot,
  Span,
  Variant,
} from "@/types-and-constants/resume";
import { entryTerminology } from "@/types-and-constants/resume";

/** Create separate language records. @param en English text. @param pt Portuguese text. @returns Localized content. @example localized("Projects", "Projetos") */
export function localized(en = "", pt = ""): LocalizedText {
  const make = (value: string) => ({
    spans: [{ text: value, emphasis: false, href: "" }],
    revision: 0,
    needsReview: false,
    reviewedCounterpart: null,
  });
  return { "en-US": make(en), "pt-BR": make(pt) };
}

/** Read plain wording without formatting. @param value Localized record. @param locale Language. @returns Joined text. @example plain(entry.title, "en-US") */
export function plain(value: LocalizedText, locale: Locale): string {
  return value[locale].spans.map((span) => span.text).join("");
}

/** Update one language and flag an existing counterpart. @param value Mutable draft record. @param locale Changed language. @param spans Structured text. @returns Nothing. @example editTranslation(title, "en-US", spans) */
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

/** List localized fields in library or active-output order, preserving identifier-based associations.
 * @param doc Workspace. @param variant Optional variant to restrict fields to its actual output.
 * @returns Field descriptors with source context and requiredness; summary is always optional.
 * @example localizedFields(doc, doc.variants[0])
 */
export function localizedFields(
  doc: ResumeDocument,
  variant?: Variant,
): LocalizedFieldDescriptor[] {
  const fields: LocalizedFieldDescriptor[] = [
    {
      path: "profile.summary",
      label: "Summary",
      source: "Profile",
      sectionId: "profile",
      value: doc.profile.summary,
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
          path: `bullets.${bullet.id}.body`,
          label: entryTerminology[section.kind].item,
          source,
          sectionId: section.id,
          value: bullet.body,
          multiline: section.kind !== "skills",
          required: true,
        });
    }
  }
  return fields;
}

/** Classify target wording for filtering and navigation without turning optional omissions into errors.
 * @param field Localized field descriptor. @param locale Target language.
 * @returns Independent missing/review flags and their unresolved union.
 * @example translationStatus(field, "pt-BR").unresolved
 */
export function translationStatus(
  field: LocalizedFieldDescriptor,
  locale: Locale,
) {
  const populated = !!plain(field.value, locale).trim();
  const missing = field.required && !populated;
  const review = populated && field.value[locale].needsReview;
  return { missing, review, unresolved: missing || review };
}

/** Capture the explicitly selected language as an immutable review version.
 * @param value Bilingual wording. @param locale Selected reference or target language.
 * @returns An independent locale, revision, and spans snapshot.
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

/** Acknowledge only the exact target and selected reference displayed to the reviewer.
 * @param doc Mutable workspace draft. @param path Stable localized field path.
 * @param target Displayed target version. @param reference Displayed reference version.
 * @param referenceLocale Currently selected reference locale, which must still match the displayed snapshot.
 * @returns Whether review was accepted; rejected calls leave the draft unchanged.
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

/** Find a localized record inside a draft by its stable path. @param doc Workspace. @param path Field path. @returns Matching record, or undefined after deletion. @example findLocalized(doc, "profile.summary") */
export function findLocalized(
  doc: ResumeDocument,
  path: string,
): LocalizedText | undefined {
  return localizedFields(doc).find((field) => field.path === path)?.value;
}
