"use client";

import {
  ArrowLeft,
  ArrowRight,
  Columns2,
  Copy,
  Eye,
  FileText,
  Languages,
  LayoutDashboard,
  ListOrdered,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  type ReactElement,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CareerRichField,
  CareerTextField,
  contentLanguageName,
} from "@/components/career/career-fields";
import { StyleSample } from "@/components/career/layout-editor";
import { CareerSectionIcon } from "@/components/content/career-section-icon";
import { EntrySearch } from "@/components/content/entry-search";
import { SortableItemLayout } from "@/components/editor/sortable-item-layout";
import { SortableList, SortableRow } from "@/components/editor/sortable-list";
import { SemanticBadge } from "@/components/shared/semantic-badges/semantic-badge";
import { WordingSourceBadge } from "@/components/shared/semantic-badges/wording-source-badge";
import { AnimatedListItem } from "@/components/ui/animated-list";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DisclosureChevron,
  DisclosureGuide,
  DisclosureLabel,
  disclosureTriggerClassName,
} from "@/components/ui/disclosure";
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
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ResumeColorPicker } from "@/components/variants/resume-color-picker";
import { useListEntrance } from "@/hooks/use-list-entrance";
import { outputCapabilities } from "@/lib/career/output";
import {
  copyResume,
  createResume,
  effectiveResume,
  resolveResumeWording,
  resumeComparisonRows,
  type ResumeContent,
  resumeFactFields,
  type ResumeFieldOwner,
  resumeWordingFields,
} from "@/lib/career/resumes";
import {
  fieldsForNewEntries,
  prepareStarterResume,
  starterMappings,
} from "@/lib/career/starters";
import { type RichText, wordingText } from "@/lib/career/wording";
import { reorderVisible } from "@/lib/ordering";
import type {
  CareerDocument,
  CareerResume,
} from "@/types-and-constants/career";
import { CAREER_FIELD_LABELS } from "@/types-and-constants/career";
import type { SectionIconId } from "@/types-and-constants/section-icons";

export function ResumeIdentityFields({
  values,
  onChange,
}: {
  values: { name: string; color?: CareerResume["color"] };
  onChange: (values: { name: string; color?: CareerResume["color"] }) => void;
}) {
  return (
    <FieldGroup>
      <CareerTextField
        label="Resume name"
        maxLength={500}
        value={values.name}
        onChange={(name) => onChange({ ...values, name })}
      />
      <ResumeColorPicker
        value={values.color ?? "indigo"}
        onChange={(color) => onChange({ ...values, color })}
      />
    </FieldGroup>
  );
}

export function ResumeManager({
  document,
  navigate,
  commit,
  createRequested,
  onCreateHandled,
  children,
  guard,
  getResume,
  getDocument,
  createStarter,
  saveStarter,
}: {
  getDocument: () => CareerDocument;
  createStarter: () => void;
  saveStarter: (resume: CareerResume) => void;
  getResume: (id: string) => CareerResume | undefined;
  guard: (action: () => void) => void;
  children: (actions: ResumeActions) => ReactNode;
  document: CareerDocument;
  navigate: (destination: string) => void;
  commit: (
    scope: string,
    value: unknown,
    after: string,
    reviewed?: CareerResume,
  ) => Promise<boolean>;
  createRequested: boolean;
  onCreateHandled: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [source, setSource] = useState<CareerResume | null>(null);
  const [deleting, setDeleting] = useState<CareerResume | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<CareerResume["color"]>("indigo");
  const [language, setLanguage] = useState("");
  const [starterId, setStarterId] = useState("");
  const [creationMode, setCreationMode] = useState("blank");
  const [mapping, setMapping] = useState<string[]>([]);
  const starter = document.starters.find((item) => item.id === starterId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const open = creating || createRequested || Boolean(source);
  const languages = document.languages.filter(
    (item) => item.active && item.tag !== source?.language,
  );
  const selectedLanguage = language || languages[0]?.tag || "";
  const close = () => {
    setStarterId("");
    setCreationMode("blank");
    setMapping([]);
    setCreating(false);
    onCreateHandled();
    setSource(null);
    setLanguage("");
    setName("");
    setColor("indigo");
    setError("");
  };
  const save = async () => {
    setBusy(true);
    try {
      const currentDocument = getDocument();
      const currentStarter = currentDocument.starters.find(
        (item) => item.id === starterId,
      );
      if (
        !currentDocument.languages.some(
          (item) => item.active && item.tag === selectedLanguage,
        ) ||
        !languages.some((item) => item.tag === selectedLanguage)
      )
        throw new Error("Choose an active destination language.");
      if (!source && creationMode === "starter" && !currentStarter)
        throw new Error(
          "Choose an available starter before creating this resume.",
        );
      const prepared =
        !source && currentStarter
          ? prepareStarterResume(
              currentDocument,
              currentStarter,
              mapping,
              selectedLanguage,
            )
          : null;
      const resume = prepared
        ? { ...prepared.resume, name, color }
        : source
          ? copyResume(source, selectedLanguage)
          : { ...createResume(currentDocument, selectedLanguage), name, color };
      await commit(
        prepared ? `starter-create/${resume.id}` : `resume/${resume.id}`,
        prepared ? { ...prepared, resume } : resume,
        `resume-content/${resume.id}`,
      );
      close();
    } catch (error) {
      setError(String(error));
    } finally {
      setBusy(false);
    }
  };
  const actions: ResumeActions = {
    saveStarter,
    edit: (resume) => navigate(`resume-details/${resume.id}`),
    create: (requestedStarterId?: string) =>
      guard(() => {
        const latest = getDocument();
        const chosen = latest.starters.find(
          (item) => item.id === requestedStarterId,
        );
        setCreationMode(requestedStarterId ? "starter" : "blank");
        setStarterId(requestedStarterId ?? "");
        setMapping(chosen ? starterMappings(latest, chosen) : []);
        setCreating(true);
        setError("");
      }),
    duplicate: (resume) =>
      guard(() => {
        const current = getResume(resume.id);
        if (!current) return;
        const copy = copyResume(current);
        void commit(`resume/${copy.id}`, copy, `resume-overview/${copy.id}`);
      }),
    copy: (resume) =>
      guard(() => {
        const current = getResume(resume.id);
        if (!current) return;
        setSource(current);
        setLanguage("");
        setError("");
      }),
    delete: (resume) =>
      guard(() => {
        const current = getResume(resume.id);
        if (!current) return;
        setDeleting(structuredClone(current));
        setError("");
      }),
  };
  return (
    <>
      {children(actions)}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value && !busy) close();
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {source ? "Create copy in another language" : "Create resume"}
            </DialogTitle>
            <DialogDescription>
              {source
                ? "The copy uses destination career wording. Missing wording remains missing; source customizations are not copied."
                : "Start blank or copy a starter’s empty structure and layout. Select optional content after creation."}
            </DialogDescription>
          </DialogHeader>
          <fieldset disabled={busy} className="flex flex-col gap-4">
            {!source && (
              <ResumeIdentityFields
                values={{ name, color }}
                onChange={(value) => {
                  setName(value.name);
                  setColor(value.color);
                }}
              />
            )}
            <Field>
              <FieldLabel htmlFor="new-resume-language">
                Content language
              </FieldLabel>
              <Select
                items={languages.map((item) => ({
                  value: item.tag,
                  label: contentLanguageName(item.tag),
                }))}
                value={selectedLanguage}
                onValueChange={(value) => {
                  if (value) setLanguage(value);
                }}
              >
                <SelectTrigger id="new-resume-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {languages.map((item) => (
                      <SelectItem key={item.tag} value={item.tag}>
                        <Languages />
                        {contentLanguageName(item.tag)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {!source && (
              <FieldGroup>
                <Field>
                  <FieldLabel>Start with</FieldLabel>
                  <ToggleGroup
                    multiple={false}
                    value={[creationMode]}
                    onValueChange={(values) => {
                      const mode = values[0];
                      if (mode) {
                        setCreationMode(mode);
                        if (mode === "blank") {
                          setStarterId("");
                          setMapping([]);
                        }
                      }
                    }}
                    aria-label="Resume starting point"
                  >
                    <ToggleGroupItem value="blank">
                      Blank resume
                    </ToggleGroupItem>
                    <ToggleGroupItem value="starter">
                      From starter
                    </ToggleGroupItem>
                  </ToggleGroup>
                </Field>
                {creationMode === "starter" && (
                  <>
                    {!document.starters.length && (
                      <div className="flex flex-col items-start gap-2">
                        <p className="text-sm text-muted-foreground">
                          No resume starters yet. Create one with empty
                          sections, field defaults, and layout.
                        </p>
                        <Button
                          variant="outline"
                          onClick={() => {
                            close();
                            createStarter();
                          }}
                        >
                          Create starter…
                        </Button>
                      </div>
                    )}
                    <Field>
                      <FieldLabel htmlFor="new-resume-starter">
                        Starter
                      </FieldLabel>
                      <Select
                        items={[
                          ...document.starters.map((item) => ({
                            value: item.id,
                            label: item.name || "Untitled starter",
                          })),
                        ]}
                        value={starterId || null}
                        onValueChange={(value) => {
                          const chosen = document.starters.find(
                            (item) => item.id === value,
                          );
                          setStarterId(chosen?.id ?? "");
                          setMapping(
                            chosen ? starterMappings(document, chosen) : [],
                          );
                        }}
                      >
                        <SelectTrigger id="new-resume-starter">
                          <SelectValue placeholder="Choose a starter" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {document.starters.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name || "Untitled starter"}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    {starter && (
                      <>
                        <StyleSample values={starter.layout} />
                        <p className="text-xs text-muted-foreground">
                          Summary:{" "}
                          {starter.summaryIncluded ? "included" : "hidden"}.
                          Section order and field defaults:
                        </p>
                        <ol className="flex list-decimal flex-col gap-1 ps-5 text-sm">
                          {starter.sections.map((section) => (
                            <li key={section.id}>
                              {section.label} /{" "}
                              {section.hidden ? "Hidden" : "Visible"} /{" "}
                              {section.visibleFields
                                .map((key) => CAREER_FIELD_LABELS[key])
                                .join(", ") || "No optional fields"}
                            </li>
                          ))}
                        </ol>
                        <p className="text-xs text-muted-foreground">
                          Review the Career sections to reuse or create. No
                          entries or wording are copied. Custom headings need
                          career wording before PDF output.
                        </p>
                        {starter.sections.map((definition, index) => (
                          <Field key={definition.id}>
                            <FieldLabel htmlFor={`starter-mapping-${index}`}>
                              {definition.label}
                            </FieldLabel>
                            <Select
                              items={[
                                { value: "new", label: "Create empty section" },
                                ...document.sections
                                  .filter(
                                    (section) =>
                                      !section.archived &&
                                      section.kind === definition.kind,
                                  )
                                  .map((section) => ({
                                    value: section.id,
                                    label: section.name || section.kind,
                                  })),
                              ]}
                              value={mapping[index] || null}
                              onValueChange={(value) =>
                                setMapping(
                                  mapping.map((prior, i) =>
                                    i === index ? (value ?? "") : prior,
                                  ),
                                )
                              }
                            >
                              <SelectTrigger id={`starter-mapping-${index}`}>
                                <SelectValue placeholder="Choose a section" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value="new">
                                    Create empty section
                                  </SelectItem>
                                  {document.sections
                                    .filter(
                                      (section) =>
                                        !section.archived &&
                                        section.kind === definition.kind,
                                    )
                                    .map((section) => (
                                      <SelectItem
                                        key={section.id}
                                        value={section.id}
                                      >
                                        {section.name || section.kind}
                                      </SelectItem>
                                    ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </Field>
                        ))}
                      </>
                    )}
                    <Button
                      variant="ghost"
                      className="self-start"
                      onClick={() => {
                        close();
                        navigate("starters");
                      }}
                    >
                      Manage starters
                    </Button>
                    {starterId && !starter && (
                      <p role="alert">
                        This starter is unavailable. Choose another starter or
                        start blank.
                      </p>
                    )}
                  </>
                )}
              </FieldGroup>
            )}
            {source && (
              <p className="text-xs text-muted-foreground">
                Compatible layout is copied. Font metrics and line wrapping can
                differ by language; identical appearance is not guaranteed.{" "}
                {!outputCapabilities[selectedLanguage] &&
                  "PDF output is unavailable until this language’s rendering is verified."}
              </p>
            )}
            {error && <p role="alert">{error}</p>}
          </fieldset>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={close}>
              Cancel
            </Button>
            <Button
              disabled={
                busy ||
                !selectedLanguage ||
                document.resumes.length >= 120 ||
                (!source && creationMode === "starter" && !starter) ||
                (!!starter && mapping.some((value) => !value))
              }
              onClick={() => void save()}
            >
              {busy ? "Creating…" : "Create resume"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(value) => {
          if (!value && !busy) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete resume?</DialogTitle>
            <DialogDescription>
              Delete {deleting?.name || "Untitled resume"} ({deleting?.language}
              )? Shared career content and recoverable drafts are retained.
            </DialogDescription>
          </DialogHeader>
          {error && <p role="alert">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (!deleting) return;
                if (
                  JSON.stringify(
                    document.resumes.find((item) => item.id === deleting.id),
                  ) !== JSON.stringify(deleting)
                ) {
                  setError(
                    "This resume changed. Close this dialog and review it before deleting.",
                  );
                  return;
                }
                setBusy(true);
                void commit(`resume/${deleting.id}`, null, "resumes", deleting)
                  .then((saved) => {
                    if (saved) setDeleting(null);
                  })
                  .finally(() => setBusy(false));
              }}
            >
              Delete resume
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CareerResumeCollection({
  document,
  navigate,
  actions,
}: {
  document: CareerDocument;
  navigate: (destination: string) => void;
  actions: ResumeActions;
}) {
  const list = useRef<HTMLDivElement>(null);
  useListEntrance({
    getElements: () => [
      ...(list.current?.querySelectorAll<HTMLElement>(
        ":scope > [data-list-id]",
      ) ?? []),
    ],
    contextKey: "resume-collection",
  });
  return (
    <div
      role="region"
      aria-label="Resume collection"
      className="flex flex-col gap-5"
    >
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          disabled={document.resumes.length < 2}
          onClick={() => navigate("resume-compare")}
        >
          <Columns2 data-icon="inline-start" />
          Compare resumes
        </Button>
        <Button
          disabled={
            document.resumes.length >= 120 ||
            !document.languages.some((item) => item.active)
          }
          onClick={() => {
            actions.create();
          }}
        >
          <Plus data-icon="inline-start" />
          Create resume
        </Button>
      </div>
      {!document.resumes.length && (
        <Empty>
          <EmptyHeader>
            <FileText />
            <EmptyTitle>No resumes yet</EmptyTitle>
            <EmptyDescription>
              Create an independent resume, then select content from Career
              details.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      <div ref={list} className="grid gap-4 @2xl:grid-cols-2">
        {document.resumes.map((resume) => (
          <Card
            key={resume.id}
            data-list-id={resume.id}
            size="sm"
            onPointerEnter={(event) =>
              event.currentTarget
                .getAnimations()
                .forEach((animation) => animation.finish())
            }
            onFocusCapture={(event) =>
              event.currentTarget
                .getAnimations()
                .forEach((animation) => animation.finish())
            }
          >
            <CardHeader>
              <CardTitle
                size="section"
                className="flex min-w-0 items-center gap-2"
              >
                <FileText
                  aria-hidden="true"
                  className="resume-color size-4 shrink-0 text-(--resume-color)"
                  data-resume-color={resume.color ?? "indigo"}
                />
                <span className="truncate">
                  {resume.name || "Untitled resume"}
                </span>
              </CardTitle>
              <CardDescription>
                {contentLanguageName(resume.language)} ·{" "}
                {effectiveResume(document, resume).selection.reduce(
                  (total, section) => total + section.entryIds.length,
                  0,
                )}{" "}
                selected entries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Shared career details · independent content, wording, and
                appearance
              </p>
            </CardContent>
            <CardFooter className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => navigate(`resume-overview/${resume.id}`)}
              >
                <FileText data-icon="inline-start" />
                Open resume
              </Button>
              <ResumeActionsMenu
                document={document}
                resume={resume}
                actions={actions}
              />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

export type ResumeActions = {
  create: (starterId?: string) => void;
  edit: (resume: CareerResume) => void;
  duplicate: (resume: CareerResume) => void;
  copy: (resume: CareerResume) => void;
  delete: (resume: CareerResume) => void;
  saveStarter?: (resume: CareerResume) => void;
};

export function ResumeActionsMenu({
  document,
  resume,
  actions,
  trigger,
}: {
  document: CareerDocument;
  resume: CareerResume;
  actions: ResumeActions;
  trigger?: ReactElement;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          trigger ?? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${resume.name || "Untitled resume"}`}
            />
          )
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => actions.edit(resume)}>
            <Pencil />
            Edit name &amp; color
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={document.resumes.length >= 120}
            onClick={() => actions.duplicate(resume)}
          >
            <Copy />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={
              document.resumes.length >= 120 ||
              !document.languages.some(
                (item) => item.active && item.tag !== resume.language,
              )
            }
            onClick={() => actions.copy(resume)}
          >
            <Languages />
            Create copy in another language
          </DropdownMenuItem>
          {actions.saveStarter && (
            <DropdownMenuItem
              disabled={document.starters.length >= 100}
              onClick={() => actions.saveStarter?.(resume)}
            >
              <Copy />
              Save as starter
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant="destructive"
            onClick={() => actions.delete(resume)}
          >
            <Trash2 />
            Delete resume
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Present route-controlled resume tabs while leaving dirty navigation with the workspace owner. */
export function ResumeViewTabs({
  resume,
  destination,
  saving,
  navigate,
  children,
}: {
  resume?: CareerResume;
  destination: string;
  saving: boolean;
  navigate: (destination: string) => void;
  children: ReactNode;
}) {
  if (!resume) return children;
  if (destination === `resume-details/${resume.id}`) {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        <Button
          variant="ghost"
          className="self-start"
          disabled={saving}
          onClick={() => navigate(`resume-overview/${resume.id}`)}
        >
          <ArrowLeft aria-hidden="true" data-icon="inline-start" />
          Back to overview
        </Button>
        {children}
      </div>
    );
  }
  const views = [
    ["resume-overview", "Overview", LayoutDashboard],
    ["resume-content", "Content & order", ListOrdered],
    ["resume-wording", "Wording", Languages],
    ["resume-layout", "Layout", Palette],
  ] as const;
  const active = views.some(
    ([prefix]) => destination === `${prefix}/${resume.id}`,
  )
    ? destination
    : null;
  return (
    <Tabs
      value={active}
      onValueChange={(value) => {
        if (typeof value === "string") navigate(value);
      }}
      className="min-w-0 gap-6"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="max-w-full overflow-x-auto px-1 pt-1 pb-2">
          <TabsList variant="line" aria-label="Resume views">
            {views.map(([prefix, label, Icon]) => (
              <TabsTrigger
                key={prefix}
                value={`${prefix}/${resume.id}`}
                disabled={saving}
              >
                <Icon aria-hidden="true" data-icon="inline-start" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <Button
          variant="outline"
          disabled={saving}
          onClick={() => navigate("resume-compare")}
        >
          <Columns2 aria-hidden="true" data-icon="inline-start" />
          Compare resumes
        </Button>
      </div>
      {active ? (
        <TabsContent value={active} className="min-w-0">
          {children}
        </TabsContent>
      ) : (
        children
      )}
    </Tabs>
  );
}

export function ResumeOverview({
  document,
  resume,
}: {
  document: CareerDocument;
  resume: CareerResume;
}) {
  const content = effectiveResume(document, resume);
  const sections = content.selection.filter((section) => !section.hidden);
  const entryCount = sections.reduce(
    (total, section) =>
      total +
      section.entryIds.filter((id) => !section.hiddenEntryIds?.includes(id))
        .length,
    0,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle size="section">Resume overview</CardTitle>
        <CardDescription>
          {contentLanguageName(resume.language)} · Independent content and
          wording
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt>Name</dt>
          <dd className="wrap-anywhere">{resume.name || "Untitled resume"}</dd>
          <dt>Language</dt>
          <dd>{contentLanguageName(resume.language)}</dd>
          <dt>Selected sections</dt>
          <dd>{sections.length}</dd>
          <dt>Selected entries</dt>
          <dd>{entryCount}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

type Choice = {
  id: string;
  label: string;
  value?: string;
  archived?: boolean;
  children?: ReactNode;
};

function Choices({
  label,
  scope,
  items,
  selected,
  onChange,
  revision,
  query = "",
  disabled = false,
}: {
  label: string;
  scope: string;
  items: Choice[];
  selected: string[];
  onChange: (ids: string[]) => void;
  revision: object;
  query?: string;
  disabled?: boolean;
}) {
  const available = items.filter(
    (item) =>
      !query ||
      `${item.label} ${item.value ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const visibleIds = selected.filter((id) =>
    available.some((item) => item.id === id),
  );
  const ordered = [
    ...visibleIds.map((id) => available.find((item) => item.id === id)!),
    ...available.filter((item) => !selected.includes(item.id)),
  ];
  const content = (item: Choice, handle?: ReactNode, buttons?: ReactNode) => (
    <SortableItemLayout dragHandle={handle}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <label className="flex min-w-0 flex-1 items-start gap-2">
          <Checkbox
            className="mt-1.5"
            aria-label={`Include ${item.label}`}
            checked={selected.includes(item.id)}
            disabled={
              disabled || (item.archived && !selected.includes(item.id))
            }
            onCheckedChange={(checked) =>
              onChange(
                checked
                  ? [...selected, item.id]
                  : selected.filter((id) => id !== item.id),
              )
            }
          />
          <span className="min-w-0 pt-1 text-sm leading-5 wrap-anywhere">
            {item.label}
            {item.archived && (
              <Badge variant="secondary" className="ms-2">
                Archived
              </Badge>
            )}
            <span className="block text-xs text-muted-foreground">
              {selected.includes(item.id) ? "Included" : "Excluded"}
              {item.value !== undefined && ` · ${item.value || "Empty"}`}
            </span>
          </span>
        </label>
        {buttons}
      </div>
      {item.children}
    </SortableItemLayout>
  );
  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-3">
      <legend className="mb-3 text-sm font-medium">{label}</legend>
      {ordered.length === 0 ? (
        <Empty className="flex-none items-start border px-3 py-3 text-start">
          <EmptyDescription>
            {items.length > 0 && query
              ? `No ${label.toLowerCase()} match this search.`
              : `No ${label.toLowerCase()} available.`}
          </EmptyDescription>
        </Empty>
      ) : (
        <SortableList
          scope={`resume:${scope}`}
          revision={revision}
          contextKey={query}
          items={visibleIds.map((id) => ({
            id,
            label: items.find((item) => item.id === id)!.label,
          }))}
          onReorder={(source, target) => {
            const next = [...selected];
            reorderVisible(next, visibleIds, source, target, (id) => id);
            onChange(next);
          }}
        >
          <div className="flex flex-col gap-3">
            {ordered.map((item) =>
              selected.includes(item.id) ? (
                <SortableRow
                  key={item.id}
                  id={item.id}
                  label={item.label}
                  surface="standard"
                  className="rounded-lg border py-3"
                >
                  {({ dragHandle, orderButtons }) =>
                    content(item, dragHandle, orderButtons)
                  }
                </SortableRow>
              ) : (
                <div key={item.id} className="rounded-lg border py-3">
                  {content(item)}
                </div>
              ),
            )}
          </div>
        </SortableList>
      )}
    </fieldset>
  );
}

export function ResumeContentEditor({
  document,
  resume,
  values,
  onChange,
}: {
  document: CareerDocument;
  resume: CareerResume;
  values: ResumeContent;
  onChange: (value: ResumeContent) => void;
}) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const effective = effectiveResume(document, { ...resume, ...values });
  const wording = (id: string, shared: Record<string, RichText>) =>
    wordingText(resolveResumeWording(resume, id, shared));
  const changeSection = (
    id: string,
    update: (
      value: CareerResume["selection"][number],
    ) => CareerResume["selection"][number],
  ) => {
    const current = values.selection.find(
      (section) => section.sectionId === id,
    ) ?? {
      sectionId: id,
      entryIds: [],
      fieldIds: [],
      achievementIds: [],
      linkIds: [],
      hidden: true,
    };
    const changed = update(current);
    onChange({
      ...values,
      selection: values.selection.some((section) => section.sectionId === id)
        ? values.selection.map((section) =>
            section.sectionId === id ? changed : section,
          )
        : [...values.selection, changed],
    });
  };
  const contacts: Choice[] = [
    ...document.profile.fields
      .filter((field) => field.key !== "fullName")
      .map((field) => ({
        id: field.id,
        label: `Profile · ${field.key}`,
        value:
          field.type === "text" ? wording(field.id, field.wording) : field.fact,
      })),
    ...document.profile.links.map((link, index) => ({
      id: link.id,
      label: `Profile · Link ${index + 1}`,
      value: wording(link.id, link.label) || link.url,
      archived: link.archived,
    })),
  ];
  return (
    <div className="flex flex-col gap-5">
      {values.selection.some((section) => section.fieldDefaults) && (
        <p className="text-xs text-muted-foreground">
          Starter structure is ready. Select entries below; copied field
          defaults apply to new selections. All choices remain independent.
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle size="section">Profile</CardTitle>
          <CardDescription>
            Full name is required by the template. Choose and order optional
            contacts. Facts are edited in Career details.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm">
            Full name · Required ·{" "}
            {wording(
              document.profile.fields.find((field) => field.key === "fullName")!
                .id,
              document.profile.fields.find((field) => field.key === "fullName")!
                .wording,
            ) || "Empty"}
          </p>
          <Choices
            label="Contact details"
            scope={`${resume.id}:contacts`}
            items={contacts.filter(
              (item) =>
                !item.archived || effective.profileSelection!.includes(item.id),
            )}
            selected={effective.profileSelection!}
            revision={document}
            onChange={(profileSelection) =>
              onChange({ ...values, profileSelection })
            }
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle size="section">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-start gap-2">
            <Checkbox
              aria-label="Include summary"
              checked={effective.summaryIncluded}
              onCheckedChange={(summaryIncluded) =>
                onChange({
                  ...values,
                  summaryIncluded: Boolean(summaryIncluded),
                })
              }
            />
            <span className="text-sm">
              Include summary ·{" "}
              {wording(document.summary.id, document.summary.wording) ||
                "Empty"}
            </span>
          </label>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle size="section">Find resume content</CardTitle>
          <CardDescription>
            Selections and order belong only to this resume. Title placement
            stays fixed; other fields are ordered within the template’s detail
            line.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EntrySearch
            query={query}
            onQuery={setQuery}
            showArchived={showArchived}
            onArchived={setShowArchived}
            count={
              document.sections
                .flatMap((item) => item.entries)
                .filter(
                  (item) =>
                    (!item.archived || showArchived) &&
                    item.name.toLowerCase().includes(query.toLowerCase()),
                ).length
            }
            total={document.sections.reduce(
              (total, section) => total + section.entries.length,
              0,
            )}
          />
        </CardContent>
      </Card>
      {!outputCapabilities[resume.language] && (
        <p role="status">
          PDF unavailable · this language’s output is unverified. You can still
          select, edit, and save content.
        </p>
      )}
      <Choices
        label="Sections"
        scope={`${resume.id}:sections`}
        selected={effective.selection.map((item) => item.sectionId)}
        revision={document}
        onChange={(ids) => {
          const order = [
            ...ids,
            ...values.selection
              .map((item) => item.sectionId)
              .filter((id) => !ids.includes(id)),
          ];
          onChange({
            ...values,
            selection: order.map((sectionId) => ({
              ...(values.selection.find(
                (item) => item.sectionId === sectionId,
              ) ?? {
                sectionId,
                entryIds: [],
                achievementIds: [],
                fieldIds: [],
                linkIds: [],
              }),
              hidden: !ids.includes(sectionId),
            })),
          });
        }}
        items={document.sections
          .filter(
            (section) =>
              !section.archived ||
              values.selection.some((item) => item.sectionId === section.id),
          )
          .map((section) => {
            const configured = values.selection.find(
              (item) => item.sectionId === section.id,
            );
            const sectionVisible = configured && !configured.hidden;
            const selectedIds =
              configured?.entryIds.filter(
                (id) => !configured.hiddenEntryIds?.includes(id),
              ) ?? [];
            return {
              id: section.id,
              label: section.name || section.kind,
              archived: section.archived,
              children: (
                <Collapsible>
                  <CollapsibleTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        className={disclosureTriggerClassName}
                      />
                    }
                  >
                    <DisclosureChevron />
                    <CareerSectionIcon
                      kind={section.kind}
                      icon={section.icon}
                    />
                    <DisclosureLabel>
                      {section.name || section.kind} entries
                    </DisclosureLabel>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <DisclosureGuide>
                      <Choices
                        label="Entries"
                        scope={`${resume.id}:${section.id}:entries`}
                        disabled={!sectionVisible}
                        revision={document}
                        query={query}
                        selected={selectedIds}
                        onChange={(ids) =>
                          changeSection(section.id, (current) => {
                            const entryIds = [
                              ...ids,
                              ...current.entryIds.filter(
                                (id) => !ids.includes(id),
                              ),
                            ];
                            return {
                              ...current,
                              fieldIds: fieldsForNewEntries(
                                section,
                                current,
                                ids,
                              ),
                              entryIds,
                              hiddenEntryIds: entryIds.filter(
                                (id) => !ids.includes(id),
                              ),
                            };
                          })
                        }
                        items={section.entries
                          .filter(
                            (entry) =>
                              !entry.archived ||
                              showArchived ||
                              configured?.entryIds.includes(entry.id),
                          )
                          .map((entry) => ({
                            id: entry.id,
                            label:
                              entry.name ||
                              wordingText(
                                entry.fields.find((field) =>
                                  ["title", "degree"].includes(field.key),
                                )?.wording[resume.language] ?? "",
                              ) ||
                              "Untitled entry",
                            archived: entry.archived || section.archived,
                            value: entry.fields
                              .map((field) =>
                                field.type === "text"
                                  ? wording(field.id, field.wording)
                                  : field.fact,
                              )
                              .filter(Boolean)
                              .join(" · "),
                            children: configured?.entryIds.includes(
                              entry.id,
                            ) ? (
                              <Collapsible>
                                <CollapsibleTrigger
                                  render={
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={disclosureTriggerClassName}
                                    />
                                  }
                                >
                                  <DisclosureChevron />
                                  <DisclosureLabel>
                                    Fields, achievements, and links
                                  </DisclosureLabel>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <DisclosureGuide className="flex flex-col gap-4">
                                    {(
                                      [
                                        "fieldIds",
                                        "achievementIds",
                                        "linkIds",
                                      ] as const
                                    ).map((key) => {
                                      const records: Choice[] =
                                        key === "fieldIds"
                                          ? entry.fields.map((field) => ({
                                              id: field.id,
                                              label: field.key,
                                              value:
                                                field.type === "text"
                                                  ? wording(
                                                      field.id,
                                                      field.wording,
                                                    )
                                                  : field.fact,
                                            }))
                                          : key === "achievementIds"
                                            ? entry.achievements.map(
                                                (item, index) => ({
                                                  id: item.id,
                                                  label: `Achievement ${index + 1}`,
                                                  value: wording(
                                                    item.id,
                                                    item.wording,
                                                  ),
                                                  archived: item.archived,
                                                }),
                                              )
                                            : entry.links.map(
                                                (item, index) => ({
                                                  id: item.id,
                                                  label: `Link ${index + 1}`,
                                                  value:
                                                    wording(
                                                      item.id,
                                                      item.label,
                                                    ) || item.url,
                                                  archived: item.archived,
                                                }),
                                              );
                                      const ownIds = new Set(
                                        records.map((item) => item.id),
                                      );
                                      return (
                                        <Choices
                                          key={key}
                                          label={
                                            key === "fieldIds"
                                              ? "Fields"
                                              : key === "achievementIds"
                                                ? "Achievements"
                                                : "Links"
                                          }
                                          scope={`${resume.id}:${entry.id}:${key}`}
                                          revision={document}
                                          disabled={
                                            !selectedIds.includes(entry.id)
                                          }
                                          items={records.filter(
                                            (item) =>
                                              !item.archived ||
                                              configured[key].includes(item.id),
                                          )}
                                          selected={configured[key].filter(
                                            (id) => ownIds.has(id),
                                          )}
                                          onChange={(ids) =>
                                            changeSection(
                                              section.id,
                                              (current) => {
                                                const slots = current[
                                                  key
                                                ].flatMap((id, index) =>
                                                  ownIds.has(id) ? [index] : [],
                                                );
                                                const next = current[
                                                  key
                                                ].filter(
                                                  (id) => !ownIds.has(id),
                                                );
                                                next.splice(
                                                  slots[0] ?? next.length,
                                                  0,
                                                  ...ids,
                                                );
                                                return {
                                                  ...current,
                                                  [key]: next,
                                                };
                                              },
                                            )
                                          }
                                        />
                                      );
                                    })}
                                  </DisclosureGuide>
                                </CollapsibleContent>
                              </Collapsible>
                            ) : undefined,
                          }))}
                      />
                    </DisclosureGuide>
                  </CollapsibleContent>
                </Collapsible>
              ),
            };
          })}
      />
    </div>
  );
}

function ResumeFieldIcon({
  owner,
  icon,
}: {
  owner: ResumeFieldOwner;
  icon?: SectionIconId;
}) {
  return (
    <span aria-hidden="true" className="flex h-lh shrink-0 items-center">
      {owner === "resume" ? (
        <FileText className="size-4 shrink-0" />
      ) : (
        <CareerSectionIcon
          kind={owner}
          icon={icon}
          className="size-4 shrink-0"
        />
      )}
    </span>
  );
}

function CareerReferenceList({
  contextKey,
  children,
}: {
  contextKey: string;
  children: ReactNode;
}) {
  const list = useRef<HTMLDivElement>(null);

  useListEntrance({
    getElements: () => [
      ...(list.current?.querySelectorAll<HTMLElement>(
        ":scope > [data-list-id]",
      ) ?? []),
    ],
    contextKey,
  });

  return (
    <div ref={list} className="flex flex-col gap-2">
      {children}
    </div>
  );
}

function CareerReferenceRow({
  id,
  label,
  value,
  owner,
  icon,
  destination,
  navigate,
  showLabel = true,
}: {
  id: string;
  label: string;
  value: string;
  owner: ResumeFieldOwner;
  icon?: SectionIconId;
  destination: string;
  navigate: (destination: string) => void;
  showLabel?: boolean;
}) {
  return (
    <AnimatedListItem
      itemId={id}
      surface="nested"
      data-list-id={id}
      className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl p-3"
      onPointerEnter={(event) =>
        event.currentTarget
          .getAnimations()
          .forEach((animation) => animation.finish())
      }
      onFocusCapture={(event) =>
        event.currentTarget
          .getAnimations()
          .forEach((animation) => animation.finish())
      }
    >
      <div className="min-w-0 flex-1 basis-48">
        {showLabel && (
          <p className="mb-1 flex items-start gap-2 text-sm font-medium">
            <ResumeFieldIcon owner={owner} icon={icon} />
            <span className="min-w-0 wrap-anywhere">{label}</span>
          </p>
        )}
        <p className="text-sm wrap-anywhere whitespace-pre-wrap">
          {value || "Empty"}
        </p>
      </div>
      <Button
        variant="link"
        size="xs"
        className="ms-auto h-auto min-h-8 max-w-full whitespace-normal"
        aria-label={`Open Career details · ${label}`}
        onClick={() => navigate(destination)}
      >
        Open Career details
        <ArrowRight aria-hidden="true" data-icon="inline-end" />
      </Button>
    </AnimatedListItem>
  );
}

export function ResumeWordingEditor({
  document,
  resume,
  values,
  onChange,
  navigate,
}: {
  document: CareerDocument;
  resume: CareerResume;
  values: CareerResume["overrides"];
  onChange: (value: CareerResume["overrides"]) => void;
  navigate: (destination: string) => void;
}) {
  const fields = useMemo(
    () => resumeWordingFields(document, resume.language),
    [document, resume.language],
  );
  const facts = useMemo(() => resumeFactFields(document), [document]);
  return (
    <div className="flex flex-col gap-4" lang={resume.language}>
      <p className="text-sm">
        Editing this resume only · {resume.name || "Untitled resume"} (
        {resume.language}). Dates, URLs, credentials, and other facts stay
        shared in Career details.
      </p>
      <Card size="sm">
        <CardHeader>
          <CardTitle>Shared facts</CardTitle>
          <CardDescription>
            Dates, contact addresses, URLs, and credentials are read-only in
            this resume.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Collapsible>
            <CollapsibleTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className={disclosureTriggerClassName}
                />
              }
            >
              <DisclosureChevron />
              <DisclosureLabel className="flex flex-wrap items-center gap-x-1">
                <span>Shared facts</span>
                <SemanticBadge
                  appearance={{
                    label: "read only",
                    icon: Eye,
                    variant: "outline",
                  }}
                />
              </DisclosureLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <DisclosureGuide>
                <CareerReferenceList contextKey={`wording-facts:${resume.id}`}>
                  {facts.map((fact) => (
                    <CareerReferenceRow
                      key={fact.id}
                      {...fact}
                      navigate={navigate}
                    />
                  ))}
                </CareerReferenceList>
              </DisclosureGuide>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
      {fields.map((field) => {
        const custom = Object.hasOwn(values, field.id);
        return (
          <Card
            key={field.id}
            id={`resume-wording-${resume.id}-${field.id}`}
            tabIndex={-1}
            size="sm"
            role="group"
            aria-label={field.label}
          >
            <CardHeader className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <CardTitle className="flex min-w-0 flex-1 basis-48 items-start gap-2">
                <ResumeFieldIcon owner={field.owner} icon={field.icon} />
                <span className="min-w-0 wrap-anywhere">{field.label}</span>
              </CardTitle>
              <WordingSourceBadge
                source={custom ? "custom" : "inherited"}
                className="ms-auto h-auto min-h-5 max-w-full whitespace-normal"
              />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {custom ? (
                field.rich ? (
                  <CareerRichField
                    language={resume.language}
                    label={field.label}
                    value={values[field.id]}
                    onChange={(value) =>
                      onChange({ ...values, [field.id]: value })
                    }
                  />
                ) : (
                  <CareerTextField
                    label={field.label}
                    value={wordingText(values[field.id])}
                    onChange={(value) =>
                      onChange({ ...values, [field.id]: value })
                    }
                  />
                )
              ) : (
                <p className="text-sm wrap-anywhere whitespace-pre-wrap">
                  {wordingText(field.shared) ||
                    "Empty · no career wording in this language"}
                </p>
              )}
              <Collapsible>
                <CollapsibleTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className={disclosureTriggerClassName}
                    />
                  }
                >
                  <DisclosureChevron />
                  <DisclosureLabel className="flex flex-wrap items-center gap-x-1">
                    <span>Career wording</span>
                    <SemanticBadge
                      appearance={{
                        label: "read only",
                        icon: Eye,
                        variant: "outline",
                      }}
                    />
                  </DisclosureLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <DisclosureGuide>
                    <CareerReferenceList
                      contextKey={`wording-reference:${resume.id}:${field.id}`}
                    >
                      <CareerReferenceRow
                        id={field.id}
                        label={field.label}
                        value={wordingText(field.shared)}
                        owner={field.owner}
                        icon={field.icon}
                        destination={field.destination}
                        navigate={navigate}
                        showLabel={false}
                      />
                    </CareerReferenceList>
                  </DisclosureGuide>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
            <CardFooter className="justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  if (custom) {
                    const next = { ...values };
                    delete next[field.id];
                    onChange(next);
                  } else
                    onChange({
                      ...values,
                      [field.id]: structuredClone(field.shared),
                    });
                }}
              >
                {!custom && (
                  <Pencil aria-hidden="true" data-icon="inline-start" />
                )}
                {custom ? "Use career wording" : "Customize"}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

export function ResumeComparison({ document }: { document: CareerDocument }) {
  const [leftId, setLeftId] = useState(document.resumes[0]?.id ?? "");
  const [rightId, setRightId] = useState(document.resumes[1]?.id ?? "");
  const [differences, setDifferences] = useState(false);
  const left =
    document.resumes.find((item) => item.id === leftId) ?? document.resumes[0];
  const right =
    document.resumes.find(
      (item) => item.id === rightId && item.id !== left?.id,
    ) ?? document.resumes.find((item) => item.id !== left?.id);
  if (!left || !right)
    return (
      <p>Create or duplicate a second resume to compare committed content.</p>
    );
  const columns = [left, right];
  const rows = columns.map((resume) => resumeComparisonRows(document, resume));
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        Effective committed content only. Unsaved forms are excluded.
      </p>
      <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
        {columns.map((resume, index) => (
          <Field key={index}>
            <FieldLabel htmlFor={`compare-${index}`}>
              {index ? "Right resume" : "Left resume"}
            </FieldLabel>
            <Select
              value={resume.id}
              items={document.resumes.map((item) => ({
                value: item.id,
                label: `${item.name || "Untitled resume"} (${item.language})`,
              }))}
              onValueChange={(value) => {
                if (value) (index ? setRightId : setLeftId)(value);
              }}
            >
              <SelectTrigger id={`compare-${index}`}>
                <SelectValue>
                  <FileText
                    aria-hidden="true"
                    className="resume-color text-(--resume-color)"
                    data-resume-color={resume.color ?? "indigo"}
                  />
                  {resume.name || "Untitled resume"} ({resume.language})
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {document.resumes.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <FileText
                        aria-hidden="true"
                        className="resume-color text-(--resume-color)!"
                        data-resume-color={item.color ?? "indigo"}
                      />
                      {item.name || "Untitled resume"} ({item.language})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={differences}
          onCheckedChange={(value) => setDifferences(Boolean(value))}
        />
        Differences only
      </label>
      {rows[0].map((row) => {
        const cells = [row, rows[1].find((item) => item.id === row.id)!];
        if (
          differences &&
          JSON.stringify([cells[0].value, cells[0].status, cells[0].source]) ===
            JSON.stringify([cells[1].value, cells[1].status, cells[1].source])
        )
          return null;
        return (
          <Card key={row.id} size="sm">
            <CardHeader>
              <CardTitle className="flex items-start gap-2">
                <ResumeFieldIcon owner={row.owner} icon={row.icon} />
                <span className="min-w-0 wrap-anywhere">{row.label}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 @lg:grid-cols-2">
              {cells.map((cell, index) => (
                <div
                  key={index}
                  lang={columns[index].language}
                  className="flex min-w-0 flex-col gap-2"
                >
                  <p className="text-sm font-medium wrap-anywhere">
                    {columns[index].name || "Untitled resume"} (
                    {columns[index].language})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[cell.status, cell.source].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-sm wrap-anywhere whitespace-pre-wrap">
                    {cell.value || "Empty"}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
