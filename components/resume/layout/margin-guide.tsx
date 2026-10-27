import { cn } from "cn";

import {
  layoutPaperSizes,
  type TemplateSettings,
} from "@/types-and-constants/output";

export function MarginGuide({
  values,
  active,
}: {
  values: TemplateSettings;
  active: string | null;
}) {
  const paper = layoutPaperSizes[values.pageSize];
  const x = values.marginSide;
  const y = values.marginTop;
  const width = paper.width - x * 2;
  const height = paper.height - y - values.marginBottom;
  return (
    <figure className="flex flex-col items-center gap-3 rounded-lg bg-muted/40 p-4">
      <figcaption className="text-sm font-medium">Margin guide</figcaption>
      <svg
        role="img"
        aria-label={`${paper.label}, ${width.toFixed(1)} by ${height.toFixed(1)} mm printable area. Top ${y}, bottom ${values.marginBottom}, sides ${x} mm.`}
        viewBox={`-2 -2 ${paper.width + 4} ${paper.height + 4}`}
        className="h-auto w-36 max-w-full overflow-visible text-muted-foreground"
      >
        <rect
          width={paper.width}
          height={paper.height}
          rx="3"
          className="fill-background stroke-border"
          strokeWidth="2"
        />
        <g className="fill-primary/15 stroke-primary" strokeWidth="1">
          <rect
            x="0"
            y="0"
            width={paper.width}
            height={y}
            className={cn(active !== "marginTop" && "opacity-0")}
          />
          <rect
            x="0"
            y={paper.height - values.marginBottom}
            width={paper.width}
            height={values.marginBottom}
            className={cn(active !== "marginBottom" && "opacity-0")}
          />
          <g className={cn(active !== "marginSide" && "opacity-0")}>
            <rect width={x} height={paper.height} />
            <rect x={paper.width - x} width={x} height={paper.height} />
          </g>
        </g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="none"
          stroke="currentColor"
          strokeDasharray="3 3"
        />
        <g stroke="currentColor" strokeWidth="2" opacity="0.3">
          {Array.from({ length: 12 }, (_, i) => (
            <path
              key={i}
              d={`M${x + 8} ${y + 14 + i * 10}h${width - (i % 4 === 3 ? 40 : 16)}`}
            />
          ))}
        </g>
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        {paper.label} · {paper.dimensions}
        <br />
        Printable area {Number(width.toFixed(2))} × {Number(height.toFixed(2))}{" "}
        mm
      </p>
      <p className="text-center text-xs text-muted-foreground">
        Guide only. The compiled PDF is the output reference.
      </p>
    </figure>
  );
}
