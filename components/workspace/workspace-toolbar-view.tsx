"use client";

import {
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  Undo2,
} from "lucide-react";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function WorkspaceToolbarView({
  shortcuts,
  title,
  viewTitle,
  location,
  preview,
  togglePreview,
  previewAvailable = true,
  mobilePreviewControls,
  history,
  status,
}: {
  shortcuts: { undo: string; redo: string };
  location?: { label: string; onClick?: () => void }[];
  title: string;
  viewTitle?: string;
  preview: boolean;
  togglePreview: () => void;
  previewAvailable?: boolean;
  mobilePreviewControls?: ReactNode;
  history: {
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
  };
  status: ReactNode;
}) {
  const { open, openMobile, isMobile } = useSidebar();
  const expanded = isMobile ? openMobile : open;
  const PreviewIcon = preview ? PanelRightClose : PanelRightOpen;
  return (
    <div className="flex min-h-16 min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 md:px-6">
      <div className="flex min-w-0 flex-1 basis-60 items-center gap-2">
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
        {!expanded && <BrandMark className="size-6 shrink-0 text-primary" />}
        <Separator orientation="vertical" />
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          {location ? (
            <nav
              aria-label="Location"
              className="flex min-w-0 items-center gap-2"
            >
              {location.map((item, index) => (
                <span key={index} className="flex min-w-0 items-center gap-2">
                  {index > 0 && (
                    <ChevronRight
                      className="size-3 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                  {item.onClick ? (
                    <button
                      type="button"
                      onClick={item.onClick}
                      title={item.label}
                      className="truncate text-muted-foreground hover:text-foreground focus-visible:outline-ring"
                    >
                      {item.label}
                    </button>
                  ) : (
                    <span
                      title={item.label}
                      aria-current={
                        index === location.length - 1 ? "page" : undefined
                      }
                      className={
                        index === location.length - 1
                          ? "truncate font-medium"
                          : "truncate text-muted-foreground"
                      }
                    >
                      {item.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          ) : (
            <>
              <span className="hidden text-muted-foreground sm:inline">
                Workspace
              </span>
              <ChevronRight
                className="hidden size-3 text-muted-foreground sm:block"
                aria-hidden="true"
              />
              <span
                className="truncate font-medium"
                aria-current={viewTitle ? undefined : "page"}
              >
                {title}
              </span>
              {viewTitle && (
                <>
                  <ChevronRight
                    className="size-3 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="shrink-0 font-medium" aria-current="page">
                    {viewTitle}
                  </span>
                </>
              )}
            </>
          )}
        </div>
        <Separator orientation="vertical" />
        <div
          role="group"
          aria-label="Editing history"
          className="flex shrink-0 items-center gap-1"
        >
          {[
            {
              label: "Undo",
              shortcut: shortcuts.undo,
              available: history.canUndo,
              action: history.undo,
              Icon: Undo2,
            },
            {
              label: "Redo",
              shortcut: shortcuts.redo,
              available: history.canRedo,
              action: history.redo,
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
                    data-workspace-history
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
        </div>
        <Separator orientation="vertical" />
      </div>
      <div className="ml-auto flex max-w-full min-w-0 flex-wrap items-center justify-end gap-3">
        {status}
        {previewAvailable && (
          <div
            role="group"
            aria-label="PDF preview controls"
            className="flex items-center gap-2"
          >
            {mobilePreviewControls}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="hidden lg:inline-flex"
                    aria-label={
                      preview ? "Hide PDF preview" : "Show PDF preview"
                    }
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
          </div>
        )}
      </div>
    </div>
  );
}
