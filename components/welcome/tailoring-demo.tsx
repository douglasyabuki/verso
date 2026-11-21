"use client";

import { type ReactNode, useState } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Example = "frontend" | "systems";

/** The selected resume only changes which parts of the fictional diagram are emphasized. */
export function TailoringDemo({ children }: { children: ReactNode }) {
  const [example, setExample] = useState<Example>("frontend");

  return (
    <div
      className="group/demo row-start-2 min-w-0 overflow-clip rounded-[12px] border bg-(--welcome-desk) shadow-[0_1px_2px_#10181708] welcome-motion min-[1120px]:col-start-2 min-[1120px]:row-span-2 min-[1120px]:row-start-1"
      data-example={example}
    >
      <div className="flex min-h-[61px] items-center justify-between gap-2.5 border-b bg-card px-[clamp(12px,2vw,24px)] py-[9px] text-sm font-medium welcome-compact:min-h-[53px] welcome-compact:gap-[7px] welcome-compact:text-xs">
        <p id="welcome-demo-title">Explore a resume</p>
        <ToggleGroup
          aria-labelledby="welcome-demo-title"
          aria-controls="welcome-diagram"
          value={[example]}
          onValueChange={([value]) => {
            if (value === "frontend" || value === "systems") setExample(value);
          }}
          size="sm"
          spacing={0}
          variant="outline"
        >
          <ToggleGroupItem
            value="frontend"
            className="min-h-9 motion-reduce:transition-none welcome-compact:text-xs"
          >
            Frontend
          </ToggleGroupItem>
          <ToggleGroupItem
            value="systems"
            className="min-h-9 motion-reduce:transition-none welcome-compact:text-xs"
          >
            Design systems
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {children}
      <p role="status" className="sr-only">
        {example === "frontend"
          ? "Frontend uses experience, the dashboard achievement, and education."
          : "Design systems leads with the Transit Companion project and also uses experience."}
      </p>
    </div>
  );
}
