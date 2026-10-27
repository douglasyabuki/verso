"use client";

import { ListChecks, Pencil } from "lucide-react";

import { LanguageFlag } from "@/components/resume/language-flag";
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
import { formatCount } from "@/lib/format-count";
import { reviewItems } from "@/lib/resume/review-queue";
import type { Locale } from "@/types-and-constants/languages";
import { locales } from "@/types-and-constants/languages";
import type { WorkspaceDestination } from "@/types-and-constants/navigation";
import type { ResumeDocument } from "@/types-and-constants/resume";

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
        <InfoHint label="review counts" size="sm">
          Counts include active and archived text. Use the review filters to
          choose the content to check.
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
                    className="justify-between"
                    onClick={() => onReview(section.id, locale)}
                  >
                    <div className="flex items-center gap-2">
                      <LanguageFlag locale={locale} className="rounded-sm" />
                      {locale === "en-US" ? "English" : "Portuguese"}
                    </div>
                    <Badge variant={items.length ? "attention" : "outline"}>
                      <ListChecks data-icon="inline-start" />
                      {items.length
                        ? formatCount(items.length, "task", "tasks")
                        : "No tasks"}
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
