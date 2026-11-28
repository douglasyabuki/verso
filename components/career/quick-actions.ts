import {
  Archive,
  ArchiveRestore,
  Columns2,
  Copy,
  FilePlus2,
  Languages,
  ListOrdered,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";

import type { ResumeActions } from "@/components/career/resume-workspace";
import type { QuickAction } from "@/components/ui/quick-actions";
import { CAREER_TERMS } from "@/lib/career/terminology";
import type {
  CareerDocument,
  CareerEntry,
  CareerResume,
  CareerSection,
} from "@/types-and-constants/career";

export type CareerNavigationAction = (
  destination: string,
  entry?: CareerEntry,
) => void;

/** Workspace commands the sidebar and page headers expose as quick actions. */
export type CareerActions = {
  addSection: () => void;
  createEntry: (sectionId: string, open: CareerNavigationAction) => void;
  toggleSectionArchived: (sectionId: string) => void;
  createLibraryItem: (kind: "preset" | "starter") => void;
  /** A Save is running; commands are unavailable until it settles. */
  busy: boolean;
};

const busyHint = "Wait for the current Save to finish.";

/** Navigation-only action for a destination row. */
export function openAction(open: () => void): QuickAction {
  return { key: "open", label: "Open/Edit", icon: Pencil, onSelect: open };
}

export function createEntryQuickAction(
  section: CareerSection,
  busy: boolean,
  onSelect: () => void,
): QuickAction {
  return {
    key: "create-entry",
    label: CAREER_TERMS[section.kind].addEntry,
    icon: Plus,
    disabled: busy || section.entries.length >= 300,
    hint: busy ? busyHint : "Limit of 300 entries reached.",
    onSelect,
  };
}

/** Resume menu: edits and copies first, Delete last after a divider. */
export function resumeQuickActions(
  document: CareerDocument,
  resume: CareerResume,
  actions: ResumeActions,
): QuickAction[] {
  const full = document.resumes.length >= 120;
  const otherLanguage = document.languages.some(
    (item) => item.active && item.tag !== resume.language,
  );
  return [
    {
      key: "edit",
      label: "Edit name & color",
      icon: Pencil,
      onSelect: () => actions.edit(resume),
    },
    {
      ...compareAction(document, actions.saving),
      label: "Compare",
      onSelect: () => actions.compare(resume),
    },
    {
      key: "duplicate",
      label: "Duplicate",
      icon: Copy,
      disabled: full,
      hint: "Limit of 120 resumes reached.",
      onSelect: () => actions.duplicate(resume),
    },
    {
      key: "copy",
      label: "Create copy in another language",
      icon: Languages,
      disabled: full || !otherLanguage,
      hint: full
        ? "Limit of 120 resumes reached."
        : "Activate another content language first.",
      onSelect: () => actions.copy(resume),
    },
    ...(actions.saveStarter
      ? [
          {
            key: "starter",
            label: "Save as starter",
            icon: FilePlus2,
            disabled: document.starters.length >= 100,
            hint: "Limit of 100 starters reached.",
            onSelect: () => actions.saveStarter?.(resume),
          },
        ]
      : []),
    {
      key: "delete",
      label: "Delete resume",
      icon: Trash2,
      destructive: true,
      onSelect: () => actions.delete(resume),
    },
  ];
}

/** Career section menu. Sections are archived, never deleted, so there is no negative action. */
export function sectionQuickActions(
  section: CareerSection,
  actions: CareerActions,
  open: CareerNavigationAction,
  { includeCreateEntry = false } = {},
): QuickAction[] {
  return [
    openAction(() => open(`list/${section.id}`)),
    ...(includeCreateEntry
      ? [
          createEntryQuickAction(section, actions.busy, () =>
            actions.createEntry(section.id, open),
          ),
        ]
      : []),
    {
      key: "properties",
      label: "Section properties",
      icon: Settings2,
      onSelect: () => open(`section/${section.id}`),
    },
    {
      key: "archive",
      label: section.archived ? "Restore section" : "Archive section",
      icon: section.archived ? ArchiveRestore : Archive,
      disabled: actions.busy,
      hint: busyHint,
      onSelect: () => actions.toggleSectionArchived(section.id),
    },
  ];
}

/** Career details collection header (right-click). */
export function careerDetailsQuickActions(
  document: CareerDocument,
  actions: CareerActions,
  open: (destination: string) => void,
): QuickAction[] {
  return [
    openAction(() => open("overview")),
    {
      key: "add",
      label: "Add section",
      icon: Plus,
      disabled: document.sections.length >= 100,
      hint: "Limit of 100 sections reached.",
      onSelect: actions.addSection,
    },
    {
      key: "order",
      label: "Edit section order",
      icon: ListOrdered,
      onSelect: () => open("sections"),
    },
  ];
}

/** Layout presets or Resume starters row. */
export function libraryQuickActions(
  document: CareerDocument,
  kind: "preset" | "starter",
  actions: CareerActions,
  open: (destination: string) => void,
): QuickAction[] {
  const collection = kind === "preset" ? "presets" : "starters";
  return [
    openAction(() => open(collection)),
    {
      key: "create",
      label: `Create ${kind}`,
      icon: Plus,
      disabled: actions.busy || document[collection].length >= 100,
      hint: actions.busy ? busyHint : `Limit of 100 ${collection} reached.`,
      onSelect: () => actions.createLibraryItem(kind),
    },
  ];
}

/** Management actions for a saved layout preset or resume starter. */
export function libraryItemQuickActions(
  kind: "preset" | "starter",
  count: number,
  busy: boolean,
  actions: { edit: () => void; duplicate: () => void; delete: () => void },
): QuickAction[] {
  return [
    {
      key: "edit",
      label: "Edit",
      icon: Pencil,
      disabled: busy,
      hint: busyHint,
      onSelect: actions.edit,
    },
    {
      key: "duplicate",
      label: "Duplicate",
      icon: Copy,
      disabled: busy || count >= 100,
      hint: busy ? busyHint : `Limit of 100 ${kind}s reached.`,
      onSelect: actions.duplicate,
    },
    {
      key: "delete",
      label: "Delete",
      icon: Trash2,
      disabled: busy,
      hint: busyHint,
      destructive: true,
      onSelect: actions.delete,
    },
  ];
}

function compareAction(
  document: CareerDocument,
  busy: boolean,
): Omit<QuickAction, "onSelect"> {
  return {
    key: "compare",
    label: "Compare resumes",
    icon: Columns2,
    disabled: busy || document.resumes.length < 2,
    hint: busy ? busyHint : "Create at least two resumes to compare.",
  };
}

/** Collection commands shared by the Resumes page and sidebar heading. */
export function resumeCollectionActions(
  document: CareerDocument,
  busy: boolean,
): {
  create: Omit<QuickAction, "onSelect">;
  compare: Omit<QuickAction, "onSelect">;
} {
  const full = document.resumes.length >= 120;
  return {
    create: {
      key: "create",
      label: "Create resume",
      icon: Plus,
      disabled: busy || full || !document.languages.some((item) => item.active),
      hint: busy
        ? busyHint
        : full
          ? "Limit of 120 resumes reached."
          : "Activate a content language first.",
    },
    compare: compareAction(document, busy),
  };
}
