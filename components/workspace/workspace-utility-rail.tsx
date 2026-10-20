"use client";

import { BookOpen, Monitor } from "lucide-react";
import { useState } from "react";

import { ThemeSelector } from "@/components/theme-selector";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
      className="hidden w-14 shrink-0 flex-col items-center gap-4 border-r bg-background py-4 md:flex"
    >
      <span className="flex h-8 items-center" title="Verso">
        <BookOpen className="size-5" aria-hidden="true" />
        <span className="sr-only">Verso</span>
      </span>
      {dataMenu}
      <div className="mt-auto">
        <AppearanceControl />
      </div>
    </nav>
  );
}

export function AppearanceControl() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Appearance"
              onClick={() => setOpen(true)}
            />
          }
        >
          <Monitor />
        </TooltipTrigger>
        <TooltipContent>Appearance</TooltipContent>
      </Tooltip>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Appearance</SheetTitle>
            <SheetDescription>
              Choose a theme for this browser.
            </SheetDescription>
          </SheetHeader>
          <div className="px-6">
            <ThemeSelector />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
