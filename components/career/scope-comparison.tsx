import { careerEntryLabel } from "@/components/career/career-entry-list";
import { Badge } from "@/components/ui/badge";
import { FieldDescription } from "@/components/ui/field";
import { draftChanges } from "@/lib/career/draft-changes";
import {
  detailRowLabel,
  linkRowLabel,
  sectionFieldLabel,
} from "@/lib/career/terminology";
import type { CareerDocument, CareerDraft } from "@/types-and-constants/career";
import { templateSettingLabels } from "@/types-and-constants/output";
import {
  sectionIconIds,
  sectionIconLabels,
} from "@/types-and-constants/section-icons";

const names: Record<string, string> = {
  ...templateSettingLabels,
  paper: "Paper",
  font: "Font",
  contactRows: "Contacts per row",
  contactRowSizes: "Custom row sizes",
  contactRowGap: "Contact row spacing",
  contactSeparator: "Contact separator",
  contactLocation: "City & country",
  defaults: "Frozen layout defaults",
  fullName: "Full name",
  fact: "Shared value",
  wording: "Wording",
  heading: "Section heading",
  name: "Internal name",
  icon: "Section icon",
  active: "Active",
  archived: "Archived",
  label: "Link label",
  url: "Link address",
  fields: "Fields",
  achievements: "Achievements",
  links: "Links",
};

/** Flatten safely rendered values into labeled comparison rows, matching records by identity.
 * @param value Current saved scope or recoverable draft.
 * @param prefix Owning field label.
 * @returns Display labels mapped to text; identifiers are used for matching, never rendered as content.
 * @example comparisonRows({ name: "Example", archived: false })
 */
function comparisonRows(value: unknown, prefix = ""): Map<string, string> {
  const rows = new Map<string, string>();
  const walk = (item: unknown, key: string, label: string) => {
    if (Array.isArray(item)) {
      if (
        item.every((span) => span && typeof span === "object" && "text" in span)
      ) {
        rows.set(
          `${key}\0${label}`,
          item
            .map(
              (span) =>
                `${span.emphasis ? "Italic: " : ""}${String(span.text)}${span.href ? ` [${String(span.href)}]` : ""}`,
            )
            .join(""),
        );
      } else
        item.forEach((child, index) =>
          walk(
            child,
            `${key}/${child && typeof child === "object" && "id" in child ? String(child.id) : index}`,
            `${label} ${index + 1}`,
          ),
        );
    } else if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const fieldLabel =
        typeof record.key === "string"
          ? (names[record.key] ?? record.key)
          : label;
      Object.entries(record).forEach(([name, child]) => {
        if (["id", "key", "type"].includes(name)) return;
        walk(
          child,
          `${key}/${name}`,
          `${fieldLabel}${fieldLabel ? " · " : ""}${names[name] ?? name}`,
        );
      });
    } else
      rows.set(
        `${key}\0${label}`,
        item === undefined
          ? "Missing"
          : item === null
            ? "Empty"
            : typeof item === "boolean"
              ? item
                ? "Yes"
                : "No"
              : key.endsWith("/icon") &&
                  sectionIconIds.some((id) => id === item)
                ? sectionIconLabels[item as (typeof sectionIconIds)[number]]
                : String(item),
      );
  };
  walk(value, "", prefix);
  return rows;
}

export function ScopeComparison({
  current,
  draft,
}: {
  current: unknown;
  draft: unknown;
}) {
  const saved = comparisonRows(current);
  const recovered = comparisonRows(draft);
  const keys = [...new Set([...saved.keys(), ...recovered.keys()])];
  return (
    <section
      aria-label="Compare saved content and draft"
      className="flex flex-col gap-3"
    >
      <FieldDescription>
        Saved content beside the draft. Comparing never changes or removes
        either version.
      </FieldDescription>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">Field</th>
              <th className="p-2">Current saved content</th>
              <th className="p-2">Recovered / current draft</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key} className="border-b align-top">
                <th className="p-2 font-medium">
                  {key.split("\0")[1] || "Value"}
                </th>
                <td className="p-2 break-words whitespace-pre-wrap">
                  {saved.get(key) || "Empty"}
                </td>
                <td className="p-2 break-words whitespace-pre-wrap">
                  {recovered.get(key) || "Empty"}
                  {saved.get(key) !== recovered.get(key) && (
                    <span className="ms-2 text-xs text-muted-foreground">
                      Changed
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Show only edits made since the reviewed draft started. */
export function DraftChanges({
  draft,
  document,
  language,
}: {
  draft: CareerDraft;
  document: CareerDocument;
  language: string;
}) {
  const [scope, id] = draft.scope.split("/");
  const sectionId =
    scope === "language-evidence"
      ? (draft.values as { sectionId?: unknown } | null)?.sectionId
      : id;
  const section = document.sections.find((section) =>
    scope === "entry"
      ? section.entries.some((entry) => entry.id === id)
      : section.id === sectionId,
  );
  const names = new Map<string, string>([[document.summary.id, "Summary"]]);
  for (const field of document.profile.fields)
    names.set(field.id, sectionFieldLabel(field.key));
  document.profile.links.forEach((link, index) =>
    names.set(link.id, linkRowLabel(link, index, link.label[language]).title),
  );
  const entryNames = new Map(
    document.sections.flatMap((owner) =>
      owner.entries.map(
        (entry) => [entry.id, careerEntryLabel(entry, language)] as const,
      ),
    ),
  );
  for (const owner of document.sections) {
    names.set(
      owner.id,
      owner.name || owner.heading[language] || "Untitled section",
    );
    for (const entry of owner.entries) {
      names.set(entry.id, entryNames.get(entry.id)!);
      for (const field of entry.fields)
        names.set(field.id, sectionFieldLabel(field.key, owner.kind));
      entry.achievements.forEach((item, index) =>
        names.set(
          item.id,
          detailRowLabel(owner.kind, item, index, item.wording[language]).title,
        ),
      );
      entry.links.forEach((link, index) =>
        names.set(
          link.id,
          linkRowLabel(link, index, link.label[language]).title,
        ),
      );
      for (const evidence of entry.evidence ?? []) {
        const name = entryNames.get(evidence.entryId);
        if (name) names.set(evidence.id, name);
      }
    }
  }
  const changes = draftChanges(draft, {
    sectionKind: section?.kind,
    language,
    reference: (id) => names.get(id),
  });
  return (
    <section aria-label="Draft changes" className="min-w-0">
      {changes.length ? (
        <table className="w-full table-fixed text-start text-sm">
          <thead>
            <tr className="border-b text-start">
              <th scope="col" className="p-2 text-start">
                Field
              </th>
              <th scope="col" className="p-2 text-start">
                Before
              </th>
              <th scope="col" className="p-2 text-start">
                After
              </th>
            </tr>
          </thead>
          <tbody>
            {changes.map(({ label, kind, before, after }, index) => (
              <tr key={index} className="border-b align-top last:border-b-0">
                <th
                  scope="row"
                  className="p-2 text-start font-medium wrap-anywhere"
                >
                  <span className="block">{label}</span>
                  {kind !== "Changed" && (
                    <Badge variant="secondary">{kind}</Badge>
                  )}
                </th>
                <td className="p-2 wrap-anywhere whitespace-pre-wrap">
                  {before}
                </td>
                <td className="p-2 wrap-anywhere whitespace-pre-wrap">
                  {after}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-muted-foreground">No changes to restore</p>
      )}
    </section>
  );
}
