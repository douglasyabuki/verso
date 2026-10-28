import { cn } from "cn";

import { SectionIcon } from "@/components/resume/section-icon";
import { Badge } from "@/components/ui/badge";
import { librarySectionLabel } from "@/components/workspace/navigation";
import type { Section } from "@/types-and-constants/resume";

export function SectionBadge({
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
          ? librarySectionLabel(section)
          : "Unavailable section";

  return (
    <Badge
      variant="secondary"
      className={cn("max-w-full min-w-0", className)}
      title={label}
    >
      <SectionIcon
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
