import type { JSONContent } from "@tiptap/core";
import {
  Fragment,
  type Mark,
  type Node,
  type Schema,
  Slice,
} from "@tiptap/pm/model";

import { normalizeSpans } from "@/lib/wording/spans";
import type { Span } from "@/types-and-constants/resume";

/** Convert portable spans to an editor-only document without HTML parsing.
 * @param spans Stored wording; empty legacy spans are represented without changing the stored value.
 * @returns One paragraph with text and marked hard breaks.
 * @example spansToEditorContent(record.spans);
 */
export function spansToEditorContent(spans: readonly Span[]): JSONContent {
  const content: JSONContent[] = [];
  for (const span of spans) {
    const marks: NonNullable<JSONContent["marks"]> = [];
    if (span.emphasis) marks.push({ type: "italic" });
    if (span.href) marks.push({ type: "link", attrs: { href: span.href } });
    span.text.split("\n").forEach((text, index) => {
      if (index) content.push({ type: "hardBreak", marks });
      if (text) content.push({ type: "text", text, marks });
    });
  }
  return { type: "doc", content: [{ type: "paragraph", content }] };
}

/** Read the restricted editor document as schema-1 wording.
 * @param doc Editor document containing a single paragraph.
 * @returns Normalized spans, preserving whitespace, line breaks, and both supported marks.
 * @example editorContentToSpans(editor.state.doc);
 */
export function editorContentToSpans(doc: Node): Span[] {
  const spans: Span[] = [];
  doc.descendants((node) => {
    if (!node.isText && node.type.name !== "hardBreak") return;
    spans.push({
      text: node.isText ? node.text! : "\n",
      emphasis: node.marks.some((mark) => mark.type.name === "italic"),
      href:
        node.marks.find((mark) => mark.type.name === "link")?.attrs.href ?? "",
    });
  });
  return normalizeSpans(spans);
}

/** Build literal pasted text with the insertion point's formatting.
 * @param text Clipboard text. @param schema Restricted editor schema. @param marks Active insertion marks.
 * @returns An inline slice with line endings normalized to hard breaks.
 * @example plainTextSlice(text, view.state.schema, view.state.selection.$from.marks());
 */
export function plainTextSlice(
  text: string,
  schema: Schema,
  marks: readonly Mark[],
): Slice {
  const nodes: Node[] = [];
  text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .forEach((line, index) => {
      if (index) nodes.push(schema.nodes.hardBreak.create(null, null, marks));
      if (line) nodes.push(schema.text(line, marks));
    });
  return new Slice(Fragment.fromArray(nodes), 0, 0);
}
