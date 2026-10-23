"use client";

import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { useResumeActions } from "@/hooks/workspace/use-resume-actions";
import type { ResumeDocument } from "@/types-and-constants/resume";
import type { Variant } from "@/types-and-constants/resume";

export function ResumeCollection({
  document,
  actions,
  onOpen,
  onCreate,
}: {
  document: ResumeDocument;
  actions: ReturnType<typeof useResumeActions>;
  onOpen: (id: string) => void;
  onCreate: (source?: Variant) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <Button
        className="self-start"
        disabled={document.variants.length >= 30}
        onClick={() => onCreate()}
      >
        Create resume
      </Button>
      {document.variants.map((resume) => (
        <Card key={resume.id}>
          <CardHeader>
            <CardTitle className="flex min-w-0 items-center gap-2">
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
            <p className="text-sm text-muted-foreground">
              Shared profile and career library; independent selections,
              wording, reviews, and appearance.
            </p>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button onClick={() => onOpen(resume.id)}>Open resume</Button>
            <Button
              variant="outline"
              onClick={(event) => actions.edit(resume.id, event.currentTarget)}
            >
              Rename &amp; color
            </Button>
            <Button
              variant="outline"
              disabled={document.variants.length >= 30}
              onClick={() => actions.duplicate(resume.id)}
            >
              Duplicate
            </Button>
            <Button
              variant="destructive"
              disabled={document.variants.length <= 1}
              onClick={() => actions.remove(resume.id)}
            >
              Delete
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
