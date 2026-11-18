"use client";

import { type LucideIcon, MoreHorizontal } from "lucide-react";
import { type CSSProperties, type ReactElement, useRef, useState } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** One item in an item's action menu. */
export type QuickAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  /** Reason shown under the label while the action is disabled. */
  hint?: string;
  /** Negative action (delete, clear, sign out): rendered last, after a divider. */
  destructive?: boolean;
};

function QuickActionItem({ action }: { action: QuickAction }) {
  const Icon = action.icon;
  return (
    <DropdownMenuItem
      variant={action.destructive ? "destructive" : "default"}
      disabled={action.disabled}
      onClick={action.onSelect}
    >
      <Icon aria-hidden="true" />
      {/* Menus never wrap: long text truncates with an ellipsis. */}
      <span
        className="min-w-0 truncate"
        title={
          action.disabled && action.hint
            ? `${action.label} — ${action.hint}`
            : action.label
        }
      >
        {action.label}
        {action.disabled && action.hint && (
          <span className="block truncate text-xs text-muted-foreground">
            {action.hint}
          </span>
        )}
      </span>
    </DropdownMenuItem>
  );
}

/** Render actions with every negative action grouped last, after a divider.
 * Menu parts are shared by Base UI's Menu and ContextMenu, so this body renders
 * identically inside both popups.
 * @param props The actions to render, in display order.
 * @returns Grouped menu items.
 * @example <QuickActionItems actions={[{ key: "open", label: "Open", icon: Pencil, onSelect }]} />
 */
export function QuickActionItems({ actions }: { actions: QuickAction[] }) {
  const regular = actions.filter((action) => !action.destructive);
  const negative = actions.filter((action) => action.destructive);
  return (
    <>
      {regular.length > 0 && (
        <DropdownMenuGroup>
          {regular.map((action) => (
            <QuickActionItem key={action.key} action={action} />
          ))}
        </DropdownMenuGroup>
      )}
      {regular.length > 0 && negative.length > 0 && <DropdownMenuSeparator />}
      {negative.length > 0 && (
        <DropdownMenuGroup>
          {negative.map((action) => (
            <QuickActionItem key={action.key} action={action} />
          ))}
        </DropdownMenuGroup>
      )}
    </>
  );
}

/** Attribute marking the item whose width caps its action menus. */
export const quickActionsRowAttribute = "data-quick-actions-row";

/** Width of the item that owns `element`, if one is marked. */
function rowWidth(element: Element | null) {
  return element
    ?.closest(`[${quickActionsRowAttribute}]`)
    ?.getBoundingClientRect().width;
}

/** Popup style that caps the menu at the owning item's width. */
function rowStyle(width: number | undefined) {
  return width === undefined
    ? undefined
    : ({ "--quick-actions-row-width": `${width}px` } as CSSProperties);
}

/** "…" menu for an item's actions. The menu is never wider than the nearest
 * element marked with `quickActionsRowAttribute` (set automatically by
 * `QuickActionsContextMenu`).
 * @param props Actions and the trigger element; the "…" icon is supplied.
 * @returns A dropdown menu.
 * @example <QuickActionsMenu actions={actions} trigger={<Button aria-label="Actions for X" />} />
 */
export function QuickActionsMenu({
  actions,
  trigger,
  align = "end",
}: {
  actions: QuickAction[];
  trigger: ReactElement;
  align?: "start" | "center" | "end";
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [width, setWidth] = useState<number>();
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) setWidth(rowWidth(triggerRef.current));
      }}
    >
      <DropdownMenuTrigger ref={triggerRef} render={trigger}>
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="quick-actions-dropdown"
        style={rowStyle(width)}
      >
        <QuickActionItems actions={actions} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Open the same actions on right-click (or the keyboard context-menu key).
 * The wrapped element becomes the row that caps the menu width.
 * @param props Actions and the element that receives the context menu.
 * @returns The element wrapped as a context-menu trigger.
 * @example <QuickActionsContextMenu actions={actions}><SidebarMenuItem /></QuickActionsContextMenu>
 */
export function QuickActionsContextMenu({
  actions,
  children,
}: {
  actions: QuickAction[];
  children: ReactElement;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>();
  if (!actions.length) return children;
  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open) setWidth(rowWidth(triggerRef.current));
      }}
    >
      <ContextMenuTrigger
        ref={triggerRef}
        render={children}
        {...{ [quickActionsRowAttribute]: "" }}
      />
      <ContextMenuContent
        className="quick-actions-dropdown"
        style={rowStyle(width)}
      >
        <QuickActionItems actions={actions} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
