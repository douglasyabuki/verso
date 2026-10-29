import { cn } from "cn";
import type { ReactNode } from "react";

/** Align an item's header and body beside a persistent, top-aligned handle gutter. */
export function SortableItemLayout({
  dragHandle,
  children,
  contentClassName,
  handleClassName,
}: {
  dragHandle: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  handleClassName?: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-x-2 ps-1 pe-3">
      <div
        className={cn(
          "flex size-7 items-center justify-center",
          handleClassName,
        )}
      >
        {dragHandle}
      </div>
      <div className={cn("flex min-w-0 flex-col gap-3", contentClassName)}>
        {children}
      </div>
    </div>
  );
}
