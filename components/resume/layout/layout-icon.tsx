import {
  ALargeSmall,
  ArrowDownUp,
  Baseline,
  Bold,
  CaseUpper,
  ContactRound,
  createLucideIcon,
  FileDigit,
  FileWarning,
  Heading1,
  Heading2,
  Heading3,
  Link,
  List,
  ListOrdered,
  type LucideIcon,
  type LucideProps,
  Paintbrush,
  Scaling,
  ScanLine,
  SeparatorHorizontal,
  Shapes,
  TextAlignCenter,
  TextAlignStart,
  Type,
  UserRound,
} from "lucide-react";

import type { TemplateSettings } from "@/types-and-constants/output";

/** Create a layout diagram using Lucide's grid, stroke, and accessibility defaults.
 * @param name Component display name.
 * @param path SVG path describing the affected text blocks and spacing.
 * @returns A standard Lucide-compatible icon component.
 * @example const GapIcon = diagram("Gap", "M4 4h16M4 20h16M12 8v8");
 */
function diagram(name: string, path: string): LucideIcon {
  return createLucideIcon(name, [["path", { d: path, key: "diagram" }]]);
}

const MarginTop = diagram(
  "MarginTop",
  "M5 3h14v18H5zM5 9h14M12 4v4m-2-2 2 2 2-2",
);
const MarginBottom = diagram(
  "MarginBottom",
  "M5 3h14v18H5zM5 15h14M12 16v4m-2-2 2-2 2 2",
);
const MarginLeft = diagram(
  "MarginLeft",
  "M5 3h14v18H5zM10 3v18M6 12h3m-1-1 1 1-1 1",
);
const MarginRight = diagram(
  "MarginRight",
  "M5 3h14v18H5zM14 3v18M15 12h3m-2-1-1 1 1 1",
);
const NameContactGap = diagram(
  "NameContactGap",
  "M7 3h10M5 5h14M7 19h2m2 0h2m2 0h2M12 8v8m-2-6 2-2 2 2m-4 4 2 2 2-2",
);
const HeaderGap = diagram(
  "HeaderGap",
  "M7 3h10M5 6h14M7 9h10M4 20h16M12 12v5m-2-3 2-2 2 2m-4 1 2 2 2-2",
);
const SectionAbove = diagram(
  "SectionAbove",
  "M4 3h11M4 6h16M4 18h16v3H4zM12 9v6m-2-4 2-2 2 2m-4 2 2 2 2-2",
);
const SectionBelow = diagram(
  "SectionBelow",
  "M4 3h16v3H4zM4 18h16M4 21h11M12 9v6m-2-4 2-2 2 2m-4 2 2 2 2-2",
);
const DividerThickness = diagram(
  "DividerThickness",
  "M3 10h18v4H3zM12 2v5m-2-2 2 2 2-2M12 17v5m-2-3 2-2 2 2",
);
const HeadingSubtitleGap = diagram(
  "HeadingSubtitleGap",
  "M4 3h16M4 6h16M4 20h10M17 9v8m-2-6 2-2 2 2m-4 4 2 2 2-2",
);
const BeforeDetailsGap = diagram(
  "BeforeDetailsGap",
  "M4 3h16M4 6h10M4 18h16M4 21h12M17 9v6m-2-4 2-2 2 2m-4 2 2 2 2-2",
);
const EntryGap = diagram(
  "EntryGap",
  "M3 3h10v4H3zM3 17h10v4H3zM18 5v14m-2-12 2-2 2 2m-4 10 2 2 2-2",
);
const ParagraphGap = diagram(
  "ParagraphGap",
  "M3 3h10M3 6h10M3 9h7M3 16h10M3 19h10M3 22h7M18 9v7m-2-5 2-2 2 2m-4 3 2 2 2-2",
);
const BulletIndent = diagram(
  "BulletIndent",
  "M3 3v18M11 5h1m3 0h6M11 10h1m3 0h6M4 17h8m-6-2-2 2 2 2m4-4 2 2-2 2",
);
const BulletTextGap = diagram(
  "BulletTextGap",
  "M3 5h1m8 0h9M3 10h1m8 0h9M4 17h8m-6-2-2 2 2 2m4-4 2 2-2 2",
);
const BulletGap = diagram(
  "BulletGap",
  "M3 4h1m4 0h13M3 20h1m4 0h13M12 7v10m-2-8 2-2 2 2m-4 6 2 2 2-2",
);
const ListAbove = diagram(
  "ListAbove",
  "M3 3h18M3 17h1m4 0h13M3 21h1m4 0h13M12 6v8m-2-6 2-2 2 2m-4 4 2 2 2-2",
);
const ListBelow = diagram(
  "ListBelow",
  "M3 3h1m4 0h13M3 7h1m4 0h13M3 21h18M12 10v8m-2-6 2-2 2 2m-4 4 2 2 2-2",
);

// Exhaustive coverage prevents new settings from silently inheriting a generic icon.
export const layoutSettingIcons = {
  pageSize: Scaling,
  targetPages: FileWarning,
  marginTop: MarginTop,
  marginBottom: MarginBottom,
  marginLeft: MarginLeft,
  marginRight: MarginRight,
  fontFamily: Type,
  fontSize: ALargeSmall,
  lineHeight: ArrowDownUp,
  nameSize: UserRound,
  nameWeight: Bold,
  headerAlignment: TextAlignCenter,
  nameContactGap: NameContactGap,
  headerGap: HeaderGap,
  contactIcons: ContactRound,
  sectionSize: Heading1,
  sectionWeight: Bold,
  sectionCasing: CaseUpper,
  sectionGap: SectionAbove,
  sectionBelow: SectionBelow,
  sectionDivider: SeparatorHorizontal,
  dividerThickness: DividerThickness,
  entryTitleSize: Heading2,
  entryTitleWeight: Bold,
  entrySubtitleSize: Heading3,
  entrySubtitleWeight: Bold,
  headingSubtitleGap: HeadingSubtitleGap,
  beforeDetailsGap: BeforeDetailsGap,
  entryGap: EntryGap,
  paragraphGap: ParagraphGap,
  bulletMarker: List,
  bulletIndent: BulletIndent,
  bulletTextGap: BulletTextGap,
  bulletGap: BulletGap,
  listAbove: ListAbove,
  listBelow: ListBelow,
  headingColor: Paintbrush,
  bodyColor: Baseline,
  secondaryColor: TextAlignStart,
  linkColor: Link,
  iconColor: Shapes,
  dividerColor: ScanLine,
  pageNumbering: ListOrdered,
  pageNumberAlignment: TextAlignCenter,
  pageNumberFormat: FileDigit,
} satisfies Record<keyof TemplateSettings, LucideIcon>;

/** Draw a paper outline with its relative aspect ratio.
 * @param props Paper size and standard Lucide SVG attributes.
 * @returns A decorative paper-size icon.
 * @example <LayoutIcon kind="a4" />
 */
export function LayoutIcon({
  kind,
  ...props
}: LucideProps & { kind: "a4" | "letter" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect
        x="5"
        y="3"
        width={kind === "letter" ? 14 : 13}
        height="18"
        rx="1.5"
      />
      <path d="M8 17h7m-5-2-2 2 2 2m3-4 2 2-2 2" />
    </svg>
  );
}
