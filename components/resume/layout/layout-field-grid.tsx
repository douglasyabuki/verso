import { cn } from "cn";
import type { ReactNode } from "react";

import { FieldGroup } from "@/components/ui/field";

export function LayoutFieldGrid({
  children,
  layout = "standard",
}: {
  children: ReactNode;
  layout?: "standard" | "pair" | "page" | "colors";
}) {
  return (
    <div className="@container/layout-fields min-w-0">
      <FieldGroup
        className={cn(
          "grid min-w-0 grid-cols-1 items-start gap-4 *:min-w-0",
          (layout === "standard" || layout === "pair") &&
            "@min-[27rem]/layout-fields:grid-cols-2",
          layout === "standard" && "@min-[41rem]/layout-fields:grid-cols-3",
          layout === "page" && "@min-[36rem]/layout-fields:grid-cols-2",
          layout === "colors" && "@min-[41rem]/layout-fields:grid-cols-2",
        )}
      >
        {children}
      </FieldGroup>
    </div>
  );
}
