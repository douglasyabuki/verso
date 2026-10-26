import type { Locale } from "@/types-and-constants/languages";
import type { TemplateSettings } from "@/types-and-constants/output";
import type { ResumeDocument, Variant } from "@/types-and-constants/resume";

/** Resolve supported settings in increasing specificity. @param doc Workspace. @param variant Variant. @param locale Language. @returns Base, locale, variant, then variant-locale settings combined. @example resolveSettings(doc, variant, "pt-BR") */
export function resolveSettings(
  doc: ResumeDocument,
  variant: Variant,
  locale: Locale,
): TemplateSettings {
  return {
    ...doc.settings,
    ...doc.localeSettings[locale],
    ...variant.settings,
    ...variant.localeSettings[locale],
  };
}
