"use client";

import type { CSSProperties, ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { WorkspaceUtilityRail } from "@/components/workspace/workspace-utility-rail";

export function WorkspaceShell({
  sidebarOpen,
  onSidebarChange,
  sidebar,
  toolbar,
  overlays,
  dataMenu,
  children,
}: {
  sidebarOpen: boolean;
  onSidebarChange: (open: boolean) => void;
  sidebar: ReactNode;
  toolbar: ReactNode;
  overlays: ReactNode;
  dataMenu: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-background">
      <WorkspaceUtilityRail dataMenu={dataMenu} />
      <SidebarProvider
        open={sidebarOpen}
        onOpenChange={onSidebarChange}
        className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
        style={{ "--sidebar-width": "15rem" } as CSSProperties}
      >
        {sidebar}
        <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
          {toolbar}
          {children}
        </SidebarInset>
        {overlays}
      </SidebarProvider>
    </div>
  );
}
