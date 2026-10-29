import type { Span } from "@/types-and-constants/resume";

/**
 * Normalize editable wording without losing text or formatting.
 * @param spans Structured wording, including legacy empty or adjacent equivalent spans.
 * @returns {Span[]} Fresh spans, merged and split at the schema's 20,000 UTF-16-unit limit; empty wording has one plain span.
 * @example normalizeSpans([{ text: "Hello", emphasis: false, href: "" }]);
 */
export function normalizeSpans(spans: readonly Span[]): Span[] {
  const runs: Span[] = [];
  for (const span of spans) {
    if (!span.text) continue;
    const last = runs.at(-1);
    if (last && last.emphasis === span.emphasis && last.href === span.href) {
      last.text += span.text;
    } else {
      runs.push({ text: span.text, emphasis: span.emphasis, href: span.href });
    }
  }

  const result: Span[] = [];
  for (const run of runs) {
    for (let start = 0; start < run.text.length;) {
      let end = Math.min(start + 20_000, run.text.length);
      if (
        end < run.text.length &&
        /[\uD800-\uDBFF]/.test(run.text[end - 1]) &&
        /[\uDC00-\uDFFF]/.test(run.text[end])
      ) {
        end--;
      }
      result.push({ ...run, text: run.text.slice(start, end) });
      start = end;
    }
  }
  return result.length ? result : [{ text: "", emphasis: false, href: "" }];
}

/**
 * Compare wording independently of empty spans and equivalent segmentation.
 * @param left Existing wording.
 * @param right Proposed wording.
 * @returns {boolean} Whether both represent the same text, emphasis, and destinations.
 * @example equivalentSpans(previous, next);
 */
export function equivalentSpans(
  left: readonly Span[],
  right: readonly Span[],
): boolean {
  return (
    JSON.stringify(normalizeSpans(left)) ===
    JSON.stringify(normalizeSpans(right))
  );
}
