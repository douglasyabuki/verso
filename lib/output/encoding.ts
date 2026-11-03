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


/** Encode a validated URL as one hyperref argument without changing query separators.
 * @param value Safe-scheme URL.
 * @returns Escaped TeX destination.
 * @example escapeLatexUrl("https://example.com/?a=1&b=2")
 */
export function escapeLatexUrl(value: string): string {
  return value.replace(/[{}^~\\]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`).replace(/[%&#_]/g, (character) => `\\${character}`);
}
