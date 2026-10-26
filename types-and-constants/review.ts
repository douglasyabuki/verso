import type { Locale } from "@/types-and-constants/languages";
import type { WorkspaceFocusTarget } from "@/types-and-constants/navigation";
import type { LocalizedFieldDescriptor } from "@/types-and-constants/resume";

export type Issue = {
  id: string;
  path: string;
  message: string;
  category: "error" | "translation" | "shared-wording" | "layout";
  locale: Locale;
  section: string;
  entry: string;
  field: string;
  target?: {
    sectionId: string;
    entryId?: string;
    fieldKey: string;
    variantId?: string;
    scope?: "variant" | "shared";
    wordingPath?: string;
  };
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

type ReviewCategory = keyof typeof reviewCategoryLabels;

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
