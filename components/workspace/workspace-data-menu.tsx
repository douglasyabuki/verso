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
}: {
  dirty: boolean;
  importJson: () => void;
  exportJson: () => void;
  example: () => void;
  recover?: () => void;
  resume: () => void;
  disabled: boolean;
}) {
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
