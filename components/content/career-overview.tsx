"use client";

import { ListChecks, Pencil } from "lucide-react";

import { CareerSectionIcon } from "@/components/content/career-section-icon";
import { LanguageFlag } from "@/components/shared/language-flag";
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
import { careerSectionLabel } from "@/lib/content/section-fields";
import { formatCount } from "@/lib/format-count";
import { reviewItems } from "@/lib/review/review-queue";
import type { Locale } from "@/types-and-constants/languages";
import { locales } from "@/types-and-constants/languages";
import type { WorkspaceDestination } from "@/types-and-constants/navigation";
import type { ResumeDocument } from "@/types-and-constants/resume";

export function CareerOverview({
  document,
  open,
  onReview,
}: {
  document: ResumeDocument;
  open: (destination: WorkspaceDestination) => void;
  onReview: (
    destination: Extract<
      WorkspaceDestination,
      { kind: "career-summary" | "career-section" }
    >,
    locale: Locale,
  ) => void;
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
          {
            id: "profile",
            kind: "profile" as const,
            label: "Profile",
            entries: [],
            destination: { kind: "career-profile" } as const,
            reviewSectionId: null,
          },
          {
            id: "summary",
            kind: "summary" as const,
            label: "Summary",
            entries: [],
            destination: { kind: "career-summary", tab: "edit" } as const,
            reviewSectionId: "profile",
          },
          ...document.sections.map((section) => ({
            ...section,
            label: careerSectionLabel(section),
            destination: {
              kind: "career-section",
              sectionId: section.id,
              tab: "edit",
            } as const,
            reviewSectionId: section.id,
          })),
        ].map((section) => (
          <Card key={JSON.stringify(section.destination)} size="sm">
            <CardHeader>
              <CardTitle
                size="section"
                className="flex items-center gap-2 [&>svg]:size-5 [&>svg]:shrink-0"
              >
                <CareerSectionIcon
                  kind={section.kind}
                  icon={"icon" in section ? section.icon : undefined}
                />
                {section.label}
              </CardTitle>
              <CardDescription>
                {section.destination.kind === "career-profile"
                  ? "Shared contact details for all resumes"
                  : section.destination.kind === "career-summary"
                    ? "Shared bilingual summary"
                    : `${section.entries.filter((entry) => !entry.archived).length} active · ${section.entries.filter((entry) => entry.archived).length} archived entries`}
              </CardDescription>
            </CardHeader>
            {section.destination.kind !== "career-profile" && (
              <CardContent className="flex flex-col gap-2">
                {locales.map((locale) => {
                  const items = queue.filter(
                    (item) =>
                      item.field.sectionId === section.reviewSectionId &&
                      item.locale === locale,
                  );
                  return (
                    <Button
                      key={locale}
                      variant="outline"
                      className="justify-between"
                      onClick={() => {
                        if (section.destination.kind !== "career-profile")
                          onReview(
                            { ...section.destination, tab: "review" },
                            locale,
                          );
                      }}
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
            )}
            <CardFooter className="mt-auto">
              <Button
                variant="outline"
                onClick={() => open(section.destination)}
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
