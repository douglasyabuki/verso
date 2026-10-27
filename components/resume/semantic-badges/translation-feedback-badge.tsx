import { cn } from "cn";
import { Check, CircleAlert } from "lucide-react";

import { SemanticBadge } from "@/components/resume/semantic-badges/semantic-badge";

export function TranslationFeedbackBadge({
  state,
  owner,
  className,
}: { className?: string } & { state: "accepted" | "rejected"; owner: string }) {
  return (
    <SemanticBadge
      appearance={
        state === "accepted"
          ? {
              label: `Both languages confirmed for ${owner}.`,
              icon: Check,
              variant: "success",
            }
          : {
              label:
                "The text changed or could not be confirmed. Compare the latest text in both languages and try again.",
              icon: CircleAlert,
              variant: "destructive",
            }
      }
      className={cn("h-auto max-w-full whitespace-normal", className)}
    />
  );
}
