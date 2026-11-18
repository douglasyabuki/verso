"use client";

import { Plus } from "lucide-react";
import { type ReactNode, useRef } from "react";

import {
  type QuickAction,
  QuickActionsContextMenu,
} from "@/components/ui/quick-actions";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { SidebarSelection } from "@/components/ui/sidebar-selection";
import { useCollectionAllocation } from "@/hooks/workspace/use-collection-allocation";

export function SidebarCollection({
  label,
  active,
  onOpen,
  onCreate,
  createLabel,
  createDisabled,
  contextActions = [],
  children,
}: {
  label: string;
  active: boolean;
  onOpen: () => void;
  onCreate?: () => void;
  createLabel?: string;
  createDisabled?: boolean;
  /** Right-click actions for the collection heading. */
  contextActions?: QuickAction[];
  children: ReactNode;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useCollectionAllocation({ group: groupRef, content: contentRef });
  return (
    <SidebarGroup
      ref={groupRef}
      data-sidebar-collection={label}
      className="min-h-0 shrink px-3 py-0"
    >
      <SidebarSelection className="shrink-0">
        <QuickActionsContextMenu actions={contextActions}>
          <SidebarGroupLabel
            render={<button type="button" />}
            aria-current={active ? "page" : undefined}
            data-active={active || undefined}
            className="h-9 w-full pr-9 hover:bg-sidebar-accent data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground"
            onClick={onOpen}
          >
            {label}
          </SidebarGroupLabel>
        </QuickActionsContextMenu>
      </SidebarSelection>
      {onCreate && (
        <SidebarGroupAction
          className="top-2 right-5 disabled:opacity-50"
          aria-label={createLabel}
          title={createLabel}
          disabled={createDisabled}
          onClick={onCreate}
        >
          <Plus />
        </SidebarGroupAction>
      )}
      <div
        data-collection-viewport
        role="region"
        aria-label={`${label} list`}
        tabIndex={0}
        className="app-scrollbar min-h-0 overflow-x-hidden overflow-y-auto"
      >
        <div ref={contentRef}>
          <SidebarSelection>{children}</SidebarSelection>
        </div>
      </div>
    </SidebarGroup>
  );
}
