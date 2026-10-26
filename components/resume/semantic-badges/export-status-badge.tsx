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
          ? { label: "Valid for export", icon: Check, variant: "success" }
          : {
              label: "Output blocked",
              icon: CircleAlert,
              variant: "destructive",
            }
      }
      className={className}
    />
  );
}
