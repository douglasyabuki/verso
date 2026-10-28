import { localized } from "@/lib/resume/localization";
import type {
  CareerTarget,
  ResumeDocument,
} from "@/types-and-constants/resume";

/** Check whether a career target contains anything that clearing would remove.
 * @param document Current workspace. @param target Profile, summary, or section.
 * @returns {boolean} True when content or summary review metadata can be cleared.
 * @example hasCareerContent(document, { kind: "profile" });
 */
export function hasCareerContent(
  document: ResumeDocument,
  target: CareerTarget,
): boolean {
  if (target.kind === "profile") {
    const { name, email, phone, city, country, links } = document.profile;
    return !!(name || email || phone || city || country || links.length);
  }
  if (target.kind === "summary")
    return Object.values(document.profile.summary).some(
      (value) =>
        value.spans.some((span) => span.text.length > 0) ||
        value.needsReview ||
        value.reviewedCounterpart !== null,
    );
  return !!document.sections.find((section) => section.id === target.sectionId)
    ?.entries.length;
}

/** Clear shared career content while preserving its container and unrelated facts.
 * @param draft Mutable workspace draft. @param target Content to clear.
 * @returns {void} Mutates the draft and removes deleted entry selections; wording reconciliation runs in the controller.
 * @example clearCareerContent(draft, { kind: "section", sectionId });
 */
export function clearCareerContent(
  draft: ResumeDocument,
  target: CareerTarget,
): void {
  if (target.kind === "profile") {
    Object.assign(draft.profile, {
      name: "",
      email: "",
      phone: "",
      city: "",
      country: "",
      links: [],
    });
  } else if (target.kind === "summary") {
    const empty = localized();
    for (const locale of ["en-US", "pt-BR"] as const)
      empty[locale].revision = draft.profile.summary[locale].revision + 1;
    draft.profile.summary = empty;
  } else {
    const section = draft.sections.find((item) => item.id === target.sectionId);
    if (!section) return;
    const removed = new Set(section.entries.map((entry) => entry.id));
    section.entries = [];
    for (const resume of draft.variants)
      for (const selected of resume.sections)
        selected.entries = selected.entries.filter(
          (entry) => !removed.has(entry.entryId),
        );
  }
}

/** Remove a custom section and its resume references as one draft operation.
 * @param draft Mutable workspace. @param sectionId Custom section identity.
 * @returns {void} Leaves built-in and missing sections unchanged.
 * @example deleteCareerSection(draft, sectionId);
 */
export function deleteCareerSection(
  draft: ResumeDocument,
  sectionId: string,
): void {
  if (
    !draft.sections.some(
      (section) => section.id === sectionId && section.kind === "custom",
    )
  )
    return;
  clearCareerContent(draft, { kind: "section", sectionId });
  draft.sections = draft.sections.filter((section) => section.id !== sectionId);
  for (const resume of draft.variants)
    resume.sections = resume.sections.filter(
      (section) => section.sectionId !== sectionId,
    );
}
