"use client";

import { cn } from "cn";
import {
  Database,
  FileText,
  Languages,
  LayoutDashboard,
  ListOrdered,
  Palette,
  Settings,
  X,
} from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

import { BrandLockup } from "@/components/brand/brand";
import { contentLanguageName } from "@/components/career/career-fields";
import { libraryDestinationKind } from "@/components/career/library-navigation";
import {
  type ResumeActions,
  ResumeActionsMenu,
} from "@/components/career/resume-workspace";
import { CareerSectionIcon } from "@/components/content/career-section-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DisclosureChevron,
  disclosureChevronTriggerClassName,
} from "@/components/ui/disclosure";
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
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { SidebarSelection } from "@/components/ui/sidebar-selection";
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
  addResume: () => void;
  resumeActions: ResumeActions;
};

/** Keep resume expansion local without remounting rows or replaying their entrances during Library navigation. */
function ResumeSidebarCollection({
  document,
  destination,
  go,
  addResume,
  resumeActions,
}: Pick<
  CareerNavigation,
  "document" | "destination" | "addResume" | "resumeActions"
> & { go: (next: string) => void }) {
  const { setOpenMobile } = useSidebar();
  const [expansion, setExpansion] = useState<{
    destination: string;
    id: string | null;
  }>({ destination: "", id: null });
  const libraryDestination = libraryDestinationKind(destination) !== null;
  if (libraryDestination && expansion.destination !== destination) {
    setExpansion({ destination, id: null });
  }
  const expandedId =
    expansion.destination === destination
      ? expansion.id
      : destination.startsWith("resume-")
        ? destination.split("/")[1]
        : null;
  return (
    <SidebarCollection
      label="Resumes"
      active={destination === "resumes" || destination === "resume-compare"}
      onOpen={() => go("resumes")}
      onCreate={() => {
        setOpenMobile(false);
        addResume();
      }}
      createLabel="Create resume"
      createDisabled={
        document.resumes.length >= 120 ||
        !document.languages.some((item) => item.active)
      }
    >
      <SidebarMenu>
        {document.resumes.map((resume) => {
          const name = resume.name || "Untitled resume";
          const active =
            destination.startsWith("resume-") &&
            destination.split("/")[1] === resume.id;
          const expanded = expandedId === resume.id;
          return (
            <SidebarMenuItem key={resume.id}>
              <div className="relative">
                <SidebarMenuButton
                  className="ps-7 pe-10"
                  isActive={active}
                  aria-current={
                    destination === `resume-overview/${resume.id}`
                      ? "page"
                      : undefined
                  }
                  title={`${name} (${resume.language})`}
                  onClick={() => {
                    setExpansion({
                      destination: `resume-overview/${resume.id}`,
                      id: resume.id,
                    });
                    go(`resume-overview/${resume.id}`);
                  }}
                >
                  <FileText
                    aria-hidden="true"
                    className="resume-color text-(--resume-color)"
                    data-resume-color={resume.color ?? "indigo"}
                  />
                  <span className="truncate">{name}</span>
                  <span className="sr-only">({resume.language})</span>
                </SidebarMenuButton>
                <SidebarMenuAction
                  className={cn(
                    disclosureChevronTriggerClassName,
                    "start-1 end-auto",
                  )}
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${name} pages`}
                  aria-expanded={expanded}
                  aria-controls={`resume-pages-${resume.id}`}
                  onClick={() =>
                    setExpansion({
                      destination,
                      id: expanded ? null : resume.id,
                    })
                  }
                >
                  <DisclosureChevron />
                </SidebarMenuAction>
                <ResumeActionsMenu
                  document={document}
                  resume={resume}
                  actions={resumeActions}
                  trigger={
                    <SidebarMenuAction
                      showOnHover
                      className="[@media(hover:none)]:opacity-100"
                      aria-label={`Actions for ${name}`}
                    />
                  }
                />
              </div>
              {expanded && (
                <SidebarMenuSub
                  id={`resume-pages-${resume.id}`}
                  className="ms-3.5 me-3.5 border-border ps-4 pe-0"
                >
                  {(
                    [
                      ["resume-overview", "Overview", LayoutDashboard],
                      ["resume-content", "Content & order", ListOrdered],
                      ["resume-wording", "Wording", Languages],
                      ["resume-layout", "Layout", Palette],
                    ] as const
                  ).map(([prefix, label, Icon]) => (
                    <SidebarMenuSubItem key={prefix}>
                      <SidebarMenuSubButton
                        render={<button type="button" />}
                        isActive={destination === `${prefix}/${resume.id}`}
                        aria-current={
                          destination === `${prefix}/${resume.id}`
                            ? "page"
                            : undefined
                        }
                        onClick={() => go(`${prefix}/${resume.id}`)}
                      >
                        <Icon aria-hidden="true" />
                        <span className="truncate">{label}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              )}
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarCollection>
  );
}

function CareerSidebar({
  document,
  destination,
  navigate,
  addSection,
  addResume,
  resumeActions,
}: CareerNavigation) {
  const {
    isMobile,
    openMobile,
    open: sidebarOpen,
    setOpenMobile,
  } = useSidebar();
  const libraryDestination = libraryDestinationKind(destination) !== null;
  const collectionsRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  useListEntrance({
    getElements: () =>
      [collectionsRef.current, footerRef.current]
        .flatMap((container) => [
          ...(container?.querySelectorAll<HTMLElement>(
            '[data-sidebar="group-label"], [data-sidebar="menu-button"], [data-sidebar="menu-sub-button"]',
          ) ?? []),
        ])
        .filter(
          (element) =>
            !libraryDestination ||
            !element.closest('[data-sidebar-collection="Resumes"]'),
        ),
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
        isActive={
          destination === value ||
          (value === "presets" && destination.startsWith("preset/")) ||
          (value === "starters" && destination.startsWith("starter/"))
        }
        aria-current={destination === value ? "page" : undefined}
        onClick={() => go(value)}
        title={label}
      >
        {icon}
        <span className="truncate">{label}</span>
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
      <SidebarContent className="overflow-y-auto">
        <div
          ref={collectionsRef}
          className="flex min-h-80 flex-1 flex-col gap-2 py-3"
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
                  <CareerSectionIcon kind={section.kind} icon={section.icon} />,
                  section.archived,
                ),
              )}
            </SidebarMenu>
          </SidebarCollection>
          <SidebarGroup data-sidebar-fixed-group className="shrink-0 px-3 py-0">
            <SidebarSelection className="shrink-0">
              <SidebarGroupLabel
                render={<button type="button" />}
                aria-current={destination === "library" ? "page" : undefined}
                data-active={destination === "library" || undefined}
                className="h-9 w-full hover:bg-sidebar-accent data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground"
                onClick={() => go("library")}
              >
                Library
              </SidebarGroupLabel>
            </SidebarSelection>
            <SidebarSelection>
              <SidebarMenu>
                {item(
                  "presets",
                  "Layout presets",
                  <Palette aria-hidden="true" />,
                )}
                {item(
                  "starters",
                  "Resume starters",
                  <FileText aria-hidden="true" />,
                )}
              </SidebarMenu>
            </SidebarSelection>
          </SidebarGroup>
          <ResumeSidebarCollection
            document={document}
            destination={destination}
            go={go}
            addResume={addResume}
            resumeActions={resumeActions}
          />
        </div>
      </SidebarContent>
      <SidebarSeparator className="mx-5 shrink-0" />
      <SidebarFooter ref={footerRef} className="shrink-0 px-3 py-2">
        <SidebarMenu>
          {item(
            "settings/appearance",
            "Settings",
            <Settings aria-hidden="true" />,
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
  addResume,
  resumeActions,
  language,
  setLanguage,
  status,
  history,
  children,
  output,
  editorRequest,
  libraryItemState,
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
  editorRequest?: object | null;
  libraryItemState?: "new" | "missing";
}) {
  const { layout, changeLayout } = useWorkspaceLayout();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [panel, setPanel] = useState({
    value: "editor",
    request: editorRequest,
  });
  const requestedPanel = editorRequest ? "editor" : panel.value;
  const mobilePanel =
    panel.request === editorRequest ? panel.value : requestedPanel;
  if (panel.request !== editorRequest)
    setPanel({ value: requestedPanel, request: editorRequest });
  const setMobilePanel = (value: string) =>
    setPanel({ value, request: editorRequest });
  const libraryDestination = libraryDestinationKind(destination);
  const libraryKind =
    libraryDestination === "overview" ? null : libraryDestination;
  const libraryCollection = libraryKind === "preset" ? "presets" : "starters";
  const libraryLabel =
    libraryKind === "preset" ? "Layout presets" : "Resume starters";
  const libraryItem = libraryKind
    ? document[libraryCollection].find(
        (item) => item.id === destination.split("/")[1],
      )
    : undefined;
  const fullWidth =
    Boolean(libraryDestination) ||
    ["overview", "backups", "languages", "resumes", "resume-compare"].includes(
      destination,
    );
  const resume = document.resumes.find(
    (item) =>
      item.id === destination.split("/")[1] && destination.startsWith("resume"),
  );
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/30">
      {output}
    </div>
  );
  const open = (next: string) => {
    if (
      !next.startsWith("settings/") &&
      !["settings", "backups", "languages", "defaults"].includes(next)
    )
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
            <div className="flex flex-col gap-3">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Settings"
                title="Settings"
                onClick={() => open("settings/appearance")}
              >
                <Settings aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Data & backups"
                title="Data & backups"
                onClick={() => open("backups")}
              >
                <Database />
              </Button>
            </div>
          }
          sidebar={
            <CareerSidebar
              document={document}
              destination={destination}
              navigate={open}
              addSection={addSection}
              addResume={addResume}
              resumeActions={resumeActions}
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
                      : resume
                        ? resume.name || "Untitled resume"
                        : destination === "resumes" ||
                            destination === "resume-compare"
                          ? "Resumes"
                          : "Career details"
                }
                location={
                  libraryDestination === "overview"
                    ? [{ label: "Library" }]
                    : libraryKind
                      ? [
                          { label: "Library", onClick: () => open("library") },
                          {
                            label: libraryLabel,
                            onClick: destination.includes("/")
                              ? () => open(libraryCollection)
                              : undefined,
                          },
                          ...(destination.includes("/")
                            ? [
                                {
                                  label:
                                    libraryItem?.name ||
                                    (libraryItem
                                      ? `Untitled ${libraryKind}`
                                      : libraryItemState === "new"
                                        ? `New ${libraryKind}`
                                        : `Unavailable ${libraryKind}`),
                                },
                              ]
                            : []),
                        ]
                      : resume
                        ? [
                            {
                              label: "Resumes",
                              onClick: () => open("resumes"),
                            },
                            {
                              label: resume.name || "Untitled resume",
                              onClick:
                                destination !== `resume-overview/${resume.id}`
                                  ? () => open(`resume-overview/${resume.id}`)
                                  : undefined,
                            },
                            {
                              label: destination.startsWith("resume-layout/")
                                ? "Layout"
                                : destination.startsWith("resume-content/")
                                  ? "Content & order"
                                  : destination.startsWith("resume-wording/")
                                    ? "Wording"
                                    : destination.startsWith("resume-details/")
                                      ? "Name & color"
                                      : "Overview",
                            },
                          ]
                        : undefined
                }
                shortcuts={{ undo: "Ctrl/⌘ Z", redo: "Ctrl/⌘ Shift Z" }}
                viewTitle={
                  resume
                    ? destination.startsWith("resume-overview/")
                      ? "Overview"
                      : destination.startsWith("resume-content/")
                        ? "Content & order"
                        : destination.startsWith("resume-wording/")
                          ? "Wording"
                          : destination.startsWith("resume-details/")
                            ? "Name & color"
                            : undefined
                    : undefined
                }
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
              {resume && (
                <p className="border-t px-4 py-3 text-sm md:px-6">
                  Resume language · {contentLanguageName(resume.language)}
                </p>
              )}
              {!resume &&
                !libraryDestination &&
                ![
                  "overview",
                  "backups",
                  "languages",
                  "sections",
                  "resumes",
                  "resume-compare",
                ].includes(destination) && (
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
