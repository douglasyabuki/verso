"use client";

import {
  Award,
  BookOpen,
  BriefcaseBusiness,
  Code2,
  FileText,
  FolderKanban,
  GraduationCap,
  Plus,
  UserRound,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { views } from "@/components/workspace/navigation";
import { type Locale, plain, type ResumeDocument } from "@/lib/resume/model";

const sectionIcons = {
  experience: BriefcaseBusiness,
  projects: FolderKanban,
  education: GraduationCap,
  skills: Code2,
  certifications: Award,
  custom: FileText,
};

export function WorkspaceSidebar({
  document,
  locale,
  view,
  sectionId,
  navigate,
  addSection,
  reviewCount,
  utilities,
}: {
  document: ResumeDocument;
  locale: Locale;
  view: string;
  sectionId: string;
  navigate: (view: string, section?: string) => void;
  addSection: () => void;
  reviewCount: number;
  utilities: React.ReactNode;
}) {
  const { setOpenMobile, isMobile } = useSidebar();
  const go = (view: string, section?: string) => {
    navigate(view, section);
    setOpenMobile(false);
  };
  return (
    <Sidebar
      collapsible="offcanvas"
      role="navigation"
      aria-label="Workspace navigation"
    >
      <SidebarHeader className="h-16 flex-row items-center justify-between border-b px-5">
        <span className="flex items-center gap-2 font-semibold">
          <BookOpen className="size-5" aria-hidden="true" />
          verso<span className="text-muted-foreground">.</span>
        </span>
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
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarMenu>
            {views.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={view === item.id}
                  onClick={() => go(item.id)}
                  aria-current={view === item.id ? "page" : undefined}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
                {item.id === "translations" && reviewCount > 0 && (
                  <SidebarMenuBadge>
                    <Badge variant="secondary">{reviewCount}</Badge>
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>Career library</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={view === "content" && sectionId === "profile"}
                onClick={() => go("content", "profile")}
              >
                <UserRound />
                <span>Profile</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {document.sections.map((section) => {
              const Icon = sectionIcons[section.kind];
              return (
                <SidebarMenuItem key={section.id}>
                  <SidebarMenuButton
                    isActive={view === "content" && sectionId === section.id}
                    onClick={() => go("content", section.id)}
                    className="pr-9"
                  >
                    <Icon />
                    <span>
                      {plain(section.heading, locale) || "Untitled section"}
                    </span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>
                    {section.entries.filter((entry) => !entry.archived).length}
                  </SidebarMenuBadge>
                </SidebarMenuItem>
              );
            })}
            <SidebarMenuItem>
              <SidebarMenuButton
                disabled={document.sections.length >= 30}
                onClick={() => {
                  addSection();
                  setOpenMobile(false);
                }}
              >
                <Plus />
                <span>Custom section</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <p className="text-xs text-muted-foreground">
          {document.sections.reduce(
            (count, section) =>
              count + section.entries.filter((entry) => !entry.archived).length,
            0,
          )}{" "}
          entries · {document.variants.length} variants
        </p>
        {isMobile && utilities}
      </SidebarFooter>
    </Sidebar>
  );
}
