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
                  {locale}:{" "}
                  {
                    items.filter((item) =>
                      item.reasons.includes("Missing required wording"),
                    ).length
                  }{" "}
                  missing ·{" "}
                  {
                    items.filter((item) =>
                      item.reasons.some(
                        (reason) => reason !== "Missing required wording",
                      ),
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
