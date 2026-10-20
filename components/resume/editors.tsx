"use client";

import {
  Archive,
  ArchiveRestore,
  Copy,
  FilePlus2,
  Plus,
  Trash2,
} from "lucide-react";
import { useId, useState } from "react";

import type { ConfirmAction } from "@/components/resume/fields";
import {
  CheckField,
  LinksEditor,
  LocalizedField,
  OrderButtons,
  TextField,
} from "@/components/resume/fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import type {
  DocumentUpdate,
  Entry,
  Issue,
  Locale,
  ResumeDocument,
  Span,
  TemplateSettings,
  Variant,
} from "@/lib/resume/model";
import {
  createEntry,
  dateError,
  editTranslation,
  findLocalized,
  localized,
  localizedFields,
  move,
  plain,
  resolveSettings,
} from "@/lib/resume/model";

type EditorProps = {
  document: ResumeDocument;
  locale: Locale;
  variant: Variant;
  update: (change: DocumentUpdate) => void;
  confirm: ConfirmAction;
};

export function WordingField({
  document,
  path,
  locale,
  update,
  label,
  required,
  errors = [],
}: {
  document: ResumeDocument;
  path: string;
  locale: Locale;
  update: (change: DocumentUpdate) => void;
  label: string;
  required?: boolean;
  errors?: Issue[];
}) {
  const value = findLocalized(document, path);
  if (!value) return null;
  return (
    <LocalizedField
      label={label}
      value={value}
      locale={locale}
      required={required}
      error={errors.find((error) => error.path === path)?.message}
      onChange={(spans: Span[]) =>
        update((draft) => {
          const field = findLocalized(draft, path);
          if (field) editTranslation(field, locale, spans);
        })
      }
      onReviewed={() =>
        update((draft) => {
          const field = findLocalized(draft, path);
          if (field) field[locale].needsReview = false;
        })
      }
    />
  );
}

export function ContentEditor({
  document,
  locale,
  variant,
  update,
  confirm,
  sectionId,
  errors,
}: EditorProps & { sectionId: string; errors: Issue[] }) {
  const [entryId, setEntryId] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  if (sectionId === "profile")
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
          <CardDescription>
            Contact details are shared. Wording is specific to each language.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <TextField
              label="Full name"
              value={document.profile.name}
              maxLength={200}
              onChange={(name) =>
                update((draft) => {
                  draft.profile.name = name;
                })
              }
              error={
                errors.find((error) => error.path === "profile.name")?.message
              }
              placeholder="Your name"
            />
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Email"
                type="email"
                value={document.profile.email}
                maxLength={300}
                onChange={(email) =>
                  update((draft) => {
                    draft.profile.email = email;
                  })
                }
                error={
                  errors.find((error) => error.path === "profile.email")
                    ?.message
                }
                placeholder="you@example.com"
              />
              <TextField
                label="Phone"
                type="tel"
                value={document.profile.phone}
                error={
                  errors.find((error) => error.path === "profile.phone")
                    ?.message
                }
                maxLength={100}
                onChange={(phone) =>
                  update((draft) => {
                    draft.profile.phone = phone;
                  })
                }
              />
              <TextField
                label="City"
                value={document.profile.city}
                maxLength={200}
                onChange={(city) =>
                  update((draft) => {
                    draft.profile.city = city;
                  })
                }
              />
              <TextField
                label="Country code"
                value={document.profile.country}
                error={
                  errors.find((error) => error.path === "profile.country")
                    ?.message
                }
                maxLength={2}
                onChange={(country) =>
                  update((draft) => {
                    draft.profile.country = country.toUpperCase();
                  })
                }
                placeholder="BR"
                description="Two letters, for example BR or US. The PDF localizes the country name."
              />
            </FieldGroup>
            <Separator />
            <WordingField
              document={document}
              path="profile.summary"
              locale={locale}
              update={update}
              label="Summary"
              errors={errors}
            />
            <Separator />
            <FieldSet>
              <FieldLegend>Social & website links</FieldLegend>
              <LinksEditor
                links={document.profile.links}
                onChange={(links) =>
                  update((draft) => {
                    draft.profile.links = links;
                  })
                }
                confirm={confirm}
              />
            </FieldSet>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            Plain text, emphasis, and links are supported. LaTeX syntax is
            treated as text.
          </p>
        </CardFooter>
      </Card>
    );

  const section = document.sections.find((section) => section.id === sectionId);
  if (!section) return null;
  const displayed = section.entries.filter(
    (entry) => showArchived || !entry.archived,
  );
  const entry = displayed.find((entry) => entry.id === entryId) || displayed[0];
  const changeEntry = (change: (entry: Entry) => void) =>
    update((draft) => {
      const target = draft.sections
        .find((item) => item.id === sectionId)
        ?.entries.find((item) => item.id === entry?.id);
      if (target) change(target);
    });
  const addEntry = () => {
    const created = createEntry();
    update((draft) => {
      draft.sections
        .find((section) => section.id === sectionId)!
        .entries.push(created);
      draft.variants
        .find((item) => item.id === variant.id)!
        .sections.find((item) => item.sectionId === sectionId)!
        .entries.push({ entryId: created.id, bulletIds: [] });
    });
    setEntryId(created.id);
  };
  const selectedSection = variant.sections.find(
    (item) => item.sectionId === sectionId,
  );
  const selection = selectedSection?.entries.find(
    (item) => item.entryId === entry?.id,
  );
  const included = !!selection;
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>
            {plain(section.heading, locale) || "Untitled section"}
          </CardTitle>
          <CardDescription>
            A shared library. Choose what belongs in each resume under Variants.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <details>
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Edit section heading
              </summary>
              <div className="mt-4">
                <WordingField
                  document={document}
                  path={`sections.${section.id}.heading`}
                  locale={locale}
                  update={update}
                  label="Heading"
                  required
                  errors={errors}
                />
              </div>
            </details>
            <CheckField
              label={`Show archived (${section.entries.filter((entry) => entry.archived).length})`}
              checked={showArchived}
              onChange={setShowArchived}
            />
            {displayed.length ? (
              <ul className="flex flex-col gap-2" aria-label="Library entries">
                {displayed.map((item, index) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 rounded-lg border p-2"
                    data-selected={entry?.id === item.id}
                  >
                    <Button
                      className="min-w-0 flex-1 justify-start truncate"
                      variant={entry?.id === item.id ? "secondary" : "ghost"}
                      onClick={() => setEntryId(item.id)}
                    >
                      {item.organization ||
                        plain(item.title, locale) ||
                        "Untitled entry"}
                    </Button>
                    {item.archived && <Badge variant="outline">Archived</Badge>}
                    <OrderButtons
                      label={item.organization || "entry"}
                      first={index === 0}
                      last={index === displayed.length - 1}
                      onMove={(offset) =>
                        update((draft) => {
                          const entries = draft.sections.find(
                            (section) => section.id === sectionId,
                          )!.entries;
                          const current = entries.findIndex(
                            (entry) => entry.id === item.id,
                          );
                          const neighbor = displayed[index + offset];
                          if (neighbor) {
                            const target = entries.findIndex(
                              (entry) => entry.id === neighbor.id,
                            );
                            [entries[current], entries[target]] = [
                              entries[target],
                              entries[current],
                            ];
                          }
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FilePlus2 />
                  </EmptyMedia>
                  <EmptyTitle>No entries here yet</EmptyTitle>
                  <EmptyDescription>
                    Add your first entry. You can write each language at your
                    own pace.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-2">
          <Button onClick={addEntry} disabled={section.entries.length >= 300}>
            <Plus data-icon="inline-start" />
            Add entry
          </Button>
          <span className="text-xs text-muted-foreground">
            Library ordering is separate from variant ordering.
          </span>
        </CardFooter>
      </Card>
      {entry && (
        <Card key={entry.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>
                {entry.organization ||
                  plain(entry.title, locale) ||
                  "New entry"}
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    changeEntry((target) => {
                      target.archived = !target.archived;
                    })
                  }
                >
                  {entry.archived ? (
                    <ArchiveRestore data-icon="inline-start" />
                  ) : (
                    <Archive data-icon="inline-start" />
                  )}
                  {entry.archived ? "Restore" : "Archive"}
                </Button>
                <Button
                  variant="destructive"
                  size="icon-sm"
                  aria-label="Delete entry permanently"
                  onClick={() => {
                    const affected = document.variants
                      .filter((variant) =>
                        variant.sections.some((section) =>
                          section.entries.some(
                            (item) => item.entryId === entry.id,
                          ),
                        ),
                      )
                      .map((variant) => variant.name || "Untitled");
                    confirm(
                      "Permanently delete this entry?",
                      `Its achievements and links will also be removed. Affected variants: ${affected.join(", ") || "none"}. Export a JSON backup first if you need a copy.`,
                      () =>
                        update((draft) => {
                          draft.sections.find(
                            (section) => section.id === sectionId,
                          )!.entries = section.entries.filter(
                            (item) => item.id !== entry.id,
                          );
                          draft.variants.forEach((variant) =>
                            variant.sections.forEach((section) => {
                              section.entries = section.entries.filter(
                                (item) => item.entryId !== entry.id,
                              );
                            }),
                          );
                        }),
                    );
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
            <CardDescription>
              {entry.archived
                ? "Archived entries stay editable and are hidden from all generated outputs."
                : "Changes update every variant referencing this entry."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <CheckField
                label={`Include in ${variant.name || "this variant"}`}
                checked={included}
                disabled={entry.archived}
                onChange={(checked) =>
                  update((draft) => {
                    const selection = draft.variants
                      .find((item) => item.id === variant.id)!
                      .sections.find((item) => item.sectionId === sectionId)!;
                    selection.entries = checked
                      ? [
                          ...selection.entries,
                          {
                            entryId: entry.id,
                            bulletIds: entry.bullets.map((bullet) => bullet.id),
                          },
                        ]
                      : selection.entries.filter(
                          (item) => item.entryId !== entry.id,
                        );
                  })
                }
              />
              <TextField
                label="Organization / institution"
                value={entry.organization}
                onChange={(organization) =>
                  changeEntry((target) => {
                    target.organization = organization;
                  })
                }
                description="Shared across languages. Optional for standalone projects and custom entries."
              />
              <WordingField
                document={document}
                path={`entries.${entry.id}.title`}
                locale={locale}
                update={update}
                label="Title / role"
                required
                errors={errors}
              />
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="City"
                  value={entry.city}
                  maxLength={200}
                  onChange={(city) =>
                    changeEntry((target) => {
                      target.city = city;
                    })
                  }
                />
                <TextField
                  label="Country code"
                  value={entry.country}
                  error={
                    errors.find(
                      (error) => error.path === `entries.${entry.id}.country`,
                    )?.message
                  }
                  maxLength={2}
                  onChange={(country) =>
                    changeEntry((target) => {
                      target.country = country.toUpperCase();
                    })
                  }
                  placeholder="BR"
                />
                <TextField
                  label="Start date"
                  value={entry.start}
                  maxLength={7}
                  placeholder="YYYY-MM"
                  onChange={(start) =>
                    changeEntry((target) => {
                      target.start = start;
                    })
                  }
                  error={dateError(entry)}
                />
                {!entry.ongoing && (
                  <TextField
                    label="End date"
                    value={entry.end}
                    maxLength={7}
                    placeholder="YYYY-MM"
                    onChange={(end) =>
                      changeEntry((target) => {
                        target.end = end;
                      })
                    }
                    error={dateError(entry)}
                  />
                )}
              </FieldGroup>
              <CheckField
                label="Ongoing"
                checked={entry.ongoing}
                onChange={(ongoing) =>
                  changeEntry((target) => {
                    target.ongoing = ongoing;
                    if (ongoing) target.end = "";
                  })
                }
              />
              <TextField
                label="Technologies"
                value={entry.technologies.join(", ")}
                maxLength={2_000}
                onChange={(value) =>
                  changeEntry((target) => {
                    target.technologies = value
                      .split(",")
                      .map((value) => value.trim())
                      .slice(0, 100);
                  })
                }
                description="Separate technologies with commas. Shared across languages."
              />
              <Separator />
              <FieldSet>
                <FieldLegend>Achievements & details</FieldLegend>
                <FieldDescription>
                  Selected achievements need text in the output language.
                  Uncheck an unfinished achievement to inspect the rest.
                </FieldDescription>
                {entry.bullets.map((bullet, index) => (
                  <div
                    key={bullet.id}
                    className="flex flex-col gap-3 rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        ACHIEVEMENT {index + 1}
                      </span>
                      <div className="flex gap-1">
                        <OrderButtons
                          label={`achievement ${index + 1}`}
                          first={index === 0}
                          last={index === entry.bullets.length - 1}
                          onMove={(offset) =>
                            changeEntry((target) =>
                              move(target.bullets, index, offset),
                            )
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete achievement ${index + 1}`}
                          onClick={() =>
                            confirm(
                              "Delete this achievement?",
                              "This removes it from every variant that references it.",
                              () =>
                                update((draft) => {
                                  const target = draft.sections
                                    .find(
                                      (section) => section.id === sectionId,
                                    )!
                                    .entries.find(
                                      (item) => item.id === entry.id,
                                    )!;
                                  target.bullets = target.bullets.filter(
                                    (item) => item.id !== bullet.id,
                                  );
                                  draft.variants.forEach((variant) =>
                                    variant.sections.forEach((section) =>
                                      section.entries.forEach((item) => {
                                        item.bulletIds = item.bulletIds.filter(
                                          (id) => id !== bullet.id,
                                        );
                                      }),
                                    ),
                                  );
                                }),
                            )
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                    <CheckField
                      label={`Use in ${variant.name || "this variant"}`}
                      checked={!!selection?.bulletIds.includes(bullet.id)}
                      disabled={!included || entry.archived}
                      onChange={(checked) =>
                        update((draft) => {
                          const selected = draft.variants
                            .find((item) => item.id === variant.id)!
                            .sections.find(
                              (item) => item.sectionId === sectionId,
                            )!
                            .entries.find((item) => item.entryId === entry.id)!;
                          selected.bulletIds = checked
                            ? [...selected.bulletIds, bullet.id]
                            : selected.bulletIds.filter(
                                (id) => id !== bullet.id,
                              );
                        })
                      }
                    />
                    <WordingField
                      document={document}
                      path={`bullets.${bullet.id}.body`}
                      locale={locale}
                      update={update}
                      label="Achievement"
                      required
                      errors={errors}
                    />
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={entry.bullets.length >= 100}
                  onClick={() => {
                    const bullet = {
                      id: crypto.randomUUID(),
                      body: localized(),
                    };
                    update((draft) => {
                      draft.sections
                        .find((section) => section.id === sectionId)!
                        .entries.find((item) => item.id === entry.id)!
                        .bullets.push(bullet);
                      const selected = draft.variants
                        .find((item) => item.id === variant.id)!
                        .sections.find((item) => item.sectionId === sectionId)!
                        .entries.find((item) => item.entryId === entry.id);
                      selected?.bulletIds.push(bullet.id);
                    });
                  }}
                >
                  <Plus data-icon="inline-start" />
                  Add achievement
                </Button>
              </FieldSet>
              <Separator />
              <FieldSet>
                <FieldLegend>Entry links</FieldLegend>
                <LinksEditor
                  links={entry.links}
                  onChange={(links) =>
                    changeEntry((target) => {
                      target.links = links;
                    })
                  }
                  confirm={confirm}
                />
              </FieldSet>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              Dates and links are shared facts. Translations keep the same entry
              and achievement IDs.
            </p>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

export function TranslationsEditor({
  document,
  update,
}: Pick<EditorProps, "document" | "update">) {
  const [filter, setFilter] = useState("all");
  const fields = localizedFields(document).filter(
    (field) =>
      filter === "all" ||
      (filter === "review"
        ? Object.values(field.value).some((value) => value.needsReview)
        : !plain(field.value, "en-US").trim() ||
          !plain(field.value, "pt-BR").trim()),
  );
  return (
    <div className="flex flex-col gap-5">
      <Field>
        <FieldLabel htmlFor="translation-filter">Show translations</FieldLabel>
        <NativeSelect
          id="translation-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <NativeSelectOption value="all">All wording</NativeSelectOption>
          <NativeSelectOption value="review">Needs review</NativeSelectOption>
          <NativeSelectOption value="missing">
            Missing wording
          </NativeSelectOption>
        </NativeSelect>
        <FieldDescription>
          Missing optional wording can stay empty. Review flags warn without
          blocking valid downloads.
        </FieldDescription>
      </Field>
      {!fields.length && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>All clear</EmptyTitle>
            <EmptyDescription>No wording matches this filter.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {fields.map((field) => (
        <Card key={field.path}>
          <CardHeader>
            <CardTitle>{field.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 @2xl:grid-cols-2">
              {(["en-US", "pt-BR"] as Locale[]).map((locale) => (
                <WordingField
                  key={locale}
                  document={document}
                  path={field.path}
                  locale={locale}
                  update={update}
                  label={locale === "en-US" ? "English" : "Português"}
                />
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              Editing one language flags its existing counterpart for review.
            </p>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export function VariantsEditor({
  document,
  variant,
  locale,
  update,
  confirm,
  onVariant,
}: EditorProps & { onVariant: (id: string) => void }) {
  const create = (duplicate: boolean) => {
    const id = crypto.randomUUID();
    const created: Variant = duplicate
      ? {
          ...structuredClone(variant),
          id,
          name: `${variant.name || "Untitled"} copy`.slice(0, 100),
        }
      : {
          id,
          name: "New variant",
          sections: document.sections.map((section) => ({
            sectionId: section.id,
            visible: true,
            entries: [],
          })),
          settings: {},
          localeSettings: {},
        };
    update((draft) => {
      draft.variants.push(created);
    });
    onVariant(id);
  };
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Your resume, with focus</CardTitle>
          <CardDescription>
            Variants reference the same content. Select sections, entries, and
            achievements, then set their output order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <TextField
              label="Variant name"
              value={variant.name}
              maxLength={100}
              onChange={(name) =>
                update((draft) => {
                  draft.variants.find((item) => item.id === variant.id)!.name =
                    name;
                })
              }
              error={
                !variant.name.trim() ? "Give this variant a name." : undefined
              }
            />
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={document.variants.length >= 30}
            onClick={() => create(false)}
          >
            <Plus data-icon="inline-start" />
            New variant
          </Button>
          <Button
            variant="outline"
            disabled={document.variants.length >= 30}
            onClick={() => create(true)}
          >
            <Copy data-icon="inline-start" />
            Duplicate
          </Button>
          <Button
            variant="destructive"
            disabled={document.variants.length === 1}
            onClick={() =>
              confirm(
                "Delete this variant?",
                "Your shared career content will remain available. Its selections and layout overrides will be removed.",
                () =>
                  update((draft) => {
                    draft.variants = draft.variants.filter(
                      (item) => item.id !== variant.id,
                    );
                  }),
              )
            }
          >
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        </CardFooter>
      </Card>
      {variant.sections.map((selected, sectionIndex) => {
        const section = document.sections.find(
          (section) => section.id === selected.sectionId,
        );
        if (!section) return null;
        const ordered = [
          ...selected.entries
            .map((item) =>
              section.entries.find((entry) => entry.id === item.entryId),
            )
            .filter((entry): entry is Entry => !!entry),
          ...section.entries.filter(
            (entry) =>
              !selected.entries.some((item) => item.entryId === entry.id),
          ),
        ];
        return (
          <Card key={section.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>
                  {plain(section.heading, locale) || "Untitled section"}
                </CardTitle>
                <OrderButtons
                  label="section"
                  first={sectionIndex === 0}
                  last={sectionIndex === variant.sections.length - 1}
                  onMove={(offset) =>
                    update((draft) =>
                      move(
                        draft.variants.find((item) => item.id === variant.id)!
                          .sections,
                        sectionIndex,
                        offset,
                      ),
                    )
                  }
                />
              </div>
            </CardHeader>
            <CardContent>
              <FieldSet>
                <FieldLegend className="sr-only">Section selection</FieldLegend>
                <CheckField
                  label="Show section"
                  checked={selected.visible}
                  onChange={(visible) =>
                    update((draft) => {
                      draft.variants
                        .find((item) => item.id === variant.id)!
                        .sections.find(
                          (item) => item.sectionId === section.id,
                        )!.visible = visible;
                    })
                  }
                />
                {!ordered.length && (
                  <p className="text-sm text-muted-foreground">
                    Add entries to this section in Content.
                  </p>
                )}
                {ordered.map((entry) => {
                  const entryIndex = selected.entries.findIndex(
                    (item) => item.entryId === entry.id,
                  );
                  const selection = selected.entries[entryIndex];
                  return (
                    <div
                      key={entry.id}
                      className="flex flex-col gap-3 rounded-lg border p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <CheckField
                          label={`${entry.organization || plain(entry.title, locale) || "Untitled entry"}${entry.archived ? " (archived)" : ""}`}
                          checked={!!selection}
                          disabled={entry.archived && !selection}
                          onChange={(checked) =>
                            update((draft) => {
                              const target = draft.variants
                                .find((item) => item.id === variant.id)!
                                .sections.find(
                                  (item) => item.sectionId === section.id,
                                )!;
                              target.entries = checked
                                ? [
                                    ...target.entries,
                                    {
                                      entryId: entry.id,
                                      bulletIds: entry.bullets.map(
                                        (bullet) => bullet.id,
                                      ),
                                    },
                                  ]
                                : target.entries.filter(
                                    (item) => item.entryId !== entry.id,
                                  );
                            })
                          }
                        />
                        {selection && (
                          <OrderButtons
                            label="selected entry"
                            first={entryIndex === 0}
                            last={entryIndex === selected.entries.length - 1}
                            onMove={(offset) =>
                              update((draft) =>
                                move(
                                  draft.variants
                                    .find((item) => item.id === variant.id)!
                                    .sections.find(
                                      (item) => item.sectionId === section.id,
                                    )!.entries,
                                  entryIndex,
                                  offset,
                                ),
                              )
                            }
                          />
                        )}
                      </div>
                      {selection &&
                        entry.bullets.map((bullet) => {
                          const bulletIndex = selection.bulletIds.indexOf(
                            bullet.id,
                          );
                          return (
                            <div
                              key={bullet.id}
                              className="flex items-center justify-between gap-2 pl-3"
                            >
                              <CheckField
                                label={
                                  plain(bullet.body, locale).slice(0, 100) ||
                                  "Missing achievement text"
                                }
                                checked={bulletIndex >= 0}
                                onChange={(checked) =>
                                  update((draft) => {
                                    const target = draft.variants
                                      .find((item) => item.id === variant.id)!
                                      .sections.find(
                                        (item) => item.sectionId === section.id,
                                      )!
                                      .entries.find(
                                        (item) => item.entryId === entry.id,
                                      )!;
                                    target.bulletIds = checked
                                      ? [...target.bulletIds, bullet.id]
                                      : target.bulletIds.filter(
                                          (id) => id !== bullet.id,
                                        );
                                  })
                                }
                              />
                              {bulletIndex >= 0 && (
                                <OrderButtons
                                  label="selected achievement"
                                  first={bulletIndex === 0}
                                  last={
                                    bulletIndex ===
                                    selection.bulletIds.length - 1
                                  }
                                  onMove={(offset) =>
                                    update((draft) =>
                                      move(
                                        draft.variants
                                          .find(
                                            (item) => item.id === variant.id,
                                          )!
                                          .sections.find(
                                            (item) =>
                                              item.sectionId === section.id,
                                          )!
                                          .entries.find(
                                            (item) => item.entryId === entry.id,
                                          )!.bulletIds,
                                        bulletIndex,
                                        offset,
                                      ),
                                    )
                                  }
                                />
                              )}
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </FieldSet>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">
                Archived entries are omitted from output until restored.
              </p>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

export function SettingsEditor({
  document,
  variant,
  locale,
  update,
}: Pick<EditorProps, "document" | "variant" | "locale" | "update">) {
  const [scope, setScope] = useState("base");
  const selectId = useId();
  const values = resolveSettings(document, variant, locale);
  const target =
    scope === "base"
      ? document.settings
      : scope === "locale"
        ? document.localeSettings[locale] || {}
        : scope === "variant"
          ? variant.settings
          : variant.localeSettings[locale] || {};
  const change = (
    key: keyof TemplateSettings,
    value: number | string | undefined,
  ) =>
    update((draft) => {
      const selectedVariant = draft.variants.find(
        (item) => item.id === variant.id,
      )!;
      const target =
        scope === "base"
          ? draft.settings
          : scope === "locale"
            ? (draft.localeSettings[locale] ||= {})
            : scope === "variant"
              ? selectedVariant.settings
              : (selectedVariant.localeSettings[locale] ||= {});
      if (value === undefined)
        delete (target as Partial<TemplateSettings>)[key];
      else Object.assign(target, { [key]: value });
    });
  const controls: {
    key: keyof TemplateSettings;
    label: string;
    values: (string | number)[];
    unit?: string;
  }[] = [
    { key: "pageSize", label: "Page size", values: ["a4", "letter"] },
    {
      key: "fontSize",
      label: "Body size",
      values: [9, 10, 10.5, 11, 11.5, 12],
      unit: "pt",
    },
    {
      key: "lineHeight",
      label: "Line height",
      values: [1, 1.1, 1.2, 1.3, 1.4],
    },
    {
      key: "sectionGap",
      label: "Section spacing",
      values: [0, 2, 4, 6, 8],
      unit: "mm",
    },
    {
      key: "marginTop",
      label: "Top margin",
      values: [10, 15, 18, 20, 25, 30, 35],
      unit: "mm",
    },
    {
      key: "marginBottom",
      label: "Bottom margin",
      values: [10, 15, 18, 20, 25, 25.4, 30, 35],
      unit: "mm",
    },
    {
      key: "marginSide",
      label: "Side margins",
      values: [10, 15, 18, 20, 25, 30, 35],
      unit: "mm",
    },
    {
      key: "targetPages",
      label: "Page-count target",
      values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    },
  ];
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>The reference template</CardTitle>
          <CardDescription>
            Inter typography, sepia headings, and a single-column layout adapted
            from your Overleaf resume.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Badge variant="outline">
              {document.template.id}@{document.template.version}
            </Badge>
            <Field>
              <FieldLabel htmlFor={selectId}>Apply settings to</FieldLabel>
              <NativeSelect
                id={selectId}
                value={scope}
                onChange={(event) => setScope(event.target.value)}
              >
                <NativeSelectOption value="base">
                  Workspace defaults
                </NativeSelectOption>
                <NativeSelectOption value="locale">
                  {locale} defaults
                </NativeSelectOption>
                <NativeSelectOption value="variant">
                  {variant.name || "Current variant"}
                </NativeSelectOption>
                <NativeSelectOption value="variant-locale">
                  {variant.name || "Current variant"} · {locale}
                </NativeSelectOption>
              </NativeSelect>
              <FieldDescription>
                Precedence: workspace → language → variant → variant language.
              </FieldDescription>
            </Field>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              {controls.map((control) => {
                const id = selectId + control.key;
                const current = target[control.key];
                const choices = Array.from(
                  new Set([
                    ...control.values,
                    ...(current !== undefined ? [current] : []),
                  ]),
                );
                return (
                  <Field key={control.key}>
                    <FieldLabel htmlFor={id}>{control.label}</FieldLabel>
                    <NativeSelect
                      id={id}
                      value={current ?? "inherit"}
                      onChange={(event) =>
                        change(
                          control.key,
                          event.target.value === "inherit"
                            ? undefined
                            : control.key === "pageSize"
                              ? event.target.value
                              : Number(event.target.value),
                        )
                      }
                    >
                      {scope !== "base" && (
                        <NativeSelectOption value="inherit">
                          Inherit
                        </NativeSelectOption>
                      )}
                      {choices.map((value) => (
                        <NativeSelectOption key={value} value={value}>
                          {value === "a4"
                            ? "A4"
                            : value === "letter"
                              ? "US Letter"
                              : `${value}${control.unit ? " " + control.unit : ""}`}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                );
              })}
            </FieldGroup>
            <p className="text-xs text-muted-foreground">
              Current output: {values.pageSize.toUpperCase()}, {values.fontSize}{" "}
              pt, target {values.targetPages} pages. Content is never removed to
              meet the target.
            </p>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            All template settings and overrides are included in JSON backups.
          </p>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Browser compiler</CardTitle>
          <CardDescription>
            Initialization and compilation have independent timeouts. Changing
            these settings restarts the engine.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {(["initializationTimeoutMs", "compilationTimeoutMs"] as const).map(
              (key) => (
                <Field key={key}>
                  <FieldLabel htmlFor={selectId + key}>
                    {key === "initializationTimeoutMs"
                      ? "Initialization timeout"
                      : "Compilation timeout"}
                  </FieldLabel>
                  <NativeSelect
                    id={selectId + key}
                    value={document.compiler[key]}
                    onChange={(event) =>
                      update((draft) => {
                        draft.compiler[key] = Number(event.target.value);
                      })
                    }
                  >
                    {Array.from(
                      new Set([
                        5_000,
                        10_000,
                        30_000,
                        60_000,
                        120_000,
                        300_000,
                        600_000,
                        document.compiler[key],
                      ]),
                    ).map((value) => (
                      <NativeSelectOption key={value} value={value}>
                        {value / 1000} seconds
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              ),
            )}
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            Locally verified in desktop Chrome, Edge, and Firefox. Safari is
            unverified.
          </p>
        </CardFooter>
      </Card>
      <Alert>
        <AlertTitle>Session-only workspace</AlertTitle>
        <AlertDescription>
          There is no cloud or browser storage. Export JSON to preserve your
          editable content and settings. PDF and LaTeX downloads do not save the
          workspace.
        </AlertDescription>
      </Alert>
    </div>
  );
}
