import { plain } from "@/lib/resume/localization";
import { templateIdentity } from "@/lib/resume/model";
import { resolveSettings } from "@/lib/resume/settings";
import { validateOutput } from "@/lib/resume/validation";
import type {
  Entry,
  Locale,
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

/** Encode text for a nonexecutable LaTeX context. @param value User wording. @returns Escaped text with normalized whitespace. @example escapeLatex("R&D: 100%") */
export function escapeLatex(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\\{}$&#%_^~]/g, (char) => special[char]);
}

/** Encode an already validated URL for hyperref. @param value Safe-scheme URL. @returns Escaped URL. @example latexUrl("https://example.com/a?q=100%25") */
function latexUrl(value: string): string {
  return value
    .replace(
      /[{}^~]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    .replace(/[%&#_]/g, (char) => "\\" + char);
}

/** Allow long link labels to wrap at delimiters. @param value Link label. @returns Escaped breakable text. @example linkLabel("example.com/project") */
function linkLabel(value: string): string {
  return Array.from(value)
    .map(
      (char) =>
        escapeLatex(char) + (/[/@.?&=_-]/.test(char) ? "\\allowbreak{}" : ""),
    )
    .join("");
}

/** Render a safe shared link. @param link Validated link. @returns Hyperref source, or empty text for an empty optional link. @example renderLink(link) */
function renderLink(link: ResumeLink): string {
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
  return `{\\color{icnclr}${icon}}~\\href{${latexUrl(link.url)}}{${linkLabel(link.label.trim() || link.url)}}`;
}

/** Render structured wording without interpreting source syntax. @param value Localized content. @param locale Language. @param uppercase Whether to uppercase visible text while preserving link destinations. @returns Escaped text with emphasis and links. @example renderText(title, "en-US") */
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

/** Format independent year/month facts. @param value YYYY or YYYY-MM. @param locale Output language. @returns Localized month/year, or an empty string. @example displayDate("2023-03", "pt-BR") */
function displayDate(value: string, locale: Locale): string {
  if (!value || value.length === 4) return value;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value + "-01T12:00:00Z"));
}

/** Format an ongoing or completed date range. @param entry Shared facts. @param locale Language. @returns Escaped range. @example dateRange(entry, "en-US") */
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

/** Localize a shared city/country pair. @param city City name. @param country ISO country code or empty. @param locale Language. @returns Display text. @example displayLocation("Curitiba", "BR", "en-US") */
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

/** Produce deterministic LaTeX for one frozen language/variant. @param doc Workspace snapshot. @param variantId Selected variant ID. @param locale Output language. @returns Source, warnings, settings, and exact template manifest; throws on invalid selected content. @example renderLatex(doc, "general", "pt-BR") */
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
  const contacts = [
    doc.profile.city || doc.profile.country
      ? `{\\color{icnclr}\\faMapMarker}~${escapeLatex(displayLocation(doc.profile.city, doc.profile.country, locale))}`
      : "",
    doc.profile.email
      ? renderLink({
          id: "email",
          label: doc.profile.email,
          url: `mailto:${doc.profile.email}`,
        })
      : "",
    doc.profile.phone
      ? renderLink({
          id: "phone",
          label: doc.profile.phone,
          url: `tel:${encodeURIComponent(doc.profile.phone.replace(/[^+\d]/g, ""))}`,
        })
      : "",
    ...doc.profile.links.map(renderLink),
  ].filter(Boolean);
  const body: string[] = [];
  if (plain(doc.profile.summary, locale).trim())
    body.push(
      `\\Needspace{6\\baselineskip}\n\\section{${locale === "pt-BR" ? "SOBRE MIM" : "ABOUT ME"}}\n${renderText(doc.profile.summary, locale)}`,
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
      content.push("\\Needspace{6\\baselineskip}");
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
        content.push(
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
        content.push(
          `\\subsubsection{\\textcolor{roleclr}{${[subtitle, dates].filter(Boolean).join(" \\hfill ")}}}`,
        );
      const detail = (value: string) => {
        if (value) content.push(`\\noindent ${value}\\par`);
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
        .filter((bullet) => bullet && plain(bullet.body, locale).trim());
      if (bullets.length)
        content.push(
          "\\begin{itemize}\n" +
            bullets
              .map((bullet) => "\\item " + renderText(bullet!.body, locale))
              .join("\n") +
            "\n\\end{itemize}",
        );
      if (entry.links.some((link) => link.url.trim()))
        content.push(
          "\\begin{itemize}[label={},left=0pt]\n" +
            entry.links
              .filter((link) => link.url.trim())
              .map((link) => "\\item " + renderLink(link))
              .join("\n") +
            "\n\\end{itemize}",
        );
      content.push("\\par\\vspace{0.7em}");
    }
    if (content.length)
      body.push(
        `\\Needspace{9\\baselineskip}\n\\section{${renderText(section.heading, locale, true)}}\n${content.join("\n")}`,
      );
  }
  const source = String.raw`% Adapted from the owner's Overleaf resume and Rover Resume by Subidit.
% https://www.overleaf.com/latex/templates/rover-resume/bpzqtssvfgsn
% CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
% Changes: browser XeTeX compatibility, structured bilingual rendering, and bounded layout settings.
\documentclass[11pt]{article}
\usepackage[T1]{fontenc}
\usepackage{inter}
\renewcommand*\familydefault{\sfdefault}
\usepackage{geometry}
\geometry{${settings.pageSize === "a4" ? "a4paper" : "letterpaper"},top=${settings.marginTop}mm,bottom=${settings.marginBottom}mm,left=${settings.marginSide}mm,right=${settings.marginSide}mm}
\setcounter{secnumdepth}{0}
\usepackage{enumitem}
\setlist[itemize]{noitemsep,left=2em}
\usepackage[xetex,dvipsnames]{xcolor}
\definecolor{customgray}{gray}{0.25}
\colorlet{roleclr}{customgray}
\colorlet{icnclr}{gray}
\usepackage{fontawesome5}
\usepackage{titlesec}
\usepackage{needspace}
\titlespacing{\section}{0pt}{${settings.sectionGap}mm}{2mm}
\titlespacing{\subsection}{0pt}{0pt}{0pt}
\titlespacing{\subsubsection}{0pt}{0pt}{0pt}
\titleformat{\section}{\color{Sepia}\large\interheavy}{}{}{\ruleafter}[\global\RemVStrue]
\titleformat{\subsection}{\bfseries}{}{}{\rvs}
\titleformat{\subsubsection}{\color{gray}\bfseries}{}{}{}
\usepackage{xhfill}
\newcommand\ruleafter[1]{#1~\xrfill[.5ex]{1pt}[gray]}
\newif\ifRemVS
\newcommand{\rvs}{\ifRemVS\vspace{-1.5ex}\fi\global\RemVSfalse}
\usepackage[bookmarks=true,bookmarksdepth=1]{hyperref}
\hypersetup{colorlinks=true,urlcolor=Sepia,pdftitle={${escapeLatex(doc.profile.name + " · " + variant.name)}},pdfauthor={${escapeLatex(doc.profile.name)}},pdflang={${locale}},pdfsubject={Verso revision ${doc.revision}; ${templateIdentity.id}@${templateIdentity.version}}}
\usepackage{fancyhdr}
\pagestyle{fancy}
\renewcommand{\headrulewidth}{0pt}
\fancyhf{}
\renewcommand{\normalsize}{\fontsize{${settings.fontSize}}{${(settings.fontSize * settings.lineHeight).toFixed(3)}}\selectfont}
\begin{document}
\language=${locale === "pt-BR" ? 1 : 0}
\normalsize
\begin{center}
{\fontsize{20}{22}\selectfont ${escapeLatex(doc.profile.name)}}\\[8pt]
${contacts.join(" \\quad ")}
\end{center}
${body.join("\n\n")}
\end{document}
`;
  return {
    source,
    warnings: validation.warnings,
    settings,
    assetManifest: {
      ...templateIdentity,
      engine: "SwiftLaTeX v20022022",
      bundle: "/compiler/resources.bundle",
    },
  };
}
