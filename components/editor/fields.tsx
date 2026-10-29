"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useId } from "react";

import { TextEditor } from "@/components/editor/text/text-editor";
import { ContentStatusBadge } from "@/components/shared/semantic-badges/content-status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import { Input } from "@/components/ui/input";
import { useFieldHistory } from "@/hooks/workspace/use-field-history";
import { plain } from "@/lib/wording/localization";
import type { Locale } from "@/types-and-constants/languages";
import { languageNames } from "@/types-and-constants/languages";
import type { LocalizedText, Span } from "@/types-and-constants/resume";
import type { EditGroup } from "@/types-and-constants/workspace";

export function TextField({
  fieldKey,
  label,
  value,
  onChange,
  error,
  description,
  hint,
  placeholder,
  type = "text",
  maxLength = 500,
}: {
  fieldKey: string;
  label: string;
  value: string;
  onChange: (value: string, group?: EditGroup) => void;
  error?: string;
  description?: string;
  hint?: string;
  placeholder?: string;
  type?: string;
  maxLength?: number;
}) {
  const id = useId();
  const history = useFieldHistory({ fieldKey, onChange });
  return (
    <Field data-invalid={!!error}>
      <div className="flex items-center gap-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {hint && <InfoHint label={label}>{hint}</InfoHint>}
      </div>
      <Input
        id={id}
        data-issue-field={fieldKey}
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        {...history}
        aria-invalid={!!error}
        aria-describedby={error || description ? id + "-help" : undefined}
      />
      {error ? (
        <FieldError id={id + "-help"}>{error}</FieldError>
      ) : description ? (
        <FieldDescription id={id + "-help"}>{description}</FieldDescription>
      ) : null}
    </Field>
  );
}

export function CheckField({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <Field orientation="horizontal" data-disabled={disabled}>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
    </Field>
  );
}

export function OrderButtons({
  label,
  first,
  last,
  onMove,
}: {
  label: string;
  first: boolean;
  last: boolean;
  onMove: (offset: number) => void;
}) {
  return (
    <div className="flex shrink-0 text-muted-foreground">
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={first}
        onClick={() => onMove(-1)}
        aria-label={`Move ${label} up`}
      >
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={last}
        onClick={() => onMove(1)}
        aria-label={`Move ${label} down`}
      >
        <ArrowDown />
      </Button>
    </div>
  );
}

export function LocalizedField({
  fieldKey,
  label,
  value,
  locale,
  onChange,
  required = false,
  error,
  multiline = false,
  description,
  hint,
}: {
  fieldKey: string;
  label: string;
  value: LocalizedText;
  locale: Locale;
  onChange: (spans: Span[], group?: EditGroup) => void;
  multiline?: boolean;
  description?: string;
  hint?: string;
  required?: boolean;
  error?: string;
}) {
  const id = useId();
  const record = value[locale];
  const missing = !plain(value, locale).trim();
  return (
    <FieldGroup className="gap-3">
      <Field data-invalid={!!error}>
        <div className="flex flex-wrap items-center gap-1.5">
          <FieldLabel htmlFor={id}>
            {label}{" "}
            <span className="text-muted-foreground">
              {languageNames[locale]}
              {required ? " *" : ""}
            </span>
          </FieldLabel>
          {hint && <InfoHint label={label}>{hint}</InfoHint>}
          {missing && !required ? (
            <ContentStatusBadge state="optional-empty" />
          ) : null}
        </div>
        <TextEditor
          key={fieldKey}
          id={id}
          fieldKey={fieldKey}
          label={`${label} (${languageNames[locale]})`}
          spans={record.spans}
          error={error}
          multiline={multiline}
          onChange={onChange}
        />
        {missing && required && (
          <FieldDescription>
            Enter the required {languageNames[locale]} wording.
          </FieldDescription>
        )}
        {description && <FieldDescription>{description}</FieldDescription>}
        {error && <FieldError id={id + "-error"}>{error}</FieldError>}
      </Field>
    </FieldGroup>
  );
}
