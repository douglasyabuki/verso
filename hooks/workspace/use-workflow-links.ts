"use client";

import { useContext } from "react";

import { WorkflowLinksContext } from "@/contexts/workflow-links";

/** Access owner-editor links without subscribing to navigation state.
 * @returns Shared career editing actions; throws without WorkspaceWorkflowProvider.
 * @example const { editCareer } = useWorkflowLinks();
 */
export function useWorkflowLinks() {
  const links = useContext(WorkflowLinksContext);
  if (!links) throw new Error("WorkspaceWorkflowProvider is required");
  return links;
}
