import { Check, CircleAlert, Languages, Library, Minus } from "lucide-react";

import {
  type BadgeAppearance,
  SemanticBadge,
} from "@/components/shared/semantic-badges/semantic-badge";

const reviewStates = {
  missing: { label: "Missing text", icon: CircleAlert, variant: "attention" },
  translation: {
    label: "Compare translations",
    icon: Languages,
    variant: "attention",
  },
  "shared-wording": {
    label: "Review shared text changes",
    icon: Library,
    variant: "attention",
  },
  unflagged: {
    label: "No review reminders",
    icon: Minus,
    variant: "outline",
    description:
      "You haven’t been asked to review this text. It may still need checking.",
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
