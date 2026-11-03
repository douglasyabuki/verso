import { Pencil } from "lucide-react";

import { CareerSectionIcon } from "@/components/content/career-section-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CareerDocument } from "@/types-and-constants/career";

/** Render the original career overview card layout using schema-2 career records.
 * @param props Committed career content and guarded destination navigation.
 * @returns Profile, summary, and section cards without retired translation-review controls.
 * @example <CareerOverview document={head.document} navigate={navigate} />
 */
export function CareerOverview({
  document,
  navigate,
}: {
  document: CareerDocument;
  navigate: (destination: string) => void;
}) {
  const sections = [
    {
      id: "profile",
      kind: "profile" as const,
      label: "Profile",
      description: "Shared contact details for all resumes",
      destination: "profile",
      archived: false,
    },
    {
      id: "summary",
      kind: "summary" as const,
      label: "Summary",
      description: "Reusable summary wording for each content language",
      destination: "summary",
      archived: false,
    },
    ...document.sections.map((section) => ({
      id: section.id,
      kind: section.kind,
      label: section.name || section.kind,
      description: `${section.entries.filter((entry) => !entry.archived).length} active · ${section.entries.filter((entry) => entry.archived).length} archived entries`,
      destination: `list/${section.id}`,
      archived: section.archived,
    })),
  ];
  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-muted-foreground">Shared career content</p>
      <div className="grid gap-4 @2xl:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.id} size="sm">
            <CardHeader>
              <CardTitle
                size="section"
                className="flex items-center gap-2 [&>svg]:size-5 [&>svg]:shrink-0"
              >
                <CareerSectionIcon kind={section.kind} />
                {section.label}
                {section.archived && (
                  <Badge variant="secondary">Archived</Badge>
                )}
              </CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto justify-end">
              <Button
                variant="outline"
                onClick={() => navigate(section.destination)}
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
