import {
  Archive,
  ArchiveRestore,
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
import type {
  CareerDocument,
  CareerResume,
  CareerSection,
} from "@/types-and-constants/career";

/** Workspace commands the sidebar and page headers expose as quick actions. */
export type CareerActions = {
  addSection: () => void;
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
  open: (destination: string) => void,
): QuickAction[] {
  return [
    openAction(() => open(`list/${section.id}`)),
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

/** Resumes collection header (right-click). */
export function resumesQuickActions(
  document: CareerDocument,
  addResume: () => void,
  open: (destination: string) => void,
): QuickAction[] {
  const full = document.resumes.length >= 120;
  return [
    openAction(() => open("resumes")),
    {
      key: "create",
      label: "Create resume",
      icon: Plus,
      disabled: full || !document.languages.some((item) => item.active),
      hint: full
        ? "Limit of 120 resumes reached."
        : "Activate a content language first.",
      onSelect: addResume,
    },
  ];
}
