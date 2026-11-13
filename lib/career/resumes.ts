import { careerFieldLabel } from "@/lib/career/labels";
import { layoutFromPreset } from "@/lib/career/layout";
import type { RichText } from "@/lib/career/wording";
import { wordingText } from "@/lib/career/wording";
import type {
  CareerDocument,
  CareerResume,
  CareerSection,
} from "@/types-and-constants/career";
import { CAREER_OUTPUT_CAPABILITIES } from "@/types-and-constants/career";
import type { SectionIconId } from "@/types-and-constants/section-icons";

export type ResumeContent = Pick<
  CareerResume,
  "selection" | "profileSelection" | "summaryIncluded"
>;

export type ResumeFieldOwner =
  CareerSection["kind"] | "profile" | "summary" | "resume";
export type ResumeWordingField = {
  owner: ResumeFieldOwner;
  icon?: SectionIconId;
  id: string;
  label: string;
  /** Label within its card or entry, e.g. "Title" or "Achievement 2". */
  shortLabel: string;
  /** `profile`, `summary`, or the owning section ID. */
  groupId: string;
  entryId?: string;
  archived: boolean;
  shared: RichText;
  rich: boolean;
  destination: string;
};

export type ResumeWordingRow = ResumeWordingField & { included: boolean };

export type ResumeWordingEntryGroup = {
  id: string;
  label: string;
  archived: boolean;
  included: boolean;
  destination: string;
  rows: ResumeWordingRow[];
};

export type ResumeWordingGroup = {
  id: string;
  owner: ResumeFieldOwner;
  icon?: SectionIconId;
  label: string;
  archived: boolean;
  included: boolean;
  destination: string;
  rows: ResumeWordingRow[];
  entries: ResumeWordingEntryGroup[];
};

/** Create an independent, deliberately unselected resume without copying career records.
 * @param document Workspace providing document defaults.
 * @param language Active destination language.
 * @returns {CareerResume} New identity with required name only and no custom wording.
 * @example createResume(document, "en-US")
 */
export function createResume(
  document: CareerDocument,
  language: string,
): CareerResume {
  if (!document.languages.some((item) => item.tag === language && item.active))
    throw new Error("Choose an active content language.");
  return {
    id: crypto.randomUUID(),
    name: "",
    color: "indigo",
    language,
    template: "yabuki-reference@1.0.3",
    selection: [],
    profileSelection: [],
    summaryIncluded: false,
    overrides: {},
    layout: layoutFromPreset(document.defaults),
  };
}

/** Copy committed configuration while retaining shared career identities.
 * @param source Committed source resume.
 * @param language Destination language; omission duplicates in the source language.
 * @returns {CareerResume} Fresh resume with independent configuration; cross-language overrides are cleared.
 * @example copyResume(resume, "pt-BR")
 */
export function copyResume(
  source: CareerResume,
  language = source.language,
): CareerResume {
  return {
    ...structuredClone(source),
    createdSectionIds: undefined,
    id: crypto.randomUUID(),
    language,
    name: `${source.name || "Untitled resume"} ${language === source.language ? "copy" : `(${language})`}`.slice(
      0,
      500,
    ),
    overrides:
      language === source.language ? structuredClone(source.overrides) : {},
  };
}

/** Resolve display wording, preserving explicit empty custom text and missing destination wording.
 * @param resume Resume whose single language is authoritative.
 * @param id Stable wording identity.
 * @param shared Career wording indexed by content language.
 * @returns {RichText} Custom text, destination career text, or empty text; never another language.
 * @example resolveResumeWording(resume, field.id, field.wording)
 */
export function resolveResumeWording(
  resume: CareerResume,
  id: string,
  shared: Record<string, RichText>,
): RichText {
  return Object.hasOwn(resume.overrides, id)
    ? resume.overrides[id]
    : (shared[resume.language] ?? "");
}

/** Resolve visibility without losing the stored hidden configuration or old schema-2 defaults.
 * @param document Committed career records.
 * @param resume Stored independent resume configuration.
 * @returns {CareerResume} Effective output selection with explicit contacts and summary visibility.
 * @example effectiveResume(document, resume).selection
 */
export function effectiveResume(
  document: CareerDocument,
  resume: CareerResume,
): CareerResume {
  return {
    ...resume,
    profileSelection: resume.profileSelection ?? [
      ...document.profile.fields
        .filter((field) => field.key !== "fullName")
        .map((field) => field.id),
      ...document.profile.links
        .filter((link) => !link.archived)
        .map((link) => link.id),
    ],
    summaryIncluded: resume.summaryIncluded ?? true,
    selection: resume.selection
      .filter((section) => !section.hidden)
      .map((section) => ({
        ...section,
        entryIds: section.entryIds.filter(
          (id) => !section.hiddenEntryIds?.includes(id),
        ),
      })),
  };
}

/** Describe every customizable display value without exposing shared facts as editable wording.
 * @param document Shared career records.
 * @param language Resume content language.
 * @returns {ResumeWordingField[]} Stable identities, readable labels, inherited values and career navigation targets.
 * @example resumeWordingFields(document, "pt-BR")
 */
export function resumeWordingFields(
  document: CareerDocument,
  language: string,
): ResumeWordingField[] {
  const rows: ResumeWordingField[] = [];
  const add = ({
    prefix,
    wording,
    archived = false,
    rich = false,
    ...row
  }: Omit<ResumeWordingField, "label" | "shared" | "archived" | "rich"> & {
    prefix: string;
    wording: Record<string, RichText>;
    archived?: boolean;
    rich?: boolean;
  }) =>
    rows.push({
      ...row,
      label: prefix ? `${prefix} · ${row.shortLabel}` : row.shortLabel,
      shared: wording[language] ?? "",
      archived,
      rich,
    });
  const profile = {
    prefix: "Profile",
    destination: "profile",
    owner: "profile",
    groupId: "profile",
  } as const;
  for (const field of document.profile.fields.filter(
    (field) => field.type === "text",
  ))
    add({
      ...profile,
      id: field.id,
      shortLabel: careerFieldLabel(field.key),
      wording: field.wording,
    });
  document.profile.links.forEach((link, index) =>
    add({
      ...profile,
      id: link.id,
      shortLabel: `Link ${index + 1} label`,
      wording: link.label,
      archived: link.archived,
    }),
  );
  add({
    id: document.summary.id,
    prefix: "",
    shortLabel: "Summary",
    wording: document.summary.wording,
    destination: "summary",
    owner: "summary",
    groupId: "summary",
    rich: true,
  });
  for (const section of document.sections) {
    const title = section.name || section.kind;
    const common = {
      owner: section.kind,
      icon: section.icon,
      groupId: section.id,
    };
    add({
      ...common,
      id: section.id,
      prefix: title,
      shortLabel: "Heading",
      wording: section.heading,
      destination: `section/${section.id}`,
      archived: section.archived,
    });
    for (const entry of section.entries) {
      const owner = {
        ...common,
        prefix: `${title} · ${entry.name || "Untitled entry"}`,
        destination: `entry/${entry.id}`,
        entryId: entry.id,
      };
      for (const field of entry.fields.filter((field) => field.type === "text"))
        add({
          ...owner,
          id: field.id,
          shortLabel: careerFieldLabel(field.key),
          wording: field.wording,
        });
      entry.achievements.forEach((item, index) =>
        add({
          ...owner,
          id: item.id,
          shortLabel: `Achievement ${index + 1}`,
          wording: item.wording,
          archived: item.archived,
          rich: true,
        }),
      );
      entry.links.forEach((item, index) =>
        add({
          ...owner,
          id: item.id,
          shortLabel: `Link ${index + 1} label`,
          wording: item.label,
          archived: item.archived,
        }),
      );
    }
  }
  return rows;
}

/** Describe read-only shared facts and their owning career navigation targets.
 * @param document Shared career records, including existing archived content.
 * @returns Fact descriptors with readable labels, sidebar ownership and selection identities.
 * @example resumeFactFields(document).filter((fact) => fact.owner === "profile")
 */
export function resumeFactFields(document: CareerDocument) {
  const rows: {
    id: string;
    selectionId: string;
    label: string;
    value: string;
    destination: string;
    owner: ResumeFieldOwner;
    icon?: SectionIconId;
  }[] = [];
  const add = (
    fields: CareerDocument["profile"]["fields"],
    links: CareerDocument["profile"]["links"],
    label: string,
    destination: string,
    owner: ResumeFieldOwner,
    icon?: SectionIconId,
  ) => {
    for (const field of fields.filter((field) => field.type !== "text"))
      rows.push({
        id: field.id,
        selectionId: field.id,
        label: `${label} · ${careerFieldLabel(field.key)}`,
        value: field.fact,
        destination,
        owner,
        icon,
      });
    links.forEach((link, index) =>
      rows.push({
        id: `url:${link.id}`,
        selectionId: link.id,
        label: `${label} · Link ${index + 1} URL`,
        value: link.url,
        destination,
        owner,
        icon,
      }),
    );
  };
  add(
    document.profile.fields,
    document.profile.links,
    "Profile",
    "profile",
    "profile",
  );
  for (const section of document.sections)
    for (const entry of section.entries)
      add(
        entry.fields,
        entry.links,
        `${section.name || section.kind} · ${entry.name || "Untitled entry"}`,
        `entry/${entry.id}`,
        section.kind,
        section.icon,
      );
  return rows;
}

/** Collect every identity the resume's effective selection renders or orders.
 * @param document Shared career records.
 * @param resume Independent resume configuration.
 * @returns {Set<string>} Full name, selected contacts, summary, sections, entries, and their selected fields, achievements and links.
 * @example resumeSelectedIds(document, resume).has(entry.id)
 */
export function resumeSelectedIds(
  document: CareerDocument,
  resume: CareerResume,
): Set<string> {
  const effective = effectiveResume(document, resume);
  return new Set<string>([
    document.profile.fields.find((field) => field.key === "fullName")!.id,
    ...effective.profileSelection!,
    ...(effective.summaryIncluded ? [document.summary.id] : []),
    ...effective.selection.flatMap((section) => [
      section.sectionId,
      ...section.entryIds,
      ...section.entryIds.flatMap((id) => {
        const entry = document.sections
          .find((item) => item.id === section.sectionId)!
          .entries.find((item) => item.id === id)!;
        return [
          ...section.fieldIds,
          ...section.achievementIds,
          ...section.linkIds,
        ].filter((key) =>
          [...entry.fields, ...entry.achievements, ...entry.links].some(
            (item) => item.id === key,
          ),
        );
      }),
    ]),
  ]);
}

/** Group customizable wording by its Career details owner, in resume output order.
 * @param document Shared career records.
 * @param resume Independent resume whose language and selection apply.
 * @returns {ResumeWordingGroup[]} Profile, Summary, then sections (selected in resume order, then the rest); entries and rows list selected items in output order before excluded ones.
 * @example resumeWordingGroups(document, resume).filter((group) => group.included)
 */
export function resumeWordingGroups(
  document: CareerDocument,
  resume: CareerResume,
): ResumeWordingGroup[] {
  const effective = effectiveResume(document, resume);
  const selected = resumeSelectedIds(document, resume);
  const byOrder = <T extends { id: string }>(items: T[], order: string[]) => {
    const rank = (id: string) => {
      const index = order.indexOf(id);
      return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    };
    return [...items].sort((a, b) => rank(a.id) - rank(b.id));
  };
  const rows = resumeWordingFields(document, resume.language).map(
    (field): ResumeWordingRow => ({
      ...field,
      included: selected.has(field.id),
    }),
  );
  const groupRows = (groupId: string, entryId?: string) =>
    rows.filter((row) => row.groupId === groupId && row.entryId === entryId);
  const groups: ResumeWordingGroup[] = [
    {
      id: "profile",
      owner: "profile",
      label: "Profile",
      archived: false,
      included: true,
      destination: "profile",
      rows: byOrder(groupRows("profile"), [
        document.profile.fields.find((field) => field.key === "fullName")!.id,
        ...effective.profileSelection!,
      ]),
      entries: [],
    },
    {
      id: "summary",
      owner: "summary",
      label: "Summary",
      archived: false,
      included: !!effective.summaryIncluded,
      destination: "summary",
      rows: groupRows("summary"),
      entries: [],
    },
  ];
  const sections = byOrder(
    document.sections,
    effective.selection.map((item) => item.sectionId),
  );
  for (const section of sections) {
    const config = effective.selection.find(
      (item) => item.sectionId === section.id,
    );
    const detailOrder = config
      ? [...config.fieldIds, ...config.achievementIds, ...config.linkIds]
      : [];
    groups.push({
      id: section.id,
      owner: section.kind,
      icon: section.icon,
      label: section.name || section.kind,
      archived: section.archived,
      included: selected.has(section.id),
      destination: `list/${section.id}`,
      rows: groupRows(section.id),
      entries: byOrder(section.entries, config?.entryIds ?? []).map((entry) => {
        const entryRows = groupRows(section.id, entry.id);
        return {
          id: entry.id,
          label: entry.name || "Untitled entry",
          archived: entry.archived,
          included: selected.has(entry.id),
          destination: `entry/${entry.id}`,
          rows: [entry.fields, entry.achievements, entry.links].flatMap(
            (items) =>
              byOrder(
                entryRows.filter((row) =>
                  items.some((item) => item.id === row.id),
                ),
                detailOrder,
              ),
          ),
        };
      }),
    });
  }
  return groups;
}

/** Build comparable rows from effective committed content, independently in each resume's language.
 * @param document Committed workspace; drafts must never be supplied.
 * @param resume Committed resume to inspect.
 * @returns Comparable values with readable labels, owning sidebar kind, order and inclusion metadata.
 * @example resumeComparisonRows(document, document.resumes[0])
 */
export function resumeComparisonRows(
  document: CareerDocument,
  resume: CareerResume,
) {
  const effective = effectiveResume(document, resume);
  const selected = resumeSelectedIds(document, resume);
  const rows = resumeWordingFields(document, resume.language).map((field) => ({
    id: field.id,
    label: field.label,
    owner: field.owner,
    icon: field.icon,
    value: wordingText(
      Object.hasOwn(resume.overrides, field.id)
        ? resume.overrides[field.id]
        : field.shared,
    ),
    status: selected.has(field.id) ? "Included" : "Excluded",
    source: Object.hasOwn(resume.overrides, field.id)
      ? "Custom"
      : "Career wording",
  }));
  // Template labels and URL labels are effective display values too.
  const displayDefaults = new Map<string, string>();
  for (const section of document.sections) {
    displayDefaults.set(
      section.id,
      CAREER_OUTPUT_CAPABILITIES[resume.language]?.labels[section.kind] ?? "",
    );
    for (const entry of section.entries)
      for (const link of entry.links) displayDefaults.set(link.id, link.url);
  }
  for (const link of document.profile.links)
    displayDefaults.set(link.id, link.url);
  for (const row of rows)
    if (!row.value) row.value = displayDefaults.get(row.id) ?? "";
  for (const fact of resumeFactFields(document)) {
    rows.push({
      id: fact.id,
      label: fact.label,
      owner: fact.owner,
      icon: fact.icon,
      value: fact.value,
      status: selected.has(fact.selectionId) ? "Included" : "Excluded",
      source: "Shared fact",
    });
  }
  const orderRows: typeof rows = [
    {
      id: "order:contacts",
      label: "Contact order",
      owner: "profile",
      icon: undefined,
      value: effective
        .profileSelection!.map((id) => {
          const field = document.profile.fields.find(
            (field) => field.id === id,
          );
          if (field) return careerFieldLabel(field.key);
          return (
            wordingText(
              resolveResumeWording(
                resume,
                id,
                document.profile.links.find((link) => link.id === id)!.label,
              ),
            ) || "Link"
          );
        })
        .join(" → "),
      status: "Committed",
      source: "",
    },
    {
      id: "order:sections",
      label: "Section order",
      owner: "resume",
      icon: undefined,
      value: effective.selection
        .map((item) => {
          const section = document.sections.find(
            (section) => section.id === item.sectionId,
          )!;
          return (
            wordingText(
              resolveResumeWording(resume, section.id, section.heading),
            ) ||
            section.name ||
            section.kind
          );
        })
        .join(" → "),
      status: "Committed",
      source: "",
    },
  ];
  for (const section of document.sections) {
    const config = effective.selection.find(
      (item) => item.sectionId === section.id,
    );
    const title = section.name || section.kind;
    orderRows.push({
      id: `order:entries:${section.id}`,
      label: `${title} · Entry order`,
      owner: section.kind,
      icon: section.icon,
      value:
        config?.entryIds
          .map(
            (id) =>
              section.entries.find((entry) => entry.id === id)!.name ||
              "Untitled entry",
          )
          .join(" → ") ?? "",
      status: config ? "Included" : "Excluded",
      source: "",
    });
    for (const entry of section.entries) {
      const visible = config?.entryIds.includes(entry.id);
      const label = `${title} · ${entry.name || "Untitled entry"}`;
      orderRows.push({
        id: `order:details:${entry.id}`,
        label: `${label} · Detail / achievement / link order`,
        owner: section.kind,
        icon: section.icon,
        value:
          visible && config
            ? [
                config.fieldIds
                  .map((id) => {
                    const field = entry.fields.find((field) => field.id === id);
                    return field ? careerFieldLabel(field.key) : undefined;
                  })
                  .filter(Boolean)
                  .join(" → "),
                config.achievementIds
                  .map((id) => {
                    const index = entry.achievements.findIndex(
                      (item) => item.id === id,
                    );
                    return index < 0 ? "" : `Achievement ${index + 1}`;
                  })
                  .filter(Boolean)
                  .join(" → "),
                config.linkIds
                  .map((id) => {
                    const index = entry.links.findIndex(
                      (item) => item.id === id,
                    );
                    return index < 0 ? "" : `Link ${index + 1}`;
                  })
                  .filter(Boolean)
                  .join(" → "),
              ]
                .filter(Boolean)
                .join("; ")
            : "",
        status: visible ? "Included" : "Excluded",
        source: "",
      });
    }
  }
  rows.unshift(...orderRows);
  return rows;
}

export type ProfileContact =
  | { kind: "email" | "phone" | "location"; text: string }
  | { kind: "link"; text: string; url: string };

/** Resolve nonempty profile contacts in output order, optionally combining city and country.
 * @param document Committed shared career records.
 * @param resume Independent resume with selections and wording overrides.
 * @param contactLocation Location grouping; missing values keep city and country separate.
 * @returns {ProfileContact[]} Displayed contact items; a combined location sits at the first selected city/country position and joins their values in selection order.
 * @example profileContacts(document, resume, "combined")
 */
export function profileContacts(
  document: CareerDocument,
  resume: CareerResume,
  contactLocation: CareerResume["layout"]["contactLocation"] = resume.layout
    .contactLocation,
): ProfileContact[] {
  const selected = effectiveResume(document, resume).profileSelection!;
  const fields = document.profile.fields;
  const value = (id: string) => {
    const field = fields.find((item) => item.id === id);
    if (!field) return "";
    return field.type === "text"
      ? wordingText(resolveResumeWording(resume, id, field.wording))
      : field.fact;
  };
  const locationIds = selected.filter((id) =>
    fields.some(
      (field) =>
        field.id === id && (field.key === "city" || field.key === "country"),
    ),
  );
  const items: ProfileContact[] = [];
  for (const id of selected) {
    const field = fields.find((item) => item.id === id);
    if (field) {
      const location = locationIds.includes(id);
      if (location && contactLocation === "combined") {
        if (id !== locationIds[0]) continue;
        const text = locationIds
          .map(value)
          .filter((part) => !!part.trim())
          .join(", ");
        if (text) items.push({ kind: "location", text });
        continue;
      }
      const text = value(id);
      if (!text.trim()) continue;
      items.push({
        kind:
          field.key === "email"
            ? "email"
            : field.key === "phone"
              ? "phone"
              : "location",
        text,
      });
      continue;
    }
    const link = document.profile.links.find((item) => item.id === id);
    if (link?.url)
      items.push({
        kind: "link",
        text: wordingText(resolveResumeWording(resume, id, link.label)),
        url: link.url,
      });
  }
  return items;
}

/** Describe nonempty committed contacts in the same order as output, for layout row controls.
 * @param document Committed shared career records.
 * @param resume Independent resume with selections and wording overrides.
 * @param contactLocation Draft location grouping, so row controls match the edited layout.
 * @returns {string[]} Effective displayed contact values, omitting empty items without cross-language fallback.
 * @example profileContactLabels(document, resume, draft.contactLocation)
 */
export function profileContactLabels(
  document: CareerDocument,
  resume: CareerResume,
  contactLocation?: CareerResume["layout"]["contactLocation"],
): string[] {
  return profileContacts(document, resume, contactLocation).map((item) =>
    item.kind === "link" ? item.text || item.url : item.text,
  );
}
