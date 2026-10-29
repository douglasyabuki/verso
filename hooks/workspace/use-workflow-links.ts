"use client";

import { createContext, useContext } from "react";

import type { Locale } from "@/types-and-constants/languages";

export const WorkflowLinksContext = createContext<{
  editCareer: (path: string, locale: Locale) => void;
}>({ editCareer: () => {} });

/** Access explicit owner-editor links without coupling wording controls to navigation state.
 * @returns Actions provided by the mounted workspace navigation owner.
 * @example const { editCareer } = useWorkflowLinks();
 */
export function useWorkflowLinks() {
  return useContext(WorkflowLinksContext);
}
