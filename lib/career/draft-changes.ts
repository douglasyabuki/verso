import { diffArrays } from "diff";

import { sameScope } from "@/lib/career/commit";
import { careerFieldLabel } from "@/lib/career/labels";
import { CAREER_TERMS, sectionFieldLabel } from "@/lib/career/terminology";
import { richTextSchema, wordingSpans } from "@/lib/career/wording";
import type { CareerDraft, CareerSection } from "@/types-and-constants/career";
import { templateSettingLabels } from "@/types-and-constants/output";

type ChangeKind = "Changed" | "Cleared" | "Added" | "Removed" | "Reordered";

export type DraftChange = {
  label: string;
  kind: ChangeKind;
  before: string;
  after: string;
};

type Labels = {
  sectionKind?: CareerSection["kind"];
  language: string;
  reference?: (id: string) => string | undefined;
};

const fieldNames: Record<string, string> = {
  ...templateSettingLabels,
  achievementIds: "Achievements",
  contactLocation: "City & country",
  contactRowGap: "Contact row spacing",
  contactRowSizes: "Custom row sizes",
  contactRows: "Contacts per row",
  entryIds: "Entries",
  evidence: "Tests and certificates",
  evidenceIds: "Tests and certificates",
  fieldDefaults: "Default fields",
  fieldIds: "Fields",
  heading: "Section heading",
  hiddenEntryIds: "Hidden entries",
  icon: "Icon",
  label: "Link label",
  linkIds: "Links",
  profileSelection: "Contact details",
  sectionId: "Section",
  selection: "Sections",
  summaryIncluded: "Include summary",
  visibleFields: "Visible fields",
};

const metadata = new Set([
  "id",
  "type",
  "key",
  "template",
  "defaults",
  "createdSectionIds",
  "draftId",
  "draftVersion",
  "workspaceId",
  "baselineRevision",
  "generation",
  "operationId",
  "fingerprint",
  "updatedAt",
]);

const references = new Set([
  "entryIds",
  "achievementIds",
  "fieldIds",
  "linkIds",
  "evidenceIds",
  "hiddenEntryIds",
  "profileSelection",
  "fieldDefaults",
  "visibleFields",
]);

const ordered = new Set([
  "sections",
  "entries",
  "entryIds",
  "achievements",
  "achievementIds",
  "selection",
  "links",
]);

/** Read a traversable record from scope values, which can include incomplete imported input.
 * @param value A draft or baseline node.
 * @returns A record for non-array objects, otherwise undefined.
 * @example asRecord({ fullName: "Ana" })?.fullName
 */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Render editable values as text, preserving supported rich text marks in the comparison.
 * @param value A scalar or rich text value.
 * @returns Display text, or an empty string for absent and empty values.
 * @example valueText(true) // "Yes"
 */
function valueText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (!Array.isArray(value) || value.length === 0) return "";
  const rich = richTextSchema.safeParse(value);
  return rich.success
    ? wordingSpans(rich.data)
        .map(
          ({ text, emphasis, href }) =>
            `${emphasis ? `Italic: ${text}` : text}${href ? ` [${href}]` : ""}`,
        )
        .join("")
    : value.map(valueText).filter(Boolean).join(", ");
}

/** Align records by identity, or recognize an array of references to editor items.
 * @param items A before or after collection.
 * @param byReference True when string items are identities.
 * @returns A map in editor order, or null when the collection has no stable unique identities.
 * @example itemsById([{ id: "a" }], false)?.has("a")
 */
function itemsById(
  items: unknown[],
  byReference: boolean,
): Map<string, unknown> | null {
  const result = new Map<string, unknown>();
  for (const item of items) {
    const record = asRecord(item);
    const id = byReference
      ? item
      : (record?.id ?? record?.sectionId ?? record?.tag);
    if (typeof id !== "string" || result.has(id)) return null;
    result.set(id, item);
  }
  return result;
}

/** Compare a recovery draft with its own recorded starting values.
 * @param draft Reviewed draft scope, baseline, and values.
 * @param labels Editor vocabulary and references to display names.
 * @returns Only edits, with before/after values and collection moves in editor order.
 * @example draftChanges(draft, { language: "en-US" })
 */
export function draftChanges(
  draft: Pick<CareerDraft, "scope" | "baseline" | "values">,
  labels: Labels,
): DraftChange[] {
  const changes: DraftChange[] = [];
  const [scope] = draft.scope.split("/");
  const fieldLabel = (key: string) =>
    sectionFieldLabel(key, labels.sectionKind);
  const detail = labels.sectionKind
    ? CAREER_TERMS[labels.sectionKind].detail
    : "Achievement";
  const append = (parent: string, child: string) =>
    parent ? `${parent} · ${child}` : child;
  const add = (
    label: string,
    kind: ChangeKind,
    before: string,
    after: string,
  ) =>
    changes.push({
      label,
      kind,
      before: before || "Empty",
      after: after || "Empty",
    });

  const itemLabel = (
    key: string,
    id: string,
    item: unknown,
    index: number,
  ): string => {
    const record = asRecord(item);
    if (typeof record?.key === "string") return fieldLabel(record.key);
    if (key === "visibleFields" || key === "fieldDefaults")
      return fieldLabel(id);
    if (typeof record?.tag === "string") return record.tag;
    if (key === "evidence" && typeof record?.entryId === "string")
      return labels.reference?.(record.entryId) ?? "Test or certificate";
    return (
      valueText(record?.name) ||
      valueText(asRecord(record?.wording)?.[labels.language]) ||
      valueText(asRecord(record?.label)?.[labels.language] ?? record?.label) ||
      valueText(record?.url) ||
      labels.reference?.(id) ||
      (key === "achievements"
        ? `${detail} ${index + 1}`
        : key === "links"
          ? `Link ${index + 1}`
          : `Item ${index + 1}`)
    );
  };

  const walk = (
    before: unknown,
    after: unknown,
    key: string,
    label: string,
  ) => {
    if (sameScope(before, after)) return;
    const a = asRecord(before);
    const b = asRecord(after);
    if ((a || b) && (before == null || a) && (after == null || b)) {
      const localized = ["wording", "heading", "label"].includes(key);
      const overrides = key === "overrides";
      const field = typeof (b ?? a)?.key === "string";
      for (const property of new Set([
        ...Object.keys(a ?? {}),
        ...Object.keys(b ?? {}),
      ])) {
        if (!overrides && metadata.has(property)) continue;
        // An unarchived new record has no archive edit to review.
        if (!a && property === "archived" && b?.[property] === false) continue;
        const name = overrides
          ? (labels.reference?.(property) ?? "Unavailable wording")
          : localized
            ? property === labels.language
              ? ""
              : property
            : field && ["fact", "wording"].includes(property)
              ? ""
              : property === "name"
                ? scope === "section" || scope === "new-section"
                  ? "Section internal name"
                  : ["resume", "resume-details", "starter-create"].includes(
                        scope,
                      )
                    ? "Resume name"
                    : ["preset", "starter"].includes(scope)
                      ? "Name"
                      : "Internal name"
                : (fieldNames[property] ?? careerFieldLabel(property));
        walk(
          a?.[property],
          b?.[property],
          property,
          name ? append(label, name) : label,
        );
      }
      return;
    }
    if (Array.isArray(before) || Array.isArray(after)) {
      const left = Array.isArray(before) ? before : [];
      const right = Array.isArray(after) ? after : [];
      const byReference =
        references.has(key) ||
        (key === scope && ["sections", "entries"].includes(scope));
      const from = itemsById(left, byReference);
      const to = itemsById(right, byReference);
      if (
        from &&
        to &&
        (before == null || Array.isArray(before)) &&
        (after == null || Array.isArray(after))
      ) {
        const oldIds = [...from.keys()];
        const newIds = [...to.keys()];
        for (const [index, id] of oldIds.entries()) {
          const item = from.get(id);
          const name = itemLabel(key, id, item, index);
          if (!to.has(id)) {
            const field = asRecord(item);
            if (typeof field?.key === "string") {
              const text =
                valueText(asRecord(field.wording)?.[labels.language]) ||
                valueText(field.fact);
              add(name, "Removed", text, "Removed");
            } else add(label, "Removed", name, "Removed");
          } else if (!byReference) {
            walk(
              item,
              to.get(id),
              key,
              key === "fields" ? name : append(label, name),
            );
          }
        }
        for (const [index, id] of newIds.entries()) {
          if (from.has(id)) continue;
          const item = to.get(id);
          const name = itemLabel(key, id, item, index);
          if (typeof asRecord(item)?.key === "string")
            walk(undefined, item, key, name);
          else add(label, "Added", "Not present", name);
        }
        if (ordered.has(key)) {
          const oldOrder = oldIds.filter((id) => to.has(id));
          const newOrder = newIds.filter((id) => from.has(id));
          if (!sameScope(oldOrder, newOrder)) {
            const parts = diffArrays(oldOrder, newOrder, {
              maxEditLength: 128,
            });
            const moved = parts?.flatMap((part) =>
              part.added ? part.value : [],
            );
            const position = (
              ids: string[],
              items: Map<string, unknown>,
              id: string,
            ) => {
              const index = ids.indexOf(id);
              return `${itemLabel(key, id, items.get(id), index)} (position ${index + 1})`;
            };
            if (moved?.length) {
              for (const id of moved)
                add(
                  label,
                  "Reordered",
                  position(oldIds, from, id),
                  position(newIds, to, id),
                );
            } else add(label, "Reordered", "Original order", "Order changed");
          }
        }
        return;
      }
    }
    const oldText = valueText(before);
    const newText = valueText(after);
    if (oldText === newText) return;
    add(
      label || "Value",
      !newText ? "Cleared" : before == null ? "Added" : "Changed",
      oldText,
      newText || "Cleared",
    );
  };

  const key =
    scope === "summary"
      ? "wording"
      : scope === "resume-wording"
        ? "overrides"
        : scope;
  const summaryBefore =
    scope === "summary" ? asRecord(draft.baseline)?.wording : draft.baseline;
  const summaryAfter =
    scope === "summary" ? asRecord(draft.values)?.wording : draft.values;
  const label =
    scope === "entries"
      ? "Entry order"
      : scope === "sections"
        ? "Section order"
        : scope === "summary"
          ? "Summary"
          : scope === "selection"
            ? "Sections"
            : "";
  walk(summaryBefore, summaryAfter, key, label);
  return changes;
}
