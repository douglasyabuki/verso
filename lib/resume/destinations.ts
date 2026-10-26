import { localizedFields } from "@/lib/resume/localization";
import type {
  WorkspaceDestination,
  WorkspaceFocusTarget,
} from "@/types-and-constants/navigation";
import type { ResumeDocument } from "@/types-and-constants/resume";
import type { Issue } from "@/types-and-constants/review";

/** Resolve stable wording identity to its owner, including excluded or archived targets.
 * @param document Current restored workspace.
 * @param target Stable field, language, and optional resume ownership.
 * @param edit Open shared editing instead of its review tab.
 * @returns Owner destination, or null after deletion.
 * @example resolveOwnerDestination(document, { path: "profile.summary", locale: "en-US" });
 */
export function resolveOwnerDestination(
  document: ResumeDocument,
  target: WorkspaceFocusTarget,
  edit = false,
): WorkspaceDestination | null {
  const field = localizedFields(document).find(
    (field) => field.path === target.path,
  );
  if (!field) return null;
  if (target.resumeId)
    return document.variants.some((resume) => resume.id === target.resumeId)
      ? { kind: "resume", resumeId: target.resumeId, page: "translations" }
      : null;
  return {
    kind: "library-section",
    sectionId: field.sectionId,
    tab: edit ? "edit" : "review",
  };
}

/** Resolve validation and comparison links through the same typed destination boundary.
 * @param document Restored workspace used to reject stale IDs.
 * @param issue Issue carrying an editor target.
 * @param resumeId Preview resume for targets without explicit ownership.
 * @returns Reachable editor destination, or null for unavailable targets.
 * @example resolveIssueDestination(document, issue, document.variants[0].id);
 */
export function resolveIssueDestination(
  document: ResumeDocument,
  issue: Issue,
  resumeId: string,
): WorkspaceDestination | null {
  const target = issue.target;
  if (!target) return null;
  if (target.sectionId === "template" || target.scope === "variant") {
    const id = target.variantId ?? resumeId;
    return document.variants.some((resume) => resume.id === id)
      ? {
          kind: "resume",
          resumeId: id,
          page: target.sectionId === "template" ? "layout" : "content",
        }
      : null;
  }
  if (
    target.sectionId === "profile" ||
    document.sections.some((section) => section.id === target.sectionId)
  )
    return {
      kind: "library-section",
      sectionId: target.sectionId,
      tab: "edit",
    };
  return null;
}
