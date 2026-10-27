import type { ComponentProps } from "react";

/** Draw page-specific concepts on Lucide's 24-unit grid.
 * @param props Icon concept and standard SVG attributes.
 * @returns Decorative, rounded currentColor SVG.
 * @example <LayoutIcon kind="marginTop" />
 */
export function LayoutIcon({
  kind,
  ...props
}: ComponentProps<"svg"> & { kind: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {kind === "sectionGap" ? (
        <>
          <path d="M5 4h14M5 12h14M5 16h10M5 20h12M9 6v4m-2-2 2-2 2 2" />
        </>
      ) : (
        <>
          <rect
            x="5"
            y="3"
            width={kind === "letter" ? 14 : 13}
            height={18}
            rx="1.5"
          />
          {kind === "marginTop" ? (
            <path d="M5 8h13M11.5 4v3m-2-2 2 2 2-2" />
          ) : kind === "marginBottom" ? (
            <path d="M5 16h13M11.5 17v3m-2-2 2-2 2 2" />
          ) : kind === "marginLeft" ? (
            <path d="M9 3v18M6 12h2" />
          ) : kind === "marginRight" ? (
            <path d="M14 3v18M16 12h2" />
          ) : (
            <path d="M8 17h7m-5-2-2 2 2 2m3-4 2 2-2 2" />
          )}
        </>
      )}
    </svg>
  );
}
