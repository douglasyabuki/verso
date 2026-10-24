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
  "inline-flex shrink-0 cursor-help items-center justify-center self-center rounded-sm align-middle text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:pointer-events-none",
  {
    variants: {
      size: {
        sm: "size-4 [&_svg]:size-3",
        default: "size-5 [&_svg]:size-3.5",
        lg: "size-6 [&_svg]:size-4",
      },
    },
    defaultVariants: { size: "default" },
  },
);

/** Optional, noninteractive help available by pointer, keyboard, or touch.
 * @param props Accessible topic label, short explanation, and size matching adjacent text.
 * @returns An info button with dismissible help.
 * @example <InfoHint label="Shared wording" size="sm">Updates all inheriting resumes.</InfoHint>
 */
export function InfoHint({
  label,
  children,
  size,
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
        className={cn(infoHintVariants({ size }))}
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
