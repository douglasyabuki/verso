"use client";

import { Copy, Plus, Trash2 } from "lucide-react";

import type { EditorProps } from "@/components/resume/editor-types";
import {
  CheckField,
  OrderButtons,
  TextField,
} from "@/components/resume/fields";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import type { Entry, Variant } from "@/lib/resume/model";
import { move, plain } from "@/lib/resume/model";

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
          <CardTitle size="section">Your resume, with focus</CardTitle>
          <CardDescription>
            Variants reference the same content. Select sections, entries, and
            achievements, then set their output order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <TextField
              fieldKey={`variants.${variant.id}.name`}
              label="Variant name"
              value={variant.name}
              maxLength={100}
              onChange={(name, group) =>
                update((draft) => {
                  draft.variants.find((item) => item.id === variant.id)!.name =
                    name;
                }, group)
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
                <CardTitle size="section">
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
