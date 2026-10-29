"use client";

import { Copy, FileText, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InfoHint } from "@/components/ui/info-hint";
import type { useResumeActions } from "@/hooks/workspace/use-resume-actions";
import type { ResumeDocument } from "@/types-and-constants/resume";
import type { Variant } from "@/types-and-constants/resume";

export function ResumeCollection({
  document,
  actions,
  onOpen,
}: {
  document: ResumeDocument;
  actions: ReturnType<typeof useResumeActions>;
  onOpen: (id: string) => void;
  onCreate: (source?: Variant) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 @2xl:grid-cols-2">
        {document.variants.map((resume) => (
          <Card key={resume.id} size="sm">
            <CardHeader>
              <CardTitle
                size="section"
                className="flex min-w-0 items-center gap-2"
              >
                <FileText
                  aria-hidden="true"
                  className="resume-color size-4 shrink-0 text-(--resume-color)"
                  data-resume-color={resume.color}
                />
                <span className="truncate">
                  {resume.name || "Untitled resume"}
                </span>
              </CardTitle>
              <CardDescription>
                {resume.sections.reduce(
                  (count, section) => count + section.entries.length,
                  0,
                )}{" "}
                selected entries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Shared career details
                <InfoHint label="resume independence" size="sm">
                  This resume uses shared career content, with its own selected
                  content, custom text, reviews, and appearance.
                </InfoHint>
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => onOpen(resume.id)}>
                <FileText data-icon="inline-start" />
                Open resume
              </Button>
              <Button
                variant="outline"
                onClick={(event) =>
                  actions.edit(resume.id, event.currentTarget)
                }
              >
                <Pencil data-icon="inline-start" />
                Rename &amp; color
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for ${resume.name || "Untitled resume"}`}
                    />
                  }
                >
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      disabled={document.variants.length >= 30}
                      onClick={() => actions.duplicate(resume.id)}
                    >
                      <Copy />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={document.variants.length <= 1}
                      onClick={() => actions.remove(resume.id)}
                    >
                      <Trash2 />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
