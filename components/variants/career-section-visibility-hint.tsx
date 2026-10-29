"use client";

import {
  type PointerEvent,
  type ReactElement,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function CareerSectionVisibilityHint({
  hidden,
  children,
}: {
  hidden: boolean;
  children: ReactElement;
}) {
  const triggerId = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const hovering = useRef(false);
  const close = () => {
    hovering.current = false;
    clearTimeout(timer.current);
    clearTimeout(leaveTimer.current);
    setOpen(false);
  };
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(leaveTimer.current);
      hovering.current = false;
      setOpen(false);
    },
    [hidden],
  );
  const hover = (event: PointerEvent<HTMLElement>) => {
    clearTimeout(leaveTimer.current);
    if (
      !hidden ||
      event.pointerType === "touch" ||
      event.buttons !== 0 ||
      !(event.target instanceof Element) ||
      event.target.closest(
        "button, input, textarea, select, a, label, [role='button'], [role='checkbox'], [role='switch'], [role='textbox'], [contenteditable]:not([contenteditable='false']), [data-no-section-hint]",
      )
    ) {
      close();
      return;
    }
    if (hovering.current) return;
    hovering.current = true;
    timer.current = setTimeout(() => setOpen(true), 400);
  };
  return (
    <Tooltip
      open={hidden && open}
      triggerId={triggerId}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <TooltipTrigger
        id={triggerId}
        disabled
        tabIndex={-1}
        render={children}
        onPointerOverCapture={hover}
        onPointerMoveCapture={hover}
        onPointerLeave={() => {
          clearTimeout(timer.current);
          hovering.current = false;
          leaveTimer.current = setTimeout(close, 150);
        }}
        onPointerDownCapture={close}
        onFocusCapture={close}
        onKeyDownCapture={(event) => {
          if (event.key === "Escape") close();
        }}
      />
      <TooltipContent
        onPointerEnter={() => clearTimeout(leaveTimer.current)}
        onPointerLeave={close}
      >
        This section is hidden from this resume’s PDF. Use Show in resume in
        Content & order to include it. You can still edit and reorder its
        content.
      </TooltipContent>
    </Tooltip>
  );
}
