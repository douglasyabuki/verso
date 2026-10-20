"use client";

import {
  ChevronDown,
  ChevronRight,
  Download,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  title,
  preview,
  togglePreview,
  download,
  disabled,
  exporting,
}: {
  title: string;
  preview: boolean;
  togglePreview: () => void;
  download: (kind: "pdf" | "both" | "latex") => void;
  disabled: boolean;
  exporting: boolean;
}) {
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
        <WorkspaceSaveStatus className="hidden text-xs text-muted-foreground sm:inline" />
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
        <Button
          size="sm"
          disabled={disabled || exporting}
          onClick={() => download("pdf")}
        >
          <Download data-icon="inline-start" />
          {exporting ? "Exporting…" : "Download PDF"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="More export options"
                disabled={exporting}
              />
            }
          >
            <ChevronDown />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => download("both")}>
                Both languages (ZIP)
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={disabled}
                onClick={() => download("latex")}
              >
                LaTeX + assets
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
