import { ArrowDownUp, Hash, Minus, Plus, Type } from "lucide-react";

import { LayoutIcon } from "@/components/resume/layout/layout-icon";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import type { useLayoutDrafts } from "@/hooks/resume/use-layout-drafts";
import { numericLayoutControls } from "@/types-and-constants/output";

type Control = (typeof numericLayoutControls)[number];

export function NumericLayoutField({
  control,
  id,
  drafts,
  disabled,
  source,
  reset,
  templateDefault,
  highlight,
}: {
  control: Control;
  id: string;
  drafts: ReturnType<typeof useLayoutDrafts>;
  disabled: boolean;
  source: string;
  reset?: () => void;
  templateDefault?: () => void;
  highlight: (key: string | null) => void;
}) {
  const { key } = control;
  const text = drafts.text(key);
  const error = drafts.errors[key];
  const icon =
    key === "fontSize" ? (
      <Type className="size-4" />
    ) : key === "lineHeight" ? (
      <ArrowDownUp className="size-4" />
    ) : key === "targetPages" ? (
      <Hash className="size-4" />
    ) : (
      <LayoutIcon kind={key} className="size-4" />
    );
  const adjust = (direction: number) => {
    const number = Number(text);
    if (!text.trim() || !Number.isFinite(number)) return;
    // Arithmetic precision only: arbitrary typed decimals are never quantized.
    const next = Math.min(
      control.max,
      Math.max(
        control.min,
        Number((number + direction * control.increment).toPrecision(14)),
      ),
    );
    drafts.edit(key, String(next));
    drafts.focus(key);
  };
  return (
    <Field
      data-invalid={!!error}
      data-disabled={disabled}
      onMouseEnter={() => highlight(key)}
      onMouseLeave={() => highlight(null)}
      onFocus={() => highlight(key)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) highlight(null);
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={id}>
          {icon}
          {control.label}
        </FieldLabel>
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
      <InputGroup data-disabled={disabled}>
        <InputGroupInput
          ref={(node) => {
            drafts.bindInput(key, node);
          }}
          id={id}
          type="number"
          className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          inputMode={key === "targetPages" ? "numeric" : "decimal"}
          step="any"
          min={control.min}
          max={control.max}
          appearance="utility"
          placeholder={"templateDefault" in control ? "Automatic" : undefined}
          value={text}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={`${id}-description${error ? ` ${id}-error` : ""}`}
          data-issue-field={`settings.${key}`}
          onChange={(event) => drafts.edit(key, event.target.value)}
          onBlur={(event) => {
            // Context/action handlers validate the entire outgoing batch. History
            // restores discard drafts before a later blur can commit them.
            if (
              event.relatedTarget instanceof HTMLElement &&
              (event.relatedTarget.closest(
                "[data-layout-scope], [data-workspace-history]",
              ) ||
                (event.relatedTarget.closest("[data-layout-inspector]") &&
                  event.relatedTarget.closest('button, [role="button"]')))
            )
              return;
            drafts.commit();
          }}
          onKeyDown={(event) => {
            const historyKey = event.key.toLowerCase();
            if (
              (event.ctrlKey || event.metaKey) &&
              !event.altKey &&
              (historyKey === "z" || historyKey === "y")
            ) {
              event.preventDefault();
              event.stopPropagation();
              drafts.history(historyKey === "y" || event.shiftKey);
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              drafts.cancel(key);
            } else if (event.key === "Enter") {
              event.preventDefault();
              drafts.commit();
            } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              adjust(event.key === "ArrowUp" ? 1 : -1);
            }
          }}
        />
        <InputGroupAddon align="inline-end" className="gap-1">
          <InputGroupText>{control.unit}</InputGroupText>
          <Separator orientation="vertical" className="mx-1" />
          <InputGroupButton
            size="icon-xs"
            disabled={
              disabled ||
              !text.trim() ||
              !Number.isFinite(Number(text)) ||
              Number(text) <= control.min
            }
            aria-label={`Decrease ${control.label.toLowerCase()}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => adjust(-1)}
          >
            <Minus />
          </InputGroupButton>
          <InputGroupButton
            size="icon-xs"
            disabled={
              disabled ||
              !text.trim() ||
              !Number.isFinite(Number(text)) ||
              Number(text) >= control.max
            }
            aria-label={`Increase ${control.label.toLowerCase()}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => adjust(1)}
          >
            <Plus />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <FieldDescription id={`${id}-description`}>
        {source}
        {"templateDefault" in control && (
          <> · Template default: {control.templateDefault}</>
        )}
        {"description" in control && <> · {control.description}</>}
      </FieldDescription>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}
