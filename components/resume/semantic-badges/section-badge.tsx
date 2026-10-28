import { cn } from "cn";

import { SectionIcon } from "@/components/resume/section-icon";
import { Badge } from "@/components/ui/badge";
import { librarySectionLabel } from "@/components/workspace/navigation";
import type { Section } from "@/types-and-constants/resume";

export function SectionBadge({
  section,
  className,
}: {
  section: Section | "profile" | undefined;
  className?: string;
}) {
  const label =
    section === "profile"
      ? "Profile & summary"
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
        kind={section === "profile" ? "profile" : (section?.kind ?? "custom")}
        data-icon="inline-start"
      />
      <span className="truncate">{label}</span>
    </Badge>
  );
}
