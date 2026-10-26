"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Info } from "lucide-react";
import { useId, useState } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const infoHintVariants = cva(
  "inline-flex shrink-0 cursor-help items-center justify-center self-center rounded-sm align-middle transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:pointer-events-none",
  {
    variants: {
      size: {
        sm: "size-4 [&_svg]:size-3",
        default: "size-5 [&_svg]:size-3.5",
        lg: "size-6 [&_svg]:size-4",
      },
      variant: {
        default: "text-muted-foreground hover:bg-muted hover:text-foreground",
        badge:
          "size-3.5 rounded-full text-inherit hover:bg-foreground/10 focus-visible:-outline-offset-2 [&_svg]:size-2.5",
      },
    },
    defaultVariants: { size: "default", variant: "default" },
  },
);

/** Optional, noninteractive help available by pointer, keyboard, or touch.
 * @param props Accessible topic label, short explanation, size, and optional compact badge appearance.
 * @returns An info button with dismissible help.
 * @example <InfoHint label="Shared wording" size="sm">Updates all inheriting resumes.</InfoHint>
 */
export function InfoHint({
  label,
  children,
  size,
  variant,
}: {
  label: string;
  children: string;
} & VariantProps<typeof infoHintVariants>) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen} triggerId={id}>
      <TooltipTrigger
        id={id}
        delay={0}
        closeOnClick={false}
        type="button"
        className={cn(infoHintVariants({ size, variant }))}
        aria-label={`About ${label}`}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <Info aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}
