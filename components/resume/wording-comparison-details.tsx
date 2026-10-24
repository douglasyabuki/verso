"use client";

import { ChevronDown, Languages } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function WordingComparisonDetails({
  expanded = false,
  children,
}: {
  expanded?: boolean;
  children: ReactNode;
}) {
  return (
    <Collapsible defaultOpen={expanded}>
      <CollapsibleTrigger
        render={<Button variant="ghost" size="sm" />}
        className="group"
      >
        <Languages data-icon="inline-start" />
        Compare languages
        <ChevronDown
          data-icon="inline-end"
          className="transition-transform group-data-panel-open:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 border-l-2 pl-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
