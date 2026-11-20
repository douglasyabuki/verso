"use client";

import { ArrowLeft, Download, FileText, Palette, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { AccountMenu } from "@/components/account/account-menu";
import {
  AccountPanel,
  GuestImport,
  readGuestWorkspace,
  SignOutConfirmation,
} from "@/components/account/account-panel";
import { ReleasesPanel } from "@/components/account/releases-panel";
import { BrandLoading } from "@/components/brand/brand-loading";
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
import { ConflictPanel } from "@/components/career/conflict-panel";
import {
  RestoredDraftBanner,
  StoredDraftNotice,
} from "@/components/career/draft-recovery-banners";
import { LayoutFields } from "@/components/career/layout-editor";
import { libraryDestinationKind } from "@/components/career/library-navigation";
import {
  type CareerActions,
  careerDetailsQuickActions,
  sectionQuickActions,
} from "@/components/career/quick-actions";
import { RecoveryList } from "@/components/career/recovery-list";
import { ReleaseControl } from "@/components/career/release-dialog";
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
import {
  DeviceSettings,
  SettingsDialog,
} from "@/components/career/settings-dialog";
import { SettingsSection } from "@/components/career/settings-section";
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
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { QuickActionsMenu } from "@/components/ui/quick-actions";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAccountActions } from "@/hooks/account/use-account-actions";
import { useAutomaticRelease } from "@/hooks/output/use-automatic-release";
import { useCommittedPreview } from "@/hooks/output/use-committed-preview";
import { useReleases } from "@/hooks/releases/use-releases";
import { draftConflict } from "@/lib/career/conflict";
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
  destinationFromUrl,
  destinationScope,
  destinationUrl,
  parseDestination,
  settingsPanel,
} from "@/lib/career/navigation";
import { importPortable } from "@/lib/career/portable-import";
import { recoveryForScope } from "@/lib/career/recovery";
import { oversizedRecovery, recoveryFiles } from "@/lib/career/recovery-export";
import { profileContactLabels, type ResumeContent } from "@/lib/career/resumes";
import { captureStarter } from "@/lib/career/starters";
import type {
  AccountSession,
  AccountSessionStore,
} from "@/stores/account/session";
import { openAccountBackend } from "@/stores/career/account-backend";
import {
  CareerController,
  type CareerDraftTarget,
} from "@/stores/career/controller";
import type { CareerHead } from "@/stores/career/persistence";
import type {
  CareerDocument,
  CareerDraft,
  CareerEntry,
  CareerResume,
  CareerSection,
  ResumeOutputTarget,
} from "@/types-and-constants/career";
import {
  mib,
  RECOVERY_BYTES,
  SECTION_KINDS,
  VERIFIED_OUTPUT_LANGUAGES,
  WORKSPACE_BYTES,
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
  const inputId = useId();
  const add = () => {
    try {
      const canonical = Intl.getCanonicalLocales(tag.trim())[0];
      if (!canonical || values.some((item) => item.tag === canonical))
        throw new Error("Enter a new valid language tag.");
      onChange([...values, { tag: canonical, active: true }]);
      setTag("");
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {values.map((item) => {
          const verified = (
            VERIFIED_OUTPUT_LANGUAGES as readonly string[]
          ).includes(item.tag);
          return (
            <li
              key={item.tag}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {item.tag}
                  <Badge variant={item.active ? "secondary" : "outline"}>
                    {item.active ? "Active" : "Inactive"}
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {verified
                    ? "PDF output available"
                    : "PDF unavailable · rendering unverified"}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`${item.active ? "Deactivate" : "Reactivate"} ${item.tag}`}
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
                {item.active ? "Deactivate" : "Reactivate"}
              </Button>
            </li>
          );
        })}
      </ul>
      <Field data-invalid={Boolean(error)}>
        <FieldLabel htmlFor={inputId}>Add content language</FieldLabel>
        <InputGroup className="max-w-xs">
          <InputGroupInput
            id={inputId}
            value={tag}
            placeholder="pt-BR"
            aria-invalid={Boolean(error)}
            aria-describedby={`${inputId}-description`}
            onChange={(event) => {
              setTag(event.target.value);
              if (error) setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton disabled={!tag.trim()} onClick={add}>
              <Plus aria-hidden="true" />
              Add language
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <FieldDescription id={`${inputId}-description`}>
          Use a canonical language tag such as en-US or pt-BR. The interface
          stays in English; activation controls creation choices only.
        </FieldDescription>
        {error && <FieldError>{error}</FieldError>}
      </Field>
    </div>
  );
}

/** Create the controller for the mounted owner: account storage for a signed-in
 * (or expired, still-mounted) session, guest IndexedDB otherwise.
 * @param account Optional account session and store.
 * @returns {CareerController} Controller bound to exactly one owner.
 * @example createOwnerController({ store, session })
 */
function createOwnerController(account?: {
  store: AccountSessionStore;
  session: AccountSession;
}): CareerController {
  const session = account?.session;
  if (session?.kind !== "authenticated" && session?.kind !== "expired")
    return new CareerController();
  const identity = { userId: session.user.id, sessionId: session.sessionId };
  return new CareerController({
    owner: "account",
    openBackend: () =>
      openAccountBackend(identity, {
        onSessionInvalid: () => account?.store.invalidate(),
      }),
  });
}

export function CareerWorkspace({
  controller: supplied,
  account,
}: {
  controller?: CareerController;
  /** Account session; the parent remounts this workspace when the owner changes. */
  account?: { store: AccountSessionStore; session: AccountSession };
}) {
  const [controller] = useState(
    () => supplied ?? createOwnerController(account),
  );
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
    /** Guest import into an account; otherwise a file replacement or rollback. */
    kind?: "import";
  } | null>(null);
  const [localError, setLocalError] = useState("");
  const [sessionReview, setSessionReview] = useState<{
    head: CareerHead;
    previous?: CareerHead;
  } | null>(null);
  const [sessionExportChoice, setSessionExportChoice] = useState(false);
  const [sessionReviewError, setSessionReviewError] = useState("");
  // Both versions of a conflicted form scope, derived from committed state and the draft baseline.
  const formConflict = useMemo(
    () =>
      state.head && state.draft ? draftConflict(state.head, state.draft) : null,
    [state.head, state.draft],
  );
  const orderConflict = useMemo(
    () =>
      state.head && state.orderDraft
        ? draftConflict(state.head, state.orderDraft)
        : null,
    [state.head, state.orderDraft],
  );
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
      void controller.sync("focus");
    };
    const visibility = () => {
      if (document.visibilityState === "hidden")
        void controller.flushRecovery();
      else void controller.sync("visible");
    };
    const online = () => {
      void controller.sync("online");
    };
    // Input marks the owner active; idle tabs pause periodic account checks.
    const activity = () => controller.activity();
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (
        controller.hasUnsavedChanges() ||
        controller.getSnapshot().sessionCommits > 0
      )
        event.preventDefault();
    };
    window.addEventListener("focus", focus);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("beforeunload", beforeUnload);
    for (const type of ["pointerdown", "keydown"] as const)
      window.addEventListener(type, activity, { passive: true });
    return () => {
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", online);
      for (const type of ["pointerdown", "keydown"] as const)
        window.removeEventListener(type, activity);
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
    const initial = destinationFromUrl(window.location);
    route.current.index = Number.isSafeInteger(window.history.state?.versoIndex)
      ? window.history.state.versoIndex
      : 0;
    const initialUrl = destinationUrl(
      new URL(window.location.href),
      parseDestination(initial),
    );
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
      const next = destinationFromUrl(window.location);
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
  const releases = useReleases({
    session: account?.session,
    onSessionInvalid: () => account?.store.invalidate(),
  });
  const accountMode = state.storageMode === "account";
  const releaseLinks = releases?.state.list?.links;
  const automaticResumeIds = useMemo(
    () =>
      accountMode
        ? (releaseLinks ?? [])
            .filter((link) => link.autoRelease)
            .map((link) => link.resumeId)
        : [],
    [accountMode, releaseLinks],
  );
  const preview = useCommittedPreview({
    head: state.head,
    preferences: state.preferences,
    activeResumeId: activeResume?.id,
    automaticResumeIds,
  });
  useAutomaticRelease({ preview, releases, accountMode });
  const currentOutput =
    preview.state.output && preview.state.output.key === preview.key
      ? preview.state.output
      : null;
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
        const url = destinationUrl(new URL(window.location.href), next);
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
  const unconfirmedAccountWork =
    state.recovery.length +
    [state.draft, state.orderDraft].filter((draft) => draft?.operationId)
      .length;
  const accountActions = useAccountActions({
    store: account?.store,
    unconfirmed: unconfirmedAccountWork,
    resolveDrafts: (action) =>
      resolveTargets(controller.navigationTargets(), action),
  });
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
    if (new TextEncoder().encode(content).byteLength > WORKSPACE_BYTES)
      throw new Error(
        `Workspace backup exceeds the ${mib(WORKSPACE_BYTES)} file limit including its envelope. No content was truncated or changed.`,
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
      if (file.size > (recovery ? RECOVERY_BYTES : WORKSPACE_BYTES))
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
      <main>
        <BrandLoading message="Opening saved workspace…" />
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
  const careerActions: CareerActions = {
    busy: state.saving,
    addSection: () =>
      resolveTargets(controller.navigationTargets(), () => {
        navigate("overview");
        setAddingSection(true);
      }),
    toggleSectionArchived: (sectionId) =>
      resolveTargets(controller.navigationTargets(), () => {
        const current = controller
          .getSnapshot()
          .head?.document.sections.find((section) => section.id === sectionId);
        if (!current) return;
        // Properties-only scope: entries are not part of `section/<id>`.
        void controller.command(`section/${current.id}`, {
          id: current.id,
          kind: current.kind,
          icon: current.icon,
          name: current.name,
          heading: current.heading,
          archived: !current.archived,
        });
      }),
    createLibraryItem: (kind) => {
      const document = controller.getSnapshot().head!.document;
      const collection = kind === "preset" ? "presets" : "starters";
      if (controller.getSnapshot().saving || document[collection].length >= 100)
        return;
      const base = {
        id: crypto.randomUUID(),
        name: "",
        template: "yabuki-reference@1.0.3",
        layout: structuredClone(document.defaults),
      };
      navigate(
        `${kind}/${base.id}`,
        kind === "starter"
          ? { ...base, sections: [], summaryIncluded: false }
          : base,
      );
    },
  };
  const recoveryLabel = (draft: CareerDraft): string =>
    draft.scope.startsWith("entries/")
      ? `${documentValue.sections.find((section) => section.id === draft.scope.split("/")[1])?.name || "Section"} entry order`
      : draft.scope.startsWith("entry/")
        ? (() => {
            const entry = documentValue.sections
              .flatMap((section) => section.entries)
              .find((entry) => entry.id === draft.scope.split("/")[1]);
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
                }[draft.scope] ?? "Unsaved form");
  const restoreRecovery = (draft: CareerDraft) => {
    const restore = () => {
      controller.restore(draft);
      const activeForm = controller.getSnapshot().draft;
      navigate(
        draft.scope.startsWith("entries/") && activeForm
          ? activeForm.scope
          : draft.scope,
      );
    };
    const target: CareerDraftTarget = draft.scope.startsWith("entries/")
      ? "order"
      : "form";
    const activeForm = controller.getSnapshot().draft;
    const relatedSection = documentValue.sections.find((section) =>
      section.entries.some(
        (entry) => activeForm?.scope === `entry/${entry.id}`,
      ),
    );
    const targets =
      draft.scope === `entries/${relatedSection?.id}`
        ? [target]
        : [...new Set([...controller.navigationTargets(draft.scope), target])];
    resolveTargets(targets, restore);
  };
  const restoredDraft = state.draft
    ? state.recovery.find((draft) => draft.draftId === state.draft?.draftId)
    : undefined;
  const storedDraft =
    state.draft && !restoredDraft
      ? recoveryForScope(state.recovery, state.draft.scope, state.draft.draftId)
      : null;
  const uncertainSave =
    state.saveStatus.kind === "failed" &&
    state.saveStatus.reason === "uncertain";
  const recoveryWriteFailed =
    state.recoveryStatus.startsWith("Recovery failed");
  const draftNotice =
    !state.draft || formConflict ? null : restoredDraft ||
      uncertainSave ||
      recoveryWriteFailed ? (
      <RestoredDraftBanner
        updatedAt={restoredDraft?.updatedAt}
        current={readScope(documentValue, state.draft.scope)}
        draft={state.draft.values}
        disabled={state.saving}
        onReconcile={uncertainSave ? () => controller.reconcile() : undefined}
        onExport={recoveryWriteFailed ? exportRecovery : undefined}
      />
    ) : storedDraft ? (
      <StoredDraftNotice
        updatedAt={storedDraft.updatedAt}
        name={recoveryLabel(storedDraft)}
        disabled={state.saving}
        onRestore={() => restoreRecovery(storedDraft)}
        onDiscard={() => void controller.discardRecovery(storedDraft)}
        onExport={exportRecovery}
      />
    ) : null;
  const listedRecovery = state.recovery.filter(
    (draft) =>
      draft.draftId !== state.draft?.draftId &&
      draft.draftId !== state.orderDraft?.draftId,
  );
  const backupPanel = (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title="Unsaved drafts"
        description="Changes that were never saved, kept on this device after a reload, crash, or closed tab."
      >
        <RecoveryList
          drafts={listedRecovery}
          disabled={state.saving}
          label={recoveryLabel}
          saved={(draft) => readScope(documentValue, draft.scope)}
          outdated={(draft) =>
            Boolean(state.head && draftConflict(state.head, draft))
          }
          onRestore={restoreRecovery}
          onDiscard={(draft) => void controller.discardRecovery(draft)}
          onExport={exportRecovery}
        />
      </SettingsSection>
      <SettingsSection
        title="Back up"
        description="Workspace exports contain saved content only. Recovery exports contain unsaved drafts, to continue them in another browser."
      >
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              try {
                exportWorkspace();
              } catch (error) {
                setLocalError(String(error));
              }
            }}
          >
            <Download data-icon="inline-start" aria-hidden="true" />
            Export workspace
          </Button>
          <Button size="sm" variant="outline" onClick={exportRecovery}>
            <Download data-icon="inline-start" aria-hidden="true" />
            Export recovery
          </Button>
        </div>
      </SettingsSection>
      <SettingsSection
        title="Restore"
        description="Imported workspaces open a review before replacing saved content. Imported recovery becomes unsaved drafts and never commits on its own."
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="workspace-import">
              Import workspace for review
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
              Import recovery drafts
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
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Previous workspace</p>
            <p className="text-xs text-muted-foreground">
              The one workspace kept before the last import or replacement.
            </p>
          </div>
          <Button
            size="sm"
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
            Review previous workspace
          </Button>
        </div>
      </SettingsSection>
      <SettingsSection
        title="Sample workspace"
        description="Explore fictional career details and English/Portuguese resumes. Loading the sample opens a replacement review before changing saved content."
      >
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          disabled={loadingSample || state.saving || !state.durable}
          onClick={() => void loadSample()}
        >
          {loadingSample ? "Loading sample…" : "Load sample workspace"}
        </Button>
      </SettingsSection>
    </div>
  );
  const settingsForm =
    state.draft && settingsDraft ? (
      <div className="flex flex-col gap-4">
        {draftNotice}
        <fieldset disabled={state.saving} className="flex flex-col gap-4">
          {state.draft.scope === "defaults" ? (
            <LayoutFields
              values={state.draft.values}
              defaults={appLayoutDefaults}
              onChange={(values) => controller.change(values)}
            />
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
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {formConflict ? (
          <ConflictPanel
            conflict={formConflict}
            disabled={state.saving}
            onKeepDraft={() => controller.reconcile()}
            onUseSaved={() => {
              const savedScope = state.draft!.scope;
              return controller
                .cancel()
                .then(() => controller.open(savedScope))
                .catch(() => {});
            }}
            onExport={exportRecovery}
          />
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span role="status" className="me-auto text-xs text-muted-foreground">
            {controller.isDirty() ? state.recoveryStatus : "No unsaved changes"}
          </span>
          <Button
            variant="outline"
            disabled={(!controller.isDirty() && !restoredDraft) || state.saving}
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
        preferenceStatus={state.preferenceStatus}
        retryPreferences={() => void controller.changePreferences()}
        accountMode={state.storageMode === "account"}
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
        ) : panel === "account" ? (
          <AccountPanel
            session={account?.session}
            store={account?.store}
            actions={accountActions}
            unconfirmed={unconfirmedAccountWork}
            exportWorkspace={() => exportWorkspace()}
          >
            {account?.session.kind === "authenticated" && (
              <GuestImport
                disabled={state.saving || !state.head}
                review={() =>
                  resolveTargets(controller.navigationTargets(), () => {
                    void readGuestWorkspace()
                      .then(async (guest) => {
                        if (!guest) {
                          setLocalError(
                            "No workspace is saved in this browser as a guest.",
                          );
                          return;
                        }
                        setReview({
                          head: controller.getSnapshot().head!,
                          incoming: guest.document,
                          previous: await controller.previous(),
                          kind: "import",
                        });
                        setExportChoice(false);
                        setLocalError("");
                      })
                      .catch((error) => setLocalError(String(error)));
                  })
                }
                error={localError}
              />
            )}
          </AccountPanel>
        ) : panel === "releases" ? (
          <ReleasesPanel
            releases={releases}
            session={account?.session}
            resumes={documentValue?.resumes ?? []}
          />
        ) : null}
      </SettingsDialog>
      <SignOutConfirmation
        actions={accountActions}
        unconfirmed={unconfirmedAccountWork}
        exportRecovery={exportRecovery}
      />

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
            accountMenu={(side) => (
              <AccountMenu
                session={account?.session}
                actions={accountActions}
                navigate={navigate}
                side={side}
              />
            )}
            closeSettings={closeSettings}
            resumeActions={resumeActions}
            careerActions={careerActions}
            destination={destination}
            editorRequest={issueFocus ?? libraryEditorRequest}
            libraryItemState={
              state.draft?.values && typeof state.draft.values === "object"
                ? "new"
                : "missing"
            }
            navigate={navigate}
            addSection={careerActions.addSection}
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
                actions={
                  state.head && (
                    <ReleaseControl
                      releases={accountMode ? releases : null}
                      output={currentOutput}
                      workspaceId={state.head.workspaceId}
                    />
                  )
                }
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
                  onClick={() =>
                    careerActions.createLibraryItem(
                      destination === "presets" ? "preset" : "starter",
                    )
                  }
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
                <QuickActionsMenu
                  actions={
                    contextSection
                      ? sectionQuickActions(
                          contextSection,
                          careerActions,
                          navigate,
                        ).filter(
                          // Omit the action for the page already open.
                          (action) =>
                            !(
                              (action.key === "open" &&
                                destination === `list/${contextSection.id}`) ||
                              (action.key === "properties" &&
                                destination === `section/${contextSection.id}`)
                            ),
                        )
                      : careerDetailsQuickActions(
                          documentValue,
                          careerActions,
                          navigate,
                        ).filter((action) => action.key === "order")
                  }
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={
                        contextSection ? "Section actions" : "Overview actions"
                      }
                    />
                  }
                />
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
                      tab&apos;s saved workspace from Settings › Data before
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
            {listSection &&
              orderConflict &&
              orderConflict.scope === `entries/${listSection.id}` && (
                <ConflictPanel
                  conflict={orderConflict}
                  subject="entry order"
                  disabled={state.saving}
                  comparison={
                    <div className="grid gap-4 sm:grid-cols-2">
                      {(
                        [
                          ["Current saved order", orderConflict.saved],
                          ["Your entry order", orderConflict.draft],
                        ] as const
                      ).map(([title, ids]) => (
                        <section key={title} aria-label={title}>
                          <h3 className="text-sm font-medium">{title}</h3>
                          <ol className="list-decimal ps-5 text-sm">
                            {(Array.isArray(ids) ? ids : []).map((id) => {
                              const entry = listSection.entries.find(
                                (item) => item.id === id,
                              );
                              return (
                                <li key={String(id)}>
                                  {entry
                                    ? careerEntryLabel(entry, contentLanguage)
                                    : "Missing entry"}
                                </li>
                              );
                            })}
                          </ol>
                        </section>
                      ))}
                    </div>
                  }
                  onKeepDraft={() => controller.reconcile("order")}
                  onUseSaved={() => controller.cancel("order").catch(() => {})}
                  onExport={exportRecovery}
                />
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
                      draft remains in Settings › Data.
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
                      Open Data
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
                      {draftNotice}
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
                                resumeLayoutSchema.safeParse(state.draft.values)
                                  .data?.contactLocation,
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
                            focusRequest={
                              issueFocus?.resumeId === activeResume.id
                                ? issueFocus
                                : null
                            }
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
                          <span
                            role="status"
                            className="self-center text-xs text-muted-foreground"
                          >
                            {controller.isDirty()
                              ? state.recoveryStatus
                              : "No unsaved changes"}
                          </span>
                          {((state.storageMode !== "durable" &&
                            state.storageMode !== "account") ||
                            (state.saveStatus.kind === "failed" &&
                              (state.saveStatus.reason === "storage" ||
                                state.saveStatus.reason === "offline"))) && (
                            <Button
                              variant="outline"
                              onClick={() => void controller.save(true)}
                            >
                              Save in this tab only
                            </Button>
                          )}
                        </div>
                      </fieldset>
                      {formConflict &&
                        !(
                          formConflict.saved === undefined &&
                          !formConflict.replaced
                        ) && (
                          <ConflictPanel
                            conflict={formConflict}
                            disabled={state.saving}
                            onKeepDraft={() => controller.reconcile()}
                            onUseSaved={() =>
                              controller.cancel().catch(() => {})
                            }
                            onExport={exportRecovery}
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
                        disabled={
                          (!controller.isDirty() && !restoredDraft) ||
                          state.saving
                        }
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
                        {state.draft?.operationId &&
                        !state.saving &&
                        !formConflict &&
                        state.storageMode === "account"
                          ? "Retry save"
                          : state.orderDraft
                            ? "Save entry"
                            : "Save"}
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
                    {review?.kind === "import"
                      ? "Review guest workspace import"
                      : review?.incoming
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
                {review?.kind === "import" && (
                  <p>
                    This browser&apos;s guest workspace replaces your account
                    workspace ({review.head.document.sections.length} sections,{" "}
                    {review.head.document.resumes.length} resumes). Nothing is
                    merged, and the guest workspace stays in this browser
                    unchanged.
                  </p>
                )}
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
                          .replace(
                            review.head,
                            review.incoming,
                            review.kind ?? "replace",
                          )
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
