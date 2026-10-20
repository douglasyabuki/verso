"use client";

import { useState } from "react";

type WorkspaceLayout = { sidebar: boolean; preview: boolean; split: number };
const key = "verso.layout.v1";
const defaults: WorkspaceLayout = { sidebar: true, preview: true, split: 54 };

/** Restore non-content layout preferences; unavailable storage uses defaults.
 * @returns Valid layout preferences. @example const initial = readLayout();
 */
function readLayout(): WorkspaceLayout {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    return {
      sidebar: typeof value?.sidebar === "boolean" ? value.sidebar : true,
      preview: typeof value?.preview === "boolean" ? value.preview : true,
      split:
        typeof value?.split === "number" &&
        value.split >= 30 &&
        value.split <= 70
          ? value.split
          : 54,
    };
  } catch {
    return defaults;
  }
}

/** Manage layout separately from editable resume content and backup freshness.
 * @returns Current preferences and a best-effort persistent patch action.
 * @example const { layout, changeLayout } = useWorkspaceLayout();
 */
export function useWorkspaceLayout() {
  const [layout, setLayout] = useState(readLayout);
  const changeLayout = (patch: Partial<WorkspaceLayout>) => {
    setLayout((current) => {
      const next = { ...current, ...patch };
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* Layout remains usable in this tab. */
      }
      return next;
    });
  };
  return { layout, changeLayout };
}
