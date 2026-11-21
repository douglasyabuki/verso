"use client";

import { cn } from "cn";
import { useEffect, useRef } from "react";

import geometry from "@/components/brand/geometry.json";

/** Align every animation under `element` to the document timeline origin, so
 * loaders that replace each other (for example, session → workspace) continue
 * the same page-turn phase instead of restarting. */
function usePinnedAnimationPhase<T extends Element>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof element.getAnimations !== "function") return;
    for (const animation of element.getAnimations({ subtree: true }))
      animation.startTime = 0;
  }, []);
  return ref;
}

/** Render the mark with each page turning about the central fold. At rest, and
 * with reduced motion, it is identical to `BrandMark`. Decorative only. */
export function AnimatedBrandMark({ className }: { className?: string }) {
  const ref = usePinnedAnimationPhase<SVGSVGElement>();
  return (
    <svg
      ref={ref}
      viewBox={geometry.viewBox}
      fill="currentColor"
      aria-hidden="true"
      className={cn("size-8", className)}
    >
      {geometry.pages.map((page) => (
        <path key={page} d={page} className="brand-loading-page" />
      ))}
    </svg>
  );
}

/** Announce a loading state with the animated mark.
 * @param message - Visible and announced status text.
 * @param variant - `page` fills the viewport with the wordmark; `inline` fits a panel.
 * @example <BrandLoading message="Opening workspace…" />
 */
export function BrandLoading({
  message,
  variant = "page",
  className,
}: {
  message: string;
  variant?: "page" | "inline";
  className?: string;
}) {
  const page = variant === "page";
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "brand-loading flex flex-col items-center justify-center text-center",
        page ? "min-h-dvh gap-5 bg-background p-6" : "gap-3 py-6",
        className,
      )}
    >
      <AnimatedBrandMark
        className={cn("text-primary", page ? "size-12" : "size-8")}
      />
      <div className="flex flex-col items-center gap-1.5">
        {page && (
          <span
            aria-hidden="true"
            className="font-sans text-2xl leading-none font-medium tracking-tight text-foreground"
          >
            verso
          </span>
        )}
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
