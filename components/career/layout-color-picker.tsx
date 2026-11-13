"use client";

import { Check } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  type LayoutColor,
  resolvedLayoutColor,
} from "@/lib/career/layout-display";
import type { CareerResume } from "@/types-and-constants/career";
import { pdfColorPresets, textColors } from "@/types-and-constants/output";

/** Select one draft color without committing the enclosing form.
 * @param props Color role, current appearance, frozen defaults, validation, and draft callback.
 * @returns A swatch trigger and accessible named choices that close on selection.
 * @example <LayoutColorPicker id="heading" label="Section color" setting="headingColor" layout={layout} defaults={defaults} disabled={false} change={change} />
 */
export function LayoutColorPicker({
  id,
  label,
  setting,
  layout,
  defaults,
  disabled,
  error,
  change,
}: {
  id: string;
  label: string;
  setting: LayoutColor;
  layout: CareerResume["layout"];
  defaults: CareerResume["layout"];
  disabled: boolean;
  error?: string;
  change: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = resolvedLayoutColor(layout, setting);
  const baseline = resolvedLayoutColor(defaults, setting);
  const automatic = resolvedLayoutColor(
    { ...layout, [setting]: "template-default" },
    setting,
  );
  return (
    <Field data-disabled={disabled} data-invalid={!!error}>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <Popover open={open && !disabled} onOpenChange={setOpen}>
          <PopoverTrigger
            ref={trigger}
            render={<Button type="button" variant="outline" size="icon-sm" />}
            id={id}
            aria-label={`${label}: ${selected.label}`}
            aria-invalid={!!error}
            aria-describedby={`${id}-description${error ? ` ${id}-error` : ""}`}
            disabled={disabled}
          >
            <span
              aria-hidden="true"
              className="size-4 rounded-sm border"
              style={{ backgroundColor: selected.hex }}
            />
          </PopoverTrigger>
          <PopoverContent align="end" finalFocus={trigger}>
            <PopoverTitle>{label}</PopoverTitle>
            <PopoverDescription>
              Changes stay in this draft until you Save the form.
            </PopoverDescription>
            <div className="flex flex-col gap-1">
              {textColors.map((value) => {
                const option =
                  value === "template-default"
                    ? automatic
                    : pdfColorPresets[value];
                return (
                  <Button
                    key={value}
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-pressed={layout[setting] === value}
                    onClick={() => {
                      change(value);
                      setOpen(false);
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="size-3 rounded-full border"
                      style={{ backgroundColor: option.hex ?? undefined }}
                    />
                    {value === "template-default"
                      ? `Automatic: ${option.label}`
                      : option.label}
                    {layout[setting] === value && (
                      <Check aria-hidden="true" data-icon="inline-end" />
                    )}
                  </Button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <FieldDescription id={`${id}-description`}>
        {selected.label}. Default: {baseline.label}.
        {disabled &&
          " Enable its related feature to use this color; the value is retained."}
      </FieldDescription>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}
