import { z } from "zod";

import { escapeLatex, escapeLatexUrl } from "@/lib/output/encoding";

const safeLink = z
  .string()
  .max(2000)
  .refine((value) => {
    if (!value) return true;
    try {
      return ["http:", "https:", "mailto:", "tel:"].includes(
        new URL(value).protocol,
      );
    } catch {
      return false;
    }
  }, "Use an http, https, mailto, or tel link.");

export const richSpanSchema = z.strictObject({
  text: z.string().max(20_000),
  emphasis: z.boolean(),
  href: safeLink,
});

export const richTextSchema = z.union([
  z.string().max(20_000),
  z
    .array(richSpanSchema)
    .min(1)
    .max(100)
    .refine(
      (spans) =>
        spans.reduce((length, span) => length + span.text.length, 0) <= 20_000,
      "Use at most 20,000 characters of wording.",
    ),
]);

export type RichText = z.infer<typeof richTextSchema>;
export type RichSpan = z.infer<typeof richSpanSchema>;

/** Read searchable text without interpreting markup.
 * @param value Plain or formatted career wording.
 * @returns Plain text, including line breaks.
 * @example wordingText([{ text: "Hello", emphasis: true, href: "" }])
 */
export function wordingText(value: RichText): string {
  return typeof value === "string"
    ? value
    : value.map((span) => span.text).join("");
}

/** Adapt saved wording to the controlled editor without discarding marks.
 * @param value Plain or formatted wording.
 * @returns Structured editor spans.
 * @example wordingSpans("Hello")
 */
export function wordingSpans(value: RichText): RichSpan[] {
  return typeof value === "string"
    ? [{ text: value, emphasis: false, href: "" }]
    : value;
}

/** Render validated prose as escaped TeX with supported inline formatting.
 * @param value Plain or formatted wording.
 * @returns Trusted TeX; user text and destinations are escaped separately.
 * @example renderWording("Hello & welcome")
 */
export function renderWording(value: RichText): string {
  return wordingSpans(value)
    .map((span) => {
      let text = span.text.split("\n").map(escapeLatex).join("\\newline{} ");
      if (span.emphasis) text = `\\textit{${text}}`;
      if (span.href) text = `\\href{${escapeLatexUrl(span.href)}}{${text}}`;
      return text;
    })
    .join("");
}
