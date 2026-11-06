import { createResume } from "@/lib/career/resumes";
import type {
  CareerDocument,
  CareerResume,
  StarterCreationRequest,
} from "@/types-and-constants/career";
import { BUILTIN_FIELDS } from "@/types-and-constants/career";

type Starter = CareerDocument["starters"][number];

/** Capture empty structure and appearance without wording or selected records.
 * @param document Career records used only to identify structural section metadata.
 * @param resume Committed source resume.
 * @returns {Starter} Independent starter with a new identity and no content references.
 * @example captureStarter(document, resume)
 */
export function captureStarter(
  document: CareerDocument,
  resume: CareerResume,
): Starter {
  return {
    id: crypto.randomUUID(),
    name: `${resume.name || "Untitled resume"} structure`.slice(0, 500),
    template: resume.template,
    layout: structuredClone(resume.layout),
    summaryIncluded: resume.summaryIncluded ?? true,
    sections: resume.selection.map((selection) => {
      const section = document.sections.find(
        (item) => item.id === selection.sectionId,
      )!;
      const chosen = section.entries.flatMap((entry) =>
        entry.fields
          .filter((field) => selection.fieldIds.includes(field.id))
          .map((field) => field.key),
      );
      return {
        id: crypto.randomUUID(),
        kind: section.kind,
        icon: section.icon,
        label: section.name || section.kind,
        hidden: selection.hidden ?? false,
        visibleFields: selection.fieldDefaults
          ? [...selection.fieldDefaults]
          : selection.entryIds.length
            ? [...new Set(chosen)]
            : [...BUILTIN_FIELDS[section.kind]],
      };
    }),
  };
}

/** Suggest active compatible matches; ambiguity is deliberately unresolved.
 * @param document Committed career records.
 * @param starter Empty structural definitions.
 * @returns {string[]} Section IDs, "new" for missing sections, or empty strings requiring review.
 * @example starterMappings(document, starter)
 */
export function starterMappings(
  document: CareerDocument,
  starter: Starter,
): string[] {
  return starter.sections.map((definition) => {
    const matches = document.sections.filter(
      (section) =>
        !section.archived &&
        section.kind === definition.kind &&
        (section.kind !== "custom" || section.name === definition.label),
    );
    return matches.length === 1 ? matches[0].id : matches.length ? "" : "new";
  });
}

/** Prepare immutable identities for one reviewed, atomic starter-based creation.
 * @param document Workspace at review time.
 * @param starter Committed starter to copy.
 * @param mapping Reviewed active section IDs or "new" in starter order.
 * @param language Active content language.
 * @returns {StarterCreationRequest} New resume, empty missing sections and reviewed metadata for reused sections; throws for invalid or duplicate matches.
 * @example prepareStarterResume(document, starter, starterMappings(document, starter), "en-US")
 */
export function prepareStarterResume(
  document: CareerDocument,
  starter: Starter,
  mapping: string[],
  language: string,
): StarterCreationRequest {
  if (mapping.length !== starter.sections.length)
    throw new Error("Review every section mapping.");
  const resume = createResume(document, language);
  const sections: CareerDocument["sections"] = [];
  const used = new Set<string>();
  resume.layout = structuredClone(starter.layout);
  resume.summaryIncluded = starter.summaryIncluded;
  resume.selection = starter.sections.map((definition, index) => {
    let section = document.sections.find((item) => item.id === mapping[index]);
    if (mapping[index] === "new") {
      section = {
        id: crypto.randomUUID(),
        name: definition.label,
        kind: definition.kind,
        icon: definition.icon,
        heading: {},
        archived: false,
        entries: [],
      };
      sections.push(section);
    }
    if (
      !section ||
      section.archived ||
      section.kind !== definition.kind ||
      used.has(section.id)
    )
      throw new Error(
        "Choose a distinct active section of the matching kind for every row.",
      );
    used.add(section.id);
    return {
      sectionId: section.id,
      hidden: definition.hidden,
      entryIds: [],
      achievementIds: [],
      fieldIds: [],
      linkIds: [],
      fieldDefaults: [...definition.visibleFields],
    };
  });
  resume.createdSectionIds = sections.map((section) => section.id);
  return {
    resume,
    sections,
    reviewedSections: document.sections
      .filter((section) => used.has(section.id))
      .map(({ id, kind, name, icon, archived }) => ({
        id,
        kind,
        name,
        icon,
        archived,
      })),
  };
}

/** Add copied starter defaults only for newly configured entries, retaining prior explicit choices.
 * @param section Shared section supplying stable field identities.
 * @param selection Current resume configuration with optional copied defaults.
 * @param ids Next visible entry IDs.
 * @returns {string[]} Existing field IDs plus matching defaults for genuinely new selections.
 * @example fieldsForNewEntries(section, selection, [entry.id])
 */
export function fieldsForNewEntries(
  section: CareerDocument["sections"][number],
  selection: CareerResume["selection"][number],
  ids: string[],
): string[] {
  return selection.fieldDefaults
    ? [
        ...selection.fieldIds,
        ...section.entries
          .filter(
            (entry) =>
              ids.includes(entry.id) && !selection.entryIds.includes(entry.id),
          )
          .flatMap((entry) =>
            entry.fields
              .filter((field) => selection.fieldDefaults!.includes(field.key))
              .map((field) => field.id),
          ),
      ]
    : selection.fieldIds;
}
