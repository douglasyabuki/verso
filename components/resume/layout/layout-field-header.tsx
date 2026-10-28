import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function LayoutFieldHeader({
  children,
  disabled,
  reset,
  templateDefault,
}: {
  children: ReactNode;
  disabled: boolean;
  reset?: () => void;
  templateDefault?: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 [&>[data-slot=field-label]]:min-w-0 [&>[data-slot=field-label]]:flex-1 [&>[data-slot=field-label]]:basis-32">
      {children}
      {(templateDefault || reset) && (
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {templateDefault && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={disabled}
              onClick={templateDefault}
            >
              Template default
            </Button>
          )}
          {reset && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={disabled}
              onClick={reset}
            >
              Use default
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
