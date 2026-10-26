import type { Locale } from "@/types-and-constants/languages";
import type { Issue } from "@/types-and-constants/review";

type LibraryTab = "edit" | "review";

type ResumePage = "content" | "translations" | "layout";

export type WorkspaceDestination =
  | { kind: "library-overview" }
  | { kind: "library-section"; sectionId: string; tab: LibraryTab }
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

export type LibraryEditorContext = {
  entryId: string;
  query: string;
  showArchived: boolean;
};
