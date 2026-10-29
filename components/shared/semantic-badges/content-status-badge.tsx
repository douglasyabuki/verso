import { Archive, EyeOff, Minus } from "lucide-react";

import {
  type BadgeAppearance,
  SemanticBadge,
} from "@/components/shared/semantic-badges/semantic-badge";

const contentStates = {
  archived: { label: "Archived", icon: Archive, variant: "outline" },
  "archived-omitted": {
    label: "Archived · hidden from resumes",
    icon: Archive,
    variant: "outline",
  },
  "section-hidden": {
    label: "Hidden from this resume",
    icon: EyeOff,
    variant: "outline",
  },
  "optional-empty": {
    label: "Optional field empty",
    icon: Minus,
    variant: "outline",
  },
} satisfies Record<string, BadgeAppearance>;

export function ContentStatusBadge({
  state,
  className,
}: { className?: string } & { state: keyof typeof contentStates }) {
  return (
    <SemanticBadge appearance={contentStates[state]} className={className} />
  );
}
