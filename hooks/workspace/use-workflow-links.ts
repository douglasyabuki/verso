"use client";

import { createContext, useContext } from "react";

import type { Locale } from "@/types-and-constants/resume";

export const WorkflowLinksContext = createContext<{
  editLibrary: (path: string, locale: Locale) => void;
}>({ editLibrary: () => {} });

/** Access explicit owner-editor links without coupling wording controls to navigation state.
 * @returns Actions provided by the mounted workspace navigation owner.
 * @example const { editLibrary } = useWorkflowLinks();
 */
export function useWorkflowLinks() {
  return useContext(WorkflowLinksContext);
}
