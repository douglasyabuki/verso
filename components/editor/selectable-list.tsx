"use client";

import {
  AnimatedList,
  type AnimatedListSelectionProps,
} from "@/components/ui/animated-list";

type SelectableListProps<T extends { id: string }> = Omit<
  AnimatedListSelectionProps<T>,
  "mode" | "initialScrollTop" | "onRestoreScroll"
> & {
  restoreScroll: { list: number; page: number };
};

/** Review-card adapter; activation and selection remain owned by the editor. */
export function SelectableList<T extends { id: string }>({
  restoreScroll,
  ...props
}: SelectableListProps<T>) {
  return (
    <AnimatedList
      {...props}
      initialScrollTop={restoreScroll.list}
      onRestoreScroll={(viewport) => {
        const workspace = viewport.closest<HTMLElement>(
          "[data-workspace-scroll]",
        );
        if (workspace) workspace.scrollTop = restoreScroll.page;
      }}
    />
  );
}
