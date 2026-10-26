import { z } from "zod";

import { certificationDateErrors } from "@/lib/resume/certification";
import { outputIssue } from "@/lib/resume/issues";
import { plain } from "@/lib/resume/localization";
import {
  effectiveWording,
  sharedWording,
  sharedWordingChanged,
  variantWording,
} from "@/lib/resume/wording";
import type { Locale } from "@/types-and-constants/languages";
import { languageNames } from "@/types-and-constants/languages";
import type {
  Entry,
  LocalizedText,
  ResumeDocument,
  ResumeLink,
  Variant,
} from "@/types-and-constants/resume";
import type { Issue } from "@/types-and-constants/review";
import { entryTerminology } from "@/types-and-constants/sections";

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

/** Validate each shared date field using the original supported ranges and ordering.
 * @param entry Draft entry.
 * @returns Field errors; an end date ordering error is attached to the end field.
 * @example dateErrors(entry)
 */
export function dateErrors(entry: Entry): { start?: string; end?: string } {
  const pattern = /^(19|20|21|22)\d{2}(-(0[1-9]|1[0-2]))?$/;
  const errors: { start?: string; end?: string } = {};
  for (const field of ["start", "end"] as const)
    if (entry[field] && !pattern.test(entry[field]))
      errors[field] = "Use YYYY or YYYY-MM, between 1900 and 2299.";
  if (
    !errors.start &&
    !errors.end &&
    !entry.ongoing &&
    entry.start &&
    entry.end
  ) {
    const end = entry.end.length === 4 ? entry.end + "-12" : entry.end;
    const start = entry.start.length === 4 ? entry.start + "-01" : entry.start;
    if (start > end)
      errors.end = "End date must be on or after the start date.";
  }
  return errors;
}

/** Validate shared date facts. @param entry Draft entry. @returns The first error or undefined. @example dateError(entry) */
export function dateError(entry: Entry): string | undefined {
  const errors = dateErrors(entry);
  return errors.start ?? errors.end;
}

/** Validate only the selected output; counterpart translations never block it. @param doc Workspace. @param variant Variant. @param locale Language. @returns Blocking issues and nonblocking review warnings. @example validateOutput(doc, variant, "en-US") */
export function validateOutput(
  doc: ResumeDocument,
  variant: Variant,
  locale: Locale,
): { errors: Issue[]; warnings: Issue[] } {
  const errors: Pick<Issue, "path" | "message">[] = [];
  const warnings: Pick<Issue, "path" | "message">[] = [];
  const sharedWarnings: Pick<Issue, "path" | "message">[] = [];
  const required = (value: LocalizedText, path: string, label: string) => {
    if (!plain(value, locale).trim())
      errors.push({
        path,
        message: `${label} is missing in ${locale}. Add wording for this language or remove the unfinished content from this resume.`,
      });
  };
  const wording = (value: LocalizedText, path: string) => {
    const shared = sharedWording(doc, path);
    if (shared && sharedWordingChanged(shared, variant, path, locale))
      sharedWarnings.push({
        path,
        message:
          "Library wording changed beneath this customization. Compare it, then explicitly keep the customization or reset to library wording. Editing alone does not clear this reminder. Draft downloads remain available.",
      });
    if (value[locale].needsReview && plain(value, locale).trim())
      warnings.push({
        path,
        message: `Check whether ${languageNames[locale]} still conveys the same information as ${languageNames[locale === "en-US" ? "pt-BR" : "en-US"]}, then confirm that comparison or explicitly confirm both languages. Draft downloads remain available.`,
      });
    for (const span of value[locale].spans) {
      const error = urlError(span.href);
      if (error)
        errors.push({
          path,
          message: `${error} Select the linked text to edit or remove its link.`,
        });
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
  const summary = effectiveWording(
    doc.profile.summary,
    variant,
    "profile.summary",
  );
  if (plain(summary, locale).trim()) wording(summary, "profile.summary");
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
      required(
        entry.title,
        `entries.${entry.id}.title`,
        entryTerminology[section.kind].title,
      );
      const dates =
        section.kind === "certifications"
          ? entry.certification?.dates
          : undefined;
      if (dates) {
        const issues = certificationDateErrors(
          dates.issued,
          dates.expiration.kind,
          dates.expiration.kind === "date" ? dates.expiration.date : "",
        );
        for (const [field, message] of Object.entries(issues))
          errors.push({
            path: `entries.${entry.id}.certification.${field}`,
            message,
          });
      }
      wording(entry.title, `entries.${entry.id}.title`);
      for (const [field, message] of Object.entries(dateErrors(entry)))
        errors.push({ path: `entries.${entry.id}.${field}`, message });
      links(entry.links, `entries.${entry.id}.links`);
      for (const bulletId of selection.bulletIds) {
        const bullet = entry.bullets.find((bullet) => bullet.id === bulletId);
        if (!bullet) continue;
        const body = effectiveWording(
          bullet.body,
          variant,
          `bullets.${bullet.id}.body`,
        );
        required(
          body,
          `bullets.${bullet.id}.body`,
          `Selected ${entryTerminology[section.kind].item.toLowerCase()}`,
        );
        wording(body, `bullets.${bullet.id}.body`);
      }
    }
  }
  const describe = (
    values: Pick<Issue, "path" | "message">[],
    category: "error" | "translation" | "shared-wording",
  ) =>
    Array.from(
      new Map(
        values.map((issue) => {
          const described = outputIssue(
            doc,
            locale,
            issue.path,
            issue.message,
            category,
          );
          if (
            variantWording(variant, issue.path) &&
            sharedWording(doc, issue.path)
          ) {
            described.target = {
              ...described.target!,
              variantId: variant.id,
              scope: "variant",
              wordingPath: issue.path,
              fieldKey: `variants.${variant.id}.${issue.path}.${locale}`,
            };
            described.id = `${variant.id}:${described.id}`;
          }
          return [described.id, described];
        }),
      ).values(),
    );
  return {
    errors: describe(errors, "error"),
    warnings: [
      ...describe(warnings, "translation"),
      ...describe(sharedWarnings, "shared-wording"),
    ],
  };
}
