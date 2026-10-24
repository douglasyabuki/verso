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
  categories: ReviewCategory[];
  usedBy: string[];
  archived: boolean;
  output: boolean;
  provenance: string;
};

export const reviewCategoryLabels = {
  missing: "Missing required text",
  translation: "Compare translations",
  library: "Review library changes",
} as const;

export type ReviewCategory = keyof typeof reviewCategoryLabels;
export type ReviewFilters = {
  owner: string;
  language: string;
  section: string;
  reason: string;
  output: string;
  archive: string;
};
export type ReviewReturnContext = {
  outputResumeId?: string;
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
