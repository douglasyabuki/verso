import { resolveLink } from "@/lib/content/links";
import { profileItemIncluded, selectedProfile } from "@/lib/content/profile";
import { escapeLatex } from "@/lib/output/encoding";
import { resolveSettings } from "@/lib/output/settings";
import { renderTemplate } from "@/lib/output/template";
import { templateIdentity } from "@/lib/resume/model";
import { validateOutput } from "@/lib/review/validation";
import { plain } from "@/lib/wording/localization";
import { effectiveWording } from "@/lib/wording/wording";
import type { Locale } from "@/types-and-constants/languages";
import type {
  Entry,
  LocalizedText,
  ResumeDocument,
  ResumeLink,
} from "@/types-and-constants/resume";

/**
 * Encode an already validated URL for hyperref.
 * @param value Safe-scheme URL.
 * @returns {string} Escaped URL.
 * @example latexUrl("https://example.com/a?q=100%25")
 */
function latexUrl(value: string): string {
  return value
    .replace(
      /[{}^~]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    .replace(/[%&#_]/g, (char) => "\\" + char);
}

/**
 * Allow long link labels to wrap at delimiters.
 * @param value Link label.
 * @returns {string} Escaped breakable text.
 * @example linkLabel("example.com/project")
 */
function linkLabel(value: string): string {
  return Array.from(value)
    .map(
      (char) =>
        escapeLatex(char) + (/[/@.?&=_-]/.test(char) ? "\\allowbreak{}" : ""),
    )
    .join("");
}

/**
 * Render a safe shared link.
 * @param link Validated link.
 * @param icons Whether to include its decorative icon.
 * @returns {string} Hyperref source, or empty text for an empty optional link.
 * @example renderLink(link)
 */
function renderLink(link: ResumeLink, icons = true): string {
  const resolved = resolveLink(link);
  if (!resolved.address.trim()) return "";
  const icon = {
    behance: "\\VersoBrand{F1B4}",
    dribbble: "\\VersoBrand{F17D}",
    github: "\\VersoBrand{F09B}",
    gitlab: "\\VersoBrand{F296}",
    "google-scholar": "\\VersoBrand{E63B}",
    instagram: "\\VersoBrand{F16D}",
    linkedin: "\\VersoBrand{F0E1}",
    medium: "\\VersoBrand{F23A}",
    tiktok: "\\VersoBrand{E07B}",
    "x-twitter": "\\VersoBrand{E61B}",
    youtube: "\\VersoBrand{F167}",
    website: "\\faLink",
  } satisfies Record<ResumeLink["type"], string>;
  return `${icons ? `{\\color{icnclr}${icon[resolved.type]}}~` : ""}\\href{${latexUrl(resolved.address)}}{${linkLabel(resolved.label)}}`;
}

/**
 * Render structured wording without interpreting source syntax.
 * @param value Localized content.
 * @param locale Language.
 * @param uppercase Whether to uppercase visible text while preserving link destinations.
 * @returns {string} Escaped text with emphasis and links.
 * @example renderText(title, "en-US")
 */
function renderText(
  value: LocalizedText,
  locale: Locale,
  uppercase = false,
): string {
  return value[locale].spans
    .map((span) => {
      const wording = uppercase
        ? span.text.toLocaleUpperCase(locale)
        : span.text;
      let text = span.href ? linkLabel(wording) : escapeLatex(wording);
      if (span.emphasis) text = `\\emph{${text}}`;
      if (span.href && text) text = `\\href{${latexUrl(span.href)}}{${text}}`;
      return text;
    })
    .join("");
}

/**
 * Format independent year/month facts.
 * @param value YYYY or YYYY-MM.
 * @param locale Output language.
 * @returns {string} Localized month/year, or an empty string.
 * @example displayDate("2023-03", "pt-BR")
 */
function displayDate(value: string, locale: Locale): string {
  if (!value || value.length === 4) return value;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value + "-01T12:00:00Z"));
}

/**
 * Format an ongoing or completed date range.
 * @param entry Shared facts.
 * @param locale Language.
 * @returns {string} Escaped start/end range using a localized present label for ongoing entries; an empty string when dates are absent and the entry is not ongoing.
 * @example dateRange(entry, "en-US")
 */
function dateRange(entry: Entry, locale: Locale): string {
  const end = entry.ongoing
    ? locale === "pt-BR"
      ? "Presente"
      : "Present"
    : displayDate(entry.end, locale);
  return escapeLatex(
    [displayDate(entry.start, locale), end].filter(Boolean).join(" - "),
  );
}

/**
 * Localize a shared city/country pair.
 * @param city City name.
 * @param country ISO country code or empty.
 * @param locale Language.
 * @returns {string} City and localized country joined for display; an empty string when both facts are absent.
 * @example displayLocation("Curitiba", "BR", "en-US")
 */
export function displayLocation(
  city: string,
  country: string,
  locale: Locale,
): string {
  let name = country;
  try {
    if (/^[A-Z]{2}$/.test(country))
      name =
        new Intl.DisplayNames([locale], { type: "region" }).of(country) ||
        country;
  } catch {
    /* Keep the supplied country code. */
  }
  return [city.trim(), name.trim()].filter(Boolean).join(", ");
}

/**
 * Produce deterministic LaTeX for one frozen language/variant.
 * @param doc Workspace snapshot.
 * @param variantId Selected variant ID.
 * @param locale Output language.
 * @returns {{ source: string; warnings: string[]; settings: TemplateSettings; assetManifest: { id: string; version: string; engine: string; bundle: string } }} source contains deterministic LaTeX; warnings lists nonblocking review messages; settings contains resolved layout values; assetManifest identifies the exact template and local engine/bundle. Throws for an unsupported template, missing variant, or invalid selected content.
 * @example renderLatex(doc, "general", "pt-BR")
 */
export function renderLatex(
  doc: ResumeDocument,
  variantId: string,
  locale: Locale,
) {
  if (
    doc.template.id !== templateIdentity.id ||
    doc.template.version !== templateIdentity.version
  )
    throw new Error("This document's exact template version is not bundled.");
  const variant = doc.variants.find((variant) => variant.id === variantId);
  if (!variant) throw new Error("Choose an available resume variant.");
  const validation = validateOutput(doc, variant, locale);
  if (validation.errors.length)
    throw new Error(validation.errors.map((issue) => issue.message).join(" "));
  const settings = resolveSettings(doc, variant, locale);
  const profile = selectedProfile(doc.profile, variant);
  const orderedContacts = variant.profileSelection.order.filter((item) => {
    if (!profileItemIncluded(item, variant)) return false;
    return item.kind === "field"
      ? !!profile[item.field].trim()
      : profile.links.some(
          (link) => link.id === item.linkId && link.url.trim(),
        );
  });
  const contacts: string[] = [];
  for (let index = 0; index < orderedContacts.length; index++) {
    const item = orderedContacts[index];
    if (item.kind === "link") {
      const link = profile.links.find((link) => link.id === item.linkId);
      if (link) contacts.push(renderLink(link, settings.contactIcons === "on"));
    } else if (item.field === "city" || item.field === "country") {
      const location = [
        item.field === "city"
          ? profile.city.trim()
          : displayLocation("", profile.country, locale),
      ];
      const next = orderedContacts[index + 1];
      if (
        next?.kind === "field" &&
        (next.field === "city" || next.field === "country") &&
        next.field !== item.field
      ) {
        location.push(
          next.field === "city"
            ? profile.city.trim()
            : displayLocation("", profile.country, locale),
        );
        index++;
      }
      contacts.push(
        `${settings.contactIcons === "on" ? "{\\color{icnclr}\\faMapMarker}~" : ""}${escapeLatex(location.join(", "))}`,
      );
    } else {
      const value = profile[item.field];
      const address =
        item.field === "email"
          ? `mailto:${value}`
          : `tel:${encodeURIComponent(value.replace(/[^+\d]/g, ""))}`;
      const icon =
        item.field === "email"
          ? "\\faEnvelope[regular]"
          : "\\faIcon{mobile-alt}";
      contacts.push(
        `${settings.contactIcons === "on" ? `{\\color{icnclr}${icon}}~` : ""}\\href{${latexUrl(address)}}{${linkLabel(value)}}`,
      );
    }
  }
  const defaultValue = "template-default";

  /**
   * Emit a dimension without approximating a template's elastic or relative value.
   * @param value Resolved numeric dimension or compatibility sentinel.
   * @param fallback Original TeX dimension or glue.
   * @param unit Unit for explicit numbers.
   * @returns {string} TeX dimension preserving the fallback verbatim for the sentinel.
   * @example dimension(settings.entryGap, "0.7em")
   */
  const dimension = (
    value: number | "template-default",
    fallback: string,
    unit = "pt",
  ) => (value === defaultValue ? fallback : `${value}${unit}`);

  /**
   * Render a section label with locale-aware visible casing.
   * @param value Bilingual section wording.
   * @returns {string} Escaped section text preserving link destinations.
   * @example sectionTitle(section.heading)
   */
  const sectionTitle = (value: LocalizedText) =>
    renderText(value, locale, settings.sectionCasing === "uppercase");
  const body: string[] = [];
  const summary = effectiveWording(
    doc.profile.summary,
    variant,
    "profile.summary",
  );
  if (plain(summary, locale).trim())
    body.push(
      `\\VersoHeading{\\section{${settings.sectionCasing === "uppercase" ? (locale === "pt-BR" ? "SOBRE MIM" : "ABOUT ME") : locale === "pt-BR" ? "Sobre mim" : "About me"}}}{0pt}\n${renderText(summary, locale)}`,
    );
  for (const selected of variant.sections.filter(
    (section) => section.visible,
  )) {
    const section = doc.sections.find(
      (section) => section.id === selected.sectionId,
    );
    if (!section) continue;
    const content: string[] = [];
    for (const selection of selected.entries) {
      const entry = section.entries.find(
        (entry) => entry.id === selection.entryId,
      );
      if (!entry || entry.archived) continue;
      const headingLines: string[] = [];
      if (!content.length)
        headingLines.push(`\\section{${sectionTitle(section.heading)}}`);
      const title = plain(entry.title, locale).trim()
        ? renderText(entry.title, locale)
        : "";
      const location = escapeLatex(
        displayLocation(entry.city, entry.country, locale),
      );
      const organization = escapeLatex(entry.organization.trim());
      const organizationFirst =
        section.kind === "experience" || section.kind === "education";
      const heading = organizationFirst ? organization || title : title;
      if (heading || location)
        headingLines.push(
          `\\subsection{${[heading, location].filter(Boolean).join(" \\hfill ")}}`,
        );
      const subtitle = organizationFirst
        ? organization
          ? title
          : ""
        : organization;
      const legacyDates = dateRange(entry, locale);
      const certification =
        section.kind === "certifications" ? entry.certification : undefined;
      const dates = section.kind === "certifications" ? "" : legacyDates;
      if (subtitle || dates)
        headingLines.push(
          `\\subsubsection{\\textcolor{roleclr}{${[subtitle, dates].filter(Boolean).join(" \\hfill ")}}}`,
        );
      if (content.length && settings.entryGap !== defaultValue)
        content.push(`\\par\\vspace{${settings.entryGap}pt}`);
      const detailStart = content.length;

      /**
       * Append an ordinary detail paragraph with spacing only between peers.
       * @param value Escaped paragraph content, empty to omit it.
       * @returns {void} Nothing; appends source to the current entry's content array.
       * @example detail(escapeLatex(entry.technologies.join(" · ")))
       */
      const detail = (value: string) => {
        if (!value) return;
        if (
          content.at(-1)?.startsWith("\\noindent") &&
          settings.paragraphGap !== defaultValue
        )
          content.push(`\\vspace{${settings.paragraphGap}pt}`);
        content.push(`\\noindent ${value}\\par`);
      };
      if (section.kind === "certifications") {
        if (certification?.dates) {
          const { issued, expiration } = certification.dates;
          detail(
            [
              issued
                ? `${locale === "pt-BR" ? "Emissão" : "Issued"}: ${escapeLatex(displayDate(issued, locale))}`
                : "",
              expiration.kind === "never"
                ? locale === "pt-BR"
                  ? "Sem expiração"
                  : "No expiration"
                : "",
              expiration.kind === "date"
                ? `${locale === "pt-BR" ? "Validade" : "Expires"}: ${escapeLatex(displayDate(expiration.date, locale))}`
                : "",
            ]
              .filter(Boolean)
              .join(" · "),
          );
        } else detail(legacyDates);
        if (certification?.credentialId.trim())
          detail(
            `${locale === "pt-BR" ? "ID da credencial" : "Credential ID"}: ${escapeLatex(certification.credentialId.trim())}`,
          );
        if (certification?.dates && legacyDates)
          detail(
            `${locale === "pt-BR" ? "Outras datas" : "Additional dates"}: ${legacyDates}`,
          );
      }
      const technologies = entry.technologies
        .map((value) => value.trim())
        .filter(Boolean);
      if (technologies.length) detail(escapeLatex(technologies.join(" · ")));
      const bullets = selection.bulletIds
        .map((id) => entry.bullets.find((bullet) => bullet.id === id))
        .flatMap((bullet) =>
          bullet
            ? [
                effectiveWording(
                  bullet.body,
                  variant,
                  `bullets.${bullet.id}.body`,
                ),
              ]
            : [],
        )
        .filter((body) => plain(body, locale).trim());
      if (bullets.length)
        content.push(
          `\\begin{achievements}[${content.length === detailStart && settings.beforeDetailsGap !== defaultValue ? "1" : "0"}]\n` +
            bullets
              .map((bullet) => "\\item " + renderText(bullet, locale))
              .join("\n") +
            "\n\\end{achievements}",
        );
      if (entry.links.some((link) => link.url.trim())) {
        const replaceLinkBoundary =
          content.length === detailStart &&
          settings.beforeDetailsGap !== defaultValue;
        content.push(
          (replaceLinkBoundary
            ? "\\begin{firstentrylinks}\n"
            : "\\begin{itemize}[label={},left=0pt]\n") +
            entry.links
              .filter((link) => link.url.trim())
              .map((link) => "\\item " + renderLink(link))
              .join("\n") +
            (replaceLinkBoundary
              ? "\n\\end{firstentrylinks}"
              : "\n\\end{itemize}"),
        );
      }
      const hasDetails = content.length > detailStart;
      const beforeDetails =
        hasDetails && settings.beforeDetailsGap !== defaultValue
          ? `\\par\\vspace{${settings.beforeDetailsGap}pt}\n`
          : "";
      const firstIsList = content[detailStart]?.startsWith("\\begin{");
      const firstIsAchievements = content[detailStart]?.startsWith(
        "\\begin{achievements}",
      );
      const listStartGap = firstIsAchievements
        ? settings.listAbove !== defaultValue
          ? `${settings.listAbove}pt`
          : settings.beforeDetailsGap !== defaultValue
            ? "0pt"
            : "\\topsep+\\partopsep"
        : firstIsList && settings.beforeDetailsGap === defaultValue
          ? "\\topsep+\\partopsep"
          : "0pt";
      const initialGap = hasDetails
        ? `${dimension(settings.beforeDetailsGap, "0pt")}+${listStartGap}`
        : "0pt";
      content.splice(
        detailStart,
        0,
        `\\VersoHeading{${headingLines.join("\n")}}{${initialGap}}\n${beforeDetails}`,
      );
      if (settings.entryGap === defaultValue)
        content.push("\\par\\vspace{0.7em}");
    }
    if (content.length) body.push(content.join("\n"));
  }
  const source = renderTemplate({ settings, name: doc.profile.name, resumeName: variant.name, revision: doc.revision, locale, languageNumber: locale === "pt-BR" ? 1 : 0, pageLabel: locale === "pt-BR" ? "P\u00e1gina" : "Page", ofLabel: locale === "pt-BR" ? "de" : "of", contacts, body });
  return {
    source,
    warnings: validation.warnings.map((issue) => issue.message),
    settings,
    assetManifest: {
      ...templateIdentity,
      engine: "SwiftLaTeX v20022022",
      bundle: "/compiler/resources.bundle",
    },
  };
}
