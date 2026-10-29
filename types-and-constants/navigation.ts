import type { Locale } from "@/types-and-constants/languages";
import type { Issue } from "@/types-and-constants/review";

type CareerTab = "edit" | "review";

type ResumePage = "content" | "translations" | "layout";

export type WorkspaceDestination =
  | { kind: "career-overview" }
  | { kind: "career-profile" }
  | { kind: "career-summary"; tab: CareerTab }
  | { kind: "career-section"; sectionId: string; tab: CareerTab }
  | { kind: "resumes" }
  | { kind: "resume"; resumeId: string; page: ResumePage }
  | { kind: "review" }
  | { kind: "data" }
  | { kind: "shared-defaults" };

export type WorkspaceFocusTarget = {
  path: string;
  locale: Locale;
  resumeId?: string;
};

export type IssueNavigation = {
  id: string;
  issue: Issue;
  pending: boolean;
};

export type CareerEditorContext = {
  entryId: string;
  query: string;
  showArchived: boolean;
};
