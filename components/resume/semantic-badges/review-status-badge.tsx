import { Check, CircleAlert, Languages, Library, Minus } from "lucide-react";

import {
  type BadgeAppearance,
  SemanticBadge,
} from "@/components/resume/semantic-badges/semantic-badge";

const reviewStates = {
  missing: { label: "Missing text", icon: CircleAlert, variant: "attention" },
  translation: {
    label: "Compare translations",
    icon: Languages,
    variant: "attention",
  },
  library: {
    label: "Review library changes",
    icon: Library,
    variant: "attention",
  },
  unflagged: {
    label: "No review flagged",
    icon: Minus,
    variant: "outline",
    description: "No review flag does not imply verification.",
  },
  resolved: { label: "Resolved", icon: Check, variant: "success" },
} satisfies Record<string, BadgeAppearance>;

export function ReviewStatusBadge({
  state,
  className,
  showHelp = true,
}: { className?: string } & {
  state: keyof typeof reviewStates;
  showHelp?: boolean;
}) {
  return (
    <SemanticBadge
      appearance={
        showHelp
          ? reviewStates[state]
          : { ...reviewStates[state], description: undefined }
      }
      className={className}
    />
  );
}
