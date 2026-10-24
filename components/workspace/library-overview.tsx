"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { librarySectionLabel } from "@/components/workspace/navigation";
import { reviewItems } from "@/lib/resume/review-queue";
import type { WorkspaceDestination } from "@/types-and-constants/navigation";
import type { Locale, ResumeDocument } from "@/types-and-constants/resume";
import { locales } from "@/types-and-constants/resume";

export function LibraryOverview({
  document,
  open,
  addSection,
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
      <p className="text-sm text-muted-foreground">
        Counts include active and archived career-library wording. Use archive
        and output filters in Wording tasks to choose what to work on.
      </p>
      {[
        { id: "profile", label: "Profile & summary", entries: [] },
        ...document.sections.map((section) => ({
          ...section,
          label: librarySectionLabel(section),
        })),
      ].map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle>{section.label}</CardTitle>
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
                  item.field.sectionId === section.id && item.locale === locale,
              );
              return (
                <Button
                  key={locale}
                  variant="outline"
                  className="justify-start"
                  onClick={() => onReview(section.id, locale)}
                >
                  {locale === "en-US" ? "English" : "Portuguese"}:{" "}
                  {
                    items.filter((item) => item.categories.includes("missing"))
                      .length
                  }{" "}
                  missing ·{" "}
                  {
                    items.filter((item) =>
                      item.categories.some((reason) => reason !== "missing"),
                    ).length
                  }{" "}
                  need review
                </Button>
              );
            })}
          </CardContent>
          <CardFooter>
            <Button
              onClick={() =>
                open({
                  kind: "library-section",
                  sectionId: section.id,
                  tab: "edit",
                })
              }
            >
              Edit content
            </Button>
          </CardFooter>
        </Card>
      ))}
      <Button
        className="self-start"
        disabled={document.sections.length >= 30}
        onClick={addSection}
      >
        Add section
      </Button>
    </div>
  );
}
