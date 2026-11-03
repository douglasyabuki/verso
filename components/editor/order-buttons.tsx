"use client";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";
export function OrderButtons({
  label,
  first,
  last,
  onMove,
}: {
  label: string;
  first: boolean;
  last: boolean;
  onMove: (offset: number) => void;
}) {
  return (
    <div className="flex shrink-0 text-muted-foreground">
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={first}
        onClick={() => onMove(-1)}
        aria-label={`Move ${label} up`}
      >
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={last}
        onClick={() => onMove(1)}
        aria-label={`Move ${label} down`}
      >
        <ArrowDown />
      </Button>
    </div>
  );
}
