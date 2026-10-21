import { equivalentSpans, normalizeSpans } from "@/lib/resume/spans";
import type {
  Locale,
  LocalizedText,
  ResumeDocument,
  Span,
} from "@/types-and-constants/resume";

/** Create separate language records. @param en English text. @param pt Portuguese text. @returns Localized content. @example localized("Projects", "Projetos") */
export function localized(en = "", pt = ""): LocalizedText {
  const make = (value: string) => ({
    spans: [{ text: value, emphasis: false, href: "" }],
    revision: 0,
    needsReview: false,
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

/** List all localized records for review tools. @param doc Workspace. @returns Labeled records with stable paths. @example localizedFields(doc) */
export function localizedFields(
  doc: ResumeDocument,
): { path: string; label: string; value: LocalizedText }[] {
  const fields = [
    {
      path: "profile.summary",
      label: "Profile · Summary",
      value: doc.profile.summary,
    },
  ];
  for (const section of doc.sections) {
    const name = plain(section.heading, "en-US") || "Untitled section";
    fields.push({
      path: `sections.${section.id}.heading`,
      label: `${name} · Heading`,
      value: section.heading,
    });
    for (const entry of section.entries) {
      fields.push({
        path: `entries.${entry.id}.title`,
        label: `${name} · ${entry.organization || "Untitled entry"}`,
        value: entry.title,
      });
      for (const bullet of entry.bullets)
        fields.push({
          path: `bullets.${bullet.id}.body`,
          label: `${entry.organization || name} · Achievement`,
          value: bullet.body,
        });
    }
  }
  return fields;
}

/** Find a localized record inside a draft by its stable path. @param doc Workspace. @param path Field path. @returns Matching record, or undefined after deletion. @example findLocalized(doc, "profile.summary") */
export function findLocalized(
  doc: ResumeDocument,
  path: string,
): LocalizedText | undefined {
  return localizedFields(doc).find((field) => field.path === path)?.value;
}
