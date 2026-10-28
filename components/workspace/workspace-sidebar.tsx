"use client";

import {
  ChevronRight,
  Copy,
  FileText,
  GlobeCheck,
  Languages,
  LayoutTemplate,
  ListOrdered,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

import { BrandLockup } from "@/components/brand/brand";
import { SectionIcon } from "@/components/resume/section-icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { librarySectionLabel } from "@/components/workspace/navigation";
import type { useResumeActions } from "@/hooks/workspace/use-resume-actions";
import { formatCount } from "@/lib/format-count";
import type { WorkspaceDestination } from "@/types-and-constants/navigation";
import type { ResumeDocument } from "@/types-and-constants/resume";

export function WorkspaceSidebar({
  document,
  destination,
  open,
  resumeId,
  addSection,
  createResume,
  reviewCount,
  utilities,
  actions,
  blocked,
}: {
  document: ResumeDocument;
  destination: WorkspaceDestination;
  open: (destination: WorkspaceDestination) => void;
  resumeId: string;
  addSection: () => void;
  createResume: () => void;
  reviewCount: number;
  utilities: ReactNode;
  actions: ReturnType<typeof useResumeActions>;
  blocked: boolean;
}) {
  const {
    setOpenMobile,
    isMobile,
    openMobile,
    open: sidebarOpen,
  } = useSidebar();
  // A navigation change overrides manual expansion without an effect-driven render.
  const [expansion, setExpansion] = useState({
    destination,
    id: resumeId as string | null,
  });
  if (expansion.destination !== destination) {
    setExpansion({
      destination,
      id: destination.kind === "resume" ? destination.resumeId : expansion.id,
    });
  }
  const expandedId =
    expansion.destination === destination
      ? expansion.id
      : destination.kind === "resume"
        ? destination.resumeId
        : expansion.id;
  const collectionsRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const selected = collectionsRef.current?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );
    const viewport = selected?.closest<HTMLElement>(
      "[data-collection-viewport]",
    );
    if (!selected || !viewport) return;
    const reveal = () => {
      const item = selected.getBoundingClientRect();
      const bounds = viewport.getBoundingClientRect();
      if (item.top < bounds.top) viewport.scrollTop -= bounds.top - item.top;
      else if (item.bottom > bounds.bottom)
        viewport.scrollTop += item.bottom - bounds.bottom;
    };
    reveal();
    // Collection allocation changes after content expands or the window resizes.
    const observer = new ResizeObserver(reveal);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [destination, openMobile, sidebarOpen]);
  const go = (next: WorkspaceDestination) => {
    open(next);
    setOpenMobile(false);
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
      <SidebarContent className="overflow-hidden">
        <div
          ref={collectionsRef}
          className="flex min-h-0 flex-1 flex-col gap-2 py-3"
        >
          <SidebarCollection
            label="Career details"
            active={destination.kind === "library-overview"}
            onOpen={() => go({ kind: "library-overview" })}
            onCreate={() => {
              addSection();
              setOpenMobile(false);
            }}
            createLabel="Add section"
            createDisabled={blocked || document.sections.length >= 30}
          >
            <SidebarMenu>
              {(["profile", "summary"] as const).map((kind) => (
                <SidebarMenuItem key={kind}>
                  <SidebarMenuButton
                    isActive={destination.kind === `library-${kind}`}
                    aria-current={
                      destination.kind === `library-${kind}`
                        ? "page"
                        : undefined
                    }
                    onClick={() =>
                      go(
                        kind === "profile"
                          ? { kind: "library-profile" }
                          : { kind: "library-summary", tab: "edit" },
                      )
                    }
                  >
                    <SectionIcon kind={kind} />
                    <span>{kind === "profile" ? "Profile" : "Summary"}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {document.sections.map((section) => {
                const active =
                  destination.kind === "library-section" &&
                  destination.sectionId === section.id;
                return (
                  <SidebarMenuItem key={section.id}>
                    <SidebarMenuButton
                      className="pr-9"
                      isActive={active}
                      aria-current={active ? "page" : undefined}
                      onClick={() =>
                        go({
                          kind: "library-section",
                          sectionId: section.id,
                          tab: "edit",
                        })
                      }
                    >
                      <SectionIcon kind={section.kind} />
                      <span>{librarySectionLabel(section)}</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge>
                      {
                        section.entries.filter((entry) => !entry.archived)
                          .length
                      }
                    </SidebarMenuBadge>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarCollection>
          <SidebarCollection
            label="Resumes"
            active={destination.kind === "resumes"}
            onOpen={() => go({ kind: "resumes" })}
            onCreate={() => {
              createResume();
              setOpenMobile(false);
            }}
            createLabel="Create resume"
            createDisabled={blocked || document.variants.length >= 30}
          >
            <SidebarMenu>
              {document.variants.map((resume) => {
                const active =
                  destination.kind === "resume" &&
                  destination.resumeId === resume.id;
                const expanded = expandedId === resume.id;
                const name = resume.name || "Untitled resume";
                return (
                  <SidebarMenuItem key={resume.id}>
                    <div className="relative">
                      <SidebarMenuButton
                        isActive={active}
                        className="pr-14 pl-7"
                        title={name}
                        onClick={() => {
                          setExpansion({ destination, id: resume.id });
                          go({
                            kind: "resume",
                            resumeId: resume.id,
                            page:
                              destination.kind === "resume"
                                ? destination.page
                                : "content",
                          });
                        }}
                      >
                        <FileText
                          className="resume-color text-(--resume-color)"
                          data-resume-color={resume.color}
                        />
                        <span>{name}</span>
                      </SidebarMenuButton>
                      <SidebarMenuAction
                        className="group/sidebar-expansion right-auto left-1"
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
                        <ChevronRight
                          aria-hidden="true"
                          className="transition-transform duration-200 group-aria-expanded/sidebar-expansion:rotate-90 motion-reduce:transition-none"
                        />
                      </SidebarMenuAction>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <SidebarMenuAction
                              showOnHover
                              data-resume-menu={resume.id}
                              className="[@media(hover:none)]:opacity-100"
                              aria-label={`Actions for ${name}`}
                            />
                          }
                        >
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="quick-actions-dropdown"
                        >
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              disabled={blocked}
                              onClick={() =>
                                actions.edit(
                                  resume.id,
                                  globalThis.document.querySelector<HTMLElement>(
                                    `[data-resume-menu="${CSS.escape(resume.id)}"]`,
                                  ),
                                )
                              }
                            >
                              <Pencil />
                              Rename &amp; color
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={
                                blocked || document.variants.length >= 30
                              }
                              onClick={() => {
                                actions.duplicate(resume.id);
                                setOpenMobile(false);
                              }}
                            >
                              <Copy />
                              Duplicate
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              variant="destructive"
                              disabled={
                                blocked || document.variants.length <= 1
                              }
                              onClick={() => actions.remove(resume.id)}
                            >
                              <Trash2 />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {expanded && (
                      <SidebarMenuSub id={`resume-pages-${resume.id}`}>
                        {(
                          [
                            ["content", "Content & Order", ListOrdered],
                            ["translations", "Text to review", Languages],
                            ["layout", "Layout", LayoutTemplate],
                          ] as const
                        ).map(([page, label, Icon]) => (
                          <SidebarMenuSubItem key={page}>
                            <SidebarMenuSubButton
                              render={<button type="button" />}
                              isActive={active && destination.page === page}
                              aria-current={
                                active && destination.page === page
                                  ? "page"
                                  : undefined
                              }
                              onClick={() =>
                                go({
                                  kind: "resume",
                                  resumeId: resume.id,
                                  page,
                                })
                              }
                            >
                              <Icon aria-hidden="true" />
                              <span>{label}</span>
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
        </div>
      </SidebarContent>
      <SidebarSeparator className="mx-5 shrink-0" />
      <SidebarFooter className="shrink-0 px-3 py-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="pr-9"
              isActive={destination.kind === "review"}
              aria-current={destination.kind === "review" ? "page" : undefined}
              onClick={() => go({ kind: "review" })}
            >
              <GlobeCheck aria-hidden="true" />
              <span>Text to review</span>
            </SidebarMenuButton>
            <SidebarMenuBadge
              aria-label={`${formatCount(reviewCount, "item to review", "items to review")} across the workspace`}
              title="Items to review across all career details and resumes"
            >
              {reviewCount}
            </SidebarMenuBadge>
          </SidebarMenuItem>
        </SidebarMenu>
        {isMobile && utilities}
      </SidebarFooter>
    </Sidebar>
  );
}

function SidebarCollection({
  label,
  active,
  onOpen,
  onCreate,
  createLabel,
  createDisabled,
  children,
}: {
  label: string;
  active: boolean;
  onOpen: () => void;
  onCreate: () => void;
  createLabel: string;
  createDisabled: boolean;
  children: ReactNode;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const group = groupRef.current!;
    const content = contentRef.current!;
    const collections = group.parentElement!;
    const resize = () => {
      const heading = group
        .querySelector('[data-sidebar="group-label"]')!
        .getBoundingClientRect().height;
      const height = content.getBoundingClientRect().height;
      const styles = getComputedStyle(collections);
      const available =
        collections.clientHeight -
        parseFloat(styles.paddingTop) -
        parseFloat(styles.paddingBottom) -
        parseFloat(styles.rowGap);
      const rowHeight =
        content
          .querySelector('[data-sidebar="menu-button"]')
          ?.getBoundingClientRect().height ?? 32;
      const menuGap =
        parseFloat(getComputedStyle(content.querySelector("ul")!).rowGap) || 0;
      const minimum = Math.max(
        0,
        Math.min(rowHeight * 4 + menuGap * 3, available / 2 - heading),
      );
      group.style.flexBasis = `${heading + height}px`;
      group.style.minHeight = `${heading + Math.min(height, minimum)}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(content);
    observer.observe(collections);
    return () => observer.disconnect();
  }, []);
  return (
    <SidebarGroup ref={groupRef} className="min-h-0 shrink px-3 py-0">
      <SidebarGroupLabel
        render={<button type="button" />}
        aria-current={active ? "page" : undefined}
        data-active={active || undefined}
        className="h-9 pr-9 hover:bg-sidebar-accent data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground"
        onClick={onOpen}
      >
        {label}
      </SidebarGroupLabel>
      <SidebarGroupAction
        className="top-2 right-5 disabled:opacity-50"
        aria-label={createLabel}
        title={createLabel}
        disabled={createDisabled}
        onClick={onCreate}
      >
        <Plus />
      </SidebarGroupAction>
      <div
        data-collection-viewport
        role="region"
        aria-label={`${label} list`}
        tabIndex={0}
        className="app-scrollbar min-h-0 overflow-x-hidden overflow-y-auto"
      >
        <div ref={contentRef}>{children}</div>
      </div>
    </SidebarGroup>
  );
}
