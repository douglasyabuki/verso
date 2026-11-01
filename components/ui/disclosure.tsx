import { cn } from "cn";
import { ChevronRight } from "lucide-react";
import type { ComponentProps } from "react";

export const disclosureChevronTriggerClassName =
  "[&[aria-expanded=true]>[data-slot=disclosure-chevron]]:rotate-90";

export const disclosureTriggerClassName = cn(
  disclosureChevronTriggerClassName,
  "h-auto min-h-7 max-w-full min-w-0 shrink flex-nowrap items-start justify-start gap-2 py-1 text-start leading-5 whitespace-normal [&>svg]:mt-0.5 [&>img]:mt-0.5",
);

export const disclosureGuideClassName =
  "ms-4 mt-3 w-auto min-w-0 border-s border-border ps-4";

/** Fixed-size decoration; the owning trigger's expanded state controls rotation. */
export function DisclosureChevron() {
  return (
    <ChevronRight
      aria-hidden="true"
      data-slot="disclosure-chevron"
      className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none"
    />
  );
}

/** Wrap the label without allowing it to push the leading decoration aside. */
export function DisclosureLabel({
  className,
  ...props
}: ComponentProps<"span">) {
  return <span className={cn("min-w-0 wrap-anywhere", className)} {...props} />;
}

/** Indent inline disclosure content with a single logical-start guide. */
export function DisclosureGuide({
  className,
  ...props
}: ComponentProps<"div">) {
  return <div className={cn(disclosureGuideClassName, className)} {...props} />;
}
