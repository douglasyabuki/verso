import { cn } from "cn";

import { CareerSectionIcon } from "@/components/content/career-section-icon";
import { Badge } from "@/components/ui/badge";
import { careerSectionLabel } from "@/lib/content/section-fields";
import type { Section } from "@/types-and-constants/resume";

export function CareerSectionBadge({
  section,
  className,
}: {
  section: Section | "profile" | "summary" | undefined;
  className?: string;
}) {
  const label =
    section === "profile"
      ? "Profile"
      : section === "summary"
        ? "Summary"
        : section
          ? careerSectionLabel(section)
          : "Unavailable section";

  return (
    <Badge
      variant="secondary"
      className={cn("max-w-full min-w-0", className)}
      title={label}
    >
      <CareerSectionIcon
        icon={typeof section === "object" ? section?.icon : undefined}
        kind={
          typeof section === "string" ? section : (section?.kind ?? "custom")
        }
        data-icon="inline-start"
      />
      <span className="truncate">{label}</span>
    </Badge>
  );
}
