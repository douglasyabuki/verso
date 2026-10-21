"use client";

import { useEffect, useSyncExternalStore } from "react";

import { useWorkspace } from "@/hooks/workspace/use-workspace";

/** Read the browser platform for shortcut presentation.
 * @returns Whether Command-based shortcuts apply. @example const apple = applePlatform();
 */
function applePlatform() {
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

/** Subscribe to the immutable platform value.
 * @returns No-op cleanup. @example useSyncExternalStore(subscribePlatform, applePlatform, () => false);
 */
function subscribePlatform() {
  return () => {};
}

/** Bind workspace history shortcuts while preserving native text editing and modal interactions.
 * @returns Platform shortcut labels for the toolbar; listener is removed on unmount.
 * @example const shortcuts = useWorkspaceHistory();
 */
export function useWorkspaceHistory() {
  const { controller } = useWorkspace();
  const apple = useSyncExternalStore(
    subscribePlatform,
    applePlatform,
    () => false,
  );

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.composedPath()[0];
      const focused = document.activeElement;
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.keyCode === 229 ||
        event.altKey ||
        (target instanceof HTMLElement &&
          (target.closest("input, textarea, [role='textbox']") ||
            target.isContentEditable)) ||
        (focused instanceof HTMLElement &&
          (focused.closest("input, textarea, [role='textbox']") ||
            focused.isContentEditable)) ||
        document.querySelector(
          '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]',
        )
      )
        return;
      if (
        apple
          ? !event.metaKey || event.ctrlKey
          : !event.ctrlKey || event.metaKey
      )
        return;
      const key = event.key.toLowerCase();
      const undo = key === "z" && !event.shiftKey;
      const redo =
        (key === "z" && event.shiftKey) ||
        (!apple && key === "y" && !event.shiftKey);
      const state = controller.getSnapshot();
      if (undo && state.canUndo) {
        event.preventDefault();
        controller.undo();
      } else if (redo && state.canRedo) {
        event.preventDefault();
        controller.redo();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [controller, apple]);

  return {
    undo: apple ? "⌘Z" : "Ctrl+Z",
    redo: apple ? "⇧⌘Z" : "Ctrl+Y / Ctrl+Shift+Z",
  };
}
