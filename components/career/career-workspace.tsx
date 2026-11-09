"use client";

import {
  ArrowLeft,
  FileText,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  careerEntryLabel,
  CareerEntryList,
  CareerOrderEditor,
} from "@/components/career/career-entry-list";
import {
  CareerEntryEditor as EntryEditor,
  CareerFieldsEditor as FieldsEditor,
  CareerLinksEditor as LinksEditor,
  CareerRichField,
  CareerTextField as TextField,
} from "@/components/career/career-fields";
import { CareerOverview } from "@/components/career/career-overview";
import { CareerWorkspaceShell } from "@/components/career/career-workspace-shell";
import { CommittedOutputView } from "@/components/career/committed-output";
import { LayoutFields } from "@/components/career/layout-editor";
import { libraryDestinationKind } from "@/components/career/library-navigation";
import {
  CareerResumeCollection,
  ResumeActionsMenu,
  ResumeComparison,
  ResumeContentEditor,
  ResumeIdentityFields,
  ResumeManager,
  ResumeOverview,
  ResumeViewTabs,
  ResumeWordingEditor,
} from "@/components/career/resume-workspace";
import { ScopeComparison } from "@/components/career/scope-comparison";
import {
  DeviceSettings,
  SettingsDialog,
} from "@/components/career/settings-dialog";
import {
  LibraryOverview,
  PresetPicker,
  SetupEditor,
  SetupLibrary,
} from "@/components/career/setup-library";
import { CareerSectionIcon } from "@/components/content/career-section-icon";
import { CareerSectionIconPicker } from "@/components/content/career-section-icon-picker";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useCommittedPreview } from "@/hooks/output/use-committed-preview";
import {
  layoutAppearance,
  layoutDefaults,
  layoutFromPreset,
  sameLayout,
} from "@/lib/career/layout";
import {
  careerDocumentSchema,
  createEntry,
  duplicateEntry,
  entrySchema,
  readScope,
  resumeLayoutSchema,
  sectionPropertiesSchema,
  starterCreationSchema,
} from "@/lib/career/model";
import {
  destinationExists,
  destinationScope,
  parseDestination,
  settingsPanel,
} from "@/lib/career/navigation";
import { importPortable } from "@/lib/career/portable-import";
import { oversizedRecovery, recoveryFiles } from "@/lib/career/recovery-export";
import { profileContactLabels, type ResumeContent } from "@/lib/career/resumes";
import { captureStarter } from "@/lib/career/starters";
import {
  CareerController,
  type CareerDraftTarget,
} from "@/stores/career/controller";
import type { CareerHead } from "@/stores/career/persistence";
import type {
  CareerDocument,
  CareerEntry,
  CareerResume,
  CareerSection,
  ResumeOutputTarget,
} from "@/types-and-constants/career";
import {
  SECTION_KINDS,
  VERIFIED_OUTPUT_LANGUAGES,
} from "@/types-and-constants/career";
import { appLayoutDefaults } from "@/types-and-constants/layout";
import { defaultSectionIcons } from "@/types-and-constants/section-icons";

function download(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob(
      [typeof value === "string" ? value : JSON.stringify(value, null, 2)],
      {
        type: "application/json;charset=utf-8",
      },
    ),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function DraftEditor({
  scope,
  values,
  language,
  document,
  onChange,
  disabled = false,
}: {
  disabled?: boolean;
  scope: string;
  values: unknown;
  language: string;
  document: CareerDocument;
  onChange: (values: unknown) => void;
}) {
  const [raw, setRaw] = useState<string | null>(null);
  const creation = scope.startsWith("starter-create/")
    ? starterCreationSchema.safeParse(values)
    : null;
  if (creation?.success)
    return (
      <FieldGroup>
        <p className="text-sm">
          Resume creation is pending. Save retries this same prepared creation;
          Cancel discards it. No entries or personal wording are copied.
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-2 text-sm">
          <dt>Resume</dt>
          <dd>{creation.data.resume.name || "Untitled resume"}</dd>
          <dt>Language</dt>
          <dd>{creation.data.resume.language}</dd>
          <dt>Paper</dt>
          <dd>{creation.data.resume.layout.paper.toUpperCase()}</dd>
        </dl>
        {creation.data.resume.selection.map((selection) => {
          const section =
            creation.data.sections.find(
              (item) => item.id === selection.sectionId,
            ) ??
            document.sections.find((item) => item.id === selection.sectionId);
          return (
            <p
              key={selection.sectionId}
              className="text-xs text-muted-foreground"
            >
              {section?.name || "Unavailable section"}:{" "}
              {creation.data.sections.some(
                (item) => item.id === selection.sectionId,
              )
                ? "Create empty section"
                : "Reuse Career section"}
            </p>
          );
        })}
        <p className="text-xs text-muted-foreground">
          If a mapped section changed, cancel this creation and review mappings
          again in Create resume. Export recovery remains available in Data
          &amp; backups.
        </p>
      </FieldGroup>
    );

  const resume = document.resumes.find(
    (item) => item.id === scope.split("/")[1],
  );
  if (
    resume &&
    scope.startsWith("resume-details/") &&
    values &&
    typeof values === "object" &&
    "name" in values &&
    typeof values.name === "string"
  )
    return (
      <ResumeIdentityFields
        values={values as { name: string; color?: CareerResume["color"] }}
        onChange={onChange}
      />
    );
  if (
    resume &&
    scope.startsWith("resume-content/") &&
    careerDocumentSchema.shape.resumes.element
      .pick({ selection: true, profileSelection: true, summaryIncluded: true })
      .safeParse(values).success
  )
    return (
      <ResumeContentEditor
        document={document}
        resume={resume}
        values={values as ResumeContent}
        onChange={onChange}
      />
    );
  if (
    (scope === "sections" || scope.startsWith("entries/")) &&
    Array.isArray(values) &&
    values.every((value) => typeof value === "string")
  ) {
    const ids = values as string[];
    const records =
      scope === "sections"
        ? document.sections
        : (document.sections.find(
            (section) => section.id === scope.split("/")[1],
          )?.entries ?? []);
    return (
      <CareerOrderEditor
        ids={ids}
        records={records}
        scope={scope}
        onChange={onChange}
      />
    );
  }

  const sanitized = (() => {
    try {
      return JSON.parse(JSON.stringify(values), (key, value) =>
        ["fact", "url"].includes(key) && typeof value === "string" ? "" : value,
      );
    } catch {
      return null;
    }
  })();
  const safe =
    scope.startsWith("entry/") || scope.startsWith("new-entry/")
      ? entrySchema.safeParse(sanitized).success
      : scope === "profile"
        ? careerDocumentSchema.shape.profile.safeParse(sanitized).success
        : scope === "summary"
          ? careerDocumentSchema.shape.summary.safeParse(sanitized).success
          : scope.startsWith("section/") || scope.startsWith("new-section/")
            ? sectionPropertiesSchema.safeParse(sanitized).success
            : scope === "languages"
              ? careerDocumentSchema.shape.languages.safeParse(sanitized)
                  .success
              : scope.startsWith("entries/")
                ? Array.isArray(sanitized) &&
                  sanitized.every(
                    (entry) => entrySchema.safeParse(entry).success,
                  )
                : scope === "sections"
                  ? Array.isArray(sanitized) &&
                    sanitized.every(
                      (section) =>
                        sectionPropertiesSchema.safeParse(section).success,
                    )
                  : scope.startsWith("selection/") &&
                    careerDocumentSchema.shape.resumes.element.shape.selection.safeParse(
                      sanitized,
                    ).success;
  if (!safe)
    return (
      <TextField
        label="Recovered values (JSON)"
        multiline
        value={raw ?? JSON.stringify(values, null, 2)}
        onChange={(value) => {
          setRaw(value);
          try {
            onChange(JSON.parse(value));
          } catch {}
        }}
      />
    );
  if (scope.startsWith("selection/")) {
    const selection = values as CareerDocument["resumes"][number]["selection"];
    return (
      <FieldGroup>
        <p>Existing resume selections. Removal remains a draft until Save.</p>
        {selection.flatMap((selected) => {
          const section = document.sections.find(
            (item) => item.id === selected.sectionId,
          );
          return selected.entryIds.map((id) => {
            const entry = section?.entries.find((item) => item.id === id);
            return (
              <div className="flex flex-wrap items-center gap-2" key={id}>
                <span>{entry?.name || "Untitled entry"}</span>
                {(entry?.archived || section?.archived) && (
                  <Badge>Archived</Badge>
                )}
                <Button
                  variant="outline"
                  onClick={() =>
                    onChange(
                      selection.map((item) =>
                        item.sectionId === selected.sectionId
                          ? {
                              ...item,
                              entryIds: item.entryIds.filter(
                                (value) => value !== id,
                              ),
                              achievementIds: item.achievementIds.filter(
                                (value) =>
                                  !entry?.achievements.some(
                                    (achievement) => achievement.id === value,
                                  ),
                              ),
                              fieldIds: item.fieldIds.filter(
                                (value) =>
                                  !entry?.fields.some(
                                    (field) => field.id === value,
                                  ),
                              ),
                              linkIds: item.linkIds.filter(
                                (value) =>
                                  !entry?.links.some(
                                    (link) => link.id === value,
                                  ),
                              ),
                            }
                          : item,
                      ),
                    )
                  }
                >
                  Remove from this resume
                </Button>
              </div>
            );
          });
        })}
      </FieldGroup>
    );
  }
  if (scope === "sections") {
    const sections = values as Omit<CareerSection, "entries">[];
    return (
      <FieldGroup>
        {sections.map((section, index) => (
          <div className="flex flex-wrap items-center gap-2" key={section.id}>
            <span>{section.name || section.kind}</span>
            <Button
              variant="outline"
              disabled={!index}
              onClick={() => {
                const next = [...sections];
                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                onChange(next);
              }}
            >
              Move section up
            </Button>
            <Button
              variant="outline"
              disabled={index === sections.length - 1}
              onClick={() => {
                const next = [...sections];
                [next[index + 1], next[index]] = [next[index], next[index + 1]];
                onChange(next);
              }}
            >
              Move section down
            </Button>
          </div>
        ))}
      </FieldGroup>
    );
  }
  if (
    (scope.startsWith("entry/") || scope.startsWith("new-entry/")) &&
    values &&
    typeof values === "object" &&
    "fields" in values &&
    Array.isArray(values.fields)
  )
    return (
      <EntryEditor
        disabled={disabled}
        entry={values as CareerEntry}
        kind={
          document.sections.find(
            (section) =>
              section.id === scope.split("/")[1] ||
              section.entries.some((entry) => entry.id === scope.split("/")[1]),
          )?.kind
        }
        language={language}
        onChange={onChange}
      />
    );
  if (scope === "profile") {
    const profile = values as CareerDocument["profile"];
    return (
      <FieldGroup>
        <FieldsEditor
          fields={profile.fields}
          profile
          language={language}
          onChange={(fields) => onChange({ ...profile, fields })}
        />
        <Separator />
        <LinksEditor
          links={profile.links}
          language={language}
          onChange={(links) => onChange({ ...profile, links })}
        />
      </FieldGroup>
    );
  }
  if (scope === "summary") {
    const summary = values as CareerDocument["summary"];
    return (
      <CareerRichField
        disabled={disabled}
        label="Summary"
        language={language}
        value={summary.wording[language] ?? ""}
        onChange={(value) =>
          onChange({
            ...summary,
            wording: { ...summary.wording, [language]: value },
          })
        }
      />
    );
  }
  if (scope.startsWith("section/") || scope.startsWith("new-section/")) {
    const section = values as Omit<CareerSection, "entries">;
    return (
      <FieldGroup>
        {section.kind === "custom" && (
          <CareerSectionIconPicker
            value={section.icon}
            onChange={(icon) => onChange({ ...section, icon })}
            disabled={disabled}
          />
        )}
        <Field orientation="horizontal">
          <Checkbox
            id="section-archived"
            checked={section.archived}
            onCheckedChange={(archived) => onChange({ ...section, archived })}
          />
          <FieldLabel htmlFor="section-archived">Archived</FieldLabel>
        </Field>
        <TextField
          label="Section internal name"
          value={section.name}
          onChange={(name) => onChange({ ...section, name })}
        />
        <TextField
          label="Section heading"
          value={section.heading[language] ?? ""}
          onChange={(value) =>
            onChange({
              ...section,
              heading: { ...section.heading, [language]: value },
            })
          }
        />
      </FieldGroup>
    );
  }
  if (scope === "languages")
    return (
      <LanguagesEditor
        values={values as CareerDocument["languages"]}
        onChange={onChange}
      />
    );
  if (scope.startsWith("entries/")) {
    const entries = values as CareerEntry[];
    return (
      <FieldGroup>
        <p>
          Order stays uncommitted until Save. Cancel restores the entire order.
        </p>
        {entries.map((entry, index) => (
          <div className="flex flex-wrap items-center gap-2" key={entry.id}>
            <span>{entry.name || "Untitled entry"}</span>
            {entry.archived && <Badge>Archived</Badge>}
            <Button
              variant="outline"
              disabled={!index}
              onClick={() => {
                const next = [...entries];
                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                onChange(next);
              }}
            >
              Move up
            </Button>
            <Button
              variant="outline"
              disabled={index === entries.length - 1}
              onClick={() => {
                const next = [...entries];
                [next[index + 1], next[index]] = [next[index], next[index + 1]];
                onChange(next);
              }}
            >
              Move down
            </Button>
          </div>
        ))}
      </FieldGroup>
    );
  }
  return (
    <TextField
      label="Recovered values (JSON)"
      multiline
      value={raw ?? JSON.stringify(values, null, 2)}
      onChange={(value) => {
        setRaw(value);
        try {
          onChange(JSON.parse(value));
        } catch {}
      }}
    />
  );
}

function LanguagesEditor({
  values,
  onChange,
}: {
  values: CareerDocument["languages"];
  onChange: (value: CareerDocument["languages"]) => void;
}) {
  const [tag, setTag] = useState("");
  const [error, setError] = useState("");
  return (
    <FieldGroup>
      <p>
        The interface is English. Activation controls creation choices, not
        wording retention or verified PDF support.
      </p>
      {values.map((item) => (
        <div className="flex flex-wrap items-center gap-2" key={item.tag}>
          <span>{item.tag}</span>
          <Badge variant="secondary">
            {item.active ? "Active" : "Inactive"}
          </Badge>
          <span>
            {(VERIFIED_OUTPUT_LANGUAGES as readonly string[]).includes(item.tag)
              ? "PDF output available"
              : "PDF unavailable · rendering unverified"}
          </span>
          <Button
            variant="outline"
            onClick={() =>
              onChange(
                values.map((language) =>
                  language.tag === item.tag
                    ? { ...language, active: !language.active }
                    : language,
                ),
              )
            }
          >
            {item.active ? "Deactivate" : "Reactivate"} {item.tag}
          </Button>
        </div>
      ))}
      <TextField
        label="Add content language (canonical tag)"
        value={tag}
        onChange={setTag}
      />
      <Button
        variant="outline"
        onClick={() => {
          try {
            const canonical = Intl.getCanonicalLocales(tag)[0];
            if (!canonical || values.some((item) => item.tag === canonical))
              throw new Error("Enter a new valid language tag.");
            onChange([...values, { tag: canonical, active: true }]);
            setTag("");
            setError("");
          } catch (error) {
            setError(String(error));
          }
        }}
      >
        Add language
      </Button>
      {error && <p role="alert">{error}</p>}
    </FieldGroup>
  );
}

export function CareerWorkspace({
  controller: supplied,
}: {
  controller?: CareerController;
}) {
  const [controller] = useState(() => supplied ?? new CareerController());
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const entryListRevision = useMemo(
    () => ({ head: state.head, orderDraft: state.orderDraft }),
    [state.head, state.orderDraft],
  );
  const [view, setView] = useState({
    index: 0,
    destination: "overview",
    background: "overview",
  });
  const panel = settingsPanel(view.destination);
  const destination = panel ? view.background : view.destination;
  const settingsDraft =
    state.draft?.scope === "languages" || state.draft?.scope === "defaults";
  const settingsReturnFocus = useRef<HTMLElement | null>(null);
  const [issueFocus, setIssueFocus] = useState<{
    fieldId: string;
    resumeId: string;
  } | null>(null);
  useEffect(() => {
    if (!issueFocus) return;
    const frame = requestAnimationFrame(() => {
      const card = window.document.getElementById(
        `resume-wording-${issueFocus.resumeId}-${issueFocus.fieldId}`,
      );
      card?.focus({ preventScroll: true });
      card?.scrollIntoView({ block: "center", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [issueFocus]);
  const [language, setLanguage] = useState("");
  const [kind, setKind] = useState<CareerSection["kind"]>("experience");
  const [guard, setGuard] = useState<{
    action: () => void;
    targets: CareerDraftTarget[];
  } | null>(null);
  const [review, setReview] = useState<{
    head: CareerHead;
    incoming?: CareerDocument;
    previous?: CareerHead;
  } | null>(null);
  const [localError, setLocalError] = useState("");
  const [sessionReview, setSessionReview] = useState<{
    head: CareerHead;
    previous?: CareerHead;
  } | null>(null);
  const [sessionExportChoice, setSessionExportChoice] = useState(false);
  const [sessionReviewError, setSessionReviewError] = useState("");
  const [compare, setCompare] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [addingResume, setAddingResume] = useState(false);
  const [libraryEditorRequest, setLibraryEditorRequest] = useState<
    object | null
  >(null);
  const [presetNotice, setPresetNotice] = useState<string | null>(null);
  const [exportChoice, setExportChoice] = useState(false);
  const [rawExport, setRawExport] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [importPending, setImportPending] = useState(false);
  const importJob = useRef<AbortController | null>(null);
  useEffect(() => () => importJob.current?.abort(), []);
  const route = useRef({
    index: 0,
    restoring: false,
    allowed: false,
    destination: "overview",
    background: "overview",
  });
  const workspaceViews = useRef(
    new Map<number, { scroll: number; focusId: string | undefined }>(),
  );
  const restoreWorkspace = useRef<{ index: number; history: boolean } | null>(
    null,
  );
  const rememberWorkspace = useCallback(() => {
    if (settingsPanel(route.current.destination)) return;
    const node = document.querySelector<HTMLElement>("[data-workspace-scroll]");
    const active = document.activeElement;
    workspaceViews.current.set(route.current.index, {
      scroll: node?.scrollTop ?? 0,
      focusId:
        active instanceof HTMLElement && node?.contains(active)
          ? active.id
          : undefined,
    });
  }, []);
  useEffect(() => {
    const pending = restoreWorkspace.current;
    if (!pending || panel || issueFocus) return;
    restoreWorkspace.current = null;
    const frame = requestAnimationFrame(() => {
      const remembered = pending.history
        ? workspaceViews.current.get(pending.index)
        : undefined;
      const node = document.querySelector<HTMLElement>(
        "[data-workspace-scroll]",
      );
      if (node) node.scrollTop = remembered?.scroll ?? 0;
      const target =
        (remembered?.focusId
          ? document.getElementById(remembered.focusId)
          : null) ??
        document.querySelector<HTMLElement>("[data-workspace-heading]");
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [view, panel, issueFocus]);
  const routeTargets = useCallback(
    (next: string) => {
      const current = route.current;
      const draft = controller.getSnapshot().draft;
      if (
        settingsPanel(current.destination) &&
        !settingsPanel(next) &&
        next === current.background &&
        !["languages", "defaults"].includes(draft?.scope ?? "")
      )
        return [];
      return controller.navigationTargets(next);
    },
    [controller],
  );

  const resolveTargets = useCallback(
    (targets: CareerDraftTarget[], action: () => void) => {
      if (controller.getSnapshot().saving) return;
      const dirty = targets.filter((target) => controller.isDirty(target));
      const clean = targets.filter((target) => !controller.isDirty(target));
      const proceed = () => {
        if (dirty.length) setGuard({ action, targets: dirty });
        else action();
      };
      if (clean.length)
        void (async () => {
          for (const target of clean) await controller.cancel(target);
          proceed();
        })().catch(() => {});
      else proceed();
    },
    [controller],
  );
  const resolveGuard = async (save: boolean) => {
    if (!guard || controller.getSnapshot().saving) return;
    const [target, ...remaining] = guard.targets;
    if (save) {
      if (!(await controller.save(false, target))) return;
    } else {
      try {
        await controller.cancel(target);
      } catch {
        return;
      }
    }
    if (controller.isDirty(target)) return;
    if (remaining.length) setGuard({ ...guard, targets: remaining });
    else {
      setGuard(null);
      guard.action();
    }
  };

  useEffect(() => {
    void controller.initialize();
    const focus = () => {
      void controller.refresh();
    };
    const visibility = () => {
      if (document.visibilityState === "hidden")
        void controller.flushRecovery();
      else focus();
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (
        controller.hasUnsavedChanges() ||
        controller.getSnapshot().sessionCommits > 0
      )
        event.preventDefault();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("beforeunload", beforeUnload);
      controller.dispose();
    };
  }, [controller]);

  useEffect(() => {
    if (!state.ready) return;
    const openDestination = (incoming: string, history = false) => {
      const next = parseDestination(incoming);
      const nextPanel = settingsPanel(next);
      const background = nextPanel
        ? parseDestination(window.history.state?.versoBackground ?? "overview")
        : next;
      route.current.destination = next;
      route.current.background =
        settingsPanel(background) || background === "unavailable"
          ? "overview"
          : background;
      if (!nextPanel)
        restoreWorkspace.current = { index: route.current.index, history };
      setView({
        index: route.current.index,
        destination: next,
        background: route.current.background,
      });
      setCompare(false);
      const editing = destinationScope(next);
      const head = controller.getSnapshot().head;
      if (
        editing &&
        head &&
        destinationExists(
          head.document,
          next,
          controller.getSnapshot().draft?.scope,
        )
      )
        controller.open(
          editing,
          editing.startsWith("entries/") ? "order" : "form",
        );
    };
    const initial =
      new URLSearchParams(window.location.search).get("scope") ?? "overview";
    route.current.index = Number.isSafeInteger(window.history.state?.versoIndex)
      ? window.history.state.versoIndex
      : 0;
    const initialUrl = new URL(window.location.href);
    if (initial !== "overview" || initialUrl.searchParams.has("scope"))
      initialUrl.searchParams.set("scope", parseDestination(initial));
    window.history.replaceState(
      { ...window.history.state, versoIndex: route.current.index },
      "",
      initialUrl,
    );
    openDestination(initial);
    const pop = (event: PopStateEvent) => {
      if (route.current.restoring) {
        route.current.restoring = false;
        return;
      }
      rememberWorkspace();
      const next =
        new URLSearchParams(window.location.search).get("scope") ?? "overview";
      const index = Number.isSafeInteger(event.state?.versoIndex)
        ? event.state.versoIndex
        : 0;
      const delta = index - route.current.index;
      const targets = routeTargets(parseDestination(next));
      if (
        targets.some((target) => controller.isDirty(target)) &&
        !route.current.allowed &&
        delta
      ) {
        route.current.restoring = true;
        window.history.go(-delta);
        resolveTargets(targets, () => {
          route.current.allowed = true;
          window.history.go(delta);
        });
      } else {
        route.current.allowed = false;
        resolveTargets(targets, () => {
          route.current.index = index;
          openDestination(next, true);
        });
      }
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [
    controller,
    state.ready,
    resolveTargets,
    routeTargets,
    rememberWorkspace,
  ]);

  const documentValue = state.head?.document;
  const activeResume = documentValue?.resumes.find(
    (item) =>
      item.id === destination.split("/")[1] &&
      /^(resume|resume-overview|resume-details|resume-content|resume-wording|resume-layout|selection)\//.test(
        destination,
      ),
  );
  const preview = useCommittedPreview({
    head: state.head,
    preferences: state.preferences,
    activeResumeId: activeResume?.id,
  });
  const contentLanguage =
    activeResume?.language ||
    language ||
    documentValue?.languages[0].tag ||
    "en-US";
  const navigate = (
    incoming: string,
    initialValues?: unknown,
    focusFieldId?: string,
    replace = false,
  ) => {
    const next = parseDestination(incoming);
    const focusIssue = () =>
      setIssueFocus(
        focusFieldId
          ? { fieldId: focusFieldId, resumeId: next.split("/")[1] }
          : null,
      );
    const perform = () => {
      rememberWorkspace();
      focusIssue();
      setPresetNotice(null);
      const nextPanel = settingsPanel(next);
      const current = route.current;
      const background = nextPanel
        ? settingsPanel(current.destination)
          ? current.background
          : destination
        : next;
      if (nextPanel && !settingsPanel(current.destination))
        settingsReturnFocus.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      if (current.destination !== next) {
        if (!replace) current.index++;
        const url = new URL(window.location.href);
        url.searchParams.set("scope", next);
        window.history[replace ? "replaceState" : "pushState"](
          {
            ...window.history.state,
            versoIndex: current.index,
            versoBackground: nextPanel ? background : undefined,
            versoSettingsStart: nextPanel
              ? settingsPanel(current.destination)
                ? window.history.state?.versoSettingsStart
                : current.index - (replace ? 0 : 1)
              : undefined,
          },
          "",
          url,
        );
      }
      current.destination = next;
      current.background = background;
      if (!nextPanel && !focusFieldId)
        restoreWorkspace.current = {
          index: current.index,
          history:
            settingsPanel(view.destination) !== null &&
            background === view.background,
        };
      setView({ index: current.index, destination: next, background });
      setCompare(false);
      const editing = destinationScope(next);
      const head = controller.getSnapshot().head;
      if (
        editing &&
        head &&
        destinationExists(
          head.document,
          next,
          initialValues !== undefined
            ? editing
            : controller.getSnapshot().draft?.scope,
        )
      )
        controller.open(
          editing,
          editing.startsWith("entries/") ? "order" : "form",
        );
      if (initialValues !== undefined)
        controller.change(
          initialValues,
          editing?.startsWith("entries/") ? "order" : "form",
        );
    };
    if (
      view.destination === next &&
      controller.getSnapshot().draft?.scope === next &&
      initialValues === undefined
    ) {
      focusIssue();
      return;
    }
    resolveTargets(routeTargets(next), perform);
  };
  const closeSettings = () => {
    const background = route.current.background;
    resolveTargets(routeTargets(background), () => {
      const start = window.history.state?.versoSettingsStart;
      if (
        Number.isSafeInteger(start) &&
        start >= 0 &&
        start < route.current.index
      ) {
        route.current.allowed = true;
        window.history.go(start - route.current.index);
      } else navigate(background, undefined, undefined, true);
    });
  };
  const openOutputIssue = (target: ResumeOutputTarget) =>
    navigate(target.destination, undefined, target.fieldId);
  const exportWorkspace = (head = state.head!) => {
    const content = JSON.stringify({
      format: "verso.workspace",
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      workspaceId: head.workspaceId,
      document: head.document,
    });
    if (new TextEncoder().encode(content).byteLength > 64 * 1024 * 1024)
      throw new Error(
        "Workspace backup exceeds the 64 MiB file limit including its envelope. No content was truncated or changed.",
      );
    download(content, "verso-workspace.json");
  };
  const exportRecovery = () => {
    const active = [state.draft, state.orderDraft].filter(
      (draft) => draft !== null,
    );
    const drafts = [
      ...state.recovery.filter(
        (item) => !active.some((draft) => draft.draftId === item.draftId),
      ),
      ...active.filter((draft) =>
        controller.isDirty(draft === state.orderDraft ? "order" : "form"),
      ),
    ];
    if (oversizedRecovery(drafts).length && !rawExport) {
      setRawExport(true);
      setLocalError(
        "A draft exceeds normal recovery limits. Keep this tab open. Choose Export raw recovery chunks to preserve its complete JSON; chunks require reassembly and are not a normal recovery import.",
      );
      return;
    }
    try {
      for (const file of recoveryFiles(drafts, state.head!.workspaceId))
        download(file.content, file.name);
      setRawExport(false);
    } catch (error) {
      setLocalError(String(error));
    }
  };

  const importFile = async (file: File | undefined, recovery: boolean) => {
    if (!file) return;
    importJob.current?.abort();
    const job = new AbortController();
    importJob.current = job;
    const progress = setTimeout(() => setImportPending(true), 500);
    try {
      if (file.size > (recovery ? 256 : 64) * 1024 * 1024)
        throw new Error("Import exceeds its byte limit.");
      const envelope = await importPortable(
        file,
        recovery ? "recovery" : "workspace",
        job.signal,
      );
      if (job.signal.aborted) return;
      if (envelope.format === "verso.recovery")
        await controller.importRecovery(envelope.drafts);
      else {
        resolveTargets(controller.navigationTargets(), () => {
          void controller
            .previous()
            .then((previous) => {
              setReview({
                head: controller.getSnapshot().head!,
                incoming: envelope.document,
                previous,
              });
              setExportChoice(false);
            })
            .catch((error) => setLocalError(String(error)));
        });
      }
      setLocalError("");
    } catch (error) {
      if (!job.signal.aborted) setLocalError(String(error));
    } finally {
      clearTimeout(progress);
      if (importJob.current === job) setImportPending(false);
    }
  };
  const loadSample = async () => {
    setLoadingSample(true);
    setLocalError("");
    try {
      const response = await fetch("/examples/alex-morgan.schema-2.json");
      if (!response.ok)
        throw new Error(
          "Sample workspace could not be loaded. Please try again.",
        );
      await importFile(
        new File([await response.blob()], "alex-morgan.schema-2.json", {
          type: "application/json",
        }),
        false,
      );
    } catch (error) {
      setLocalError(String(error));
    } finally {
      setLoadingSample(false);
    }
  };
  if (!state.ready || !documentValue)
    return (
      <main className="p-6">
        <h1>Verso</h1>
        <p role="status">Opening saved workspace…</p>
      </main>
    );
  const selectedSection = documentValue.sections.find(
    (section) => `list/${section.id}` === destination,
  );

  const scope =
    destination === "backups" ? "backups" : (state.draft?.scope ?? destination);
  const libraryKind = libraryDestinationKind(destination);
  const libraryDestination = libraryKind !== null;
  const scopeId = scope.split("/")[1];
  const entrySection = libraryDestination
    ? undefined
    : documentValue.sections.find((section) =>
        section.entries.some((entry) => entry.id === scopeId),
      );
  const contextSection = libraryDestination
    ? undefined
    : (selectedSection ??
      entrySection ??
      documentValue.sections.find((section) => section.id === scopeId));
  const orderDraft = state.orderDraft;
  const listSection =
    selectedSection ??
    entrySection ??
    (scope.startsWith("entries/") ? contextSection : undefined);
  const validOrderDraft =
    orderDraft?.scope === `entries/${listSection?.id}` &&
    Array.isArray(orderDraft.values) &&
    orderDraft.values.every((id) => typeof id === "string")
      ? orderDraft
      : null;
  const beforeEntryReorder = () => !controller.getSnapshot().saving;
  const missingDestination = !destinationExists(
    documentValue,
    destination,
    state.draft?.values !== null ? state.draft?.scope : undefined,
  );
  const title =
    destination === "library"
      ? "Library"
      : destination === "presets"
        ? "Layout presets"
        : destination === "starters"
          ? "Resume starters"
          : destination.startsWith("preset/")
            ? "Layout preset"
            : destination.startsWith("starter/")
              ? "Resume starter"
              : destination === "resumes"
                ? "Resumes"
                : destination === "resume-compare"
                  ? "Compare resumes"
                  : activeResume
                    ? activeResume.name || "Untitled resume"
                    : scope === "profile"
                      ? "Profile"
                      : scope === "summary"
                        ? "Summary"
                        : scope === "languages"
                          ? "Content languages"
                          : scope === "backups"
                            ? "Backups & settings"
                            : scope === "sections"
                              ? "Section order"
                              : scope.startsWith("selection/")
                                ? "Resume content & order"
                                : contextSection
                                  ? contextSection.name || contextSection.kind
                                  : "Career details · Overview";
  const iconKind =
    scope === "profile"
      ? "profile"
      : scope === "summary"
        ? "summary"
        : contextSection?.kind;
  const propertiesDraft =
    scope.startsWith("section/") || scope.startsWith("new-section/")
      ? sectionPropertiesSchema.safeParse(state.draft?.values)
      : null;
  const formIconKind = propertiesDraft?.success
    ? propertiesDraft.data.kind
    : iconKind;
  const formIcon = propertiesDraft?.success
    ? propertiesDraft.data.icon
    : contextSection?.icon;
  const formTitle = scope.startsWith("resume-layout/")
    ? "Resume layout"
    : scope.startsWith("preset/")
      ? "Layout preset"
      : scope.startsWith("starter/")
        ? "Resume starter"
        : scope.startsWith("starter-create/")
          ? "Create resume from starter"
          : scope.startsWith("resume-content/")
            ? "Resume content & order"
            : scope.startsWith("resume-wording/")
              ? "Resume wording"
              : scope === "profile"
                ? "Your profile"
                : scope === "summary"
                  ? "Summary"
                  : scope.startsWith("entry/")
                    ? "Entry details"
                    : scope.startsWith("entries/") || scope === "sections"
                      ? "Order"
                      : scope.startsWith("section/") ||
                          scope.startsWith("new-section/")
                        ? "Section details"
                        : title;

  const capturePreset = () =>
    resolveTargets(controller.navigationTargets(), () => {
      const current = controller
        .getSnapshot()
        .head?.document.resumes.find((item) => item.id === activeResume?.id);
      if (!current) return;
      const item = {
        id: crypto.randomUUID(),
        name: `${current.name || "Untitled resume"} appearance`.slice(0, 500),
        template: current.template,
        layout: layoutAppearance(current.layout),
      };
      navigate(`preset/${item.id}`, item);
    });

  /** Resolve drafts and load copied appearance into an uncommitted Layout scope.
   * @param presetId Saved appearance to recheck after resolving drafts.
   * @param resumeId Explicitly selected target resume to recheck before navigation.
   * @param complete Called after loading, or with an error if either record is unavailable; canceled navigation does not call it.
   * @returns Nothing; loading changes only the recoverable draft, never committed content or history.
   * @example loadLibraryPreset(preset.id, resume.id, error => setLocalError(error ?? ""))
   */
  const loadLibraryPreset = (
    presetId: string,
    resumeId: string,
    complete: (error?: string) => void,
  ): void => {
    resolveTargets(controller.navigationTargets(), () => {
      const document = controller.getSnapshot().head?.document;
      const preset = document?.presets.find((item) => item.id === presetId);
      const resume = document?.resumes.find((item) => item.id === resumeId);
      if (!preset || !resume) {
        complete(
          "The preset or resume is unavailable. Choose an available record and try again.",
        );
        return;
      }
      const next = `resume-layout/${resume.id}`;
      const changed = !sameLayout(
        layoutFromPreset(preset.layout),
        resume.layout,
      );
      navigate(next, changed ? layoutFromPreset(preset.layout) : undefined);
      setPresetNotice(changed ? next : null);
      setLibraryEditorRequest({});
      complete();
    });
  };
  const libraryCommand = async (
    scope: string,
    values: unknown,
    reviewed: unknown,
  ): Promise<boolean> => {
    for (const target of controller.navigationTargets()) {
      if (controller.isDirty(target)) return false;
      await controller.cancel(target);
    }
    const saved = await controller.command(scope, values, reviewed);
    if (saved) navigate(scope.startsWith("preset/") ? "presets" : "starters");
    else navigate(scope);
    return saved;
  };
  const backupPanel = (
    <section className="flex flex-col gap-4">
      <p>
        Workspace exports contain saved workspace only. Recovery is separate and
        never committed by import. Device preferences are excluded. Browser
        clearing or eviction can remove local data.
      </p>
      {state.recovery.some(
        (draft) =>
          draft.draftId !== state.draft?.draftId &&
          draft.draftId !== state.orderDraft?.draftId,
      ) && (
        <section
          className="flex flex-col gap-3"
          aria-label="Unresolved recovery"
        >
          <h2>Unsaved draft recovery</h2>
          {state.recovery
            .filter(
              (draft) =>
                draft.draftId !== state.draft?.draftId &&
                draft.draftId !== state.orderDraft?.draftId,
            )
            .map((draft) => (
              <div
                key={draft.draftId}
                className="flex flex-wrap items-center gap-2"
              >
                <span>
                  {draft.scope.startsWith("entries/")
                    ? `${documentValue.sections.find((section) => section.id === draft.scope.split("/")[1])?.name || "Section"} entry order`
                    : draft.scope.startsWith("entry/")
                      ? (() => {
                          const entry = documentValue.sections
                            .flatMap((section) => section.entries)
                            .find(
                              (entry) => entry.id === draft.scope.split("/")[1],
                            );
                          return entry
                            ? careerEntryLabel(entry, contentLanguage)
                            : "Unavailable entry";
                        })()
                      : draft.scope.startsWith("resume") ||
                          draft.scope.startsWith("selection/")
                        ? `${documentValue.resumes.find((resume) => resume.id === draft.scope.split("/")[1])?.name || "Unavailable resume"} · ${draft.scope.startsWith("resume-wording/") ? "Wording" : draft.scope.startsWith("resume-details/") ? "Name & color" : draft.scope.startsWith("resume-layout/") ? "Layout" : "Content"}`
                        : draft.scope.startsWith("preset/") ||
                            draft.scope.startsWith("starter/")
                          ? `${draft.scope.startsWith("preset/") ? "Layout preset" : "Resume starter"} / ${draft.values && typeof draft.values === "object" && "name" in draft.values && typeof draft.values.name === "string" ? draft.values.name : "Unsaved setup"}`
                          : draft.scope.startsWith("starter-create/")
                            ? "Resume creation from starter"
                            : ({
                                profile: "Profile",
                                summary: "Summary",
                                languages: "Content languages",
                                defaults: "Resume defaults",
                                sections: "Section order",
                              }[draft.scope] ?? "Unsaved form")}
                </span>
                <Button
                  variant="outline"
                  onClick={() => {
                    const restore = () => {
                      controller.restore(draft);
                      const activeForm = controller.getSnapshot().draft;
                      navigate(
                        draft.scope.startsWith("entries/") && activeForm
                          ? activeForm.scope
                          : draft.scope,
                      );
                    };
                    const target: CareerDraftTarget = draft.scope.startsWith(
                      "entries/",
                    )
                      ? "order"
                      : "form";
                    const activeForm = controller.getSnapshot().draft;
                    const relatedSection = documentValue.sections.find(
                      (section) =>
                        section.entries.some(
                          (entry) => activeForm?.scope === `entry/${entry.id}`,
                        ),
                    );
                    const targets =
                      draft.scope === `entries/${relatedSection?.id}`
                        ? [target]
                        : [
                            ...new Set([
                              ...controller.navigationTargets(draft.scope),
                              target,
                            ]),
                          ];
                    resolveTargets(targets, restore);
                  }}
                >
                  Restore draft
                </Button>
              </div>
            ))}
        </section>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            try {
              exportWorkspace();
            } catch (error) {
              setLocalError(String(error));
            }
          }}
        >
          Export workspace · saved workspace only
        </Button>
        <Button variant="outline" onClick={exportRecovery}>
          Export recovery
        </Button>
        <Button
          variant="outline"
          disabled={!state.durable}
          onClick={() =>
            resolveTargets(controller.navigationTargets(), () => {
              void controller
                .previous()
                .then((previous) => {
                  if (!previous)
                    setLocalError("No previous workspace is retained.");
                  else {
                    setReview({
                      head: controller.getSnapshot().head!,
                      previous,
                    });
                    setExportChoice(false);
                  }
                })
                .catch((error) => setLocalError(String(error)));
            })
          }
        >
          Review one previous workspace
        </Button>
      </div>
      <p>
        Explore fictional career details and English/Portuguese resumes. Loading
        the sample opens a replacement review before changing saved content.
      </p>
      <Button
        variant="outline"
        className="self-start"
        disabled={loadingSample || state.saving || !state.durable}
        onClick={() => void loadSample()}
      >
        {loadingSample ? "Loading sample…" : "Load sample workspace"}
      </Button>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="workspace-import">
            Import schema-2 workspace for review
          </FieldLabel>
          <Input
            id="workspace-import"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              void importFile(event.target.files?.[0], false);
              event.target.value = "";
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="recovery-import">
            Import recovery as uncommitted drafts
          </FieldLabel>
          <Input
            id="recovery-import"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              void importFile(event.target.files?.[0], true);
              event.target.value = "";
            }}
          />
        </Field>
      </FieldGroup>
    </section>
  );
  const settingsForm =
    state.draft && settingsDraft ? (
      <div className="flex flex-col gap-4">
        <fieldset disabled={state.saving} className="flex flex-col gap-4">
          {state.draft.scope === "defaults" ? (
            <>
              <p>
                New blank resumes copy these appearance settings. Existing
                resumes, presets, and starters keep independent copies.
              </p>
              <LayoutFields
                values={state.draft.values}
                defaults={appLayoutDefaults}
                onChange={(values) => controller.change(values)}
              />
            </>
          ) : (
            <DraftEditor
              document={documentValue}
              scope="languages"
              values={state.draft.values}
              language={contentLanguage}
              onChange={(values) => controller.change(values)}
            />
          )}
        </fieldset>
        <p role="status">
          {controller.isDirty() ? state.recoveryStatus : "No unsaved changes"}
        </p>
        {state.error && <p role="alert">{state.error}</p>}
        {compare && (
          <ScopeComparison
            current={readScope(documentValue, state.draft.scope)}
            draft={state.draft.values}
          />
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setCompare((value) => !value)}
          >
            Compare
          </Button>
          <Button
            variant="outline"
            disabled={state.saving}
            onClick={() => controller.reconcile()}
          >
            Reconcile
          </Button>
          <Button variant="outline" onClick={exportRecovery}>
            Export recovery
          </Button>
          <Button
            variant="outline"
            disabled={!controller.isDirty() || state.saving}
            onClick={() => {
              const savedScope = state.draft!.scope;
              void controller
                .cancel()
                .then(() => controller.open(savedScope))
                .catch(() => {});
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={!controller.isDirty() || state.saving}
            onClick={() => {
              const savedScope = state.draft!.scope;
              void controller.save().then((saved) => {
                if (saved) controller.open(savedScope);
              });
            }}
          >
            Save
          </Button>
        </div>
      </div>
    ) : null;
  return (
    <div
      onKeyDown={(event) => {
        if (
          (event.ctrlKey || event.metaKey) &&
          ["z", "y"].includes(event.key.toLowerCase())
        ) {
          if (
            event.target instanceof HTMLElement &&
            (event.target.isContentEditable ||
              /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))
          )
            return;
          if (state.draft || state.orderDraft) {
            event.stopPropagation();
            return;
          }
          event.preventDefault();
          void controller.history(
            event.key.toLowerCase() === "y" || event.shiftKey ? "redo" : "undo",
          );
        }
      }}
    >
      <SettingsDialog
        panel={panel}
        historyKey={view.index}
        navigate={navigate}
        close={closeSettings}
        returnFocus={settingsReturnFocus}
        workspaceSettings={["languages", "defaults", "data"].includes(
          panel ?? "",
        )}
        preferenceStatus={state.preferenceStatus}
        retryPreferences={() => void controller.changePreferences()}
      >
        {panel === "editing-preview" ? (
          <DeviceSettings
            values={state.preferences}
            change={(patch) => void controller.changePreferences(patch)}
          />
        ) : panel === "data" ? (
          <>
            {(state.draft || state.orderDraft) && (
              <Button
                variant="outline"
                className="self-start"
                onClick={() =>
                  navigate(
                    settingsDraft
                      ? `settings/${state.draft?.scope}`
                      : view.background,
                  )
                }
              >
                Back to editing
              </Button>
            )}
            {(state.error || state.orderError || localError) && (
              <Alert variant="destructive">
                <AlertTitle>Action needs attention</AlertTitle>
                <AlertDescription className="whitespace-pre-wrap">
                  {[state.error, state.orderError, localError]
                    .filter(Boolean)
                    .join("\n")}
                </AlertDescription>
              </Alert>
            )}
            {importPending && (
              <p role="status">
                Validating import... Your saved workspace is unchanged.
              </p>
            )}
            {rawExport && (
              <Button variant="outline" onClick={exportRecovery}>
                Export raw recovery chunks
              </Button>
            )}
            {backupPanel}
          </>
        ) : ["languages", "defaults"].includes(panel ?? "") ? (
          settingsForm
        ) : null}
      </SettingsDialog>

      <ResumeManager
        document={documentValue}
        saveStarter={(resume) =>
          resolveTargets(controller.navigationTargets(), () => {
            const current = controller
              .getSnapshot()
              .head?.document.resumes.find((item) => item.id === resume.id);
            if (current) {
              const starter = captureStarter(
                controller.getSnapshot().head!.document,
                current,
              );
              navigate(`starter/${starter.id}`, starter);
            }
          })
        }
        createStarter={() => {
          const document = controller.getSnapshot().head!.document;
          if (document.starters.length >= 100) return;
          const id = crypto.randomUUID();
          navigate(`starter/${id}`, {
            id,
            name: "",
            template: "yabuki-reference@1.0.3",
            layout: structuredClone(document.defaults),
            sections: [],
            summaryIncluded: false,
          });
        }}
        getDocument={() => controller.getSnapshot().head!.document}
        getResume={(id) =>
          controller
            .getSnapshot()
            .head?.document.resumes.find((resume) => resume.id === id)
        }
        navigate={navigate}
        createRequested={addingResume}
        onCreateHandled={() => setAddingResume(false)}
        guard={(action) =>
          resolveTargets(controller.navigationTargets(), action)
        }
        commit={async (scope, values, after, reviewed) => {
          // Collection navigation already resolved mounted drafts. Each command opens a recoverable immutable Save scope.
          if (
            controller
              .navigationTargets()
              .some((target) => controller.isDirty(target))
          )
            return false;
          for (const target of controller.navigationTargets())
            await controller.cancel(target);
          const saved = await controller.command(scope, values, reviewed);
          if (saved) navigate(after);
          else {
            setLocalError(controller.getSnapshot().error);
            navigate(scope);
          }
          return saved;
        }}
      >
        {(resumeActions) => (
          <CareerWorkspaceShell
            document={documentValue}
            resumeActions={resumeActions}
            destination={destination}
            editorRequest={issueFocus ?? libraryEditorRequest}
            libraryItemState={
              state.draft?.values && typeof state.draft.values === "object"
                ? "new"
                : "missing"
            }
            navigate={navigate}
            addSection={() =>
              resolveTargets(controller.navigationTargets(), () => {
                navigate("overview");
                setAddingSection(true);
              })
            }
            addResume={() =>
              resolveTargets(controller.navigationTargets(), () => {
                navigate("resumes");
                setAddingResume(true);
              })
            }
            language={contentLanguage}
            setLanguage={setLanguage}
            status={state.status}
            history={{
              canUndo: Boolean(state.undoCount) && !state.saving,
              canRedo: Boolean(state.redoCount) && !state.saving,
              undo: () =>
                state.draft || state.orderDraft
                  ? resolveTargets(controller.navigationTargets(), () => {})
                  : void controller.history("undo"),
              redo: () =>
                state.draft || state.orderDraft
                  ? resolveTargets(controller.navigationTargets(), () => {})
                  : void controller.history("redo"),
            }}
            output={(visible) => (
              <CommittedOutputView
                preview={preview}
                visible={visible}
                showSelector={!activeResume}
                onIssue={openOutputIssue}
              />
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 basis-48">
                <div className="flex items-center gap-2 [&>svg]:size-8 [&>svg]:shrink-0">
                  {activeResume ? (
                    <FileText
                      aria-hidden="true"
                      className="resume-color text-(--resume-color)"
                      data-resume-color={activeResume.color ?? "indigo"}
                    />
                  ) : libraryKind === "preset" ? (
                    <Palette aria-hidden="true" />
                  ) : libraryKind === "starter" ? (
                    <FileText aria-hidden="true" />
                  ) : iconKind ? (
                    <CareerSectionIcon
                      kind={iconKind}
                      icon={contextSection?.icon}
                    />
                  ) : null}
                  <h1 tabIndex={-1} data-workspace-heading>
                    {title}
                  </h1>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activeResume
                    ? `This resume · ${contentLanguage}`
                    : destination === "resumes" ||
                        destination === "resume-compare"
                      ? "Resumes · Independent content and wording"
                      : libraryDestination
                        ? "Library - Reusable configurations"
                        : destination === "backups"
                          ? "Workspace"
                          : "Career details · Shared content"}
                </p>
              </div>
              {activeResume && (
                <ResumeActionsMenu
                  document={documentValue}
                  resume={activeResume}
                  actions={resumeActions}
                />
              )}
              {(destination === "presets" || destination === "starters") && (
                <Button
                  disabled={
                    state.saving || documentValue[destination].length >= 100
                  }
                  onClick={() => {
                    const kind =
                      destination === "presets" ? "preset" : "starter";
                    const base = {
                      id: crypto.randomUUID(),
                      name: "",
                      template: "yabuki-reference@1.0.3",
                      layout: structuredClone(documentValue.defaults),
                    };
                    navigate(
                      `${kind}/${base.id}`,
                      kind === "starter"
                        ? { ...base, sections: [], summaryIncluded: false }
                        : base,
                    );
                  }}
                >
                  <Plus data-icon="inline-start" />
                  Create {destination === "presets" ? "preset" : "starter"}
                </Button>
              )}
              {destination === "overview" && !state.draft && (
                <Button
                  disabled={documentValue.sections.length >= 100}
                  onClick={() => setAddingSection(true)}
                >
                  <Plus data-icon="inline-start" />
                  Add section
                </Button>
              )}
              {(contextSection ||
                (destination === "overview" && !state.draft)) && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={
                          contextSection
                            ? "Section actions"
                            : "Overview actions"
                        }
                      />
                    }
                  >
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        onClick={() =>
                          navigate(
                            contextSection
                              ? `section/${contextSection.id}`
                              : "sections",
                          )
                        }
                      >
                        <Pencil />
                        {contextSection
                          ? "Edit section properties"
                          : "Edit section order"}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {!activeResume &&
              !libraryDestination &&
              (state.draft ||
                (destination === "backups" && state.orderDraft)) && (
                <Button
                  variant="ghost"
                  className="self-start"
                  onClick={() =>
                    navigate(
                      destination === "backups"
                        ? (state.draft?.scope ??
                            state.orderDraft?.scope ??
                            "overview")
                        : contextSection
                          ? `list/${contextSection.id}`
                          : "overview",
                    )
                  }
                >
                  <ArrowLeft data-icon="inline-start" />
                  {destination === "backups"
                    ? "Back to editing"
                    : contextSection
                      ? `Back to ${contextSection.name || contextSection.kind}`
                      : "Back to Career details"}
                </Button>
              )}
            {rawExport && (
              <Button variant="outline" onClick={exportRecovery}>
                Export raw recovery chunks
              </Button>
            )}
            {importPending && (
              <p role="status">
                Validating import… Your saved workspace is unchanged.
              </p>
            )}
            {(state.storageMode === "session" || state.sessionCommits > 0) && (
              <Alert>
                <AlertTitle>Saving in this tab only</AlertTitle>
                <AlertDescription className="flex flex-col items-start gap-2">
                  <span>
                    {state.sessionCommits === 1
                      ? "1 Save exists"
                      : `${state.sessionCommits} Saves exist`}{" "}
                    only in this tab. Browser storage is unchanged; closing this
                    tab loses them unless you export or keep them.
                  </span>
                  {state.storageMode === "unavailable" ? (
                    <span>
                      Browser storage could not be opened. Export this
                      tab&apos;s saved workspace from Data &amp; backups before
                      closing.
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={state.saving}
                      onClick={() => {
                        if (state.draft || state.orderDraft) {
                          setLocalError(
                            "Resolve pending forms with Cancel, Discard, or Save before returning to durable saving.",
                          );
                          return;
                        }
                        setLocalError("");
                        void Promise.all([
                          controller.durableHead(),
                          controller.previous(),
                        ])
                          .then(([head, previous]) => {
                            setSessionExportChoice(false);
                            setSessionReviewError("");
                            setSessionReview(head ? { head, previous } : null);
                          })
                          .catch((error) => setLocalError(String(error)));
                      }}
                    >
                      Return to durable saving
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <Dialog
              open={Boolean(sessionReview)}
              onOpenChange={(open) => {
                if (!open) setSessionReview(null);
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Return to durable saving</DialogTitle>
                  <DialogDescription>
                    Choose which saved workspace continues. The browser&apos;s
                    durable workspace is at revision{" "}
                    {sessionReview?.head.revision} (generation{" "}
                    {sessionReview?.head.generation}). This tab has{" "}
                    {state.sessionCommits} tab-only{" "}
                    {state.sessionCommits === 1 ? "Save" : "Saves"}. Replacing
                    keeps the durable workspace as the one previous workspace.
                    Unresolved recovery is kept either way.
                    {sessionReview?.previous
                      ? ` Keeping this tab replaces the retained snapshot at revision ${sessionReview.previous.revision} (generation ${sessionReview.previous.generation}).`
                      : " No previous snapshot is currently retained."}
                  </DialogDescription>
                </DialogHeader>
                {sessionReviewError && (
                  <Alert variant="destructive">
                    <AlertTitle>Action needs attention</AlertTitle>
                    <AlertDescription>{sessionReviewError}</AlertDescription>
                  </Alert>
                )}
                {sessionReview?.previous && !sessionExportChoice && (
                  <Button
                    variant="outline"
                    className="h-auto whitespace-normal"
                    onClick={() => {
                      try {
                        exportWorkspace(sessionReview.previous);
                        setSessionExportChoice(true);
                        setSessionReviewError("");
                      } catch (error) {
                        setSessionReviewError(
                          `Export failed. Retry or explicitly continue without export. ${String(error)}`,
                        );
                      }
                    }}
                  >
                    Export snapshot being replaced (download initiated)
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setSessionExportChoice(true);
                    setSessionReviewError("");
                  }}
                >
                  Continue without exporting snapshot
                </Button>
                <DialogFooter className="flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => setSessionReview(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      try {
                        exportWorkspace();
                      } catch (error) {
                        setSessionReviewError(String(error));
                      }
                    }}
                  >
                    Export this tab&apos;s workspace
                  </Button>
                  <Button
                    variant="outline"
                    disabled={state.saving}
                    onClick={() => {
                      if (!sessionReview) return;
                      void controller
                        .leaveSessionMode("keep-durable", sessionReview.head)
                        .then((done) => {
                          if (done) setSessionReview(null);
                          else
                            setSessionReviewError(
                              controller.getSnapshot().error,
                            );
                        });
                    }}
                  >
                    Discard tab-only Saves
                  </Button>
                  <Button
                    disabled={state.saving || !sessionExportChoice}
                    onClick={() => {
                      if (!sessionReview) return;
                      void controller
                        .leaveSessionMode("replace-durable", sessionReview.head)
                        .then((done) => {
                          if (done) setSessionReview(null);
                          else
                            setSessionReviewError(
                              controller.getSnapshot().error,
                            );
                        });
                    }}
                  >
                    Keep this tab&apos;s workspace
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {state.historyBoundary && (
              <p>
                Oldest history steps are unavailable (100 steps / 32 MiB). Undo
                is not a backup.
              </p>
            )}
            {(state.error || state.orderError || localError) && (
              <Alert variant="destructive">
                <AlertTitle>Action needs attention</AlertTitle>
                <AlertDescription className="whitespace-pre-wrap">
                  {[state.error, state.orderError, localError]
                    .filter(Boolean)
                    .join("\n")}
                </AlertDescription>
              </Alert>
            )}
            {listSection && (
              <CareerEntryList
                key={listSection.id}
                section={listSection}
                language={contentLanguage}
                selectedId={scope.startsWith("entry/") ? scopeId : undefined}
                ids={
                  validOrderDraft
                    ? (validOrderDraft.values as string[])
                    : listSection.entries.map((entry) => entry.id)
                }
                revision={entryListRevision}
                dirty={Boolean(orderDraft) && controller.isDirty("order")}
                saving={state.saving}
                showFooter={true}
                recoveryStatus={state.orderRecoveryStatus}
                onBeforeReorder={beforeEntryReorder}
                onReorder={(ids) => {
                  controller.open(`entries/${listSection.id}`, "order");
                  controller.change(ids, "order");
                  if (
                    !controller.getSnapshot().draft &&
                    destination === `list/${listSection.id}`
                  )
                    navigate(`entries/${listSection.id}`);
                }}
                onSave={() => void controller.save(false, "order")}
                onCancel={() => void controller.cancel("order").catch(() => {})}
                onOpen={(entry) => navigate(`entry/${entry.id}`)}
                onCreate={() => {
                  const entry = createEntry(listSection.kind);
                  navigate(`new-entry/${listSection.id}/${entry.id}`, entry);
                }}
                onDuplicate={(entry) => {
                  const copy = duplicateEntry(entry);
                  navigate(`new-entry/${listSection.id}/${copy.id}`, copy);
                }}
                onArchive={(entry) => {
                  const action = () => {
                    const current = controller
                      .getSnapshot()
                      .head?.document.sections.flatMap(
                        (section) => section.entries,
                      )
                      .find((candidate) => candidate.id === entry.id);
                    if (current)
                      void controller.command(`entry/${current.id}`, {
                        ...current,
                        archived: !current.archived,
                      });
                  };
                  resolveTargets(controller.navigationTargets(), action);
                }}
              />
            )}
            <ResumeViewTabs
              resume={activeResume}
              destination={destination}
              saving={state.saving}
              navigate={navigate}
            >
              {destination === "library" ? (
                <LibraryOverview navigate={navigate} />
              ) : destination === "presets" || destination === "starters" ? (
                <SetupLibrary
                  kind={destination === "presets" ? "preset" : "starter"}
                  document={documentValue}
                  navigate={navigate}
                  disabled={state.saving}
                  commit={libraryCommand}
                  createResume={resumeActions.create}
                  onUsePreset={loadLibraryPreset}
                />
              ) : destination === "resumes" ? (
                <>
                  <CareerResumeCollection
                    document={documentValue}
                    navigate={navigate}
                    actions={resumeActions}
                  />
                </>
              ) : destination.startsWith("resume-overview/") && activeResume ? (
                <ResumeOverview
                  document={documentValue}
                  resume={activeResume}
                />
              ) : destination === "resume-compare" ? (
                <ResumeComparison document={documentValue} />
              ) : missingDestination ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Record unavailable</CardTitle>
                    <CardDescription>
                      This record is missing or was never saved. Any recoverable
                      draft remains in Data & backups.
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => navigate("overview")}
                    >
                      Career details
                    </Button>
                    <Button onClick={() => navigate("backups")}>
                      Data & backups
                    </Button>
                  </CardFooter>
                </Card>
              ) : state.draft &&
                activeResume &&
                scope.startsWith("resume-details/") &&
                careerDocumentSchema.shape.resumes.element
                  .pick({ name: true, color: true })
                  .safeParse(state.draft.values).success ? (
                <Card>
                  <CardHeader>
                    <CardTitle size="section">Edit name &amp; color</CardTitle>
                    <CardDescription>
                      Identify this resume in your workspace. Its language and
                      PDF appearance stay independent.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <fieldset disabled={state.saving}>
                      <ResumeIdentityFields
                        values={
                          state.draft.values as {
                            name: string;
                            color?: CareerResume["color"];
                          }
                        }
                        onChange={(values) => controller.change(values)}
                      />
                    </fieldset>
                  </CardContent>
                  <CardFooter className="justify-end gap-2">
                    <Button
                      variant="outline"
                      disabled={!controller.isDirty() || state.saving}
                      onClick={() =>
                        void controller
                          .cancel()
                          .then(() =>
                            navigate(`resume-overview/${activeResume.id}`),
                          )
                      }
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={!controller.isDirty() || state.saving}
                      onClick={() =>
                        void controller.save().then((saved) => {
                          if (saved)
                            navigate(`resume-overview/${activeResume.id}`);
                        })
                      }
                    >
                      Save
                    </Button>
                  </CardFooter>
                </Card>
              ) : state.draft && !settingsDraft && destination !== "backups" ? (
                <section
                  className="flex flex-col gap-4"
                  aria-label="Editing form"
                  onClickCapture={(event) => {
                    if (
                      event.target instanceof HTMLElement &&
                      event.target.closest("button")?.textContent?.trim() ===
                        "Save"
                    )
                      event.currentTarget
                        .querySelector<HTMLElement>('[aria-invalid="true"]')
                        ?.focus();
                  }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle
                        size="section"
                        className="flex flex-wrap items-center gap-2"
                      >
                        {formIconKind && (
                          <CareerSectionIcon
                            kind={formIconKind}
                            icon={formIcon}
                          />
                        )}
                        {formTitle}
                      </CardTitle>
                      <CardDescription>
                        {activeResume
                          ? `Editing this resume only · ${activeResume.language}`
                          : libraryDestination
                            ? "Reusable configuration only. Existing resumes keep independent copies."
                            : scope === "profile"
                              ? "Shared contact details"
                              : "Shared text and facts. Individual resumes can use customized wording."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-5">
                      <fieldset
                        disabled={state.saving}
                        className="flex flex-col gap-4"
                      >
                        {scope.startsWith("preset/") ||
                        scope.startsWith("starter/") ? (
                          <SetupEditor
                            kind={
                              scope.startsWith("preset/") ? "preset" : "starter"
                            }
                            values={state.draft.values}
                            onChange={(values) => controller.change(values)}
                          />
                        ) : activeResume &&
                          scope.startsWith("resume-layout/") ? (
                          <>
                            {presetNotice === scope && controller.isDirty() && (
                              <p
                                role="status"
                                className="text-sm text-muted-foreground"
                              >
                                Preset loaded into unsaved layout. Save to keep
                                these changes.
                              </p>
                            )}
                            <PresetPicker
                              document={documentValue}
                              values={state.draft.values}
                              onChange={(values) => controller.change(values)}
                              navigate={navigate}
                              capture={capturePreset}
                              savedValues={activeResume.layout}
                              onLoaded={() => setPresetNotice(scope)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Save layout to update PDF output. The PDF pane
                              continues to show saved content.
                            </p>
                            <LayoutFields
                              defaults={layoutDefaults(
                                resumeLayoutSchema.safeParse(
                                  state.draft.baseline,
                                ).success
                                  ? state.draft.baseline
                                  : activeResume.layout,
                              )}
                              resumeLayout
                              values={state.draft.values}
                              onChange={(values) => controller.change(values)}
                              contacts={profileContactLabels(
                                documentValue,
                                activeResume,
                              )}
                              editContacts={() =>
                                navigate(`resume-content/${activeResume.id}`)
                              }
                            />
                          </>
                        ) : activeResume &&
                          scope.startsWith("resume-wording/") &&
                          careerDocumentSchema.shape.resumes.element.shape.overrides.safeParse(
                            state.draft.values,
                          ).success ? (
                          <ResumeWordingEditor
                            document={documentValue}
                            resume={activeResume}
                            values={
                              state.draft.values as CareerResume["overrides"]
                            }
                            onChange={(values) => controller.change(values)}
                            navigate={navigate}
                          />
                        ) : (
                          <DraftEditor
                            disabled={state.saving}
                            key={state.draft.draftId}
                            scope={state.draft.scope}
                            values={state.draft.values}
                            document={documentValue}
                            language={contentLanguage}
                            onChange={(values) => controller.change(values)}
                          />
                        )}
                        <div className="flex flex-wrap justify-end gap-2">
                          {(state.error ||
                            state.recovery.some(
                              (draft) => draft.draftId === state.draft?.draftId,
                            )) && (
                            <>
                              <Button
                                variant="outline"
                                onClick={() => setCompare(!compare)}
                              >
                                Compare
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => controller.reconcile()}
                              >
                                Reconcile with current
                              </Button>
                              <Button
                                variant="outline"
                                onClick={exportRecovery}
                              >
                                Export recovery
                              </Button>
                            </>
                          )}
                          <span
                            role="status"
                            className="self-center text-xs text-muted-foreground"
                          >
                            {controller.isDirty()
                              ? state.recoveryStatus
                              : "No unsaved changes"}
                          </span>
                          {(state.storageMode !== "durable" ||
                            (state.saveStatus.kind === "failed" &&
                              state.saveStatus.reason === "storage")) && (
                            <Button
                              variant="outline"
                              onClick={() => void controller.save(true)}
                            >
                              Save in this tab only
                            </Button>
                          )}
                        </div>
                      </fieldset>
                      {compare && (
                        <ScopeComparison
                          current={readScope(documentValue, state.draft.scope)}
                          draft={state.draft.values}
                        />
                      )}
                      {state.draft.scope.startsWith("resume") &&
                        readScope(documentValue, state.draft.scope) ===
                          undefined && (
                          <FieldGroup>
                            <p>
                              The original resume is missing. Restore this scope
                              as a new independent resume in a chosen language,
                              or export recovery. The original recovery is
                              retained.
                            </p>
                            {documentValue.languages
                              .filter((item) => item.active)
                              .map((item) => (
                                <Button
                                  key={item.tag}
                                  variant="outline"
                                  onClick={() =>
                                    void controller
                                      .restoreResumeAsNew(item.tag)
                                      .then((opened) => {
                                        if (opened)
                                          navigate(
                                            controller.getSnapshot().draft!
                                              .scope,
                                          );
                                      })
                                  }
                                >
                                  Restore as new resume · {item.tag}
                                </Button>
                              ))}
                          </FieldGroup>
                        )}
                      {!state.draft.scope.startsWith("resume") &&
                        readScope(documentValue, state.draft.scope) ===
                          undefined && (
                          <FieldGroup>
                            <p>
                              Original record missing. Choose an explicit
                              section for Restore as new; no commit happens
                              until Save.
                            </p>
                            {documentValue.sections.map((section) => (
                              <Button
                                key={section.id}
                                variant="outline"
                                onClick={() => {
                                  const parsed = entrySchema.safeParse(
                                    state.draft!.values,
                                  );
                                  if (parsed.success)
                                    controller.restoreAsNew(
                                      section.id,
                                      duplicateEntry(parsed.data),
                                    );
                                  else
                                    setLocalError(
                                      "Recovery is not a valid entry. Export it and edit its values before restoring as new.",
                                    );
                                }}
                              >
                                Restore as new in {section.name || section.kind}
                              </Button>
                            ))}
                          </FieldGroup>
                        )}
                    </CardContent>
                    <CardFooter className="justify-end gap-2">
                      <Button
                        disabled={!controller.isDirty() || state.saving}
                        variant="outline"
                        onClick={() =>
                          void controller
                            .cancel()
                            .then(() =>
                              navigate(
                                scope.startsWith("resume/")
                                  ? "resumes"
                                  : scope.startsWith("preset/")
                                    ? "presets"
                                    : scope.startsWith("starter/")
                                      ? "starters"
                                      : scope.startsWith("starter-create/")
                                        ? `resume-content/${scopeId}`
                                        : activeResume
                                          ? destination
                                          : contextSection
                                            ? `list/${contextSection.id}`
                                            : "overview",
                              ),
                            )
                            .catch(() => {})
                        }
                      >
                        {state.orderDraft ? "Cancel entry" : "Cancel"}
                      </Button>
                      <Button
                        disabled={!controller.isDirty() || state.saving}
                        onClick={() =>
                          void controller.save().then((saved) => {
                            if (saved)
                              navigate(
                                scope.startsWith("resume/")
                                  ? controller
                                      .getSnapshot()
                                      .head!.document.resumes.some(
                                        (resume) => resume.id === scopeId,
                                      )
                                    ? `resume-content/${scopeId}`
                                    : "resumes"
                                  : scope.startsWith("preset/")
                                    ? "presets"
                                    : scope.startsWith("starter/")
                                      ? "starters"
                                      : scope.startsWith("starter-create/")
                                        ? `resume-content/${scopeId}`
                                        : activeResume
                                          ? destination
                                          : contextSection
                                            ? `list/${contextSection.id}`
                                            : "overview",
                              );
                          })
                        }
                      >
                        {state.orderDraft ? "Save entry" : "Save"}
                      </Button>
                    </CardFooter>
                  </Card>
                </section>
              ) : destination === "backups" ? (
                backupPanel
              ) : listSection ? null : (
                <CareerOverview document={documentValue} navigate={navigate} />
              )}
            </ResumeViewTabs>
            <Dialog open={addingSection} onOpenChange={setAddingSection}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add section</DialogTitle>
                  <DialogDescription>
                    Choose a section for your shared career information.
                  </DialogDescription>
                </DialogHeader>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="new-section-kind">
                      New section kind
                    </FieldLabel>
                    <Select
                      value={kind}
                      items={SECTION_KINDS.map((value) => ({
                        value,
                        label: value.charAt(0).toUpperCase() + value.slice(1),
                      }))}
                      onValueChange={(value) => {
                        if (value) setKind(value);
                      }}
                    >
                      <SelectTrigger id="new-section-kind">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {SECTION_KINDS.map((value) => (
                            <SelectItem key={value} value={value}>
                              <CareerSectionIcon kind={value} />
                              {value.charAt(0).toUpperCase() + value.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </FieldGroup>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setAddingSection(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={documentValue.sections.length >= 100}
                    onClick={() => {
                      const section = {
                        id: crypto.randomUUID(),
                        kind,
                        icon: defaultSectionIcons[kind],
                        name: kind.charAt(0).toUpperCase() + kind.slice(1),
                        heading: {},
                        archived: false,
                      };
                      setAddingSection(false);
                      navigate(`new-section/${section.id}`, section);
                    }}
                  >
                    Create section
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog
              open={Boolean(guard)}
              onOpenChange={(open) => {
                if (!open) setGuard(null);
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {guard?.targets[0] === "order"
                      ? "Unsaved entry order"
                      : "Unsaved form"}
                  </DialogTitle>
                  <DialogDescription>
                    {guard?.targets[0] === "order"
                      ? "Save or discard the pending entry order before leaving this section. Cancel keeps editing."
                      : "Save or discard this form's changes before leaving it. Cancel keeps editing."}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setGuard(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    disabled={state.saving}
                    onClick={() => void resolveGuard(false)}
                  >
                    Discard
                  </Button>
                  <Button
                    disabled={state.saving}
                    onClick={() => void resolveGuard(true)}
                  >
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog
              open={Boolean(review)}
              onOpenChange={(open) => {
                if (!open) setReview(null);
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {review?.incoming
                      ? "Review workspace replacement"
                      : "Review rollback"}
                  </DialogTitle>
                  <DialogDescription>
                    Replace saved workspace at revision {review?.head.revision}.
                    The outgoing workspace becomes one previous workspace.
                    Recovery is preserved separately.{" "}
                    {review?.previous
                      ? `This replaces the retained snapshot at revision ${review.previous.revision}.`
                      : "No previous snapshot is currently retained."}
                  </DialogDescription>
                </DialogHeader>
                <p>
                  Incoming sections:{" "}
                  {
                    (review?.incoming ?? review?.previous?.document)?.sections
                      .length
                  }
                  . Incoming resumes:{" "}
                  {
                    (review?.incoming ?? review?.previous?.document)?.resumes
                      .length
                  }
                  .
                </p>
                {review?.previous && !exportChoice && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      try {
                        exportWorkspace(review.previous);
                      } catch (error) {
                        setLocalError(
                          `Export failed. Retry or explicitly continue without export. ${String(error)}`,
                        );
                      }
                    }}
                  >
                    Export snapshot being replaced (download initiated)
                  </Button>
                )}
                <Button variant="outline" onClick={() => setExportChoice(true)}>
                  Continue without exporting snapshot
                </Button>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setReview(null)}>
                    Cancel replacement
                  </Button>
                  <Button
                    disabled={state.saving || !exportChoice}
                    onClick={() => {
                      if (review)
                        void controller
                          .replace(review.head, review.incoming)
                          .then((saved) => {
                            if (saved) setReview(null);
                          });
                    }}
                  >
                    Confirm adoption
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CareerWorkspaceShell>
        )}
      </ResumeManager>
    </div>
  );
}
