"use client";

import { Archive, Check, EyeOff, Minus, Search, X } from "lucide-react";
import {
  type PointerEvent,
  type ReactElement,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { CheckField } from "@/components/resume/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SectionVisibilityHint({
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
        This section is hidden in this resume and omitted from output. Turn on
        its eye toggle in Content & order to include it. You can still edit and
        sort its content.
      </TooltipContent>
    </Tooltip>
  );
}

export function LibrarySearch({
  query,
  onQuery,
  showArchived,
  onArchived,
  count,
  total,
}: {
  query: string;
  onQuery: (value: string) => void;
  showArchived: boolean;
  onArchived: (value: boolean) => void;
  count: number;
  total: number;
}) {
  const id = useId();
  return (
    <FieldGroup className="gap-3">
      <Field>
        <div className="flex items-center gap-2">
          <FieldLabel htmlFor={id}>
            <Search className="size-4" aria-hidden="true" />
            Search entries
          </FieldLabel>
          <InfoHint label="entry search">
            Searches English and Portuguese, regardless of the editing language.
          </InfoHint>
        </div>
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Organization, title, technology, or achievement"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!query}
            onClick={() => onQuery("")}
          >
            <X data-icon="inline-start" />
            Clear
          </Button>
        </div>
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CheckField
          label="Include archived entries"
          checked={showArchived}
          onChange={onArchived}
        />
        <p className="text-xs text-muted-foreground" role="status">
          {count} of {total} entries
        </p>
      </div>
    </FieldGroup>
  );
}

export function InclusionStatus({
  selected,
  archived,
  sectionVisible,
  count,
  total,
  variantName,
}: {
  selected: boolean;
  archived: boolean;
  sectionVisible: boolean;
  count?: number;
  total?: number;
  variantName: string;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label={`Selection in ${variantName}`}
    >
      <Badge variant={selected ? "secondary" : "outline"}>
        {selected ? (
          <Check data-icon="inline-start" />
        ) : (
          <Minus data-icon="inline-start" />
        )}
        {selected ? "Selected" : "Not selected"}
      </Badge>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">
          {count}/{total} selected
        </span>
      )}
      {archived && (
        <Badge variant="outline">
          <Archive data-icon="inline-start" />
          Archived · omitted
        </Badge>
      )}
      {!archived && !sectionVisible && (
        <Badge variant="outline">
          <EyeOff data-icon="inline-start" />
          Section hidden · omitted
        </Badge>
      )}
    </div>
  );
}

export function AchievementSelectionActions({
  selected,
  total,
  disabled,
  onSelectAll,
  onClearAll,
  label,
  showCount = true,
}: {
  selected: number;
  total: number;
  disabled: boolean;
  onSelectAll: () => void;
  onClearAll: () => void;
  label: string;
  showCount?: boolean;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label={`${label} selection`}
    >
      <Button
        variant="ghost"
        size="xs"
        disabled={disabled || selected === total}
        onClick={onSelectAll}
      >
        Select all
      </Button>
      <Button
        variant="ghost"
        size="xs"
        disabled={disabled || selected === 0}
        onClick={onClearAll}
      >
        Clear all
      </Button>
      {showCount && (
        <span className="text-xs text-muted-foreground">
          {selected} of {total} selected
          {disabled ? " · Include an unarchived entry to change selection" : ""}
        </span>
      )}
    </div>
  );
}
