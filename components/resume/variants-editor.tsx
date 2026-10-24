"use client";

import { Columns2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { TextField } from "@/components/resume/fields";
import {
  AchievementSelectionActions,
  InclusionStatus,
  LibrarySearch,
  SectionVisibilityHint,
} from "@/components/resume/library-controls";
import { SortableList, SortableRow } from "@/components/resume/sortable-list";
import { VariantComparison } from "@/components/resume/variant-comparison";
import {
  VariantWordingDetails,
  VariantWordingField,
} from "@/components/resume/variant-wording-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import { Toggle } from "@/components/ui/toggle";
import { matchesEntry, selectAllAchievements } from "@/lib/resume/library";
import { plain } from "@/lib/resume/localization";
import { reorderVisible } from "@/lib/resume/operations";
import { entryLabel } from "@/lib/resume/section-fields";
import { effectiveWording } from "@/lib/resume/wording";
import type { EditorProps } from "@/types-and-constants/editor";
import type { Issue, IssueNavigation } from "@/types-and-constants/resume";
import type { Variant } from "@/types-and-constants/resume";
import { entryTerminology } from "@/types-and-constants/resume";

export function VariantsEditor({
  document,
  variant,
  locale,
  update,
  confirm,
  onOpen,
  issueNavigation,
  errors = [],
}: EditorProps & {
  onOpen: (issue: Issue) => void;
  issueNavigation?: IssueNavigation;
  errors?: Issue[];
}) {
  const [comparing, setComparing] = useState(false);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(
    !!issueNavigation?.issue.target?.entryId,
  );
  const matches = document.sections
    .flatMap((section) => section.entries)
    .filter(
      (entry) =>
        (showArchived || !entry.archived) && matchesEntry(entry, query),
    );
  const visibleSections = variant.sections.filter(
    (selected) =>
      !query.trim() ||
      document.sections
        .find((section) => section.id === selected.sectionId)
        ?.entries.some((entry) => matches.some((item) => item.id === entry.id)),
  );
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-1.5 text-lg">
            <CardTitle size="section">Resume details</CardTitle>
            <InfoHint label="resume content" size="lg">
              Select sections, entries, and achievements, then set their output
              order. Library ordering is independent.
            </InfoHint>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <TextField
              fieldKey={`variants.${variant.id}.name`}
              label="Resume name"
              value={variant.name}
              maxLength={100}
              onChange={(name, group) =>
                update((draft) => {
                  draft.variants.find((item) => item.id === variant.id)!.name =
                    name;
                }, group)
              }
              error={
                !variant.name.trim() ? "Give this resume a name." : undefined
              }
            />
          </FieldGroup>
        </CardContent>
      </Card>
      <Button
        variant="outline"
        className="self-start"
        onClick={() => setComparing(!comparing)}
      >
        <Columns2 data-icon="inline-start" />
        {comparing ? "Back to resume editing" : "Compare resumes"}
      </Button>
      {comparing ? (
        <VariantComparison
          document={document}
          variant={variant}
          locale={locale}
          onOpen={(issue) => {
            setComparing(false);
            onOpen(issue);
          }}
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-1.5 text-lg">
                <CardTitle size="section">Profile summary wording</CardTitle>
                <InfoHint label="summary scope" size="lg">
                  Shared by default. Customizations belong to this resume and
                  language.
                </InfoHint>
              </div>
            </CardHeader>
            <CardContent>
              <VariantWordingField
                document={document}
                variant={variant}
                path="profile.summary"
                locale={locale}
                update={update}
                confirm={confirm}
                errors={errors}
                label="Summary"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-1.5 text-lg">
                <CardTitle size="section">Find resume content</CardTitle>
                <InfoHint label="content order" size="lg">
                  Selected content appears first in output order. Archived
                  entries are omitted until restored.
                </InfoHint>
              </div>
              <CardDescription>{variant.name || "This resume"}</CardDescription>
            </CardHeader>
            <CardContent>
              <LibrarySearch
                query={query}
                onQuery={setQuery}
                showArchived={showArchived}
                onArchived={setShowArchived}
                count={matches.length}
                total={document.sections.reduce(
                  (count, section) => count + section.entries.length,
                  0,
                )}
              />
            </CardContent>
          </Card>
          {!matches.length && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No matching entries</EmptyTitle>
                <EmptyDescription>
                  Clear search, include archived entries, or add content in the
                  library.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          <SortableList
            scope={`variant:${variant.id}:sections`}
            revision={document}
            contextKey={JSON.stringify([query, showArchived, locale])}
            items={visibleSections.map((selected) => ({
              id: selected.sectionId,
              label:
                plain(
                  document.sections.find(
                    (section) => section.id === selected.sectionId,
                  )!.heading,
                  locale,
                ) || "Untitled section",
            }))}
            onReorder={(source, target) =>
              update((draft) => {
                reorderVisible(
                  draft.variants.find((item) => item.id === variant.id)!
                    .sections,
                  visibleSections.map((item) => item.sectionId),
                  source,
                  target,
                  (item) => item.sectionId,
                );
              })
            }
          >
            <div className="flex flex-col gap-5">
              {visibleSections.map((selected) => (
                <VariantSection
                  key={selected.sectionId}
                  document={document}
                  variant={variant}
                  locale={locale}
                  update={update}
                  sectionId={selected.sectionId}
                  query={query}
                  showArchived={showArchived}
                  confirm={confirm}
                  issueNavigation={issueNavigation}
                  errors={errors}
                />
              ))}
            </div>
          </SortableList>
        </>
      )}
    </div>
  );
}

function VariantSection({
  document,
  variant,
  locale,
  update,
  sectionId,
  query,
  showArchived,
  confirm,
  issueNavigation,
  errors,
}: Pick<
  EditorProps,
  "document" | "variant" | "locale" | "update" | "confirm"
> & {
  sectionId: string;
  query: string;
  showArchived: boolean;
  issueNavigation?: IssueNavigation;
  errors: Issue[];
}) {
  const section = document.sections.find((item) => item.id === sectionId)!;
  const selected = variant.sections.find(
    (item) => item.sectionId === sectionId,
  )!;
  const terms = entryTerminology[section.kind];
  const selectedIds = new Set(selected.entries.map((item) => item.entryId));
  const ordered = [
    ...selected.entries.flatMap((item) =>
      section.entries.filter((entry) => entry.id === item.entryId),
    ),
    ...section.entries.filter((entry) => !selectedIds.has(entry.id)),
  ].filter(
    (entry) => (showArchived || !entry.archived) && matchesEntry(entry, query),
  );
  const sortableEntries = ordered.filter((entry) => selectedIds.has(entry.id));
  const change = (change: (section: Variant["sections"][number]) => void) =>
    update((draft) => {
      const target = draft.variants
        .find((item) => item.id === variant.id)
        ?.sections.find((item) => item.sectionId === sectionId);
      if (target) change(target);
    });
  const heading = plain(section.heading, locale) || "Untitled section";
  return (
    <SortableRow id={sectionId} label={heading}>
      {({ dragHandle, orderButtons }) => (
        <Card
          tabIndex={-1}
          data-issue-field={`variants.${variant.id}.sections.${sectionId}`}
        >
          <CardHeader>
            <div className="flex items-center gap-2">
              {dragHandle}
              <CardTitle className="min-w-0 flex-1" size="section">
                {heading}
              </CardTitle>
              <VisibilityToggle
                label={`${heading} section`}
                visible={selected.visible}
                onChange={(visible) =>
                  change((target) => {
                    target.visible = visible;
                  })
                }
              />
              {orderButtons}
            </div>
          </CardHeader>

          <SectionVisibilityHint hidden={!selected.visible}>
            <CardContent
              data-section-hidden={!selected.visible || undefined}
              className="transition-opacity data-[section-hidden]:opacity-60"
            >
              <FieldSet>
                <FieldLegend className="sr-only">Section selection</FieldLegend>
                {!ordered.length && (
                  <p className="text-sm text-muted-foreground">
                    {section.entries.length
                      ? "No matching entries in this section."
                      : `Add ${terms.singular} entries to this section in the career library.`}
                  </p>
                )}
                <SortableList
                  scope={`variant:${variant.id}:${sectionId}:entries`}
                  revision={document}
                  contextKey={JSON.stringify([query, showArchived, locale])}
                  items={sortableEntries.map((entry) => ({
                    id: entry.id,
                    label: entryLabel(entry, section.kind, locale),
                  }))}
                  onReorder={(source, target) =>
                    change((selected) =>
                      reorderVisible(
                        selected.entries,
                        sortableEntries.map((entry) => entry.id),
                        source,
                        target,
                        (item) => item.entryId,
                      ),
                    )
                  }
                >
                  <div className="flex flex-col gap-3 pl-6">
                    {ordered.map((entry) => {
                      const selection = selected.entries.find(
                        (item) => item.entryId === entry.id,
                      );
                      const bulletIds = selection?.bulletIds ?? [];
                      const bullets = [
                        ...bulletIds.flatMap((id) =>
                          entry.bullets.filter((bullet) => bullet.id === id),
                        ),
                        ...entry.bullets.filter(
                          (bullet) => !bulletIds.includes(bullet.id),
                        ),
                      ];
                      const changeBullets = (
                        changeIds: (ids: string[]) => string[],
                      ) =>
                        change((selected) => {
                          const target = selected.entries.find(
                            (item) => item.entryId === entry.id,
                          );
                          if (target && !entry.archived)
                            target.bulletIds = changeIds(target.bulletIds);
                        });
                      const label = entryLabel(entry, section.kind, locale);
                      return (
                        <SortableRow
                          key={entry.id}
                          id={entry.id}
                          label={label}
                          className="flex flex-col gap-3 rounded-lg border p-3"
                        >
                          {({ dragHandle, orderButtons }) => (
                            <>
                              <div className="flex items-start gap-2">
                                {dragHandle}
                                <span
                                  tabIndex={-1}
                                  data-issue-field={`variants.${variant.id}.entries.${entry.id}`}
                                  className="min-w-0 flex-1 py-1 text-sm leading-snug font-medium"
                                >
                                  {label}
                                </span>
                                <InclusionToggle
                                  label={label}
                                  visible={!!selection}
                                  disabled={entry.archived && !selection}
                                  onChange={(visible) =>
                                    change((target) => {
                                      target.entries = visible
                                        ? target.entries.some(
                                            (item) => item.entryId === entry.id,
                                          )
                                          ? target.entries
                                          : [
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
                                {orderButtons}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-6">
                                <InclusionStatus
                                  selected={!!selection}
                                  archived={entry.archived}
                                  sectionVisible={selected.visible}
                                  count={bulletIds.length}
                                  total={entry.bullets.length}
                                  variantName={variant.name || "this resume"}
                                />
                                {entry.bullets.length > 1 && (
                                  <AchievementSelectionActions
                                    label={`${label} ${terms.items}`}
                                    selected={bulletIds.length}
                                    total={entry.bullets.length}
                                    disabled={!selection || entry.archived}
                                    showCount={false}
                                    onSelectAll={() =>
                                      changeBullets((ids) =>
                                        selectAllAchievements(ids, entry),
                                      )
                                    }
                                    onClearAll={() => changeBullets(() => [])}
                                  />
                                )}
                              </div>
                              <SortableList
                                scope={`variant:${variant.id}:${sectionId}:${entry.id}:bullets`}
                                revision={document}
                                contextKey={locale}
                                items={bulletIds.map((id) => ({
                                  id,
                                  label:
                                    plain(
                                      entry.bullets.find(
                                        (bullet) => bullet.id === id,
                                      )!.body,
                                      locale,
                                    ).slice(0, 100) || terms.item,
                                }))}
                                onReorder={(source, target) =>
                                  change((selected) => {
                                    const targetEntry = selected.entries.find(
                                      (item) => item.entryId === entry.id,
                                    );
                                    if (targetEntry)
                                      reorderVisible(
                                        targetEntry.bulletIds,
                                        bulletIds,
                                        source,
                                        target,
                                        (id) => id,
                                      );
                                  })
                                }
                              >
                                <div className="flex flex-col gap-3">
                                  {bullets.map((bullet, index) => {
                                    const label =
                                      plain(
                                        effectiveWording(
                                          bullet.body,
                                          variant,
                                          `bullets.${bullet.id}.body`,
                                        ),
                                        locale,
                                      ).slice(0, 100) ||
                                      `Missing ${terms.item.toLowerCase()} text`;
                                    return (
                                      <SortableRow
                                        key={bullet.id}
                                        id={bullet.id}
                                        label={`${terms.item.toLowerCase()} ${index + 1}: ${label}`}
                                        className="flex flex-col gap-3 pl-6"
                                      >
                                        {({ dragHandle, orderButtons }) => (
                                          <>
                                            <div className="flex items-start gap-2">
                                              {dragHandle}
                                              <span className="min-w-0 flex-1 py-1 text-sm leading-snug">
                                                {label}
                                              </span>
                                              <InclusionToggle
                                                label={`${terms.item.toLowerCase()} ${index + 1}: ${label}`}
                                                visible={bulletIds.includes(
                                                  bullet.id,
                                                )}
                                                disabled={
                                                  !selection || entry.archived
                                                }
                                                onChange={(visible) =>
                                                  changeBullets((ids) =>
                                                    visible
                                                      ? ids.includes(bullet.id)
                                                        ? ids
                                                        : [...ids, bullet.id]
                                                      : ids.filter(
                                                          (id) =>
                                                            id !== bullet.id,
                                                        ),
                                                  )
                                                }
                                              />
                                              {orderButtons}
                                            </div>
                                            <VariantWordingDetails
                                              document={document}
                                              variant={variant}
                                              path={`bullets.${bullet.id}.body`}
                                              locale={locale}
                                              update={update}
                                              confirm={confirm}
                                              errors={errors}
                                              label={terms.item}
                                              required
                                              multiline={
                                                section.kind !== "skills"
                                              }
                                              initiallyOpen={
                                                issueNavigation?.issue.target
                                                  ?.wordingPath ===
                                                `bullets.${bullet.id}.body`
                                              }
                                            />
                                          </>
                                        )}
                                      </SortableRow>
                                    );
                                  })}
                                </div>
                              </SortableList>
                            </>
                          )}
                        </SortableRow>
                      );
                    })}
                  </div>
                </SortableList>
              </FieldSet>
            </CardContent>
          </SectionVisibilityHint>
        </Card>
      )}
    </SortableRow>
  );
}

function VisibilityToggle({
  label,
  visible,
  onChange,
  disabled = false,
}: {
  label: string;
  visible: boolean;
  onChange: (visible: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Toggle
      size="sm"
      className="shrink-0"
      aria-label={`Show ${label}`}
      title={visible ? "Hide from resume" : "Show in resume"}
      pressed={visible}
      onPressedChange={onChange}
      disabled={disabled}
    >
      {visible ? (
        <Eye data-icon="inline-start" aria-hidden="true" />
      ) : (
        <EyeOff data-icon="inline-start" aria-hidden="true" />
      )}
      {visible ? "Visible" : "Hidden"}
    </Toggle>
  );
}

function InclusionToggle({
  label,
  visible,
  onChange,
  disabled = false,
}: {
  label: string;
  visible: boolean;
  onChange: (visible: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Checkbox
      aria-label={`Include ${label}`}
      checked={visible}
      onCheckedChange={onChange}
      disabled={disabled}
    />
  );
}
