import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { InfoHint } from "@/components/ui/info-hint";

export type BadgeAppearance = {
  label: string;
  description?: string;
  icon?: LucideIcon;
  variant: "attention" | "success" | "destructive" | "outline" | "secondary";
};

type LayoutProps = { className?: string };

export function SemanticBadge({
  appearance: { label, description, icon: Icon, variant },
  className,
}: LayoutProps & { appearance: BadgeAppearance }) {
  return (
    <Badge variant={variant} className={className}>
      {Icon && (
        <Icon
          data-icon="inline-start"
          aria-hidden="true"
          className="shrink-0"
        />
      )}
      {label}
      {description && (
        <InfoHint label={label} variant="badge">
          {description}
        </InfoHint>
      )}
    </Badge>
  );
}
