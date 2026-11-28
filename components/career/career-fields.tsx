"use client";

import {
  Archive,
  ArchiveRestore,
  Paperclip,
  Pencil,
  Plus,
  Unlink,
} from "lucide-react";
import { useId, useState } from "react";

import { LinkIcon } from "@/components/content/link-icon";
import { SortableItemLayout } from "@/components/editor/sortable-item-layout";
import { SortableList, SortableRow } from "@/components/editor/sortable-list";
import { TextEditorCore } from "@/components/editor/text/text-editor-core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  type QuickAction,
  QuickActionItems,
} from "@/components/ui/quick-actions";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { detectLinkIcon, resolveLinkIcon } from "@/lib/career/link-icons";
import { builtinFieldType, fieldSchema, linkSchema } from "@/lib/career/model";
import {
  CAREER_TERMS,
  detailRowLabel,
  EVIDENCE_TERMS,
  linkRowLabel,
  PROFILE_LINK_TERMS,
  sectionFieldLabel,
} from "@/lib/career/terminology";
import { type RichText, wordingSpans } from "@/lib/career/wording";
import { reorderVisible } from "@/lib/ordering";
import {
  type CareerDocument,
  type CareerEntry,
  type CareerField,
  type CareerLink,
  type CareerSection,
  EVIDENCE_LIMIT,
  LATER_FIELDS,
} from "@/types-and-constants/career";
import {
  LINK_ICON_IDS,
  LINK_ICON_NAMES,
  type LinkIconId,
} from "@/types-and-constants/link-icons";

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
  error,
}: {
  disabled?: boolean;
  error?: string;
  hideLabel?: boolean;
  label: string;
  value: RichText;
  onChange: (value: RichText) => void;
  language: string;
}) {
  const id = useId();
  return (
    <Field data-invalid={!!error}>
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
        error={error}
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
  kind,
  description,
}: {
  field: CareerField;
  language: string;
  onChange: (field: CareerField) => void;
  kind?: CareerSection["kind"];
  description?: string;
}) {
  const result = fieldSchema.safeParse(field);
  return (
    <CareerTextField
      label={sectionFieldLabel(field.key, kind)}
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
                : field.key === "score"
                  ? "As reported, e.g. 110/120 or C1"
                  : kind === "languages" && field.key === "title"
                    ? "English"
                    : kind === "languages" && field.key === "level"
                      ? "Optional, e.g. Advanced"
                      : undefined
      }
      hint={
        field.type === "text"
          ? `Career wording in ${contentLanguageName(language)}. Other languages are edited separately.`
          : field.key === "score"
            ? "The score or result exactly as reported. Shared across content languages."
            : "Shared across content languages. Optional; leave empty when it does not apply."
      }
      description={description}
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
  // Entry URLs belong in the link list. A saved Website value stays editable;
  // the decision is fixed when the form opens so clearing it never hides the input.
  const [showWebsite] = useState(() =>
    fields.some((field) => field.key === "url" && !!field.fact),
  );
  const [pendingIds] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      ((kind && LATER_FIELDS[kind]) || []).map((key) => [
        key,
        crypto.randomUUID(),
      ]),
    ),
  );
  const render = (field: CareerField) => (
    <CareerFieldInput
      key={field.id}
      field={field}
      kind={kind}
      language={language}
      description={
        field.key === "url"
          ? "Saved Website value. Add new destinations under the links below."
          : undefined
      }
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
  // Fields added after a kind shipped are offered even when older entries lack them.
  const later = (kind && LATER_FIELDS[kind]) || [];
  // The identity is reserved up front so the input keeps focus when the first
  // keystroke adds the field to the draft.
  const missing = later
    .filter((key) => !fields.some((field) => field.key === key))
    .map((key): CareerField => ({
      id: pendingIds[key],
      key,
      type: builtinFieldType(key),
      fact: "",
      wording: {},
    }));
  const visible = [...fields, ...missing].filter(
    (field) => field.key !== "url" || showWebsite,
  );
  const renderAny = (field: CareerField) =>
    missing.includes(field) ? (
      <CareerFieldInput
        key={field.id}
        field={field}
        kind={kind}
        language={language}
        onChange={(changed) => onChange([...fields, changed])}
      />
    ) : (
      render(field)
    );
  const dates = visible.filter((field) => field.type === "date");
  const primaryKeys =
    kind === "experience"
      ? ["organization", "title"]
      : kind === "education"
        ? ["institution", "degree"]
        : ["title", "organization", "level"];
  const primary = primaryKeys.flatMap((key) =>
    visible.filter((field) => field.key === key),
  );
  const remaining = visible.filter(
    (field) => field.type !== "date" && !primary.includes(field),
  );
  return (
    <FieldGroup>
      {kind === "languages" ? (
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          {primary.map(renderAny)}
        </FieldGroup>
      ) : (
        primary.map(renderAny)
      )}
      {remaining.length > 0 && (
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          {remaining.map(renderAny)}
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
            {dates.map(renderAny)}
          </FieldGroup>
        </FieldSet>
      )}
    </FieldGroup>
  );
}

function InternalNameField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (name: string | undefined) => void;
}) {
  return (
    <CareerTextField
      label={label}
      value={value ?? ""}
      maxLength={200}
      placeholder="Optional"
      hint="Identifies this row in Career details, Content & order, and Wording. Shared across resumes and languages; never printed in PDFs."
      onChange={(name) => onChange(name || undefined)}
    />
  );
}

/** Heading with its group action, used by every Career details item group. */
function GroupHeader({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <FieldLegend className="mb-0">{legend}</FieldLegend>
        {hint && <InfoHint label={legend}>{hint}</InfoHint>}
      </div>
      {children}
    </div>
  );
}

const linkIconItems = [
  { value: "automatic", label: "Automatic" },
  ...LINK_ICON_IDS.map((icon) => ({
    value: icon,
    label: LINK_ICON_NAMES[icon],
  })),
];

function LinkIconSelect({
  link,
  label,
  onChange,
}: {
  link: CareerLink;
  label: string;
  onChange: (link: CareerLink) => void;
}) {
  const id = useId();
  const detected = detectLinkIcon(link.url);
  const option = (value: string) => {
    const icon = value === "automatic" ? detected : (value as LinkIconId);
    return (
      <>
        <span className="inline-flex size-4 shrink-0 items-center justify-center">
          <LinkIcon type={icon} className="size-3.5" />
        </span>
        {value === "automatic"
          ? `Automatic (${LINK_ICON_NAMES[detected]})`
          : LINK_ICON_NAMES[icon]}
      </>
    );
  };
  return (
    <Field>
      <div className="flex items-center gap-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <InfoHint label={label}>
          Automatic recognizes the address of supported platforms and otherwise
          uses the website icon. Icons appear beside profile links in the PDF
          header when Contact icons is on.
        </InfoHint>
      </div>
      <Select
        items={linkIconItems.map((item) => ({
          value: item.value,
          label: option(item.value),
        }))}
        value={link.icon ?? "automatic"}
        onValueChange={(value) => {
          if (value === "automatic" || !value) {
            const { icon: _, ...rest } = link;
            void _;
            onChange(rest);
          } else if ((LINK_ICON_IDS as readonly string[]).includes(value))
            onChange({ ...link, icon: value as LinkIconId });
        }}
      >
        <SelectTrigger id={id} size="sm" className="max-w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {linkIconItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {option(item.value)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

export function CareerLinksEditor({
  links,
  language,
  onChange,
  kind,
}: {
  links: CareerEntry["links"];
  language: string;
  onChange: (links: CareerEntry["links"]) => void;
  /** Owning section kind; omitted for Profile links. */
  kind?: CareerSection["kind"];
}) {
  const terms = kind ? CAREER_TERMS[kind] : PROFILE_LINK_TERMS;
  const update = (id: string, change: (link: CareerLink) => CareerLink) =>
    onChange(links.map((item) => (item.id === id ? change(item) : item)));
  return (
    <FieldSet>
      <GroupHeader legend={terms.links} hint={terms.linkHint}>
        <Button
          variant="outline"
          size="sm"
          disabled={links.length >= 30}
          onClick={() => onChange([...links, newLink()])}
        >
          <Plus data-icon="inline-start" />
          {terms.addLink}
        </Button>
      </GroupHeader>
      <SortableList
        scope="career-links"
        revision={links}
        items={links.map((link, index) => ({
          id: link.id,
          label: linkRowLabel(link, index, link.label[language]).title,
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
          {links.map((link, index) => {
            const row = linkRowLabel(link, index, link.label[language]);
            return (
              <SortableRow
                key={link.id}
                id={link.id}
                label={row.title}
                surface="nested"
                className="rounded-xl p-3"
              >
                {({ dragHandle, orderButtons }) => (
                  <SortableItemLayout dragHandle={dragHandle}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                        <LinkIcon
                          type={resolveLinkIcon(link)}
                          className="size-3.5 shrink-0 text-muted-foreground"
                        />
                        <span className="min-w-0 truncate">{row.title}</span>
                        {row.detail && (
                          <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">
                            {row.detail}
                          </span>
                        )}
                        {link.archived && (
                          <Badge variant="secondary">Archived</Badge>
                        )}
                      </span>
                      <div className="flex items-center gap-1">
                        {orderButtons}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${link.archived ? "Restore" : "Archive"} ${row.title}`}
                          onClick={() =>
                            update(link.id, (item) => ({
                              ...item,
                              archived: !item.archived,
                            }))
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
                        placeholder={
                          kind === "certifications"
                            ? "Verify credential"
                            : kind === "projects"
                              ? "Source code"
                              : "Portfolio"
                        }
                        hint="Printed in the PDF. A blank label displays the link address. Labels use the editing content language."
                        onChange={(value) =>
                          update(link.id, (item) => ({
                            ...item,
                            label: { ...item.label, [language]: value },
                          }))
                        }
                      />
                      <CareerTextField
                        label={`Link ${index + 1} address`}
                        value={link.url}
                        placeholder="https://example.com"
                        error={
                          linkSchema.shape.url.safeParse(link.url).error
                            ?.issues[0]?.message
                        }
                        onChange={(url) =>
                          update(link.id, (item) => ({ ...item, url }))
                        }
                      />
                      <InternalNameField
                        label={`Link ${index + 1} internal name`}
                        value={link.name}
                        onChange={(name) =>
                          update(link.id, ({ name: _, ...item }) => {
                            void _;
                            return name ? { ...item, name } : item;
                          })
                        }
                      />
                      <LinkIconSelect
                        link={link}
                        label={`Link ${index + 1} icon`}
                        onChange={(next) => update(link.id, () => next)}
                      />
                    </FieldGroup>
                  </SortableItemLayout>
                )}
              </SortableRow>
            );
          })}
        </div>
      </SortableList>
    </FieldSet>
  );
}

function newLink(): CareerLink {
  return { id: crypto.randomUUID(), url: "", label: {}, archived: false };
}

function newDetail(): CareerEntry["achievements"][number] {
  return { id: crypto.randomUUID(), wording: {}, archived: false };
}

function CareerDetailsEditor({
  entry,
  kind,
  language,
  disabled,
  onChange,
}: {
  entry: CareerEntry;
  kind: CareerSection["kind"];
  language: string;
  disabled: boolean;
  onChange: (entry: CareerEntry) => void;
}) {
  const terms = CAREER_TERMS[kind];
  const update = (
    id: string,
    change: (
      item: CareerEntry["achievements"][number],
    ) => CareerEntry["achievements"][number],
  ) =>
    onChange({
      ...entry,
      achievements: entry.achievements.map((item) =>
        item.id === id ? change(item) : item,
      ),
    });
  return (
    <FieldSet>
      <GroupHeader legend={terms.details}>
        <Button
          variant="outline"
          size="sm"
          disabled={entry.achievements.length >= 100}
          onClick={() =>
            onChange({
              ...entry,
              achievements: [...entry.achievements, newDetail()],
            })
          }
        >
          <Plus data-icon="inline-start" />
          {terms.addDetail}
        </Button>
      </GroupHeader>
      <SortableList
        scope={`achievements-${entry.id}`}
        revision={entry}
        items={entry.achievements.map((item, index) => ({
          id: item.id,
          label: detailRowLabel(kind, item, index, item.wording[language])
            .title,
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
          {entry.achievements.map((item, index) => {
            const row = detailRowLabel(
              kind,
              item,
              index,
              item.wording[language],
            );
            return (
              <SortableRow
                key={item.id}
                id={item.id}
                label={row.title}
                surface="nested"
                className="rounded-xl p-3"
              >
                {({ dragHandle, orderButtons }) => (
                  <SortableItemLayout dragHandle={dragHandle}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                        <span className="min-w-0 truncate">{row.title}</span>
                        {row.detail && (
                          <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">
                            {row.detail}
                          </span>
                        )}
                        {item.archived && (
                          <Badge variant="secondary">Archived</Badge>
                        )}
                      </span>
                      <div className="flex items-center gap-1">
                        {orderButtons}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${item.archived ? "Restore" : "Archive"} ${row.title}`}
                          onClick={() =>
                            update(item.id, (other) => ({
                              ...other,
                              archived: !other.archived,
                            }))
                          }
                        >
                          {item.archived ? <ArchiveRestore /> : <Archive />}
                        </Button>
                      </div>
                    </div>
                    <InternalNameField
                      label={`${terms.detail} ${index + 1} internal name`}
                      value={item.name}
                      onChange={(name) =>
                        update(item.id, ({ name: _, ...other }) => {
                          void _;
                          return name ? { ...other, name } : other;
                        })
                      }
                    />
                    <CareerRichField
                      disabled={disabled}
                      label={`${terms.detail} ${index + 1}`}
                      language={language}
                      value={item.wording[language] ?? ""}
                      onChange={(value) =>
                        update(item.id, (other) => ({
                          ...other,
                          wording: { ...other.wording, [language]: value },
                        }))
                      }
                    />
                  </SortableItemLayout>
                )}
              </SortableRow>
            );
          })}
        </div>
      </SortableList>
    </FieldSet>
  );
}

/** Attached tests or certificates of a language entry. Each one is a shared
 * certification record; detaching archives only the attachment. */
function CareerEvidenceEditor({
  entry,
  document,
  language,
  onChange,
  onCreate,
  onOpen,
}: {
  entry: CareerEntry;
  document?: Pick<CareerDocument, "sections">;
  language: string;
  onChange: (entry: CareerEntry) => void;
  onCreate?: () => void;
  onOpen?: (entryId: string) => void;
}) {
  const evidence = entry.evidence ?? [];
  const certifications = (document?.sections ?? []).filter(
    (section) => section.kind === "certifications",
  );
  const record = (entryId: string) =>
    certifications
      .flatMap((section) => section.entries)
      .find((item) => item.id === entryId);
  const describe = (certification: CareerEntry | undefined) => {
    if (!certification)
      return { title: "Unavailable certification", detail: "" };
    const value = (key: string) => {
      const field = certification.fields.find((item) => item.key === key);
      return field?.type === "text"
        ? (field.wording[language] ?? "")
        : (field?.fact ?? "");
    };
    return {
      title:
        certification.name ||
        value("title") ||
        `Untitled ${EVIDENCE_TERMS.item.toLowerCase()}`,
      detail: [value("organization"), value("score")]
        .filter(Boolean)
        .join(" · "),
    };
  };
  const attachable = certifications
    .filter((section) => !section.archived)
    .flatMap((section) => section.entries)
    .filter(
      (item) =>
        !item.archived &&
        !evidence.some(
          (attachment) =>
            attachment.entryId === item.id && !attachment.archived,
        ),
    );
  const attach = (entryId: string) => {
    const existing = evidence.find((item) => item.entryId === entryId);
    onChange({
      ...entry,
      evidence: existing
        ? evidence.map((item) =>
            item.id === existing.id ? { ...item, archived: false } : item,
          )
        : [...evidence, { id: crypto.randomUUID(), entryId, archived: false }],
    });
  };
  const canCreate = certifications.some(
    (section) => !section.archived && section.entries.length < 300,
  );
  const actions: QuickAction[] = [
    {
      key: "create",
      label: EVIDENCE_TERMS.create,
      icon: Plus,
      onSelect: () => onCreate?.(),
      disabled: !onCreate || !canCreate,
      hint: canCreate
        ? undefined
        : "Add a Certifications section first to store tests and certificates.",
    },
    ...(attachable.length
      ? attachable.map((item) => ({
          key: `attach-${item.id}`,
          label: `Attach ${describe(item).title}`,
          icon: Paperclip,
          onSelect: () => attach(item.id),
          disabled: evidence.length >= EVIDENCE_LIMIT,
        }))
      : [
          {
            key: "attach",
            label: EVIDENCE_TERMS.attach,
            icon: Paperclip,
            onSelect: () => {},
            disabled: true,
            hint: "No other active certifications are available.",
          },
        ]),
  ];
  return (
    <FieldSet>
      <GroupHeader
        legend={EVIDENCE_TERMS.group}
        hint="Tests and certificates are stored once under Certifications. Edits there reach every resume that shows them after Save; each resume chooses separately whether to show them here or under Certifications."
      >
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <Plus data-icon="inline-start" />
            {EVIDENCE_TERMS.add}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="quick-actions-dropdown">
            <QuickActionItems actions={actions} />
          </DropdownMenuContent>
        </DropdownMenu>
      </GroupHeader>
      {evidence.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No test or certificate attached. Proficiency alone is fine.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {evidence.map((attachment) => {
            const certification = record(attachment.entryId);
            const row = describe(certification);
            return (
              <li
                key={attachment.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
              >
                <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium">
                  <span className="min-w-0 truncate">{row.title}</span>
                  {row.detail && (
                    <span className="text-xs font-normal text-muted-foreground">
                      {row.detail}
                    </span>
                  )}
                  {attachment.archived && (
                    <Badge variant="secondary">Detached</Badge>
                  )}
                  {certification?.archived && (
                    <Badge variant="secondary">Archived</Badge>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  {certification && onOpen && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${row.title} in Certifications`}
                      onClick={() => onOpen(certification.id)}
                    >
                      <Pencil />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${attachment.archived ? "Reattach" : "Detach"} ${row.title}`}
                    disabled={attachment.archived && !!certification?.archived}
                    onClick={() =>
                      onChange({
                        ...entry,
                        evidence: evidence.map((item) =>
                          item.id === attachment.id
                            ? { ...item, archived: !item.archived }
                            : item,
                        ),
                      })
                    }
                  >
                    {attachment.archived ? <ArchiveRestore /> : <Unlink />}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </FieldSet>
  );
}

export function CareerEntryEditor({
  entry,
  language,
  onChange,
  kind = "custom",
  disabled = false,
  document,
  onCreateEvidence,
  onOpenEntry,
}: {
  disabled?: boolean;
  entry: CareerEntry;
  language: string;
  onChange: (entry: CareerEntry) => void;
  kind?: CareerSection["kind"];
  /** Shared records used to attach certifications to language entries. */
  document?: Pick<CareerDocument, "sections">;
  /** Starts the guarded flow that creates and attaches a certification. */
  onCreateEvidence?: () => void;
  /** Opens another Career entry through guarded navigation. */
  onOpenEntry?: (entryId: string) => void;
}) {
  const terms = CAREER_TERMS[kind];
  const groups = {
    details: entry.achievements.length > 0 || terms.primary.includes("details"),
    links: entry.links.length > 0 || terms.primary.includes("links"),
    evidence: kind === "languages" || (entry.evidence?.length ?? 0) > 0,
  };
  const more: QuickAction[] = [
    ...(!groups.details
      ? [
          {
            key: "details",
            label: terms.addDetail,
            icon: Plus,
            onSelect: () => onChange({ ...entry, achievements: [newDetail()] }),
          },
        ]
      : []),
    ...(!groups.links
      ? [
          {
            key: "links",
            label: terms.addLink,
            icon: Plus,
            onSelect: () => onChange({ ...entry, links: [newLink()] }),
          },
        ]
      : []),
  ];
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
        key={entry.id}
        fields={entry.fields}
        language={language}
        kind={kind}
        onChange={(fields) => onChange({ ...entry, fields })}
      />
      {groups.evidence && (
        <>
          <Separator />
          <CareerEvidenceEditor
            entry={entry}
            document={document}
            language={language}
            onChange={onChange}
            onCreate={onCreateEvidence}
            onOpen={onOpenEntry}
          />
        </>
      )}
      {groups.details && (
        <>
          <Separator />
          <CareerDetailsEditor
            entry={entry}
            kind={kind}
            language={language}
            disabled={disabled}
            onChange={onChange}
          />
        </>
      )}
      {groups.links && (
        <>
          <Separator />
          <CareerLinksEditor
            kind={kind}
            links={entry.links}
            language={language}
            onChange={(links) => onChange({ ...entry, links })}
          />
        </>
      )}
      {more.length > 0 && (
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Add more to this ${terms.entry}`}
                />
              }
            >
              <Plus data-icon="inline-start" />
              Add more
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="quick-actions-dropdown"
            >
              <QuickActionItems actions={more} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </FieldGroup>
  );
}
