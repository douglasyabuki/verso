import { Check, CircleAlert } from "lucide-react";

import { SemanticBadge } from "@/components/resume/semantic-badges/semantic-badge";

export function PreviewStatusBadge({
  state,
  className,
}: { className?: string } & { state: "current" | "stale" }) {
  return (
    <SemanticBadge
      appearance={
        state === "current"
          ? { label: "Current", icon: Check, variant: "success" }
          : { label: "Out of date", icon: CircleAlert, variant: "attention" }
      }
      className={className}
    />
  );
}
