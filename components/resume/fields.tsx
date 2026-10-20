"use client";

import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import type {
  Locale,
  LocalizedText,
  ResumeLink,
  Span,
} from "@/lib/resume/model";
import { plain, urlError } from "@/lib/resume/model";

export type ConfirmAction = (
  title: string,
  description: string,
  action: () => void,
) => void;

export function TextField({
  label,
  value,
  onChange,
  error,
  description,
  placeholder,
  type = "text",
  maxLength = 500,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  description?: string;
  placeholder?: string;
  type?: string;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
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
  label,
  value,
  locale,
  onChange,
  onReviewed,
  required = false,
  error,
}: {
  label: string;
  value: LocalizedText;
  locale: Locale;
  onChange: (spans: Span[]) => void;
  onReviewed: () => void;
  required?: boolean;
  error?: string;
}) {
  const id = useId();
  const record = value[locale];
  const [removeIndex, setRemoveIndex] = useState<number>();
  const missing = !plain(value, locale).trim();
  const other = locale === "en-US" ? "pt-BR" : "en-US";
  const update = (index: number, patch: Partial<Span>) =>
    onChange(
      record.spans.map((span, i) =>
        i === index ? { ...span, ...patch } : span,
      ),
    );
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
        {record.spans.map((span, index) => (
          <div key={index} className="flex flex-col gap-2">
            {index > 0 && (
              <label
                htmlFor={id + "-" + index}
                className="text-xs text-muted-foreground"
              >
                Continuation {index + 1}
              </label>
            )}
            <Textarea
              id={index === 0 ? id : id + "-" + index}
              value={span.text}
              maxLength={20_000}
              rows={label === "Summary" || label === "Achievement" ? 3 : 2}
              onChange={(event) => update(index, { text: event.target.value })}
              aria-invalid={!!error}
              aria-describedby={error ? id + "-error" : undefined}
            />
            <details className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer">
                Formatting{span.emphasis ? " · emphasis" : ""}
                {span.href ? " · linked" : ""}
              </summary>
              <FieldGroup className="mt-3 gap-3">
                <CheckField
                  label="Emphasis"
                  checked={span.emphasis}
                  onChange={(emphasis) => update(index, { emphasis })}
                />
                <TextField
                  label={`Link for segment ${index + 1}`}
                  value={span.href}
                  maxLength={2_000}
                  onChange={(href) => update(index, { href })}
                  error={urlError(span.href)}
                  placeholder="https://example.com"
                />
                {record.spans.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRemoveIndex(index)}
                  >
                    Remove segment
                  </Button>
                )}
              </FieldGroup>
            </details>
          </div>
        ))}
        {error && <FieldError id={id + "-error"}>{error}</FieldError>}
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={record.spans.length >= 100}
          onClick={() =>
            onChange([...record.spans, { text: "", emphasis: false, href: "" }])
          }
        >
          <Plus data-icon="inline-start" />
          Text segment
        </Button>
        {record.needsReview && !missing && (
          <Button variant="outline" size="sm" onClick={onReviewed}>
            <Check data-icon="inline-start" />
            Mark reviewed
          </Button>
        )}
      </div>
      <AlertDialog
        open={removeIndex !== undefined}
        onOpenChange={(open) => {
          if (!open) setRemoveIndex(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this text segment?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the segment and its formatting from this language.
              Variants using this wording will update.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onChange(
                  record.spans.filter((_, index) => index !== removeIndex),
                );
                setRemoveIndex(undefined);
              }}
            >
              Remove segment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FieldGroup>
  );
}

export function LinksEditor({
  links,
  onChange,
  confirm,
}: {
  links: ResumeLink[];
  onChange: (links: ResumeLink[]) => void;
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
            label="Link label"
            value={link.label}
            maxLength={200}
            onChange={(label) =>
              onChange(
                links.map((item) =>
                  item.id === link.id ? { ...item, label } : item,
                ),
              )
            }
            placeholder="My website"
          />
          <TextField
            label="URL"
            value={link.url}
            maxLength={2_000}
            onChange={(url) =>
              onChange(
                links.map((item) =>
                  item.id === link.id ? { ...item, url } : item,
                ),
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
