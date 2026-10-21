import { z } from "zod";

import { plain } from "@/lib/resume/localization";
import type {
  Entry,
  Issue,
  Locale,
  LocalizedText,
  ResumeDocument,
  ResumeLink,
  Variant,
} from "@/types-and-constants/resume";

/** Validate supported clickable links. @param value URL. @returns An error or undefined, including for an empty optional value. @example urlError("javascript:alert(1)") */
export function urlError(value: string): string | undefined {
  if (!value) return;
  if (/[\u0000-\u0020\\]/.test(value))
    return "Use a URL without spaces, control characters, or backslashes.";
  try {
    const url = new URL(value);
    if (!["https:", "http:", "mailto:", "tel:"].includes(url.protocol))
      return "Use https, http, mailto, or tel links.";
    if (
      (url.protocol === "mailto:" || url.protocol === "tel:") &&
      !url.pathname
    )
      return "Add an email address or phone number.";
    if (url.username || url.password)
      return "Links cannot contain credentials.";
  } catch {
    return "Enter a complete URL, including its scheme.";
  }
}

/** Validate language-independent date facts. @param entry Draft entry. @returns An error or undefined. @example dateError(entry) */
export function dateError(entry: Entry): string | undefined {
  const pattern = /^(19|20|21|22)\d{2}(-(0[1-9]|1[0-2]))?$/;
  if ([entry.start, entry.end].some((value) => value && !pattern.test(value)))
    return "Use YYYY or YYYY-MM, between 1900 and 2299.";
  if (!entry.ongoing && entry.start && entry.end) {
    const end = entry.end.length === 4 ? entry.end + "-12" : entry.end;
    const start = entry.start.length === 4 ? entry.start + "-01" : entry.start;
    if (start > end) return "End date must be on or after the start date.";
  }
}

/** Validate only the selected output; counterpart translations never block it. @param doc Workspace. @param variant Variant. @param locale Language. @returns Blocking issues and nonblocking review warnings. @example validateOutput(doc, variant, "en-US") */
export function validateOutput(
  doc: ResumeDocument,
  variant: Variant,
  locale: Locale,
): { errors: Issue[]; warnings: string[] } {
  const errors: Issue[] = [];
  const warnings: string[] = [];
  const required = (value: LocalizedText, path: string, label: string) => {
    if (!plain(value, locale).trim())
      errors.push({ path, message: `${label} is missing in ${locale}.` });
  };
  const wording = (value: LocalizedText, path: string) => {
    if (value[locale].needsReview && plain(value, locale).trim())
      warnings.push(`${path} needs translation review.`);
    for (const span of value[locale].spans) {
      const error = urlError(span.href);
      if (error) errors.push({ path, message: error });
    }
  };
  const links = (values: ResumeLink[], path: string) =>
    values.forEach((link) => {
      const error = urlError(link.url);
      if (error) errors.push({ path: `${path}.${link.id}`, message: error });
    });
  if (!doc.profile.name.trim())
    errors.push({
      path: "profile.name",
      message: "Add your name to generate a PDF.",
    });
  if (doc.profile.email && !z.email().safeParse(doc.profile.email).success)
    errors.push({
      path: "profile.email",
      message: "Enter a valid email address.",
    });
  if (doc.profile.phone && !/\d/.test(doc.profile.phone))
    errors.push({
      path: "profile.phone",
      message: "Include a phone number with digits.",
    });
  if (doc.profile.country && !/^[A-Z]{2}$/.test(doc.profile.country))
    errors.push({
      path: "profile.country",
      message: "Use a two-letter country code, for example BR.",
    });
  wording(doc.profile.summary, "profile.summary");
  links(doc.profile.links, "profile.links");
  for (const selected of variant.sections.filter(
    (section) => section.visible,
  )) {
    const section = doc.sections.find(
      (section) => section.id === selected.sectionId,
    );
    if (!section) continue;
    const entries = selected.entries
      .map((selection) => ({
        selection,
        entry: section.entries.find((entry) => entry.id === selection.entryId),
      }))
      .filter((item) => item.entry && !item.entry.archived);
    if (!entries.length) continue;
    required(
      section.heading,
      `sections.${section.id}.heading`,
      "Section heading",
    );
    wording(section.heading, `sections.${section.id}.heading`);
    for (const { selection, entry } of entries) {
      if (!entry) continue;
      if (entry.country && !/^[A-Z]{2}$/.test(entry.country))
        errors.push({
          path: `entries.${entry.id}.country`,
          message: "Use a two-letter country code, for example BR.",
        });
      required(entry.title, `entries.${entry.id}.title`, "Entry title");
      wording(entry.title, `entries.${entry.id}.title`);
      const date = dateError(entry);
      if (date)
        errors.push({ path: `entries.${entry.id}.dates`, message: date });
      links(entry.links, `entries.${entry.id}.links`);
      for (const bulletId of selection.bulletIds) {
        const bullet = entry.bullets.find((bullet) => bullet.id === bulletId);
        if (!bullet) continue;
        required(
          bullet.body,
          `bullets.${bullet.id}.body`,
          "Selected achievement",
        );
        wording(bullet.body, `bullets.${bullet.id}.body`);
      }
    }
  }
  return { errors, warnings };
}
