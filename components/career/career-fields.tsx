"use client";

import { Archive, ArchiveRestore, Plus } from "lucide-react";
import { useId } from "react";

import { SortableItemLayout } from "@/components/editor/sortable-item-layout";
import { SortableList, SortableRow } from "@/components/editor/sortable-list";
import { TextEditorCore } from "@/components/editor/text/text-editor-core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { careerFieldLabel } from "@/lib/career/labels";
import { fieldSchema } from "@/lib/career/model";
import { type RichText, wordingSpans } from "@/lib/career/wording";
import { reorderVisible } from "@/lib/ordering";
import type {
  CareerEntry,
  CareerField,
  CareerSection,
} from "@/types-and-constants/career";

/** Name an extensible content language without making it an interface locale.

 * @param tag Canonical content-language tag.
 * @returns English display name and the tag for disambiguation.
 * @example contentLanguageName("pt-BR")
 */
export function contentLanguageName(tag: string): string {
  return `${new Intl.DisplayNames(["en"], { type: "language" }).of(tag) ?? tag} (${tag})`;
}

export function CareerTextField({
  label,
  value,
  onChange,
  multiline = false,
  hint,
  description,
  error,
  placeholder,
  type = "text",
  maxLength = 20_000,
  hideLabel = false,
}: {
  hideLabel?: boolean;
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  hint?: string;
  description?: string;
  error?: string;
  placeholder?: string;
  type?: string;
  maxLength?: number;
}) {
  const id = useId();
  const control = {
    id,
    value,
    placeholder,
    maxLength,
    "aria-invalid": !!error,
    "aria-describedby": error || description ? `${id}-help` : undefined,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(event.target.value),
  };
  return (
    <Field data-invalid={!!error}>
      <div className={hideLabel ? "sr-only" : "flex items-center gap-2"}>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {hint && <InfoHint label={label}>{hint}</InfoHint>}
      </div>
      {multiline ? (
        <Textarea {...control} />
      ) : (
        <Input {...control} type={type} />
      )}
      {error ? (
        <FieldError id={`${id}-help`}>{error}</FieldError>
      ) : description ? (
        <FieldDescription id={`${id}-help`}>{description}</FieldDescription>
      ) : null}
    </Field>
  );
}

export function CareerRichField({
  label,
  value,
  onChange,
  language,
  disabled = false,
  hideLabel = false,
}: {
  disabled?: boolean;
  hideLabel?: boolean;
  label: string;
  value: RichText;
  onChange: (value: RichText) => void;
  language: string;
}) {
  const id = useId();
  return (
    <Field>
      <div
        className={
          hideLabel ? "sr-only" : "flex flex-wrap items-center gap-1.5"
        }
      >
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <span className="text-xs text-muted-foreground">
          {contentLanguageName(language)}
        </span>
        <InfoHint label={label}>
          Reusable career wording. Inline links and italic emphasis are retained
          in saved content and PDFs.
        </InfoHint>
      </div>
      <TextEditorCore
        disabled={disabled}
        id={id}
        fieldKey={id}
        label={label}
        spans={wordingSpans(value)}
        multiline
        maxLength={20_000}
        onChange={(spans) =>
          onChange(
            spans.every((span) => !span.emphasis && !span.href)
              ? spans.map((span) => span.text).join("")
              : spans,
          )
        }
      />
    </Field>
  );
}

function CareerFieldInput({
  field,
  language,
  onChange,
}: {
  field: CareerField;
  language: string;
  onChange: (field: CareerField) => void;
}) {
  const result = fieldSchema.safeParse(field);
  return (
    <CareerTextField
      label={careerFieldLabel(field.key)}
      value={
        field.type === "text" ? (field.wording[language] ?? "") : field.fact
      }
      onChange={(value) =>
        onChange(
          field.type === "text"
            ? { ...field, wording: { ...field.wording, [language]: value } }
            : { ...field, fact: value },
        )
      }
      type={
        field.type === "email"
          ? "email"
          : field.type === "phone"
            ? "tel"
            : "text"
      }
      placeholder={
        field.key === "fullName"
          ? "Your name"
          : field.type === "email"
            ? "you@example.com"
            : field.type === "date"
              ? "YYYY, YYYY-MM, or YYYY-MM-DD"
              : field.type === "url"
                ? "https://example.com"
                : undefined
      }
      hint={
        field.type === "text"
          ? `Career wording in ${contentLanguageName(language)}. Other languages are edited separately.`
          : "Shared across content languages. Optional; leave empty when it does not apply."
      }
      error={result.success ? undefined : result.error.issues[0]?.message}
      maxLength={field.type === "text" ? 20_000 : 4000}
    />
  );
}

export function CareerFieldsEditor({
  fields,
  language,
  onChange,
  profile = false,
  kind,
}: {
  fields: CareerField[];
  language: string;
  onChange: (fields: CareerField[]) => void;
  profile?: boolean;
  kind?: CareerSection["kind"];
}) {
  const render = (field: CareerField) => (
    <CareerFieldInput
      key={field.id}
      field={field}
      language={language}
      onChange={(changed) =>
        onChange(fields.map((item) => (item.id === field.id ? changed : item)))
      }
    />
  );
  if (profile)
    return (
      <FieldGroup>
        {fields.filter((field) => field.key === "fullName").map(render)}
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          {["email", "phone", "city", "country"].flatMap((key) =>
            fields.filter((field) => field.key === key).map(render),
          )}
        </FieldGroup>
      </FieldGroup>
    );
  const dates = fields.filter((field) => field.type === "date");
  const primaryKeys =
    kind === "experience"
      ? ["organization", "title"]
      : kind === "education"
        ? ["institution", "degree"]
        : ["title", "organization", "level"];
  const primary = primaryKeys.flatMap((key) =>
    fields.filter((field) => field.key === key),
  );
  const remaining = fields.filter(
    (field) => field.type !== "date" && !primary.includes(field),
  );
  return (
    <FieldGroup>
      {primary.map(render)}
      {remaining.length > 0 && (
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          {remaining.map(render)}
        </FieldGroup>
      )}
      {dates.length > 0 && (
        <FieldSet>
          <FieldLegend>
            {kind === "education"
              ? "Attendance dates"
              : kind === "experience"
                ? "Employment dates"
                : kind === "certifications"
                  ? "Credential dates"
                  : "Dates"}
          </FieldLegend>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            {dates.map(render)}
          </FieldGroup>
        </FieldSet>
      )}
    </FieldGroup>
  );
}

export function CareerLinksEditor({
  links,
  language,
  onChange,
}: {
  links: CareerEntry["links"];
  language: string;
  onChange: (links: CareerEntry["links"]) => void;
}) {
  return (
    <FieldSet>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FieldLegend>Social & website links</FieldLegend>
        <Button
          variant="outline"
          size="sm"
          disabled={links.length >= 30}
          onClick={() =>
            onChange([
              ...links,
              { id: crypto.randomUUID(), url: "", label: {}, archived: false },
            ])
          }
        >
          <Plus data-icon="inline-start" />
          Add link
        </Button>
      </div>
      <SortableList
        scope="career-links"
        revision={links}
        items={links.map((link, index) => ({
          id: link.id,
          label: link.label[language] || `Link ${index + 1}`,
        }))}
        onReorder={(source, target) => {
          const next = [...links];
          reorderVisible(
            next,
            links.map((link) => link.id),
            source,
            target,
            (link) => link.id,
          );
          onChange(next);
        }}
      >
        <div className="flex flex-col gap-3">
          {links.map((link, index) => (
            <SortableRow
              key={link.id}
              id={link.id}
              label={`Link ${index + 1}`}
              surface="nested"
              className="rounded-xl p-3"
            >
              {({ dragHandle, orderButtons }) => (
                <SortableItemLayout dragHandle={dragHandle}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      Link {index + 1}{" "}
                      {link.archived && (
                        <Badge variant="secondary">Archived</Badge>
                      )}
                    </span>
                    <div className="flex items-center gap-1">
                      {orderButtons}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`${link.archived ? "Restore" : "Archive"} link ${index + 1}`}
                        onClick={() =>
                          onChange(
                            links.map((item) =>
                              item.id === link.id
                                ? { ...item, archived: !item.archived }
                                : item,
                            ),
                          )
                        }
                      >
                        {link.archived ? <ArchiveRestore /> : <Archive />}
                      </Button>
                    </div>
                  </div>
                  <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    <CareerTextField
                      label={`Link ${index + 1} label (optional)`}
                      value={link.label[language] ?? ""}
                      hint="A blank label displays the link address. Labels use the editing content language."
                      onChange={(value) =>
                        onChange(
                          links.map((item) =>
                            item.id === link.id
                              ? {
                                  ...item,
                                  label: { ...item.label, [language]: value },
                                }
                              : item,
                          ),
                        )
                      }
                    />
                    <CareerTextField
                      label={`Link ${index + 1} address`}
                      value={link.url}
                      placeholder="https://example.com"
                      onChange={(url) =>
                        onChange(
                          links.map((item) =>
                            item.id === link.id ? { ...item, url } : item,
                          ),
                        )
                      }
                    />
                  </FieldGroup>
                </SortableItemLayout>
              )}
            </SortableRow>
          ))}
        </div>
      </SortableList>
    </FieldSet>
  );
}

export function CareerEntryEditor({
  entry,
  language,
  onChange,
  kind = "custom",
  disabled = false,
}: {
  disabled?: boolean;
  entry: CareerEntry;
  language: string;
  onChange: (entry: CareerEntry) => void;
  kind?: CareerSection["kind"];
}) {
  return (
    <FieldGroup>
      <CareerTextField
        label="Internal name"
        value={entry.name}
        maxLength={500}
        hint="Used to identify this entry in the editor. It does not appear in the PDF."
        onChange={(name) => onChange({ ...entry, name })}
      />
      <CareerFieldsEditor
        fields={entry.fields}
        language={language}
        kind={kind}
        onChange={(fields) => onChange({ ...entry, fields })}
      />
      <Separator />
      <FieldSet>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FieldLegend>
            {kind === "skills" ? "Skill details" : "Achievements & details"}
          </FieldLegend>
          <Button
            variant="outline"
            size="sm"
            disabled={entry.achievements.length >= 100}
            onClick={() =>
              onChange({
                ...entry,
                achievements: [
                  ...entry.achievements,
                  { id: crypto.randomUUID(), wording: {}, archived: false },
                ],
              })
            }
          >
            <Plus data-icon="inline-start" />
            Add achievement
          </Button>
        </div>
        <SortableList
          scope={`achievements-${entry.id}`}
          revision={entry}
          items={entry.achievements.map((item, index) => ({
            id: item.id,
            label: `Achievement ${index + 1}`,
          }))}
          onReorder={(source, target) => {
            const achievements = [...entry.achievements];
            reorderVisible(
              achievements,
              achievements.map((item) => item.id),
              source,
              target,
              (item) => item.id,
            );
            onChange({ ...entry, achievements });
          }}
        >
          <div className="flex flex-col gap-3">
            {entry.achievements.map((item, index) => (
              <SortableRow
                key={item.id}
                id={item.id}
                label={`Achievement ${index + 1}`}
                surface="nested"
                className="rounded-xl p-3"
              >
                {({ dragHandle, orderButtons }) => (
                  <SortableItemLayout dragHandle={dragHandle}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {kind === "skills" ? "Skill detail" : "Achievement"}{" "}
                        {index + 1}{" "}
                        {item.archived && (
                          <Badge variant="secondary">Archived</Badge>
                        )}
                      </span>
                      <div className="flex items-center gap-1">
                        {orderButtons}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${item.archived ? "Restore" : "Archive"} achievement ${index + 1}`}
                          onClick={() =>
                            onChange({
                              ...entry,
                              achievements: entry.achievements.map((other) =>
                                other.id === item.id
                                  ? { ...other, archived: !other.archived }
                                  : other,
                              ),
                            })
                          }
                        >
                          {item.archived ? <ArchiveRestore /> : <Archive />}
                        </Button>
                      </div>
                    </div>
                    <CareerRichField
                      disabled={disabled}
                      label={`Achievement ${index + 1}`}
                      language={language}
                      value={item.wording[language] ?? ""}
                      onChange={(value) =>
                        onChange({
                          ...entry,
                          achievements: entry.achievements.map((other) =>
                            other.id === item.id
                              ? {
                                  ...other,
                                  wording: {
                                    ...other.wording,
                                    [language]: value,
                                  },
                                }
                              : other,
                          ),
                        })
                      }
                    />
                  </SortableItemLayout>
                )}
              </SortableRow>
            ))}
          </div>
        </SortableList>
      </FieldSet>
      <Separator />
      <CareerLinksEditor
        links={entry.links}
        language={language}
        onChange={(links) => onChange({ ...entry, links })}
      />
    </FieldGroup>
  );
}
