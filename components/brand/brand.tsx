import { cn } from "cn";
import type { SVGProps } from "react";

import geometry from "@/components/brand/geometry.json";

/** Render the shared V/page silhouette. Inherit color for monochrome usage. */
export function BrandMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox={geometry.viewBox}
      fill="currentColor"
      aria-hidden="true"
      className={cn("size-8", className)}
      {...props}
    >
      {geometry.pages.map((page) => (
        <path key={page} d={page} />
      ))}
    </svg>
  );
}

/** Pair the shared mark with the lowercase Geist Medium wordmark. */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="verso"
      className={cn("inline-flex items-center gap-2.5", className)}
    >
      <BrandMark className="text-primary" />
      <span
        aria-hidden="true"
        className="font-sans text-2xl leading-none font-medium tracking-tight"
      >
        verso
      </span>
    </span>
  );
}
