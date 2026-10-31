"use client";

import { createContext } from "react";

import type { Locale } from "@/types-and-constants/languages";

/** Narrow owner-editor actions supplied by WorkspaceWorkflowProvider. */
export const WorkflowLinksContext = createContext<{
  editCareer: (path: string, locale: Locale) => void;
} | null>(null);
