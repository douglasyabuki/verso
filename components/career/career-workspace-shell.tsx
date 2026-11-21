"use client";

import { cn } from "cn";
import {
  FileText,
  Languages,
  LayoutDashboard,
  ListOrdered,
  Monitor,
  Palette,
  Settings,
  X,
} from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

import { BrandLockup } from "@/components/brand/brand";
import { contentLanguageName } from "@/components/career/career-fields";
import { libraryDestinationKind } from "@/components/career/library-navigation";
import {
  type CareerActions,
  careerDetailsQuickActions,
  type CareerNavigationAction,
  libraryQuickActions,
  openAction,
  resumeCollectionActions,
  resumeQuickActions,
  sectionQuickActions,
} from "@/components/career/quick-actions";
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
  type QuickAction,
  QuickActionsContextMenu,
  QuickActionsMenu,
} from "@/components/ui/quick-actions";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SidebarCollection } from "@/components/workspace/sidebar-collection";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { WorkspaceToolbarView } from "@/components/workspace/workspace-toolbar-view";
import { useListEntrance } from "@/hooks/use-list-entrance";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useWorkspaceLayout } from "@/hooks/workspace/use-workspace-layout";
import { isResumeComparison } from "@/lib/career/navigation";
import type { CareerDocument } from "@/types-and-constants/career";

type CareerNavigation = {
  document: CareerDocument;
  destination: string;
  navigate: CareerNavigationAction;
  /** Avatar menu for the rail or mobile sidebar footer. */
  accountMenu: (side: "right" | "top") => ReactNode;
  /** Close Settings through its guarded route handling. */
  closeSettings: () => void;
  addSection: () => void;
  addResume: () => void;
  resumeActions: ResumeActions;
  careerActions: CareerActions;
};

/**
 * Expanded resume pages own their entrance: expansion is local state, so the
 * sidebar-wide entrance would not rerender to see rows mounted by each expand.
 */
function ResumePagesSub({ id, children }: { id: string; children: ReactNode }) {
  const { isMobile, openMobile, open } = useSidebar();
  const visible = isMobile ? openMobile : open;
  const list = useRef<HTMLUListElement>(null);
  useListEntrance({
    getElements: () => [
      ...(list.current?.querySelectorAll<HTMLElement>(
        '[data-sidebar="menu-sub-button"]',
      ) ?? []),
    ],
    contextKey: `${id}:${isMobile}:${visible}`,
    disabled: !visible,
    mode: "all",
  });
  return (
    <SidebarMenuSub
      ref={list}
      id={id}
      data-resume-pages=""
      className="ms-3.5 me-3.5 border-border ps-4 pe-0"
    >
      {children}
    </SidebarMenuSub>
  );
}

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
  const comparingResumes = isResumeComparison(destination);
  const resumeDestination =
    destination.startsWith("resume-") && !comparingResumes;
  const activeResumeId = resumeDestination ? destination.split("/")[1] : null;
  if (libraryDestination && expansion.destination !== destination) {
    setExpansion({ destination, id: null });
  }
  const expandedId =
    expansion.destination === destination ? expansion.id : activeResumeId;
  const { create, compare } = resumeCollectionActions(
    document,
    resumeActions.saving,
  );
  const createAndClose = () => {
    setOpenMobile(false);
    addResume();
  };
  const sidebarResumeActions: ResumeActions = {
    ...resumeActions,
    compare: (resume) => {
      setOpenMobile(false);
      resumeActions.compare(resume);
    },
  };
  return (
    <SidebarCollection
      label="Resumes"
      active={destination === "resumes" || comparingResumes}
      onOpen={() => go("resumes")}
      contextActions={[
        openAction(() => go("resumes")),
        { ...create, onSelect: createAndClose },
        { ...compare, onSelect: () => go("resume-compare") },
      ]}
      onCreate={createAndClose}
      createLabel={create.label}
      createDisabled={create.disabled}
    >
      <SidebarMenu>
        {document.resumes.map((resume) => {
          const name = resume.name || "Untitled resume";
          const active = activeResumeId === resume.id;
          const expanded = expandedId === resume.id;
          return (
            <SidebarMenuItem key={resume.id}>
              <QuickActionsContextMenu
                actions={resumeQuickActions(
                  document,
                  resume,
                  sidebarResumeActions,
                )}
              >
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
                      "inset-s-1 inset-e-auto",
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
                    actions={sidebarResumeActions}
                    trigger={
                      <SidebarMenuAction
                        showOnHover
                        className="[@media(hover:none)]:opacity-100"
                        aria-label={`Actions for ${name}`}
                      />
                    }
                  />
                </div>
              </QuickActionsContextMenu>
              {expanded && (
                <ResumePagesSub id={`resume-pages-${resume.id}`}>
                  {(
                    [
                      ["resume-overview", "Overview", LayoutDashboard],
                      ["resume-content", "Content & order", ListOrdered],
                      ["resume-wording", "Wording", Languages],
                      ["resume-layout", "Layout", Palette],
                    ] as const
                  ).map(([prefix, label, Icon]) => (
                    <QuickActionsContextMenu
                      key={prefix}
                      actions={[openAction(() => go(`${prefix}/${resume.id}`))]}
                    >
                      <SidebarMenuSubItem>
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
                    </QuickActionsContextMenu>
                  ))}
                </ResumePagesSub>
              )}
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarCollection>
  );
}

/** Rail shortcut that toggles Settings › Appearance. */
function AppearanceToggle({
  destination,
  open,
  close,
  side,
}: {
  destination: string;
  open: (destination: string) => void;
  close: () => void;
  side: "right" | "top";
}) {
  const active = destination === "settings/appearance";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Appearance"
            aria-pressed={active}
            onClick={() => (active ? close() : open("settings/appearance"))}
          />
        }
      >
        <Monitor aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent side={side}>Appearance</TooltipContent>
    </Tooltip>
  );
}

function CareerSidebar({
  document,
  destination,
  navigate,
  accountMenu,
  closeSettings,
  addSection,
  addResume,
  resumeActions,
  careerActions,
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
            !element.closest("[data-resume-pages]") &&
            (!libraryDestination ||
              !element.closest('[data-sidebar-collection="Resumes"]')),
        ),
    contextKey: `sidebar:${isMobile}:${isMobile ? openMobile : sidebarOpen}`,
    disabled: !(isMobile ? openMobile : sidebarOpen),
    mode: "all",
  });
  const go: CareerNavigationAction = (next, entry) => {
    setOpenMobile(false);
    navigate(next, entry);
  };
  const item = (
    value: string,
    label: string,
    icon: ReactNode,
    {
      archived = false,
      actions,
    }: { archived?: boolean; actions?: QuickAction[] } = {},
  ) => (
    <QuickActionsContextMenu key={value} actions={actions ?? []}>
      <SidebarMenuItem>
        <SidebarMenuButton
          className={cn(actions && "pe-9")}
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
        {actions && (
          <QuickActionsMenu
            actions={actions}
            trigger={
              <SidebarMenuAction
                showOnHover
                className="[@media(hover:none)]:opacity-100"
                aria-label={`Actions for ${label}`}
              />
            }
          />
        )}
      </SidebarMenuItem>
    </QuickActionsContextMenu>
  );
  const addSectionAndClose = () => {
    setOpenMobile(false);
    addSection();
  };
  const sidebarCareerActions = {
    ...careerActions,
    addSection: addSectionAndClose,
    createLibraryItem: (kind: "preset" | "starter") => {
      setOpenMobile(false);
      careerActions.createLibraryItem(kind);
    },
  };
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
            onCreate={addSectionAndClose}
            contextActions={careerDetailsQuickActions(
              document,
              sidebarCareerActions,
              go,
            )}
            createLabel="Add section"
            createDisabled={document.sections.length >= 100}
          >
            <SidebarMenu>
              {item(
                "profile",
                "Profile",
                <CareerSectionIcon kind="profile" />,
                {
                  actions: [openAction(() => go("profile"))],
                },
              )}
              {item(
                "summary",
                "Summary",
                <CareerSectionIcon kind="summary" />,
                {
                  actions: [openAction(() => go("summary"))],
                },
              )}
              {document.sections.map((section) =>
                item(
                  `list/${section.id}`,
                  section.name || section.kind,
                  <CareerSectionIcon kind={section.kind} icon={section.icon} />,
                  {
                    archived: section.archived,
                    actions: sectionQuickActions(
                      section,
                      sidebarCareerActions,
                      go,
                      { includeCreateEntry: true },
                    ),
                  },
                ),
              )}
            </SidebarMenu>
          </SidebarCollection>
          <SidebarGroup data-sidebar-fixed-group className="shrink-0 px-3 py-0">
            <SidebarSelection className="shrink-0">
              <QuickActionsContextMenu
                actions={[openAction(() => go("library"))]}
              >
                <SidebarGroupLabel
                  render={<button type="button" />}
                  aria-current={destination === "library" ? "page" : undefined}
                  data-active={destination === "library" || undefined}
                  className="h-9 w-full hover:bg-sidebar-accent data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground"
                  onClick={() => go("library")}
                >
                  Library
                </SidebarGroupLabel>
              </QuickActionsContextMenu>
            </SidebarSelection>
            <SidebarSelection>
              <SidebarMenu>
                {item(
                  "presets",
                  "Layout presets",
                  <Palette aria-hidden="true" />,
                  {
                    actions: libraryQuickActions(
                      document,
                      "preset",
                      sidebarCareerActions,
                      go,
                    ),
                  },
                )}
                {item(
                  "starters",
                  "Resume starters",
                  <FileText aria-hidden="true" />,
                  {
                    actions: libraryQuickActions(
                      document,
                      "starter",
                      sidebarCareerActions,
                      go,
                    ),
                  },
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
            "settings/editing-preview",
            "Settings",
            <Settings aria-hidden="true" />,
          )}
        </SidebarMenu>
        {isMobile && (
          <div className="flex items-center gap-2">
            {accountMenu("top")}
            <AppearanceToggle
              destination={destination}
              open={go}
              close={closeSettings}
              side="top"
            />
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
  accountMenu,
  closeSettings,
  addSection,
  addResume,
  resumeActions,
  careerActions,
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
  /** Render the preview; `visible` is false when it is mounted but hidden. */
  output: (visible: boolean) => ReactNode;
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
  const comparingResumes = isResumeComparison(destination);
  const fullWidth =
    Boolean(libraryDestination) ||
    comparingResumes ||
    ["overview", "backups", "languages", "resumes"].includes(destination);
  const resume =
    !comparingResumes && destination.startsWith("resume")
      ? document.resumes.find((item) => item.id === destination.split("/")[1])
      : undefined;
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
  const preview = (visible: boolean) => (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/30">
      {output(visible)}
    </div>
  );
  const open: CareerNavigationAction = (next, entry) => {
    if (
      !next.startsWith("settings/") &&
      !["settings", "backups", "languages", "defaults"].includes(next)
    )
      setMobilePanel("editor");
    navigate(next, entry);
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
          dataMenu={accountMenu("right")}
          railFooter={
            <AppearanceToggle
              destination={destination}
              open={open}
              close={closeSettings}
              side="right"
            />
          }
          sidebar={
            <CareerSidebar
              document={document}
              destination={destination}
              navigate={open}
              accountMenu={accountMenu}
              closeSettings={closeSettings}
              addSection={addSection}
              addResume={addResume}
              resumeActions={resumeActions}
              careerActions={careerActions}
            />
          }
          toolbar={
            <header
              className="flex min-h-16 shrink-0 flex-col border-b bg-card"
              aria-label="Workspace controls"
            >
              <WorkspaceToolbarView
                title={
                  destination === "backups"
                    ? "Data"
                    : destination === "languages"
                      ? "Content languages"
                      : resume
                        ? resume.name || "Untitled resume"
                        : destination === "resumes" || comparingResumes
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
                !comparingResumes &&
                ![
                  "overview",
                  "backups",
                  "languages",
                  "sections",
                  "resumes",
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
                  {preview(true)}
                </ResizablePanel>
              </ResizablePanelGroup>
            ) : desktop || !previewAvailable ? (
              editor
            ) : (
              <>
                <TabsContent
                  value="editor"
                  keepMounted
                  className="h-full min-h-0 data-hidden:hidden"
                >
                  {editor}
                </TabsContent>
                <TabsContent
                  value="preview"
                  keepMounted
                  className="h-full min-h-0 data-hidden:hidden"
                >
                  {preview(mobilePanel === "preview")}
                </TabsContent>
              </>
            )}
          </div>
        </WorkspaceShell>
      </Tabs>
    </TooltipProvider>
  );
}
