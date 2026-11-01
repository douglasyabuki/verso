"use client";

import { Languages } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DisclosureChevron,
  DisclosureGuide,
  DisclosureLabel,
  disclosureTriggerClassName,
} from "@/components/ui/disclosure";

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
        className={disclosureTriggerClassName}
      >
        <DisclosureChevron />
        <Languages aria-hidden="true" />
        <DisclosureLabel>Compare languages</DisclosureLabel>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <DisclosureGuide>{children}</DisclosureGuide>
      </CollapsibleContent>
    </Collapsible>
  );
}
