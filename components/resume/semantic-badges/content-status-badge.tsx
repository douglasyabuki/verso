import { Archive, EyeOff, Minus } from "lucide-react";

import {
  type BadgeAppearance,
  SemanticBadge,
} from "@/components/resume/semantic-badges/semantic-badge";

const contentStates = {
  archived: { label: "Archived", icon: Archive, variant: "outline" },
  "archived-omitted": {
    label: "Archived · omitted",
    icon: Archive,
    variant: "outline",
  },
  "section-hidden": {
    label: "Section hidden · omitted",
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
