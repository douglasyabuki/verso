import { Check, Minus } from "lucide-react";

import { SemanticBadge } from "@/components/shared/semantic-badges/semantic-badge";

export function SelectionBadge({
  selected,
  className,
}: { className?: string } & { selected: boolean }) {
  return (
    <SemanticBadge
      appearance={
        selected
          ? { label: "Selected", icon: Check, variant: "secondary" }
          : { label: "Not selected", icon: Minus, variant: "outline" }
      }
      className={className}
    />
  );
}
