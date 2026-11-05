import { effectiveResume, resolveResumeWording } from "@/lib/career/resumes";
import { type RichText, wordingText } from "@/lib/career/wording";
import {
  CAREER_OUTPUT_CAPABILITIES,
  type CareerDocument,
  type ResumeOutputAssessment,
  type ResumeOutputIssue,
} from "@/types-and-constants/career";

/** Assess only one resume's effective committed output, independently of Save validation.
 * @param document Validated committed workspace; never uncommitted draft values.
 * @param resumeId Resume identity to assess.
 * @returns {ResumeOutputAssessment} All blocking issues in output order and readiness; missing resumes return one issue.
 * @example assessResumeOutput(document, document.resumes[0].id).ready
 */
export function assessResumeOutput(
  document: CareerDocument,
  resumeId: string,
): ResumeOutputAssessment {
  const stored = document.resumes.find((resume) => resume.id === resumeId);
  if (!stored)
    return {
      ready: false,
      issues: [
        {
          id: `${resumeId}:missing-resume`,
          code: "missing-resume",
          recordId: resumeId,
          message: "Resume not found.",
        },
      ],
    };
  const resume = effectiveResume(document, stored);
  const issues: ResumeOutputIssue[] = [];
  const capability = CAREER_OUTPUT_CAPABILITIES[resume.language];
  if (!capability)
    issues.push({
      id: `${resumeId}:unverified-language`,
      code: "unverified-language",
      recordId: resumeId,
      message:
        "PDF unavailable: language rendering has not been verified. Language activation does not enable PDF support.",
    });
  const missing = (id: string, values: Record<string, RichText>) =>
    !wordingText(resolveResumeWording(resume, id, values)).trim();
  const add = (recordId: string, message: string) =>
    issues.push({
      id: `${resumeId}:missing-wording:${recordId}`,
      code: "missing-wording",
      recordId,
      message,
      target: { destination: `resume-wording/${resumeId}`, fieldId: recordId },
    });
  const name = document.profile.fields.find(
    (field) => field.key === "fullName",
  )!;
  if (missing(name.id, name.wording))
    add(name.id, `Add full name wording in ${resume.language} before output.`);
  for (const selection of resume.selection) {
    if (!selection.entryIds.length) continue;
    const section = document.sections.find(
      (item) => item.id === selection.sectionId,
    )!;
    const label = section.name || section.kind;
    if (section.kind === "custom" && missing(section.id, section.heading))
      add(
        section.id,
        `${label}: add a section heading in ${resume.language} before output.`,
      );
    for (const entryId of selection.entryIds) {
      const entry = section.entries.find((item) => item.id === entryId)!;
      const entryLabel = `${label} · ${entry.name || "Untitled entry"}`;
      const title = selection.fieldIds
        .map((id) => entry.fields.find((field) => field.id === id))
        .find((field) => field && ["title", "degree"].includes(field.key));
      if (title && missing(title.id, title.wording))
        add(
          title.id,
          `${entryLabel}: add selected ${title.key} wording in ${resume.language} before output.`,
        );
      for (const id of selection.achievementIds) {
        const achievement = entry.achievements.find((item) => item.id === id);
        if (achievement && missing(id, achievement.wording))
          add(
            id,
            `${entryLabel}: add selected achievement ${entry.achievements.indexOf(achievement) + 1} wording in ${resume.language} before output.`,
          );
      }
    }
  }
  return { ready: issues.length === 0, issues };
}
