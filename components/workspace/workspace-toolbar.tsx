"use client";

import {
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWorkspace } from "@/hooks/workspace/use-workspace";

export function WorkspaceSaveStatus({ className }: { className?: string }) {
  const { state, controller } = useWorkspace();
  const status = state.sessionOnly
    ? "Session only"
    : state.error || state.conflict
      ? "Saving paused"
      : state.pending
        ? "Replacement awaiting confirmation"
        : state.saving || controller.isUnsaved()
          ? "Saving…"
          : "Saved in this browser";

  return (
    <span className={className} role="status">
      {status}
    </span>
  );
}

export function WorkspaceToolbar({
  shortcuts,
  title,
  preview,
  togglePreview,
  previewAvailable = true,
}: {
  shortcuts: { undo: string; redo: string };
  title: string;
  preview: boolean;
  togglePreview: () => void;
  previewAvailable?: boolean;
}) {
  const { state, controller } = useWorkspace();
  const { open, openMobile, isMobile } = useSidebar();
  const expanded = isMobile ? openMobile : open;
  const PreviewIcon = preview ? PanelRightClose : PanelRightOpen;
  return (
    <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <SidebarTrigger
                aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
                aria-expanded={expanded}
              />
            }
          />
          <TooltipContent>
            {expanded ? "Collapse sidebar" : "Expand sidebar"}
          </TooltipContent>
        </Tooltip>
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="hidden text-muted-foreground sm:inline">
            Workspace
          </span>
          <ChevronRight
            className="hidden size-3 text-muted-foreground sm:block"
            aria-hidden="true"
          />
          <span className="truncate font-medium">{title}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <WorkspaceSaveStatus className="text-xs text-muted-foreground" />
        {[
          {
            label: "Undo",
            shortcut: shortcuts.undo,
            available: state.canUndo,
            action: controller.undo,
            Icon: Undo2,
          },
          {
            label: "Redo",
            shortcut: shortcuts.redo,
            available: state.canRedo,
            action: controller.redo,
            Icon: Redo2,
          },
        ].map(({ label, shortcut, available, action, Icon }) => (
          <Tooltip key={label}>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={label}
                  disabled={!available}
                  onClick={action}
                />
              }
            >
              <Icon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>
              {label} ({shortcut})
            </TooltipContent>
          </Tooltip>
        ))}
        {previewAvailable && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hidden lg:inline-flex"
                  aria-label={preview ? "Hide PDF preview" : "Show PDF preview"}
                  aria-pressed={preview}
                  onClick={togglePreview}
                />
              }
            >
              <PreviewIcon />
            </TooltipTrigger>
            <TooltipContent>
              {preview ? "Hide PDF preview" : "Show PDF preview"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </header>
  );
}
