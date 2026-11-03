"use client";

import { cn } from "cn";
import { Database, FileText, Languages, X } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

import { BrandLockup } from "@/components/brand/brand";
import { contentLanguageName } from "@/components/career/career-fields";
import { CareerSectionIcon } from "@/components/content/career-section-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarCollection } from "@/components/workspace/sidebar-collection";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { WorkspaceToolbarView } from "@/components/workspace/workspace-toolbar-view";
import { AppearanceControl } from "@/components/workspace/workspace-utility-rail";
import { useListEntrance } from "@/hooks/use-list-entrance";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useWorkspaceLayout } from "@/hooks/workspace/use-workspace-layout";
import type { CareerDocument } from "@/types-and-constants/career";

type CareerNavigation = {
  document: CareerDocument;
  destination: string;
  navigate: (destination: string) => void;
  addSection: () => void;
};

function CareerSidebar({
  document,
  destination,
  navigate,
  addSection,
}: CareerNavigation) {
  const {
    isMobile,
    openMobile,
    open: sidebarOpen,
    setOpenMobile,
  } = useSidebar();
  const collectionsRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  useListEntrance({
    getElements: () =>
      [collectionsRef.current, footerRef.current].flatMap((container) => [
        ...(container?.querySelectorAll<HTMLElement>(
          '[data-sidebar="group-label"], [data-sidebar="menu-button"], [data-sidebar="menu-sub-button"]',
        ) ?? []),
      ]),
    contextKey: `sidebar:${isMobile}:${isMobile ? openMobile : sidebarOpen}`,
    disabled: !(isMobile ? openMobile : sidebarOpen),
    mode: "all",
  });
  const go = (next: string) => {
    setOpenMobile(false);
    navigate(next);
  };
  const item = (
    value: string,
    label: string,
    icon: ReactNode,
    archived = false,
  ) => (
    <SidebarMenuItem key={value}>
      <SidebarMenuButton
        isActive={destination === value}
        aria-current={destination === value ? "page" : undefined}
        onClick={() => go(value)}
        title={label}
      >
        {icon}
        <span>{label}</span>
        {archived && <Badge variant="secondary">Archived</Badge>}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
  return (
    <Sidebar
      collapsible="offcanvas"
      role="navigation"
      aria-label="Workspace navigation"
    >
      <SidebarHeader className="h-16 shrink-0 flex-row items-center justify-between border-b px-5">
        <BrandLockup />
        {isMobile && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close navigation"
            onClick={() => setOpenMobile(false)}
          >
            <X />
          </Button>
        )}
      </SidebarHeader>
      <SidebarContent className="overflow-hidden">
        <div
          ref={collectionsRef}
          className="flex min-h-0 flex-1 flex-col gap-2 py-3"
        >
          <SidebarCollection
            label="Career details"
            active={destination === "overview"}
            onOpen={() => go("overview")}
            onCreate={() => {
              setOpenMobile(false);
              addSection();
            }}
            createLabel="Add section"
            createDisabled={document.sections.length >= 100}
          >
            <SidebarMenu>
              {item("profile", "Profile", <CareerSectionIcon kind="profile" />)}
              {item("summary", "Summary", <CareerSectionIcon kind="summary" />)}
              {document.sections.map((section) =>
                item(
                  `list/${section.id}`,
                  section.name || section.kind,
                  <CareerSectionIcon kind={section.kind} />,
                  section.archived,
                ),
              )}
            </SidebarMenu>
          </SidebarCollection>
          {document.resumes.length > 0 && (
            <SidebarCollection
              label="Resumes"
              active={destination.startsWith("selection/")}
              onOpen={() => go("overview")}
            >
              <SidebarMenu>
                {document.resumes.map((resume) =>
                  item(
                    `selection/${resume.id}`,
                    resume.name || "Untitled resume",
                    <FileText aria-hidden="true" />,
                  ),
                )}
              </SidebarMenu>
            </SidebarCollection>
          )}
        </div>
      </SidebarContent>
      <SidebarSeparator className="mx-5 shrink-0" />
      <SidebarFooter ref={footerRef} className="shrink-0 px-3 py-2">
        <SidebarMenu>
          {item(
            "languages",
            "Content languages",
            <Languages aria-hidden="true" />,
          )}
        </SidebarMenu>
        {isMobile && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Data & backups"
              onClick={() => go("backups")}
            >
              <Database />
            </Button>
            <AppearanceControl />
            <span className="text-xs text-muted-foreground">
              Data & appearance
            </span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

/** Compose the retained workspace presentation around schema-2 content and guarded actions. */
export function CareerWorkspaceShell({
  document,
  destination,
  navigate,
  addSection,
  language,
  setLanguage,
  status,
  history,
  children,
  output,
}: CareerNavigation & {
  language: string;
  setLanguage: (language: string) => void;
  status: string;
  history: {
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
  };
  children: ReactNode;
  output: ReactNode;
}) {
  const { layout, changeLayout } = useWorkspaceLayout();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [mobilePanel, setMobilePanel] = useState("editor");
  const fullWidth = ["overview", "backups", "languages"].includes(destination);
  const previewAvailable = document.resumes.length > 0 && !fullWidth;
  const languageItems = document.languages.map((item) => ({
    value: item.tag,
    label: `${contentLanguageName(item.tag)}${item.active ? "" : " (inactive; existing wording retained)"}`,
  }));
  const editor = (
    <div
      className={cn(
        "@container h-full overflow-auto p-4 sm:p-6",
        fullWidth && "md:p-8 xl:p-10",
      )}
      data-workspace-scroll
    >
      <div
        className={cn(
          "mx-auto flex min-w-0 flex-col gap-6",
          fullWidth ? "max-w-5xl" : "max-w-3xl",
        )}
      >
        {children}
      </div>
    </div>
  );
  const preview = (
    <div className="h-full overflow-auto bg-muted/30 p-4 sm:p-6">{output}</div>
  );
  const open = (next: string) => {
    setMobilePanel("editor");
    navigate(next);
  };
  return (
    <TooltipProvider>
      <Tabs
        value={previewAvailable ? mobilePanel : "editor"}
        onValueChange={(value) => {
          if (
            (value === "editor" || value === "preview") &&
            value !== mobilePanel
          )
            setMobilePanel(value);
        }}
        className="h-dvh min-h-0 gap-0"
      >
        <WorkspaceShell
          sidebarOpen={layout.sidebar}
          onSidebarChange={(sidebar) => changeLayout({ sidebar })}
          dataMenu={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Data & backups"
              title="Data & backups"
              onClick={() => open("backups")}
            >
              <Database />
            </Button>
          }
          sidebar={
            <CareerSidebar
              document={document}
              destination={destination}
              navigate={open}
              addSection={addSection}
            />
          }
          toolbar={
            <header
              className="shrink-0 border-b bg-card"
              aria-label="Workspace controls"
            >
              <WorkspaceToolbarView
                title={
                  destination === "backups"
                    ? "Data & backups"
                    : destination === "languages"
                      ? "Content languages"
                      : "Career details"
                }
                shortcuts={{ undo: "Ctrl/⌘ Z", redo: "Ctrl/⌘ Shift Z" }}
                history={history}
                status={
                  <span role="status" className="text-xs text-muted-foreground">
                    {status}
                  </span>
                }
                preview={layout.preview}
                togglePreview={() => changeLayout({ preview: !layout.preview })}
                previewAvailable={previewAvailable}
                mobilePreviewControls={
                  !desktop && (
                    <TabsList variant="line" aria-label="Workspace panel">
                      <TabsTrigger value="editor">Editor</TabsTrigger>
                      <TabsTrigger value="preview">PDF preview</TabsTrigger>
                    </TabsList>
                  )
                }
              />
              {!["overview", "backups", "languages", "sections"].includes(
                destination,
              ) && (
                <div className="flex min-w-0 flex-wrap items-center gap-3 border-t px-4 py-3 md:px-6">
                  <Label htmlFor="wording-language">
                    Editing career wording language
                  </Label>
                  <Select
                    items={languageItems}
                    value={language}
                    onValueChange={(value) => {
                      if (value) setLanguage(value);
                    }}
                  >
                    <SelectTrigger
                      appearance="utility"
                      id="wording-language"
                      className="max-w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {languageItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            <Languages aria-hidden="true" />
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </header>
          }
          overlays={null}
        >
          <div className="min-h-0 flex-1">
            {desktop && previewAvailable && layout.preview ? (
              <ResizablePanelGroup
                orientation="horizontal"
                defaultLayout={{
                  editor: layout.split,
                  preview: 100 - layout.split,
                }}
                resizeTargetMinimumSize={{ fine: 5, coarse: 16 }}
                onLayoutChanged={(sizes) =>
                  changeLayout({ split: sizes.editor })
                }
              >
                <ResizablePanel id="editor" minSize="30%">
                  {editor}
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel id="preview" minSize="30%">
                  {preview}
                </ResizablePanel>
              </ResizablePanelGroup>
            ) : desktop || !previewAvailable ? (
              editor
            ) : (
              <>
                <TabsContent
                  value="editor"
                  keepMounted
                  className="h-full min-h-0 data-[hidden]:hidden"
                >
                  {editor}
                </TabsContent>
                <TabsContent
                  value="preview"
                  keepMounted
                  className="h-full min-h-0 data-[hidden]:hidden"
                >
                  {preview}
                </TabsContent>
              </>
            )}
          </div>
        </WorkspaceShell>
      </Tabs>
    </TooltipProvider>
  );
}
