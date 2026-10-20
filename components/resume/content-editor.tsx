"use client";

import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  FilePlus2,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import type { EditorProps } from "@/components/resume/editor-types";
import {
  CheckField,
  LinksEditor,
  OrderButtons,
  TextField,
} from "@/components/resume/fields";
import { WordingField } from "@/components/resume/wording-field";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import type { Entry, Issue } from "@/lib/resume/model";
import {
  createEntry,
  dateError,
  localized,
  move,
  plain,
} from "@/lib/resume/model";

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
          <CardTitle size="section">Your profile</CardTitle>
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
          <CardTitle size="section">
            {plain(section.heading, locale) || "Untitled section"}
          </CardTitle>
          <CardDescription>
            A shared library. Choose what belongs in each resume under Variants.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Collapsible>
              <CollapsibleTrigger
                render={<Button variant="ghost" size="sm" />}
                className="group"
              >
                <ChevronRight
                  data-icon="inline-start"
                  className="transition-transform group-data-panel-open:rotate-90"
                />
                Edit section heading
              </CollapsibleTrigger>
              <CollapsibleContent keepMounted>
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
              </CollapsibleContent>
            </Collapsible>
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
