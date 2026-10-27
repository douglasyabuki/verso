"use client";

import {
  Database,
  Download,
  FilePlus2,
  RefreshCw,
  Undo2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InfoHint } from "@/components/ui/info-hint";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function WorkspaceDataMenu({
  dirty,
  importJson,
  exportJson,
  example,
  recover,
  resume,
  disabled,
  inline = false,
}: {
  dirty: boolean;
  importJson: () => void;
  exportJson: () => void;
  example: () => void;
  recover?: () => void;
  resume: () => void;
  disabled: boolean;
  inline?: boolean;
}) {
  if (inline)
    return (
      <div className="flex flex-col gap-3">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          {dirty
            ? "Changes since your last backup"
            : "No changes since your last backup"}
          <InfoHint label="changes since your last backup" size="sm">
            Saving in this browser is separate from downloading a backup. A
            backup (JSON) includes all editable career details, resumes, and
            settings.
          </InfoHint>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={disabled} onClick={importJson}>
            <Upload data-icon="inline-start" />
            Restore from backup
          </Button>
          <Button disabled={disabled} onClick={exportJson}>
            <Download data-icon="inline-start" />
            Download backup (JSON)
          </Button>
          <Button variant="outline" disabled={disabled} onClick={example}>
            <FilePlus2 data-icon="inline-start" />
            Load fictional example
          </Button>
          {recover && (
            <Button variant="outline" disabled={disabled} onClick={recover}>
              <Undo2 data-icon="inline-start" />
              Restore previous work
            </Button>
          )}
          <Button variant="outline" disabled={disabled} onClick={resume}>
            <RefreshCw data-icon="inline-start" />
            Review browser saving
          </Button>
        </div>
      </div>
    );
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Backups and settings"
                  disabled={disabled}
                />
              }
            />
          }
        >
          <Database />
        </TooltipTrigger>
        <TooltipContent side="right">Backups & settings</TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="right" align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Backups</DropdownMenuLabel>
          <DropdownMenuItem onClick={importJson}>
            <Upload />
            Restore from backup
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportJson}>
            <Download />
            Download backup (JSON)
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <div className="px-2 py-2 text-xs text-muted-foreground">
          {dirty
            ? "Changes since your last backup"
            : "No changes since your last backup"}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={example}>
            <FilePlus2 />
            Load fictional example
          </DropdownMenuItem>
          {recover && (
            <DropdownMenuItem onClick={recover}>
              <Undo2 />
              Restore previous work
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={resume}>
            <RefreshCw />
            Review browser saving
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
