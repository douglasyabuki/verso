"use client";

import { Eraser, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useRef } from "react";

import { CareerSectionIcon } from "@/components/content/career-section-icon";
import { CareerSectionIconPicker } from "@/components/content/career-section-icon-picker";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InfoHint } from "@/components/ui/info-hint";
import { ResumeIcon } from "@/components/variants/resume-icon";
import { useWorkspaceEditor } from "@/hooks/workspace/use-workspace-editor";
import { careerSectionLabel } from "@/lib/content/section-fields";

/** Render the destination heading and career/resume actions with their focus targets. */
export function EditorHeader() {
  const {
    navigation,
    view,
    summary,
    section,
    update,
    disabled,
    variant,
    career,
    document,
    careerTarget,
    careerActions,
  } = useWorkspaceEditor();
  const careerMenuTrigger = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1 basis-48">
        <div className="flex items-center gap-2 [&>svg]:size-8 [&>svg]:shrink-0">
          {navigation.destination.kind === "career-profile" ? (
            <CareerSectionIcon kind="profile" />
          ) : summary ? (
            <CareerSectionIcon kind="summary" />
          ) : section ? (
            section.kind === "custom" ? (
              <CareerSectionIconPicker
                key={section.id}
                section={section}
                update={update}
                disabled={disabled}
              />
            ) : (
              <CareerSectionIcon kind={section.kind} icon={section.icon} />
            )
          ) : navigation.destination.kind === "resume" ? (
            <ResumeIcon color={variant.color} />
          ) : null}
          <h1 tabIndex={-1} data-workspace-heading>
            {view === "profile"
              ? "Profile"
              : summary
                ? "Summary"
                : view === "content" || view === "career-translations"
                  ? section
                    ? careerSectionLabel(section)
                    : "Career details"
                  : view === "variants"
                    ? `${variant.name || "Untitled resume"} · Content & order`
                    : view === "resume-translations"
                      ? `${variant.name || "Untitled resume"} · Text to review`
                      : (
                          {
                            "career-overview": "Career details · Overview",
                            resumes: "All resumes",
                            review: "Text to review",
                            data: "Backups & settings",
                            template: "Layout",
                            "shared-defaults": "Default layout",
                          } as Record<string, string>
                        )[view]}
          </h1>
        </div>
        {navigation.destination.kind !== "resume" && (
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{career ? "Career details" : "Workspace"}</span>
            <InfoHint label="this workspace view" size="sm">
              {career ||
              view === "career-translations" ||
              view === "career-overview"
                ? "Edits update shared career details used by your resumes. Add new content to each resume in Content & order."
                : view === "review"
                  ? "Find missing text, translations to check, and shared text changes. Use the filters to review a resume or other career details, including archived content."
                  : view === "shared-defaults"
                    ? "These layout settings apply to multiple resumes. Custom settings for a resume still take priority."
                    : "Your work stays in this browser. Download a backup (JSON) to keep all editable career details, resumes, and settings."}
            </InfoHint>
          </div>
        )}
      </div>
      {(view === "career-overview" || view === "resumes") && (
        <Button
          disabled={
            view === "resumes"
              ? document.variants.length >= 30
              : document.sections.length >= 30
          }
          onClick={() =>
            view === "resumes"
              ? navigation.createResume()
              : navigation.addSection()
          }
        >
          <Plus data-icon="inline-start" />
          {view === "resumes" ? "Create resume" : "Add section"}
        </Button>
      )}
      {careerTarget && (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={disabled}
            render={
              <Button
                ref={careerMenuTrigger}
                variant="ghost"
                size="icon-sm"
                className="ml-auto shrink-0"
                aria-label={`Actions for ${section ? careerSectionLabel(section) : summary ? "Summary" : "Profile"}`}
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="quick-actions-dropdown">
            <DropdownMenuGroup>
              <DropdownMenuItem
                disabled={disabled || !careerActions.canClear(careerTarget)}
                onClick={() =>
                  careerActions.clear(careerTarget, careerMenuTrigger.current)
                }
              >
                <Eraser />
                Clear content
              </DropdownMenuItem>
            </DropdownMenuGroup>
            {section?.kind === "custom" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={disabled}
                    onClick={() =>
                      careerActions.remove(
                        section.id,
                        careerMenuTrigger.current,
                      )
                    }
                  >
                    <Trash2 />
                    Delete section
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
