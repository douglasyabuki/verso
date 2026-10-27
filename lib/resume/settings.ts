import { settingsSchema } from "@/lib/resume/model";
import type { Locale } from "@/types-and-constants/languages";
import type {
  numericLayoutControls,
  TemplateSettings,
} from "@/types-and-constants/output";
import type { ResumeDocument, Variant } from "@/types-and-constants/resume";

/** Resolve supported settings in increasing specificity. @param doc Workspace. @param variant Variant. @param locale Language. @returns Validated base, locale, variant, then variant-locale settings combined; throws for unsupported resolved settings. @example resolveSettings(doc, variant, "pt-BR") */
export function resolveSettings(
  doc: ResumeDocument,
  variant: Variant,
  locale: Locale,
): TemplateSettings {
  return settingsSchema.parse({
    ...doc.settings,
    ...doc.localeSettings[locale],
    ...variant.settings,
    ...variant.localeSettings[locale],
  });
}

/** Resolve the numeric value displayed for a layout control without replacing its template-default setting.
 * @param settings Settings resolved for the edited scope, including the current body size.
 * @param key Numeric layout control to display.
 * @returns The explicit value or template's fixed/nominal value in the control's units; undefined for content-dependent spacing. Font-relative millimeters are rounded to four decimals.
 * @example numericLayoutValue(settings, "entryTitleSize") // Current body size when using the template default.
 */
export function numericLayoutValue(
  settings: TemplateSettings,
  key: (typeof numericLayoutControls)[number]["key"],
): number | undefined {
  const value = settings[key];
  if (value !== "template-default") return value;

  // Mirror the bundled template in render.ts. Elastic/context-dependent gaps
  // deliberately have no single numeric value and remain automatic in the UI.
  switch (key) {
    case "nameSize":
      return 20;
    case "nameContactGap":
      return 8;
    case "sectionSize":
      return 12;
    case "sectionBelow":
      return 2;
    case "dividerThickness":
      return 1;
    case "entryTitleSize":
    case "entrySubtitleSize":
      return settings.fontSize;
    case "headingSubtitleGap":
    case "paragraphGap":
    case "bulletGap":
      return 0;
    case "entryGap":
      return Number((settings.fontSize * 0.7).toFixed(4));
    case "bulletIndent":
    case "bulletTextGap":
      return Number(
        (
          (settings.fontSize * (key === "bulletIndent" ? 2 : 0.5) * 25.4) /
          72.27
        ).toFixed(4),
      );
    default:
      return undefined;
  }
}
