import { FieldDescription } from "@/components/ui/field";
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
        Compare both versions, edit the draft, then reconcile with current
        content before saving. Neither version is removed by comparison.
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
