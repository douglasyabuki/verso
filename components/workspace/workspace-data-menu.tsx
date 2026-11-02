"use client";

import {
  Database,
  Download,
  FilePlus2,
  RefreshCw,
  Trash2,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function WorkspaceDataMenu({
  backupStatus,
  importJson,
  exportJson,
  example,
  recover,
  resume,
  clear,
  disabled,
  reasons,
  sessionOnly,
  inline = false,
}: {
  backupStatus: string;
  importJson: () => void;
  exportJson: () => void;
  example: () => void;
  recover?: () => void;
  resume: () => void;
  clear: () => void;
  disabled: boolean;
  sessionOnly: boolean;
  reasons: Record<string, string | undefined>;
  inline?: boolean;
}) {
  const actions = [
    {
      key: "import",
      label: "Restore from backup",
      run: importJson,
      icon: Upload,
    },
    {
      key: "export",
      label: "Download backup (JSON)",
      run: exportJson,
      icon: Download,
    },
    {
      key: "example",
      label: "Load fictional example",
      run: example,
      icon: FilePlus2,
    },
    {
      key: "recover",
      label: "Restore previous work",
      run: recover,
      icon: Undo2,
    },
    {
      key: "resume",
      label: sessionOnly
        ? "Start saving in this browser"
        : "Review browser saving",
      run: resume,
      icon: RefreshCw,
    },
    { key: "clear", label: "Clear data", run: clear, icon: Trash2 },
  ];
  const items = actions.map(({ key, label, run, icon: Icon }) => {
    const reason = disabled
      ? "Wait for the current action to finish."
      : reasons[key];
    const text = (
      <span className="flex min-w-0 flex-col gap-1">
        <span>{label}</span>
        {reason && (
          <span className="text-xs text-muted-foreground">{reason}</span>
        )}
      </span>
    );
    return inline ? (
      <div key={key} className="flex max-w-xs flex-col gap-1">
        <Button
          variant={key === "clear" ? "destructive" : "outline"}
          disabled={!!reason}
          aria-describedby={reason ? `inline-${key}-reason` : undefined}
          onClick={run}
        >
          <Icon data-icon="inline-start" />
          {label}
        </Button>
        {reason && (
          <p
            id={`inline-${key}-reason`}
            className="text-xs text-muted-foreground"
          >
            {reason}
          </p>
        )}
      </div>
    ) : (
      <DropdownMenuItem
        className="whitespace-normal"
        key={key}
        disabled={!!reason}
        onClick={run}
        variant={key === "clear" ? "destructive" : "default"}
      >
        <Icon />
        {text}
      </DropdownMenuItem>
    );
  });
  if (inline)
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{backupStatus}</p>
        <div className="flex flex-wrap items-start gap-3">{items}</div>
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
                />
              }
            />
          }
        >
          <Database />
        </TooltipTrigger>
        <TooltipContent side="right">Backups & settings</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        side="right"
        align="start"
        className="w-80 max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>Backups & settings</DropdownMenuLabel>
          {items}
        </DropdownMenuGroup>
        <div className="px-2 py-2 text-xs text-muted-foreground">
          {backupStatus}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
