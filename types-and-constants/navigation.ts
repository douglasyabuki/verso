import type {
  Locale,
  LocalizedFieldDescriptor,
} from "@/types-and-constants/resume";

export type LibraryTab = "edit" | "review";
export type ResumePage = "content" | "translations" | "layout";
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

export type ReviewItem = WorkspaceFocusTarget & {
  id: string;
  owner: string;
  field: LocalizedFieldDescriptor;
  reasons: string[];
  output: boolean;
  provenance: string;
};
export type ReviewFilters = {
  owner: string;
  language: string;
  section: string;
  reason: string;
  output: string;
};
export type ReviewReturnContext = {
  current: WorkspaceFocusTarget | null;
  filters: ReviewFilters;
  scroll: number;
  pageScroll?: number;
};
export type LibraryEditorContext = {
  entryId: string;
  query: string;
  showArchived: boolean;
};
