"use client";

import { useEffect } from "react";

import type { IssueNavigation } from "@/types-and-constants/navigation";

type IssueFocusOptions = {
  navigation?: IssueNavigation;
  disabled: boolean;
  onFocused: (id: string) => void;
};

/** Focus a revealed field after its editor and optional dialog have mounted.
 * @param options Pending navigation, replacement guard, and completion callback.
 * @returns Nothing; cancels observation and animation work on navigation changes or unmount.
 * @example useIssueFocus({ navigation, disabled, onFocused });
 */
export function useIssueFocus({
  navigation,
  disabled,
  onFocused,
}: IssueFocusOptions) {
  useEffect(() => {
    const target = navigation?.issue.target;
    if (!navigation?.pending || !target || disabled) return;
    let frame = 0;
    let finished = false;
    const stop = () => {
      finished = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
    const attempt = () => {
      if (finished) return;
      const element = document.querySelector<HTMLElement>(
        `[data-issue-field="${CSS.escape(target.fieldKey)}"]`,
      );
      if (element && !element.getClientRects().length) {
        const group = element.closest('[data-slot="collapsible"]');
        const trigger = group?.querySelector<HTMLButtonElement>(
          '[data-slot="collapsible-trigger"]',
        );
        if (trigger?.getAttribute("aria-expanded") === "false") trigger.click();
      }
      if (
        !element ||
        !element.getClientRects().length ||
        element.closest("[inert], fieldset:disabled") ||
        element.matches(":disabled")
      )
        return;
      element.scrollIntoView({ block: "center", inline: "nearest" });
      element.focus({ preventScroll: true });
      if (document.activeElement === element) {
        stop();
        onFocused(navigation.id);
      }
    };
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(attempt);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    const timeout = setTimeout(stop, 5000);
    frame = requestAnimationFrame(attempt);
    return stop;
  }, [navigation, disabled, onFocused]);
}
