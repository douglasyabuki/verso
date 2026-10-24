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
          {dirty ? "Changes since the last JSON backup" : "Matches JSON backup"}
          <InfoHint label="backup freshness" size="sm">
            Browser saving and JSON backups are separate. Export JSON to
            preserve the complete editable workspace.
          </InfoHint>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={disabled} onClick={importJson}>
            <Upload data-icon="inline-start" />
            Import JSON
          </Button>
          <Button disabled={disabled} onClick={exportJson}>
            <Download data-icon="inline-start" />
            Export JSON backup
          </Button>
          <Button variant="outline" disabled={disabled} onClick={example}>
            <FilePlus2 data-icon="inline-start" />
            Load fictional example
          </Button>
          {recover && (
            <Button variant="outline" disabled={disabled} onClick={recover}>
              <Undo2 data-icon="inline-start" />
              Recover previous workspace
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
                  aria-label="Workspace data and backups"
                  disabled={disabled}
                />
              }
            />
          }
        >
          <Database />
        </TooltipTrigger>
        <TooltipContent side="right">Workspace data & backups</TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="right" align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspace data</DropdownMenuLabel>
          <DropdownMenuItem onClick={importJson}>
            <Upload />
            Import JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportJson}>
            <Download />
            Export JSON backup
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <div className="px-2 py-2 text-xs text-muted-foreground">
          {dirty ? "Changes since the last JSON backup" : "Matches JSON backup"}
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
              Recover previous workspace
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
