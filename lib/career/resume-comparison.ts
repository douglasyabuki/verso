import { diffArrays } from "diff";

import { careerFieldLabel } from "@/lib/career/labels";
import {
  effectiveResume,
  type ResumeFieldOwner,
  resumeSelectedIds,
  resumeWordingFields,
} from "@/lib/career/resumes";
import {
  CAREER_TERMS,
  EVIDENCE_TERMS,
  sectionFieldLabel,
} from "@/lib/career/terminology";
import { wordingText } from "@/lib/career/wording";
import {
  CAREER_OUTPUT_CAPABILITIES,
  type CareerDocument,
  type CareerResume,
} from "@/types-and-constants/career";
import type { SectionIconId } from "@/types-and-constants/section-icons";

type Pair<T> = readonly [T, T];

type TextCell = { value: string; included: boolean };
type WordingCell = TextCell & { source: "career" | "custom" };
type OrderItem = { id: string; label: string };
type OrderCell = { items: OrderItem[]; included?: boolean };

type RowContent =
  | { kind: "wording"; cells: Pair<WordingCell> }
  | { kind: "fact"; cells: Pair<TextCell> }
  | { kind: "order"; cells: Pair<OrderCell> };

export type ComparisonChange = "wording" | "inclusion" | "order" | "source";

export type ComparisonRow = RowContent & {
  id: string;
  label: string;
  changes: ComparisonChange[];
  contentDifference: boolean;
};

type ComparisonEntry = { id: string; label: string; rows: ComparisonRow[] };

export type ComparisonGroup = {
  id: string;
  label: string;
  owner: ResumeFieldOwner;
  icon?: SectionIconId;
  rows: ComparisonRow[];
  entries: ComparisonEntry[];
};

export type ComparisonFilters = {
  show: "content" | "all";
  section: string;
  change: ComparisonChange | "all";
};

/** Apply the same projection to the left and right values.
 * @param pair Left then right value.
 * @param project Projection used on each value.
 * @returns {Pair<U>} Projected values in the original order.
 * @example mapPair([1, 2], String) // ["1", "2"]
 */
function mapPair<T, U>(
  pair: Pair<T>,
  project: (item: T, side: 0 | 1) => U,
): Pair<U> {
  return [project(pair[0], 0), project(pair[1], 1)];
}

/** Find a move among items present on both sides using stable IDs.
 * @param left Ordered items in the left resume.
 * @param right Ordered items in the right resume.
 * @returns {boolean} True when common items appear in a different relative order.
 * @example orderChanged([{ id: "one", label: "Example" }], []) // false
 */
function orderChanged(left: OrderItem[], right: OrderItem[]): boolean {
  const rank = new Map(right.map(({ id }, index) => [id, index]));
  let previous = -1;
  for (const { id } of left) {
    const index = rank.get(id);
    if (index === undefined) continue;
    if (index < previous) return true;
    previous = index;
  }
  return false;
}

/** Classify differences independently of value labels and badge presentation.
 * @param id Stable identity for the field or order row.
 * @param label Short title within its owning group.
 * @param content Paired wording, facts, or order values and their inclusion.
 * @returns {ComparisonRow} Row with change types and whether it belongs in Content differences.
 * @example comparisonRow("contacts", "Contact order", { kind: "order", cells: [{ items: [] }, { items: [] }] })
 */
function comparisonRow(
  id: string,
  label: string,
  content: RowContent,
): ComparisonRow {
  const [left, right] = content.cells;
  const changes: ComparisonChange[] = [];
  if (left.included !== right.included) changes.push("inclusion");
  let contentDifference = changes.length > 0;
  if (content.kind === "wording") {
    const [leftWording, rightWording] = content.cells;
    if (leftWording.value !== rightWording.value) {
      changes.push("wording");
      contentDifference ||= leftWording.included || rightWording.included;
    }
    if (leftWording.source !== rightWording.source) changes.push("source");
  }
  if (
    content.kind === "order" &&
    orderChanged(content.cells[0].items, content.cells[1].items)
  ) {
    changes.push("order");
    contentDifference = true;
  }
  return { ...content, id, label, changes, contentDifference };
}

/** Compare the same saved facts and URLs against each resume's inclusion.
 * @param fields Shared profile or entry fields.
 * @param links Shared links owned by the same profile or entry.
 * @param selected Effective selection IDs for each side.
 * @returns {ComparisonRow[]} Shared non-wording values, in their career-record order.
 * @example factRows(document.profile.fields, document.profile.links, selected)
 */
function factRows(
  fields: CareerDocument["profile"]["fields"],
  links: CareerDocument["profile"]["links"],
  selected: Pair<Set<string>>,
  evidence: { id: string; label: string; value: string }[] = [],
): ComparisonRow[] {
  const facts = [
    ...fields
      .filter((field) => field.type !== "text")
      .map((field) => ({
        id: field.id,
        selectionId: field.id,
        label: careerFieldLabel(field.key),
        value: field.fact,
      })),
    ...links.map((link, index) => ({
      id: `url:${link.id}`,
      selectionId: link.id,
      label: `${link.name?.trim() || `Link ${index + 1}`} URL`,
      value: link.url,
    })),
    ...evidence.map((item) => ({ ...item, selectionId: item.id })),
  ];
  return facts.map(({ id, selectionId, label, value }) =>
    comparisonRow(id, label, {
      kind: "fact",
      cells: mapPair(selected, (ids) => ({
        value,
        included: ids.has(selectionId),
      })),
    }),
  );
}

/** Describe a language entry's attached tests or certificates by their shared record.
 * @param document Saved workspace containing the certifications.
 * @param entry Language entry.
 * @returns Attachment identity, label, and the certification's internal name.
 * @example evidenceRows(document, entry)
 */
function evidenceRows(
  document: CareerDocument,
  entry: CareerDocument["sections"][number]["entries"][number],
) {
  return (entry.evidence ?? []).map((item, index) => {
    const record = document.sections
      .flatMap((section) => section.entries)
      .find((candidate) => candidate.id === item.entryId);
    const value = record?.name || `${EVIDENCE_TERMS.item} ${index + 1}`;
    return { id: item.id, label: EVIDENCE_TERMS.item, value };
  });
}

/** Resolve the default labels that contribute effective values to the comparison.
 * @param document Saved workspace, including link URLs and section metadata.
 * @param language Resume language for template heading defaults.
 * @returns {Map<string, string>} Fallback display text keyed by section or link ID.
 * @example wordingDefaults(document, "pt-BR").get(section.id)
 */
function wordingDefaults(
  document: CareerDocument,
  language: string,
): Map<string, string> {
  const headings = CAREER_OUTPUT_CAPABILITIES[language]?.labels;
  const defaults = new Map(
    document.profile.links.map((link) => [link.id, link.url]),
  );
  for (const section of document.sections) {
    defaults.set(section.id, headings?.[section.kind] ?? "");
    for (const entry of section.entries)
      for (const link of entry.links) defaults.set(link.id, link.url);
  }
  return defaults;
}

/** Build a contextual comparison for two saved resumes in their own languages.
 * @param document Saved workspace. Drafts are never supplied.
 * @param resumes Distinct left and right saved resumes.
 * @returns {ComparisonGroup[]} Profile, Summary, career sections in workspace order, and overall resume order.
 * @example buildResumeComparison(document, [application, portfolio])
 */
export function buildResumeComparison(
  document: CareerDocument,
  resumes: Pair<CareerResume>,
): ComparisonGroup[] {
  const states = mapPair(resumes, (resume) => {
    const effective = effectiveResume(document, resume);
    return {
      effective,
      selected: resumeSelectedIds(document, resume),
      selections: new Map(
        effective.selection.map((item) => [item.sectionId, item]),
      ),
      defaults: wordingDefaults(document, resume.language),
      fields: resumeWordingFields(document, resume.language),
    };
  });
  const selected = mapPair(states, (state) => state.selected);
  const profile: ComparisonGroup = {
    id: "profile",
    label: "Profile",
    owner: "profile",
    rows: [],
    entries: [],
  };
  const summary: ComparisonGroup = {
    id: "summary",
    label: "Summary",
    owner: "summary",
    rows: [],
    entries: [],
  };
  const sectionGroups = new Map<string, ComparisonGroup>();
  const entryGroups = new Map<string, ComparisonEntry>();
  const wordingCells = mapPair(
    states,
    ({ effective, selected, defaults, fields }) =>
      new Map(
        fields.map((field) => {
          const custom = Object.hasOwn(effective.overrides, field.id);
          const text = wordingText(
            custom ? effective.overrides[field.id] : field.shared,
          );
          const cell: WordingCell = {
            value: text || defaults.get(field.id) || "",
            included: selected.has(field.id),
            source: custom ? "custom" : "career",
          };
          return [field.id, cell];
        }),
      ),
  );

  const contactLabels = new Map(
    document.profile.fields.map((field) => [
      field.id,
      careerFieldLabel(field.key),
    ]),
  );
  profile.rows.push(
    comparisonRow("order:contacts", "Contact order", {
      kind: "order",
      cells: mapPair(states, ({ effective }, side) => ({
        items: effective.profileSelection!.map((id) => ({
          id,
          label:
            contactLabels.get(id) ??
            (wordingCells[side].get(id)?.value || "Link"),
        })),
      })),
    }),
  );

  for (const section of document.sections) {
    const label = section.name || section.kind;
    const group: ComparisonGroup = {
      id: `section:${section.id}`,
      label,
      owner: section.kind,
      icon: section.icon,
      rows: [],
      entries: [],
    };
    sectionGroups.set(section.id, group);
    const entryNames = new Map(
      section.entries.map((entry) => [
        entry.id,
        entry.name || "Untitled entry",
      ]),
    );
    const configurations = mapPair(states, ({ selections }) =>
      selections.get(section.id),
    );
    group.rows.push(
      comparisonRow(`order:entries:${section.id}`, "Entry order", {
        kind: "order",
        cells: mapPair(configurations, (config) => ({
          items:
            config?.entryIds.map((id) => ({
              id,
              label: entryNames.get(id)!,
            })) ?? [],
          included: !!config,
        })),
      }),
    );
    const ranks = mapPair(
      configurations,
      (config) =>
        new Map(
          config &&
            [
              ...config.fieldIds,
              ...config.achievementIds,
              ...config.linkIds,
              ...(config.evidenceIds ?? []),
            ].map((id, index) => [id, index]),
        ),
    );
    for (const entry of section.entries) {
      const details = [
        ...entry.fields.map((field) => ({
          id: field.id,
          label: sectionFieldLabel(field.key, section.kind),
        })),
        ...entry.achievements.map((item, index) => ({
          id: item.id,
          label:
            item.name?.trim() ||
            `${CAREER_TERMS[section.kind].detail} ${index + 1}`,
        })),
        ...entry.links.map((item, index) => ({
          id: item.id,
          label: item.name?.trim() || `Link ${index + 1}`,
        })),
        ...evidenceRows(document, entry).map(({ id, value }) => ({
          id,
          label: value,
        })),
      ];
      const row = comparisonRow(
        `order:details:${entry.id}`,
        "Detail, achievement, and link order",
        {
          kind: "order",
          cells: mapPair(ranks, (rank, side) => {
            const included = selected[side].has(entry.id);
            const items = included
              ? details
                  .filter(({ id }) => rank.has(id))
                  .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
              : [];
            return { included, items };
          }),
        },
      );
      const entryGroup = {
        id: entry.id,
        label: entryNames.get(entry.id)!,
        rows: [row],
      };
      entryGroups.set(entry.id, entryGroup);
      group.entries.push(entryGroup);
    }
  }

  for (const field of states[0].fields) {
    const group =
      field.owner === "profile"
        ? profile
        : field.owner === "summary"
          ? summary
          : sectionGroups.get(field.groupId)!;
    const rows = field.entryId
      ? entryGroups.get(field.entryId)!.rows
      : group.rows;
    rows.push(
      comparisonRow(field.id, field.shortLabel, {
        kind: "wording",
        cells: mapPair(wordingCells, (cells) => cells.get(field.id)!),
      }),
    );
  }
  profile.rows.push(
    ...factRows(document.profile.fields, document.profile.links, selected),
  );
  for (const section of document.sections)
    for (const entry of section.entries)
      entryGroups
        .get(entry.id)!
        .rows.push(
          ...factRows(
            entry.fields,
            entry.links,
            selected,
            evidenceRows(document, entry),
          ),
        );

  const resumeOrder: ComparisonGroup = {
    id: "resume-order",
    label: "Resume order",
    owner: "resume",
    entries: [],
    rows: [
      comparisonRow("order:sections", "Section order", {
        kind: "order",
        cells: mapPair(states, ({ effective }, side) => ({
          items: effective.selection.map(({ sectionId: id }) => ({
            id,
            label:
              wordingCells[side].get(id)?.value || sectionGroups.get(id)!.label,
          })),
        })),
      }),
    ],
  };
  return [profile, summary, ...sectionGroups.values(), resumeOrder];
}

/** Filter cards while keeping the original section and entry structure.
 * @param groups Complete comparison groups for the selected pair.
 * @param filters Current view, section, and change type.
 * @returns Filtered groups with match counts and totals across the complete comparison.
 * @example filterResumeComparison(groups, { show: "content", section: "all", change: "all" })
 */
export function filterResumeComparison(
  groups: ComparisonGroup[],
  filters: ComparisonFilters,
) {
  let total = 0;
  let contentDifferences = 0;
  let matching = 0;
  const visible = groups.flatMap((group) => {
    const inSection = filters.section === "all" || filters.section === group.id;
    const matches = (row: ComparisonRow) => {
      total++;
      if (row.contentDifference) contentDifferences++;
      return (
        inSection &&
        (filters.show === "all" || row.contentDifference) &&
        (filters.change === "all" || row.changes.includes(filters.change))
      );
    };
    const rows = group.rows.filter(matches);
    const entries = group.entries.flatMap((entry) => {
      const rows = entry.rows.filter(matches);
      return rows.length ? [{ ...entry, rows }] : [];
    });
    const count =
      rows.length + entries.reduce((sum, entry) => sum + entry.rows.length, 0);
    matching += count;
    return count ? [{ ...group, rows, entries, count }] : [];
  });
  return { groups: visible, total, contentDifferences, matching };
}

type WordingPart = { text: string; changed: boolean };

/** Mark changed words while keeping each original string intact, including whitespace.
 * @param values Nonempty left and right wording in the same language.
 * @param language Language used for word segmentation.
 * @returns {Pair<WordingPart[]> | undefined} Per-side parts, or undefined when highlighting exceeds its bounds or segmentation is unavailable.
 * @example compareWording(["Led a team", "Built a team"], "en-US")
 */
export function compareWording(
  values: Pair<string>,
  language: string,
): Pair<WordingPart[]> | undefined {
  if (values.some((value) => !value || value.length > 4096) || !Intl.Segmenter)
    return undefined;
  const segmenter = new Intl.Segmenter(language, { granularity: "word" });
  const [left, right] = mapPair(values, (value) =>
    Array.from(segmenter.segment(value), ({ segment }) => segment),
  );
  const parts = diffArrays(left, right, { maxEditLength: 128 });
  if (!parts) return undefined;
  return [
    parts
      .filter(({ added }) => !added)
      .map(({ value, removed }) => ({
        text: value.join(""),
        changed: !!removed,
      })),
    parts
      .filter(({ removed }) => !removed)
      .map(({ value, added }) => ({ text: value.join(""), changed: !!added })),
  ];
}
