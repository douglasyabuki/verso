"use client";

import { Monitor } from "lucide-react";

import { ThemeSelector } from "@/components/theme-selector";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function WorkspaceUtilityRail({
  dataMenu,
}: {
  dataMenu: React.ReactNode;
}) {
  return (
    <nav
      aria-label="Workspace utilities"
      className="hidden w-14 shrink-0 flex-col items-center gap-4 border-r bg-card py-4 md:flex"
    >
      {dataMenu}
      <div className="mt-auto">
        <AppearanceControl />
      </div>
    </nav>
  );
}

export function AppearanceControl() {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Appearance" />
              }
            />
          }
        >
          <Monitor />
        </TooltipTrigger>
        <TooltipContent side="right">Appearance</TooltipContent>
      </Tooltip>
      <PopoverContent
        side="right"
        align="end"
        className="w-auto flex-row items-center"
      >
        <PopoverHeader>
          <PopoverTitle>Appearance</PopoverTitle>
          <PopoverDescription className="sr-only">
            Choose a theme for this browser.
          </PopoverDescription>
        </PopoverHeader>
        <ThemeSelector />
      </PopoverContent>
    </Popover>
  );
}
