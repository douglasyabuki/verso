"use client";

import { cn } from "cn";
import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  Copy,
  FilePlus2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { EntryFields } from "@/components/resume/entry-fields";
import { TextField } from "@/components/resume/fields";
import { LibrarySearch } from "@/components/resume/library-controls";
import { LinksEditor } from "@/components/resume/links-editor";
import { ContentStatusBadge } from "@/components/resume/semantic-badges/content-status-badge";
import { SortableList, SortableRow } from "@/components/resume/sortable-list";
import { WordingField } from "@/components/resume/wording-field";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { InfoHint } from "@/components/ui/info-hint";
import { Separator } from "@/components/ui/separator";
import { createEntry } from "@/lib/resume/factories";
import { duplicateEntry, matchesEntry } from "@/lib/resume/library";
import { localized, plain } from "@/lib/resume/localization";
import { reorderVisible } from "@/lib/resume/operations";
import { entryLabel } from "@/lib/resume/section-fields";
import type { EditorProps } from "@/types-and-constants/editor";
import type { LibraryEditorContext } from "@/types-and-constants/navigation";
import type { Entry } from "@/types-and-constants/resume";
import type { Issue } from "@/types-and-constants/review";
import { entryTerminology } from "@/types-and-constants/sections";
import type { EditGroup } from "@/types-and-constants/workspace";

export function ContentEditor({
  document,
  locale,
  update,
  confirm,
  sectionId,
  errors,
  issueTarget,
  context,
  onContext,
}: Pick<EditorProps, "document" | "locale" | "update" | "confirm"> & {
  sectionId: string;
  errors: Issue[];
  issueTarget?: Issue["target"];
  context: LibraryEditorContext;
  onContext: (context: LibraryEditorContext) => void;
}) {
  const entryForm = useRef<HTMLDivElement>(null);
  const [editRequest, setEditRequest] = useState(0);

  useEffect(() => {
    if (!editRequest) return;
    const form = entryForm.current;
    const scroller = form?.closest<HTMLElement>("[data-workspace-scroll]");
    if (!form || !scroller) return;

    // Keep the workspace shell and its Issues footer out of this scroll.
    scroller.scrollTo({
      top:
        scroller.scrollTop +
        form.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top -
        scroller.clientTop -
        16,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [editRequest]);

  const { entryId, showArchived, query } = context;
  const setEntryId = (entryId: string) => onContext({ ...context, entryId });
  const setQuery = (query: string) => onContext({ ...context, query });
  const setShowArchived = (showArchived: boolean) =>
    onContext({ ...context, showArchived });
  if (sectionId === "profile")
    return (
      <Card>
        <CardHeader>
          <CardTitle size="section">Your profile</CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            <span>Shared contact details</span>
            <InfoHint label="profile languages">
              Contact details apply to both languages. Summary text is specific
              to each language.
            </InfoHint>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <TextField
              fieldKey="profile.name"
              label="Full name"
              value={document.profile.name}
              maxLength={200}
              onChange={(name, group) =>
                update((draft) => {
                  draft.profile.name = name;
                }, group)
              }
              error={
                errors.find((error) => error.path === "profile.name")?.message
              }
              placeholder="Your name"
            />
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <TextField
                fieldKey="profile.email"
                label="Email"
                type="email"
                value={document.profile.email}
                maxLength={300}
                onChange={(email, group) =>
                  update((draft) => {
                    draft.profile.email = email;
                  }, group)
                }
                error={
                  errors.find((error) => error.path === "profile.email")
                    ?.message
                }
                placeholder="you@example.com"
              />
              <TextField
                fieldKey="profile.phone"
                label="Phone"
                type="tel"
                value={document.profile.phone}
                error={
                  errors.find((error) => error.path === "profile.phone")
                    ?.message
                }
                maxLength={100}
                onChange={(phone, group) =>
                  update((draft) => {
                    draft.profile.phone = phone;
                  }, group)
                }
              />
              <TextField
                fieldKey="profile.city"
                label="City"
                value={document.profile.city}
                maxLength={200}
                onChange={(city, group) =>
                  update((draft) => {
                    draft.profile.city = city;
                  }, group)
                }
              />
              <TextField
                fieldKey="profile.country"
                label="Country code"
                value={document.profile.country}
                error={
                  errors.find((error) => error.path === "profile.country")
                    ?.message
                }
                maxLength={2}
                onChange={(country, group) =>
                  update((draft) => {
                    draft.profile.country = country.toUpperCase();
                  }, group)
                }
                placeholder="BR"
                description="Two letters, for example BR or US. The PDF shows the country name in the selected language."
              />
            </FieldGroup>
            <Separator />
            <WordingField
              document={document}
              path="profile.summary"
              locale={locale}
              update={update}
              label="Summary"
              multiline
              errors={errors}
            />
            <Separator />
            <FieldSet>
              <FieldLegend>Social & website links</FieldLegend>
              <LinksEditor
                document={document}
                scope="library:profile:links"
                links={document.profile.links}
                onChange={(links, group) =>
                  update((draft) => {
                    draft.profile.links = links;
                  }, group)
                }
                confirm={confirm}
              />
            </FieldSet>
          </FieldGroup>
        </CardContent>
      </Card>
    );

  const section = document.sections.find((section) => section.id === sectionId);
  if (!section) return null;
  const terms = entryTerminology[section.kind];
  const displayed = section.entries.filter(
    (entry) => (showArchived || !entry.archived) && matchesEntry(entry, query),
  );
  const entry =
    section.entries.find(
      (entry) => entry.id === entryId && (showArchived || !entry.archived),
    ) || displayed[0];
  const changeEntry = (change: (entry: Entry) => void, group?: EditGroup) =>
    update((draft) => {
      const target = draft.sections
        .find((item) => item.id === sectionId)
        ?.entries.find((item) => item.id === entry?.id);
      if (target) change(target);
    }, group);
  const addEntry = () => {
    const created = createEntry();
    if (section.kind === "certifications")
      created.certification = { credentialId: "", dates: null };
    update((draft) => {
      draft.sections
        .find((section) => section.id === sectionId)!
        .entries.push(created);
    });
    onContext({ ...context, query: "", entryId: created.id });
  };
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-lg">
              <CardTitle size="section">Entries</CardTitle>
              <InfoHint label="career entries" size="lg">
                Changes here update every resume that uses this content. Add new
                entries to each resume in Content & order. Changing their order
                here does not change their order in resumes.
              </InfoHint>
            </div>
            <Button onClick={addEntry} disabled={section.entries.length >= 300}>
              <Plus data-icon="inline-start" />
              Add {terms.singular}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Collapsible
              defaultOpen={
                issueTarget?.fieldKey ===
                `sections.${section.id}.heading.${locale}`
              }
            >
              <CollapsibleTrigger
                render={<Button variant="ghost" size="sm" />}
                className="group"
              >
                <ChevronRight
                  data-icon="inline-start"
                  className="transition-transform duration-200 group-data-panel-open:rotate-90 motion-reduce:transition-none"
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
            <LibrarySearch
              query={query}
              onQuery={setQuery}
              showArchived={showArchived}
              onArchived={setShowArchived}
              count={displayed.length}
              total={section.entries.length}
            />
            {displayed.length ? (
              <SortableList
                scope={`library:${section.id}`}
                revision={document}
                contextKey={JSON.stringify([
                  query,
                  showArchived,
                  locale,
                  entry?.id,
                ])}
                items={displayed.map((item) => ({
                  id: item.id,
                  label: entryLabel(item, section.kind, locale),
                }))}
                onReorder={(source, target) =>
                  update((draft) => {
                    reorderVisible(
                      draft.sections.find((item) => item.id === section.id)!
                        .entries,
                      displayed.map((item) => item.id),
                      source,
                      target,
                      (item) => item.id,
                    );
                  })
                }
              >
                <ul className="flex flex-col gap-2" aria-label="Career entries">
                  {displayed.map((item) => {
                    return (
                      <SortableRow
                        key={item.id}
                        id={item.id}
                        label={entryLabel(item, section.kind, locale)}
                        as="li"
                        className={cn(
                          "flex flex-col gap-2 rounded-lg border border-l-2 p-2",
                          entry?.id === item.id &&
                            "border-l-foreground bg-muted",
                        )}
                      >
                        {({ dragHandle, orderButtons }) => (
                          <>
                            <div className="flex items-center gap-2">
                              {dragHandle}
                              <Button
                                className="h-auto min-w-0 flex-1 justify-start py-2 text-left whitespace-normal"
                                variant={
                                  entry?.id === item.id ? "secondary" : "ghost"
                                }
                                onClick={() => {
                                  setEntryId(item.id);
                                  setEditRequest((request) => request + 1);
                                }}
                                aria-pressed={entry?.id === item.id}
                              >
                                <span className="flex min-w-0 flex-1 flex-col gap-1">
                                  <span className="text-base font-semibold">
                                    {entryLabel(item, section.kind, locale)}
                                  </span>
                                  <span className="text-xs font-normal text-muted-foreground">
                                    {[
                                      plain(item.title, locale) !==
                                      entryLabel(item, section.kind, locale)
                                        ? plain(item.title, locale)
                                        : item.organization !==
                                            entryLabel(
                                              item,
                                              section.kind,
                                              locale,
                                            )
                                          ? item.organization
                                          : "",
                                      item.start,
                                      item.ongoing ? "Present" : item.end,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </span>
                                </span>
                                <Pencil data-icon="inline-end" />
                                {item.archived && (
                                  <ContentStatusBadge state="archived" />
                                )}
                              </Button>
                              {orderButtons}
                            </div>
                          </>
                        )}
                      </SortableRow>
                    );
                  })}
                </ul>
              </SortableList>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FilePlus2 />
                  </EmptyMedia>
                  <EmptyTitle>
                    {section.entries.length
                      ? "No matching entries"
                      : `No ${terms.singular} entries yet`}
                  </EmptyTitle>
                  <EmptyDescription>
                    {section.entries.length
                      ? "Clear search or include archived entries to see more content."
                      : terms.empty}{" "}
                    You can write each language at your own pace.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </FieldGroup>
        </CardContent>
      </Card>
      {entry && (
        <Card key={entry.id} ref={entryForm} className="scroll-mt-4">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{entryLabel(entry, section.kind, locale)}</CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Entry actions"
                    />
                  }
                >
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      disabled={section.entries.length >= 300}
                      onClick={() => {
                        const copy = duplicateEntry(entry);
                        update((draft) => {
                          const entries = draft.sections.find(
                            (item) => item.id === sectionId,
                          )!.entries;
                          if (entries.length >= 300) return;
                          const index = entries.findIndex(
                            (item) => item.id === entry.id,
                          );
                          if (index >= 0) entries.splice(index + 1, 0, copy);
                        });
                        onContext({ ...context, query: "", entryId: copy.id });
                      }}
                    >
                      <Copy data-icon="inline-start" />
                      Duplicate entry
                    </DropdownMenuItem>
                    <DropdownMenuItem
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
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
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
                          `Its achievements and links will also be removed. Affected resumes: ${affected.join(", ") || "none"}. Export a JSON backup first if you need a copy.`,
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
                      Delete permanently
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <CardDescription className="flex items-center gap-1.5">
              {entry.archived ? (
                "Archived entries stay editable and are hidden from all resumes."
              ) : (
                <>
                  <span>Used across resumes</span>
                  <InfoHint label="content used across resumes">
                    Changes update every resume that uses this entry.
                  </InfoHint>
                </>
              )}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <FieldGroup>
              <EntryFields
                entry={entry}
                section={section}
                document={document}
                locale={locale}
                update={update}
                errors={errors}
                changeEntry={changeEntry}
                issueTarget={issueTarget}
              />
              <Separator />
              <FieldSet>
                <FieldLegend>
                  <span className="inline-flex items-center gap-1.5">
                    <span>{terms.items}</span>
                    <InfoHint label="achievement inclusion">
                      Choose achievements in each resume’s Content &amp; order.
                    </InfoHint>
                  </span>
                </FieldLegend>
                {!entry.bullets.length && (
                  <FieldDescription>
                    No {terms.items.toLowerCase()} yet. Add a{" "}
                    {terms.item.toLowerCase()} to describe this {terms.singular}{" "}
                    in each language.
                  </FieldDescription>
                )}
                <SortableList
                  scope={`library:${section.id}:${entry.id}:bullets`}
                  revision={document}
                  contextKey={JSON.stringify([locale])}
                  items={entry.bullets.map((bullet, index) => ({
                    id: bullet.id,
                    label: `${terms.item.toLowerCase()} ${index + 1}`,
                  }))}
                  onReorder={(source, target) =>
                    changeEntry((entry) =>
                      reorderVisible(
                        entry.bullets,
                        entry.bullets.map((bullet) => bullet.id),
                        source,
                        target,
                        (bullet) => bullet.id,
                      ),
                    )
                  }
                >
                  <div className="flex flex-col gap-3">
                    {entry.bullets.map((bullet, index) => (
                      <SortableRow
                        key={bullet.id}
                        id={bullet.id}
                        label={`${terms.item.toLowerCase()} ${index + 1}`}
                        className="flex flex-col gap-3 rounded-lg border border-field-filled p-3"
                      >
                        {({ dragHandle, orderButtons }) => (
                          <>
                            <div className="flex items-center gap-2">
                              {dragHandle}
                              <span className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
                                {terms.item.toUpperCase()} {index + 1}
                              </span>
                              <div className="flex gap-1">
                                {orderButtons}
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Delete ${terms.item.toLowerCase()} ${index + 1}`}
                                  onClick={() =>
                                    confirm(
                                      `Delete this ${terms.item.toLowerCase()}?`,
                                      "This removes it from every resume that references it.",
                                      () =>
                                        update((draft) => {
                                          const target = draft.sections
                                            .find(
                                              (section) =>
                                                section.id === sectionId,
                                            )!
                                            .entries.find(
                                              (item) => item.id === entry.id,
                                            )!;
                                          target.bullets =
                                            target.bullets.filter(
                                              (item) => item.id !== bullet.id,
                                            );
                                          draft.variants.forEach((variant) =>
                                            variant.sections.forEach(
                                              (section) =>
                                                section.entries.forEach(
                                                  (item) => {
                                                    item.bulletIds =
                                                      item.bulletIds.filter(
                                                        (id) =>
                                                          id !== bullet.id,
                                                      );
                                                  },
                                                ),
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
                            <WordingField
                              document={document}
                              path={`bullets.${bullet.id}.body`}
                              locale={locale}
                              update={update}
                              label={terms.item}
                              multiline={section.kind !== "skills"}
                              required
                              errors={errors}
                            />
                          </>
                        )}
                      </SortableRow>
                    ))}
                  </div>
                </SortableList>
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
                    });
                  }}
                >
                  <Plus data-icon="inline-start" />
                  Add {terms.item.toLowerCase()}
                </Button>
              </FieldSet>
              <Separator />
              <FieldSet>
                <FieldLegend>
                  {section.kind === "certifications"
                    ? "Verification links"
                    : section.kind === "projects"
                      ? "Project links"
                      : "Links"}
                </FieldLegend>
                <LinksEditor
                  document={document}
                  scope={`library:${section.id}:${entry.id}:links`}
                  links={entry.links}
                  onChange={(links, group) =>
                    changeEntry((target) => {
                      target.links = links;
                    }, group)
                  }
                  confirm={confirm}
                />
              </FieldSet>
            </FieldGroup>
          </CardContent>

          <CardFooter>
            <p className="text-xs text-muted-foreground">
              Dates and links apply to both languages.
            </p>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
