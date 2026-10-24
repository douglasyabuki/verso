"use client";

import { Languages, ListChecks, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { librarySectionLabel } from "@/components/workspace/navigation";
import { reviewItems } from "@/lib/resume/review-queue";
import type { WorkspaceDestination } from "@/types-and-constants/navigation";
import type { Locale, ResumeDocument } from "@/types-and-constants/resume";
import { locales } from "@/types-and-constants/resume";

export function LibraryOverview({
  document,
  open,
  onReview,
}: {
  document: ResumeDocument;
  open: (destination: WorkspaceDestination) => void;
  addSection: () => void;
  onReview: (sectionId: string, locale: Locale) => void;
}) {
  const queue = reviewItems(document).filter((item) => !item.resumeId);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        Shared career content
        <InfoHint label="library task counts" size="sm">
          Counts include active and archived wording. Use wording-task filters
          to choose the content to review.
        </InfoHint>
      </div>
      <div className="grid gap-4 @2xl:grid-cols-2">
        {[
          { id: "profile", label: "Profile & summary", entries: [] },
          ...document.sections.map((section) => ({
            ...section,
            label: librarySectionLabel(section),
          })),
        ].map((section) => (
          <Card key={section.id} size="sm">
            <CardHeader>
              <CardTitle size="section">{section.label}</CardTitle>
              <CardDescription>
                {section.id === "profile"
                  ? "Shared contact details and bilingual summary"
                  : `${section.entries.filter((entry) => !entry.archived).length} active · ${section.entries.filter((entry) => entry.archived).length} archived entries`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {locales.map((locale) => {
                const items = queue.filter(
                  (item) =>
                    item.field.sectionId === section.id &&
                    item.locale === locale,
                );
                return (
                  <Button
                    key={locale}
                    variant="outline"
                    className="justify-start"
                    onClick={() => onReview(section.id, locale)}
                  >
                    <Languages data-icon="inline-start" />
                    {locale === "en-US" ? "English" : "Portuguese"}
                    <Badge variant={items.length ? "attention" : "outline"}>
                      <ListChecks data-icon="inline-start" />
                      {items.length ? `${items.length} tasks` : "No tasks"}
                    </Badge>
                  </Button>
                );
              })}
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                onClick={() =>
                  open({
                    kind: "library-section",
                    sectionId: section.id,
                    tab: "edit",
                  })
                }
              >
                <Pencil data-icon="inline-start" />
                Edit content
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
