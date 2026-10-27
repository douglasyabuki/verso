import { Check, CircleAlert } from "lucide-react";

import { SemanticBadge } from "@/components/resume/semantic-badges/semantic-badge";

export function ExportStatusBadge({
  state,
  className,
}: { className?: string } & { state: "valid" | "blocked" }) {
  return (
    <SemanticBadge
      appearance={
        state === "valid"
          ? {
              label: "Required details complete",
              icon: Check,
              variant: "success",
            }
          : {
              label: "Fix errors before downloading",
              icon: CircleAlert,
              variant: "destructive",
            }
      }
      className={className}
    />
  );
}
