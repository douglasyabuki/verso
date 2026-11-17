/** Build the public file name for one released PDF from its rendered full name.
 * Diacritics are folded and everything outside ASCII letters/digits becomes a
 * hyphen, so the name is safe in `Content-Disposition` and on every file system.
 * @param fullName Effective full-name wording rendered in the PDF.
 * @param locale Canonical content language tag, such as `pt-BR`.
 * @param number Per-link release number.
 * @returns {string} Name such as `ana-souza-pt-br-v3.pdf`; `resume-…` when the name has no usable characters.
 * @example releaseFileName("Ana Souza", "pt-BR", 3) // "ana-souza-pt-br-v3.pdf"
 */
export function releaseFileName(
  fullName: string,
  locale: string,
  number: number,
): string {
  const slug = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/g, "");
  return `${slug(fullName) || "resume"}-${slug(locale) || "und"}-v${number}.pdf`;
}
