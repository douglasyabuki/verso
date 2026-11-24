import Link from "next/link";

import { BrandLockup } from "@/components/brand/brand";
import geometry from "@/components/brand/geometry.json";
import { NotFoundActions } from "@/components/brand/not-found-actions";

const [leftPage, rightPage] = geometry.pages;

/** The pages' top edges rise toward the outside at 3 units per 11; text and
 * rules follow that slant so they sit on the paper rather than across it. */
const PAGE_SLANT = (Math.atan(3 / 11) * 180) / Math.PI;

const paper = {
  className: "fill-card stroke-border",
  strokeWidth: 1,
  strokeLinejoin: "round",
  vectorEffect: "non-scaling-stroke",
} as const;

/** Draw the mark as an open spread of paper pages, "404" on the left page and
 * "not found" on the right. Each page turns about the central fold like the
 * loader, the right page half a period behind (static with reduced motion).
 * Decorative only. */
function NotFoundSpread({ className }: { className?: string }) {
  return (
    <svg
      viewBox={geometry.viewBox}
      aria-hidden="true"
      overflow="visible"
      className={className}
    >
      <g className="brand-spread-page brand-spread-page-left">
        <path d={leftPage} {...paper} />
        <g
          transform={`translate(8.9 13.2) skewY(${PAGE_SLANT})`}
          className="font-sans font-medium"
        >
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={4.2}
            className="fill-primary tabular-nums"
          >
            404
          </text>
          <line
            x1={-2.6}
            x2={2.6}
            y1={3.4}
            y2={3.4}
            strokeWidth={0.6}
            strokeLinecap="round"
            className="stroke-primary"
          />
        </g>
      </g>
      <g className="brand-spread-page brand-spread-page-right">
        <path d={rightPage} {...paper} />
        <g
          transform={`translate(23.1 13.2) skewY(${-PAGE_SLANT})`}
          className="font-sans font-medium"
        >
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={2.7}
            className="fill-foreground"
          >
            <tspan x={0} y={-1.8}>
              not
            </tspan>
            <tspan x={0} y={1.3}>
              found
            </tspan>
          </text>
          <line
            x1={-2.6}
            x2={2.6}
            y1={3.4}
            y2={3.4}
            strokeWidth={0.6}
            strokeLinecap="round"
            className="stroke-border"
          />
        </g>
      </g>
    </svg>
  );
}

/** Full-page 404 for addresses outside every Verso route. A Server Component with
 * no request data, so routes that share the root boundary stay static.
 */
export function NotFoundScreen() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center px-4 py-6 sm:px-10">
        <Link href="/" aria-label="Home" className="rounded-md">
          <BrandLockup />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-24 sm:px-10">
        <div className="brand-loading flex max-w-md flex-col items-center gap-8 text-center">
          <NotFoundSpread className="size-40 sm:size-44" />
          <div className="flex flex-col items-center gap-3">
            <h1 className="text-[28px] leading-tight font-medium tracking-tight text-balance md:text-[32px]">
              Page not found
            </h1>
            <p className="text-base leading-relaxed text-pretty text-muted-foreground">
              There is nothing on this side of the page. The address may be
              mistyped, or the link may be out of date.
            </p>
          </div>
          <NotFoundActions />
        </div>
      </main>
    </div>
  );
}
