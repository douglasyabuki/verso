import { escapeLatex } from "@/lib/output/encoding";
import type { TemplateSettings } from "@/types-and-constants/output";
import { pdfColorPresets } from "@/types-and-constants/output";

const templateIdentity = { id: "yabuki-reference", version: "1.0.3" };

/** Generate the pinned template independently of career/storage schemas.
 * @param options Escaped content blocks, contact markup, metadata, verified language capability, and resolved appearance.
 * @returns {string} Trusted generated LaTeX for the exact bundled template; user text must be escaped before passing body/contacts.
 * @example renderTemplate({ settings, name, resumeName, revision, locale, languageNumber: 0, pageLabel: "Page", ofLabel: "of", contacts, body })
 */
export function renderTemplate(options: {
  settings: TemplateSettings;
  name: string;
  resumeName: string;
  revision: number;
  locale: string;
  languageNumber: number;
  pageLabel: string;
  ofLabel: string;
  contacts: string[];
  contactRowGap?: number;
  body: string[];
}): string {
  const {
    settings,
    name,
    resumeName,
    revision,
    locale,
    languageNumber,
    pageLabel,
    ofLabel,
    contacts,
    body,
  } = options;
  const headingHex = pdfColorPresets[settings.headingColor].hex;
  const bodyHex = pdfColorPresets[settings.bodyColor].hex;
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
\newfontfamily\versobrands{FontAwesome6Brands-Regular-400.otf}
\newcommand{\VersoBrand}[1]{{\versobrands\symbol{"#1}}}
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
\hypersetup{colorlinks=true,urlcolor=linkclr,pdftitle={${escapeLatex(name + " · " + resumeName)}},pdfauthor={${escapeLatex(name)}},pdflang={${locale}},pdfsubject={Verso revision ${revision}; ${templateIdentity.id}@${templateIdentity.version}}}
\usepackage{fancyhdr}
\pagestyle{fancy}
\renewcommand{\headrulewidth}{0pt}
\fancyhf{}
\setlength{\footskip}{5mm}
${
  settings.pageNumbering === "shown"
    ? String.raw`\pagestyle{empty}
\makeatletter
\def\@oddfoot{\normalfont\fontsize{9}{10.8}\selectfont\color{roleclr}${settings.pageNumberAlignment !== "left" ? "\\hfil{}" : ""}${pageLabel} {\thepage}${settings.pageNumberFormat === "page-x-of-y" ? ` ${ofLabel} {\\VersoTotalPages}` : ""}${settings.pageNumberAlignment !== "right" ? "\\hfil" : ""}}
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
\language=${languageNumber}
\normalsize
\color{bodyclr}
\setlength{\parskip}{${dimension(settings.paragraphGap, "0pt plus 1pt")}}
${settings.headerGap === defaultValue ? `\\begin{${settings.headerAlignment === "center" ? "center" : "flushleft"}}` : `\\par\\begingroup${settings.headerAlignment === "center" ? "\\centering" : "\\raggedright"}`}
{${typography(settings.nameSize, "\\fontsize{20}{22}\\selectfont", 1.1)}${weight(settings.nameWeight)} ${escapeLatex(name)}\par}
${
  contacts.length
    ? String.raw`\vspace{${dimension(settings.nameContactGap, "8pt")}}
${contacts.join(options.contactRowGap === undefined ? " \\quad " : `\\par\\vspace{${options.contactRowGap}pt}\n`)}\par`
    : ""
}
${settings.headerGap === defaultValue ? `\\end{${settings.headerAlignment === "center" ? "center" : "flushleft"}}` : `\\endgroup\\vspace{${settings.headerGap}pt}`}
${body.join("\n\n")}
\end{document}
`;
  return source;
}
