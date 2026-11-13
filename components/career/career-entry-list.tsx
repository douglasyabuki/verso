"use client";

import {
  Archive,
  ArchiveRestore,
  Copy,
  MoreHorizontal,
  Pencil,
  Plus,
} from "lucide-react";
import { useState } from "react";

import { CareerTextField } from "@/components/career/career-fields";
import { SortableItemLayout } from "@/components/editor/sortable-item-layout";
import { SortableList, SortableRow } from "@/components/editor/sortable-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import { wordingText } from "@/lib/career/wording";
import { reorderVisible } from "@/lib/ordering";
import type { CareerEntry, CareerSection } from "@/types-and-constants/career";

/** Identify a career entry in the current wording language.
 * @param entry Shared career entry.
 * @param language Current content language.
 * @returns Editor name or the first populated display field.
 * @example careerEntryLabel(entry, "en-US")
 */
export function careerEntryLabel(entry: CareerEntry, language: string): string {
  return (
    entry.name ||
    entry.fields.find((field) => field.wording[language])?.wording[language] ||
    "Untitled entry"
  );
}

export function CareerEntryList({
  section,
  language,
  selectedId,
  onOpen,
  onCreate,
  onDuplicate,
  onArchive,
  ids,
  revision,
  dirty,
  saving,
  showFooter,
  recoveryStatus,
  onBeforeReorder,
  onReorder,
  onSave,
  onCancel,
}: {
  section: CareerSection;
  language: string;
  selectedId?: string;
  onOpen: (entry: CareerEntry) => void;
  onCreate: () => void;
  onDuplicate: (entry: CareerEntry) => void;
  onArchive: (entry: CareerEntry) => void;
  ids: string[];
  revision: object;
  dirty: boolean;
  saving: boolean;
  showFooter: boolean;
  recoveryStatus: string;
  onBeforeReorder: () => boolean;
  onReorder: (ids: string[]) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);
  // Card selection is presentation state and survives switching to the order draft.
  const [retainedSelectedId, setRetainedSelectedId] = useState(selectedId);
  if (selectedId && selectedId !== retainedSelectedId) {
    setRetainedSelectedId(selectedId);
  }
  const currentId = selectedId ?? retainedSelectedId;
  const visible = ids
    .flatMap((id) => {
      const entry = section.entries.find((candidate) => candidate.id === id);
      return entry ? [entry] : [];
    })
    .filter(
      (entry) =>
        (archived || !entry.archived) &&
        (!query ||
          [
            entry.name,
            ...entry.fields.flatMap((field) => [
              field.fact,
              ...Object.values(field.wording),
            ]),
            ...entry.achievements.flatMap((item) =>
              Object.values(item.wording).map(wordingText),
            ),
            ...entry.links.flatMap((link) => [
              link.url,
              ...Object.values(link.label),
            ]),
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase())),
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle size="section" className="flex items-center gap-1.5">
          Entries{" "}
          <InfoHint label="career entries" size="lg">
            Career details are shared by resumes. Library order is independent
            of resume order. Saves apply only to the form being edited.
          </InfoHint>
        </CardTitle>
        <CardDescription>
          {section.entries.filter((entry) => !entry.archived).length} active ·{" "}
          {section.entries.filter((entry) => entry.archived).length} archived
          entries
        </CardDescription>
        <CardAction>
          <Button
            onClick={onCreate}
            disabled={saving || section.entries.length >= 300}
          >
            <Plus data-icon="inline-start" />
            Create entry
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <CareerTextField
            label="Search entries"
            value={query}
            onChange={setQuery}
            type="search"
            placeholder="Name, organization, title, or achievement"
            hint="Searches saved entry content across all content languages."
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Field orientation="horizontal">
              <Checkbox
                id={`archived-${section.id}`}
                checked={archived}
                onCheckedChange={setArchived}
              />
              <FieldLabel htmlFor={`archived-${section.id}`}>
                Include archived entries
              </FieldLabel>
            </Field>
            <span className="text-xs text-muted-foreground">
              {visible.length} of {section.entries.length} entries
            </span>
          </div>
          <fieldset disabled={saving} className="min-w-0">
            <SortableList
              scope={`entries/${section.id}`}
              revision={revision}
              contextKey={JSON.stringify([query, archived])}
              items={visible.map((entry) => ({
                id: entry.id,
                label: careerEntryLabel(entry, language),
              }))}
              selectedId={currentId}
              onBeforeReorder={onBeforeReorder}
              onReorder={(source, target) => {
                const next = [...ids];
                reorderVisible(
                  next,
                  visible.map((entry) => entry.id),
                  source,
                  target,
                  (id) => id,
                );
                onReorder(next);
              }}
            >
              <div
                role="region"
                aria-label="Career entries"
                className="flex min-w-0 flex-col gap-3 p-1"
              >
                {visible.map((entry) => (
                  <SortableRow
                    key={entry.id}
                    id={entry.id}
                    label={careerEntryLabel(entry, language)}
                    surface="standard"
                    current={entry.id === currentId}
                    className="rounded-xl border p-3 text-card-foreground shadow-sm"
                  >
                    {({ dragHandle, orderButtons }) => (
                      <SortableItemLayout dragHandle={dragHandle}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-1 rounded-lg px-2.5 py-1 text-left text-sm whitespace-normal outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            aria-current={
                              entry.id === currentId ? "true" : undefined
                            }
                            onClick={() => onOpen(entry)}
                          >
                            <span className="font-medium">
                              {careerEntryLabel(entry, language)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {entry.fields
                                .filter((field) =>
                                  [
                                    "organization",
                                    "institution",
                                    "location",
                                  ].includes(field.key),
                                )
                                .map((field) => field.wording[language])
                                .filter(Boolean)
                                .join(" \u00b7 ")}
                            </span>
                            {entry.archived && (
                              <Badge variant="secondary">Archived</Badge>
                            )}
                          </button>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Edit ${careerEntryLabel(entry, language)}`}
                              onClick={() => onOpen(entry)}
                            >
                              <Pencil aria-hidden="true" />
                            </Button>
                            {orderButtons}
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    aria-label={`Actions for ${careerEntryLabel(entry, language)}`}
                                  />
                                }
                              >
                                <MoreHorizontal aria-hidden="true" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuGroup>
                                  <DropdownMenuItem
                                    onClick={() => onDuplicate(entry)}
                                  >
                                    <Copy aria-hidden="true" />
                                    Duplicate entry
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => onArchive(entry)}
                                  >
                                    {entry.archived ? (
                                      <ArchiveRestore aria-hidden="true" />
                                    ) : (
                                      <Archive aria-hidden="true" />
                                    )}
                                    {entry.archived
                                      ? "Restore entry"
                                      : "Archive entry"}
                                  </DropdownMenuItem>
                                </DropdownMenuGroup>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </SortableItemLayout>
                    )}
                  </SortableRow>
                ))}
                {!visible.length && (
                  <p className="py-3 text-sm text-muted-foreground">
                    {query
                      ? "No matching entries."
                      : "No entries yet. Add an entry to start building your career details."}
                  </p>
                )}
              </div>
            </SortableList>
          </fieldset>
        </FieldGroup>
      </CardContent>
      {showFooter && (
        <CardFooter className="flex-wrap justify-end gap-2">
          <span role="status" className="me-auto text-xs text-muted-foreground">
            {dirty ? recoveryStatus : "Order changes are saved only with Save."}
          </span>
          <Button
            variant="outline"
            disabled={!dirty || saving}
            onClick={onCancel}
          >
            Cancel order
          </Button>
          <Button disabled={!dirty || saving} onClick={onSave}>
            Save order
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

export function CareerOrderEditor({
  ids,
  records,
  onChange,
  scope,
}: {
  ids: string[];
  records: { id: string; name: string; archived?: boolean }[];
  onChange: (ids: string[]) => void;
  scope: string;
}) {
  const [query, setQuery] = useState("");
  const visible = ids.flatMap((id) => {
    const record = records.find((item) => item.id === id);
    return record &&
      record.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())
      ? [record]
      : [];
  });
  return (
    <FieldGroup>
      <p className="text-xs text-muted-foreground">
        Order stays in this draft until Save. Cancel restores the entire order.
        Hidden items retain their positions.
      </p>
      <CareerTextField
        label="Filter order"
        value={query}
        onChange={setQuery}
        type="search"
      />
      <SortableList
        scope={scope}
        revision={ids}
        items={visible.map((record) => ({
          id: record.id,
          label: record.name || "Untitled",
        }))}
        onReorder={(source, target) => {
          const next = [...ids];
          reorderVisible(
            next,
            visible.map((record) => record.id),
            source,
            target,
            (id) => id,
          );
          onChange(next);
        }}
      >
        <div className="flex flex-col gap-2">
          {visible.map((record) => (
            <SortableRow
              key={record.id}
              id={record.id}
              label={record.name || "Untitled"}
              surface="standard"
              className="rounded-xl border py-2"
            >
              {({ dragHandle, orderButtons }) => (
                <SortableItemLayout dragHandle={dragHandle}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {record.name || "Untitled"}{" "}
                      {record.archived && (
                        <Badge variant="secondary">Archived</Badge>
                      )}
                    </span>
                    {orderButtons}
                  </div>
                </SortableItemLayout>
              )}
            </SortableRow>
          ))}
        </div>
      </SortableList>
    </FieldGroup>
  );
}
