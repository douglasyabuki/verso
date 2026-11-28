import { Link } from "lucide-react";
import type { ComponentProps } from "react";

import {
  LINK_BRAND_GLYPHS,
  type LinkIconId,
} from "@/types-and-constants/link-icons";

/** Decorative brand glyphs match the pinned Font Awesome resume font. */
export function LinkIcon({
  type,
  ...props
}: { type: LinkIconId } & ComponentProps<"svg">) {
  if (type === "website") return <Link aria-hidden="true" {...props} />;
  const glyph = LINK_BRAND_GLYPHS[type];
  return (
    <svg
      viewBox={glyph.viewBox}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d={glyph.path} />
    </svg>
  );
}
