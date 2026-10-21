"use client";

import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import { useId } from "react";

import { TextEditor } from "@/components/resume/text-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useFieldHistory } from "@/hooks/workspace/use-field-history";
import { plain } from "@/lib/resume/localization";
import { urlError } from "@/lib/resume/validation";
import type { ConfirmAction } from "@/types-and-constants/editor";
import type {
  Locale,
  LocalizedText,
  ResumeLink,
  Span,
} from "@/types-and-constants/resume";
import type { EditGroup } from "@/types-and-constants/workspace";

export function TextField({
  fieldKey,
  label,
  value,
  onChange,
  error,
  description,
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
  placeholder?: string;
  type?: string;
  maxLength?: number;
}) {
  const id = useId();
  const history = useFieldHistory({ fieldKey, onChange });
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
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
    <div className="flex shrink-0 gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={first}
        onClick={() => onMove(-1)}
        aria-label={`Move ${label} up`}
      >
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
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
  onReviewed,
  required = false,
  error,
  multiline = false,
  description,
}: {
  fieldKey: string;
  label: string;
  value: LocalizedText;
  locale: Locale;
  onChange: (spans: Span[], group?: EditGroup) => void;
  onReviewed: () => void;
  multiline?: boolean;
  description?: string;
  required?: boolean;
  error?: string;
}) {
  const id = useId();
  const record = value[locale];
  const missing = !plain(value, locale).trim();
  const other = locale === "en-US" ? "pt-BR" : "en-US";
  return (
    <FieldGroup className="gap-3">
      <Field data-invalid={!!error}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FieldLabel htmlFor={id}>
            {label}{" "}
            <span className="text-muted-foreground">
              {locale === "en-US" ? "EN" : "PT"}
              {required ? " *" : ""}
            </span>
          </FieldLabel>
          {missing && (required || plain(value, other).trim()) ? (
            <Badge variant="outline">Missing text</Badge>
          ) : record.needsReview && !missing ? (
            <Badge variant="secondary">Needs review</Badge>
          ) : null}
        </div>
        <TextEditor
          key={fieldKey}
          id={id}
          fieldKey={fieldKey}
          label={`${label} (${locale === "en-US" ? "EN" : "PT"})`}
          spans={record.spans}
          error={error}
          multiline={multiline}
          onChange={onChange}
        />
        {description && <FieldDescription>{description}</FieldDescription>}
        {error && <FieldError id={id + "-error"}>{error}</FieldError>}
      </Field>
      <div className="flex flex-wrap gap-2">
        {record.needsReview && !missing && (
          <Button variant="outline" size="sm" onClick={onReviewed}>
            <Check data-icon="inline-start" />
            Mark reviewed
          </Button>
        )}
      </div>
    </FieldGroup>
  );
}

export function LinksEditor({
  links,
  onChange,
  confirm,
}: {
  links: ResumeLink[];
  onChange: (links: ResumeLink[], group?: EditGroup) => void;
  confirm: ConfirmAction;
}) {
  return (
    <FieldGroup className="gap-4">
      {links.map((link, index) => (
        <FieldGroup key={link.id} className="rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              LINK {index + 1}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove link ${index + 1}`}
              onClick={() =>
                confirm(
                  "Remove this link?",
                  "This removes the shared link from every draft that uses it.",
                  () => onChange(links.filter((item) => item.id !== link.id)),
                )
              }
            >
              <Trash2 />
            </Button>
          </div>
          <TextField
            fieldKey={`links.${link.id}.label`}
            label="Link label"
            value={link.label}
            maxLength={200}
            onChange={(label, group) =>
              onChange(
                links.map((item) =>
                  item.id === link.id ? { ...item, label } : item,
                ),
                group,
              )
            }
            placeholder="My website"
          />
          <TextField
            fieldKey={`links.${link.id}.url`}
            label="URL"
            value={link.url}
            maxLength={2_000}
            onChange={(url, group) =>
              onChange(
                links.map((item) =>
                  item.id === link.id ? { ...item, url } : item,
                ),
                group,
              )
            }
            error={urlError(link.url)}
            placeholder="https://example.com"
          />
        </FieldGroup>
      ))}
      <Button
        variant="outline"
        size="sm"
        disabled={links.length >= 30}
        onClick={() =>
          onChange([...links, { id: crypto.randomUUID(), label: "", url: "" }])
        }
      >
        <Plus data-icon="inline-start" />
        Add link
      </Button>
    </FieldGroup>
  );
}
