import { resolveSettings } from "@/lib/output/settings";
import { templateIdentity } from "@/lib/resume/model";
import { validateOutput } from "@/lib/review/validation";
import { plain } from "@/lib/wording/localization";
import { effectiveWording } from "@/lib/wording/wording";
import type { Locale } from "@/types-and-constants/languages";
import { pdfColorPresets } from "@/types-and-constants/output";
import type {
  Entry,
  LocalizedText,
  ResumeDocument,
  ResumeLink,
} from "@/types-and-constants/resume";

const special: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  $: "\\$",
  "&": "\\&",
  "#": "\\#",
  "%": "\\%",
  _: "\\_",
  "^": "\\textasciicircum{}",
  "~": "\\textasciitilde{}",
};

/**
 * Encode text for a nonexecutable LaTeX context.
 * @param value User wording.
 * @returns {string} Escaped text with normalized whitespace.
 * @example escapeLatex("R&D: 100%")
 */
export function escapeLatex(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\\{}$&#%_^~]/g, (char) => special[char]);
}

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
  if (!link.url.trim()) return "";
  const icon = /^mailto:/i.test(link.url)
    ? "\\faEnvelope[regular]"
    : /^tel:/i.test(link.url)
      ? "\\faIcon{mobile-alt}"
      : /^https?:\/\/(www\.)?github\.com(?:\/|$)/i.test(link.url)
        ? "\\faGithub"
        : /^https?:\/\/(www\.)?linkedin\.com(?:\/|$)/i.test(link.url)
          ? "\\faLinkedinIn"
          : "\\faLink";
  return `${icons ? `{\\color{icnclr}${icon}}~` : ""}\\href{${latexUrl(link.url)}}{${linkLabel(link.label.trim() || link.url)}}`;
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
  const headingHex = pdfColorPresets[settings.headingColor].hex;
  const bodyHex = pdfColorPresets[settings.bodyColor].hex;
  const contacts = [
    doc.profile.city || doc.profile.country
      ? `${settings.contactIcons === "on" ? "{\\color{icnclr}\\faMapMarker}~" : ""}${escapeLatex(displayLocation(doc.profile.city, doc.profile.country, locale))}`
      : "",
    doc.profile.email
      ? renderLink(
          {
            id: "email",
            label: doc.profile.email,
            url: `mailto:${doc.profile.email}`,
          },
          settings.contactIcons === "on",
        )
      : "",
    doc.profile.phone
      ? renderLink(
          {
            id: "phone",
            label: doc.profile.phone,
            url: `tel:${encodeURIComponent(doc.profile.phone.replace(/[^+\d]/g, ""))}`,
          },
          settings.contactIcons === "on",
        )
      : "",
    ...doc.profile.links.map((link) =>
      renderLink(link, settings.contactIcons === "on"),
    ),
  ].filter(Boolean);
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
   * Apply resolved size and its derived baseline to a whole heading paragraph.
   * @param value Resolved point size or compatibility sentinel.
   * @param fallback Original typography commands.
   * @param ratio Baseline multiplier for explicit sizes.
   * @returns {string} TeX typography with a three-decimal baseline, or original commands.
   * @example typography(settings.nameSize, "\\fontsize{20}{22}\\selectfont", 1.1)
   */
  const typography = (
    value: number | "template-default",
    fallback: string,
    ratio: number,
  ) =>
    value === defaultValue
      ? fallback
      : `\\fontsize{${value}}{${(value * ratio).toFixed(3)}}\\selectfont`;

  /**
   * Select an actual bundled font face.
   * @param value Resolved weight.
   * @returns {string} TeX command for regular, bold or the family's explicit black face.
   * @example weight(settings.nameWeight)
   */
  const weight = (value: "regular" | "bold" | "black") =>
    value === "regular"
      ? "\\mdseries"
      : value === "bold"
        ? "\\bfseries"
        : "\\versoblack";

  /**
   * Define a role color after resolving all scopes.
   * @param role Setting containing the preset.
   * @param name TeX color name to define.
   * @param fallback Dependent template color used by the sentinel.
   * @returns {string} A color definition or alias preserving template dependencies.
   * @example color("linkColor", "linkclr", "headingclr")
   */
  const color = (
    role: "secondaryColor" | "linkColor" | "iconColor" | "dividerColor",
    name: string,
    fallback: string,
  ) => {
    const hex = pdfColorPresets[settings[role]].hex;
    return hex
      ? `\\definecolor{${name}}{HTML}{${hex.slice(1)}}`
      : `\\colorlet{${name}}{${fallback}}`;
  };

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
  const fontPrefix =
    settings.fontFamily === "source-sans-3" ? "SourceSans3" : "SourceSerif4";
  const fontSetup =
    settings.fontFamily === "inter"
      ? String.raw`\usepackage{inter}
\renewcommand*\familydefault{\sfdefault}
\newcommand{\versoblack}{\interheavy}`
      : String.raw`\usepackage{fontspec}
\setmainfont{${fontPrefix}-Regular.otf}[BoldFont=${fontPrefix}-Bold.otf,ItalicFont=${fontPrefix}-Italic.otf,BoldItalicFont=${fontPrefix}-BoldItalic.otf]
\newfontfamily\versoblack{${fontPrefix}-Black.otf}[ItalicFont=${fontPrefix}-BlackItalic.otf,BoldFont=${fontPrefix}-Black.otf,BoldItalicFont=${fontPrefix}-BlackItalic.otf]`;
  // Use the bundled text icon face: math-mode circles initialize unbundled
  // Latin Modern math fonts, even when only measuring the marker width.
  const hollowBullet =
    "{\\raisebox{0.15ex}{\\fontsize{5}{5}\\selectfont\\faCircle[regular]}}";
  const achievementOptions = [
    "noitemsep",
    "left=2em",
    settings.bulletIndent === defaultValue &&
    settings.bulletTextGap === defaultValue
      ? ""
      : `labelindent=${dimension(settings.bulletIndent, "2em", "mm")},labelwidth=\\widthof{${settings.bulletMarker === "dash" ? "--" : settings.bulletMarker === "hollow-circle" ? hollowBullet : "\\textbullet"}},labelsep=${dimension(settings.bulletTextGap, "0.5em", "mm")},leftmargin=!`,
    settings.bulletMarker === "disc"
      ? ""
      : `label=${settings.bulletMarker === "dash" ? "--" : hollowBullet}`,
    settings.bulletGap === defaultValue
      ? ""
      : `itemsep=${settings.bulletGap}pt`,
  ]
    .filter(Boolean)
    .join(",");
  const customListBoundaries =
    settings.listAbove !== defaultValue ||
    settings.listBelow !== defaultValue ||
    settings.beforeDetailsGap !== defaultValue;
  const listEnvironment = customListBoundaries
    ? String.raw`\makeatletter
\newskip\VersoListGap
\newenvironment{achievements}[1][0]{\begingroup
  \@listi
  \VersoListGap=\topsep \advance\VersoListGap by \partopsep
  \begin{itemize}[${achievementOptions},topsep=0pt,partopsep=0pt,before={\ifnum#1=1 ${settings.listAbove === defaultValue ? "" : `\\vspace{${settings.listAbove}pt}`}\else\vspace{${dimension(settings.listAbove, "\\VersoListGap")}}\fi},after={\vspace{${dimension(settings.listBelow, "\\VersoListGap")}}}]
}{\end{itemize}\endgroup}
\makeatother`
    : String.raw`\newenvironment{achievements}[1][0]{\begin{itemize}[${achievementOptions}]}{\end{itemize}}`;
  const source = String.raw`% Adapted from the owner's Overleaf resume and Rover Resume by Subidit.
% https://www.overleaf.com/latex/templates/rover-resume/bpzqtssvfgsn
% CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
% Changes: browser XeTeX compatibility, structured bilingual rendering, and bounded layout settings.
\documentclass[11pt]{article}
\usepackage[T1]{fontenc}
${fontSetup}
\usepackage{geometry}
\geometry{${settings.pageSize === "a4" ? "a4paper" : "letterpaper"},top=${settings.marginTop}mm,bottom=${settings.marginBottom}mm,left=${settings.marginLeft}mm,right=${settings.marginRight}mm}
\setcounter{secnumdepth}{0}
\usepackage{enumitem}
\setlist[itemize]{noitemsep,left=2em}
\usepackage{calc}
${listEnvironment}
${
  settings.beforeDetailsGap !== defaultValue
    ? String.raw`\makeatletter
\newskip\VersoLinkGap
\newenvironment{firstentrylinks}{\begingroup
  \@listi
  \VersoLinkGap=\topsep \advance\VersoLinkGap by \partopsep
  \begin{itemize}[label={},left=0pt,topsep=0pt,partopsep=0pt,after={\vspace{\VersoLinkGap}}]
}{\end{itemize}\endgroup}
\makeatother`
    : ""
}

\usepackage[xetex,dvipsnames]{xcolor}
\definecolor{customgray}{gray}{0.25}
${headingHex ? `\\definecolor{headingclr}{HTML}{${headingHex.slice(1)}}` : "\\colorlet{headingclr}{Sepia}"}
${bodyHex ? `\\definecolor{bodyclr}{HTML}{${bodyHex.slice(1)}}` : "\\colorlet{bodyclr}{black}"}
${color("secondaryColor", "roleclr", bodyHex ? "bodyclr" : "customgray")}
${color("iconColor", "icnclr", bodyHex ? "bodyclr" : "gray")}
${color("linkColor", "linkclr", "headingclr")}
${color("dividerColor", "dividerclr", "gray")}
\usepackage{fontawesome5}
\usepackage{titlesec}
\usepackage{needspace}
\titlespacing{\section}{0pt}{${settings.sectionGap}mm}{${dimension(settings.sectionBelow, "2mm", "mm")}}
\titlespacing{\subsection}{0pt}{0pt}{0pt}
\titlespacing{\subsubsection}{0pt}{${dimension(settings.headingSubtitleGap, "0pt")}}{0pt}
\titleformat{\section}{\color{headingclr}${typography(settings.sectionSize, "\\large", 7 / 6)}${weight(settings.sectionWeight)}\interlinepenalty=0\emergencystretch=\linewidth}{}{}{\ruleafter}[\global\RemVStrue]
\titleformat{\subsection}{${typography(settings.entryTitleSize, "", 1.2)}${weight(settings.entryTitleWeight)}\interlinepenalty=0\emergencystretch=\linewidth}{}{}{\rvs}
\titleformat{\subsubsection}{\color{roleclr}${typography(settings.entrySubtitleSize, "", 1.2)}${weight(settings.entrySubtitleWeight)}\interlinepenalty=0\emergencystretch=\linewidth}{}{}{}
\usepackage{xhfill}
\newcommand\ruleafter[1]{#1${settings.sectionDivider === "on" ? `~\\xrfill[.5ex]{${dimension(settings.dividerThickness, "1pt")}}[dividerclr]` : ""}}
\newif\ifRemVS
\newcommand{\rvs}{${settings.sectionBelow === defaultValue && settings.headingSubtitleGap === defaultValue && settings.sectionSize === defaultValue && settings.entryTitleSize === defaultValue ? "\\ifRemVS\\vspace{-1.5ex}\\fi" : ""}\global\RemVSfalse}
\usepackage[bookmarks=true,bookmarksdepth=1]{hyperref}
\hypersetup{colorlinks=true,urlcolor=linkclr,pdftitle={${escapeLatex(doc.profile.name + " · " + variant.name)}},pdfauthor={${escapeLatex(doc.profile.name)}},pdflang={${locale}},pdfsubject={Verso revision ${doc.revision}; ${templateIdentity.id}@${templateIdentity.version}}}
\usepackage{fancyhdr}
\pagestyle{fancy}
\renewcommand{\headrulewidth}{0pt}
\fancyhf{}
\setlength{\footskip}{5mm}
${
  settings.pageNumbering === "shown"
    ? String.raw`\pagestyle{empty}
\makeatletter
\def\@oddfoot{\normalfont\fontsize{9}{10.8}\selectfont\color{roleclr}${settings.pageNumberAlignment !== "left" ? "\\hfil{}" : ""}${locale === "pt-BR" ? "Página" : "Page"} {\thepage}${settings.pageNumberFormat === "page-x-of-y" ? ` ${locale === "pt-BR" ? "de" : "of"} {\\VersoTotalPages}` : ""}${settings.pageNumberAlignment !== "right" ? "\\hfil" : ""}}
\let\@evenfoot\@oddfoot
\makeatother`
    : ""
}
\providecommand{\VersoTotalPages}{1}
\makeatletter
\AtEndDocument{\immediate\write\@auxout{\string\gdef\string\VersoTotalPages{\thepage}}}
\makeatother

% Measure without global counters, marks or writes, then typeset in the normal page list.
% Oversized blocks bypass Needspace and retain legal interline breakpoints.
\newbox\VersoHeadingBox
\newdimen\VersoHeadingHeight
\makeatletter
\newcommand{\VersoHeading}[2]{\par
  \let\VersoSavedNoBreak\if@nobreak
  \let\VersoSavedRemVS\ifRemVS
  \setbox\VersoHeadingBox=\vbox{\hsize=\linewidth
    \let\addcontentsline\@gobblethree
    \let\protected@write\@gobblethree
    \begin{NoHyper}\hrule height0pt #1\par\end{NoHyper}}
  \global\let\if@nobreak\VersoSavedNoBreak
  \global\let\ifRemVS\VersoSavedRemVS
  \VersoHeadingHeight=\dimexpr\ht\VersoHeadingBox+\dp\VersoHeadingBox+#2+\baselineskip\relax
  \ifdim\VersoHeadingHeight<\textheight
    \Needspace{\VersoHeadingHeight}
  \fi
  #1
}
\makeatother
\renewcommand{\normalsize}{\fontsize{${settings.fontSize}}{${(settings.fontSize * settings.lineHeight).toFixed(3)}}\selectfont}
\begin{document}
\language=${locale === "pt-BR" ? 1 : 0}
\normalsize
\color{bodyclr}
${settings.headerGap === defaultValue ? `\\begin{${settings.headerAlignment === "center" ? "center" : "flushleft"}}` : `\\par\\begingroup${settings.headerAlignment === "center" ? "\\centering" : "\\raggedright"}`}
{${typography(settings.nameSize, "\\fontsize{20}{22}\\selectfont", 1.1)}${weight(settings.nameWeight)} ${escapeLatex(doc.profile.name)}\par}
\vspace{${dimension(settings.nameContactGap, "8pt")}}
${contacts.join(" \\quad ")}\par
${settings.headerGap === defaultValue ? `\\end{${settings.headerAlignment === "center" ? "center" : "flushleft"}}` : `\\endgroup\\vspace{${settings.headerGap}pt}`}
${body.join("\n\n")}
\end{document}
`;
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
