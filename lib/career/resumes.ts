import { careerFieldLabel } from "@/lib/career/labels";
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
  shared: RichText;
  rich: boolean;
  destination: string;
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
    layout: structuredClone(document.defaults),
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
  const add = (
    id: string,
    label: string,
    shared: Record<string, RichText>,
    destination: string,
    owner: ResumeFieldOwner,
    rich = false,
    icon?: SectionIconId,
  ) =>
    rows.push({
      id,
      label,
      shared: shared[language] ?? "",
      destination,
      owner,
      icon,
      rich,
    });
  for (const field of document.profile.fields.filter(
    (field) => field.type === "text",
  ))
    add(
      field.id,
      `Profile · ${careerFieldLabel(field.key)}`,
      field.wording,
      "profile",
      "profile",
    );
  for (const link of document.profile.links)
    add(link.id, "Profile · Link label", link.label, "profile", "profile");
  add(
    document.summary.id,
    "Summary",
    document.summary.wording,
    "summary",
    "summary",
    true,
  );
  for (const section of document.sections) {
    add(
      section.id,
      `${section.name || section.kind} · Heading`,
      section.heading,
      `section/${section.id}`,
      section.kind,
      false,
      section.icon,
    );
    for (const entry of section.entries) {
      const label = `${section.name || section.kind} · ${entry.name || "Untitled entry"}`;
      for (const field of entry.fields.filter((field) => field.type === "text"))
        add(
          field.id,
          `${label} · ${careerFieldLabel(field.key)}`,
          field.wording,
          `entry/${entry.id}`,
          section.kind,
          false,
          section.icon,
        );
      entry.achievements.forEach((item, index) =>
        add(
          item.id,
          `${label} · Achievement ${index + 1}`,
          item.wording,
          `entry/${entry.id}`,
          section.kind,
          true,
          section.icon,
        ),
      );
      entry.links.forEach((item, index) =>
        add(
          item.id,
          `${label} · Link ${index + 1} label`,
          item.label,
          `entry/${entry.id}`,
          section.kind,
          false,
          section.icon,
        ),
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
  const selected = new Set<string>([
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

/** Describe nonempty committed contacts in the same order as output, for layout row controls.
 * @param document Committed shared career records.
 * @param resume Independent resume with selections and wording overrides.
 * @returns {string[]} Effective displayed contact values, omitting empty items without cross-language fallback.
 * @example profileContactLabels(document, resume)
 */
export function profileContactLabels(
  document: CareerDocument,
  resume: CareerResume,
): string[] {
  return effectiveResume(document, resume)
    .profileSelection!.map((id) => {
      const field = document.profile.fields.find((item) => item.id === id);
      if (field)
        return field.type === "text"
          ? wordingText(resolveResumeWording(resume, id, field.wording))
          : field.fact;
      const link = document.profile.links.find((item) => item.id === id);
      return link?.url
        ? wordingText(resolveResumeWording(resume, id, link.label)) || link.url
        : "";
    })
    .filter((value) => !!value.trim());
}
