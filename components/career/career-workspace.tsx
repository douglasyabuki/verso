"use client";

import {
  ArrowLeft,
  Columns2,
  Download,
  FilePenLine,
  FileText,
  FileUp,
  type LucideIcon,
  Palette,
  Plus,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { z } from "zod";

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
import { ConflictPanel } from "@/components/career/conflict-panel";
import { DeleteWorkspaceData } from "@/components/career/delete-workspace-data";
import { DraftRecoveryDialog } from "@/components/career/draft-recovery-dialog";
import { LayoutFields } from "@/components/career/layout-editor";
import { libraryDestinationKind } from "@/components/career/library-navigation";
import { LiveOutput } from "@/components/career/live-output";
import { LivePdfRelease } from "@/components/career/live-pdf-release";
import {
  type CareerActions,
  careerDetailsQuickActions,
  resumeCollectionActions,
  sectionQuickActions,
} from "@/components/career/quick-actions";
import { RecoveryList } from "@/components/career/recovery-list";
import { ResumeComparison } from "@/components/career/resume-comparison";
import {
  CareerResumeCollection,
  ResumeActionsMenu,
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
import {
  type WorkspaceReplacement,
  WorkspaceReplacementDialog,
} from "@/components/career/workspace-replacement-dialog";
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
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
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
import { toast } from "@/components/ui/toast";
import { useAccountActions } from "@/hooks/account/use-account-actions";
import { useLivePreview } from "@/hooks/output/use-live-preview";
import type { PdfViewPosition } from "@/hooks/output/use-pdf-document";
import { useReleases } from "@/hooks/releases/use-releases";
import { draftConflict } from "@/lib/career/conflict";
import {
  layoutAppearance,
  layoutDefaults,
  layoutFromPreset,
  sameAppearance,
  sameLayout,
} from "@/lib/career/layout";
import {
  careerDocumentSchema,
  createEntry,
  duplicateEntry,
  entrySchema,
  languageEvidenceSchema,
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
  isResumeComparison,
  parseDestination,
  settingsPanel,
} from "@/lib/career/navigation";
import { importPortable } from "@/lib/career/portable-import";
import { matchesDraftVersion, recoveryForScope } from "@/lib/career/recovery";
import { oversizedRecovery, recoveryFiles } from "@/lib/career/recovery-export";
import { profileContactLabels, type ResumeContent } from "@/lib/career/resumes";
import { captureStarter } from "@/lib/career/starters";
import { CAREER_TERMS } from "@/lib/career/terminology";
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
import type { LivePreview } from "@/stores/output/live-preview";
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
import type { SaveFailureReason } from "@/types-and-constants/career-status";
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
  try {
    anchor.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

type WorkspaceRevision = Pick<
  CareerHead,
  "workspaceId" | "generation" | "revision"
>;

function sameWorkspaceRevision(
  current: WorkspaceRevision | null,
  reviewed: WorkspaceRevision,
) {
  return (
    current?.workspaceId === reviewed.workspaceId &&
    current.generation === reviewed.generation &&
    current.revision === reviewed.revision
  );
}

function exportableDrafts(controller: CareerController) {
  const { draft, orderDraft, recovery } = controller.getSnapshot();
  return [
    ...recovery.filter(
      (item) =>
        item.draftId !== draft?.draftId && item.draftId !== orderDraft?.draftId,
    ),
    ...(draft && controller.isDirty("form") ? [draft] : []),
    ...(orderDraft && controller.isDirty("order") ? [orderDraft] : []),
  ];
}

function DraftEditor({
  scope,
  values,
  language,
  document,
  onChange,
  disabled = false,
  preview,
  focusRequest,
  onCreateEvidence,
  onOpenEntry,
}: {
  disabled?: boolean;
  preview?: LivePreview;
  focusRequest?: { fieldId: string } | null;
  scope: string;
  values: unknown;
  language: string;
  document: CareerDocument;
  onChange: (values: unknown) => void;
  /** Starts the guarded create-and-attach flow for a language entry. */
  onCreateEvidence?: (languageEntryId: string) => void;
  /** Opens another Career entry through guarded navigation. */
  onOpenEntry?: (entryId: string) => void;
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
        preview={preview}
        focusRequest={focusRequest}
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
      : scope.startsWith("language-evidence/")
        ? languageEvidenceSchema.safeParse(sanitized).success
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
                              ...(item.evidenceIds && {
                                evidenceIds: item.evidenceIds.filter(
                                  (value) =>
                                    !entry?.evidence?.some(
                                      (attachment) => attachment.id === value,
                                    ),
                                ),
                              }),
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
    scope.startsWith("language-evidence/") &&
    values &&
    typeof values === "object" &&
    "entry" in values &&
    values.entry &&
    typeof values.entry === "object" &&
    "fields" in values.entry &&
    Array.isArray(values.entry.fields)
  ) {
    const evidence = values as z.infer<typeof languageEvidenceSchema>;
    const owner = document.sections
      .flatMap((section) => section.entries)
      .find((entry) => entry.id === evidence.languageEntryId);
    const destinations = document.sections.filter(
      (section) => section.kind === "certifications" && !section.archived,
    );
    return (
      <FieldGroup>
        <p className="text-sm text-muted-foreground">
          Saved once under Certifications and attached to{" "}
          {owner ? careerEntryLabel(owner, language) : "this language"}. Save
          creates both together and returns to the language; Cancel returns
          without creating anything.
        </p>
        {destinations.length > 1 && (
          <Field>
            <FieldLabel htmlFor="evidence-section">
              Certifications section
            </FieldLabel>
            <Select
              value={evidence.sectionId}
              items={destinations.map((section) => ({
                value: section.id,
                label: section.name || "Certifications",
              }))}
              onValueChange={(sectionId) => {
                if (sectionId) onChange({ ...evidence, sectionId });
              }}
            >
              <SelectTrigger id="evidence-section">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {destinations.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name || "Certifications"}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        )}
        <EntryEditor
          disabled={disabled}
          entry={evidence.entry}
          kind="certifications"
          language={language}
          onChange={(entry) => onChange({ ...evidence, entry })}
        />
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
        document={document}
        onOpenEntry={onOpenEntry}
        onCreateEvidence={
          onCreateEvidence &&
          (() => onCreateEvidence((values as CareerEntry).id))
        }
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

type DataActionSection = "workspace" | "drafts" | "sample";

type ReplacementSurface = "data" | "account" | null;

const PREVIOUS_WORKSPACE_EXPLANATION =
  "Verso kept a copy of the workspace you had before the replacement.";

const PREVIOUS_WORKSPACE_UNAVAILABLE =
  "The previous workspace you reviewed is no longer available.";

function RestoreFileButton({
  id,
  label,
  icon: Icon,
  onSelect,
}: {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        id={id}
        type="button"
        size="sm"
        variant="outline"
        onClick={() => input.current?.click()}
      >
        <Icon data-icon="inline-start" aria-hidden="true" />
        {label}
      </Button>
      <input
        id={`${id}-file`}
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={({ currentTarget }) => {
          const file = currentTarget.files?.[0];
          currentTarget.value = "";
          if (file) onSelect(file);
        }}
      />
    </>
  );
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
  const [inlineOrderReview, setInlineOrderReview] = useState<string | null>(
    null,
  );
  const [resolvedRecoveryScopes, setResolvedRecoveryScopes] = useState<
    string[]
  >([]);
  const panel = settingsPanel(view.destination);
  const destination = panel ? view.background : view.destination;
  const canReplaceWorkspace = state.durable && state.storageMode !== "session";
  const settingsDraft =
    state.draft?.scope === "languages" || state.draft?.scope === "defaults";
  const settingsReturnFocus = useRef<HTMLElement | null>(null);
  const [issueFocus, setIssueFocus] = useState<{
    fieldId: string;
    resumeId: string;
    scope: string;
  } | null>(null);
  useEffect(() => {
    if (!issueFocus) return;
    const frame = requestAnimationFrame(() => {
      const { scope, resumeId, fieldId } = issueFocus;
      const row =
        scope === "resume-wording"
          ? document.getElementById(`resume-wording-${resumeId}-${fieldId}`)
          : document.querySelector<HTMLElement>(
              `[data-preview-field="${CSS.escape(fieldId)}"]`,
            );
      const control = row?.matches("input,button,[role=checkbox]")
        ? row
        : (row?.querySelector<HTMLElement>(
            'input, textarea, [contenteditable="true"]',
          ) ??
          row?.querySelector<HTMLElement>(
            'button[data-wording-customize], button, [role="checkbox"], [role="combobox"]',
          ));
      control?.focus({ preventScroll: true });
      control?.scrollIntoView({ block: "center", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [issueFocus]);
  const [language, setLanguage] = useState("");
  const [kind, setKind] = useState<CareerSection["kind"]>("experience");
  const [guard, setGuard] = useState<{
    action: () => void;
    targets: CareerDraftTarget[];
    issueNavigation?: boolean;
  } | null>(null);
  const [review, setReview] = useState<
    | (WorkspaceReplacement & {
        panel: ReplacementSurface;
      })
    | null
  >(null);
  const [replacementNotice, setReplacementNotice] = useState<{
    panel: ReplacementSurface;
    workspaceId: string;
    generation: number;
    restored: boolean;
  } | null>(null);
  const [reviewFailure, setReviewFailure] = useState<{
    message: string;
    reason?: SaveFailureReason;
  } | null>(null);
  const [previousCheck, setPreviousCheck] = useState<{
    key: string;
    previous?: WorkspaceRevision;
    error?: string;
  } | null>(null);
  const [previousRetry, setPreviousRetry] = useState(0);
  const currentReplacementNotice =
    replacementNotice &&
    panel === replacementNotice.panel &&
    state.head?.workspaceId === replacementNotice.workspaceId &&
    state.head.generation === replacementNotice.generation
      ? replacementNotice
      : null;
  const previousKey =
    (panel === "data" ||
      currentReplacementNotice ||
      review?.kind === "restore") &&
    canReplaceWorkspace &&
    state.head
      ? JSON.stringify([
          view.index,
          state.head.workspaceId,
          state.head.generation,
          previousRetry,
        ])
      : null;
  const previousAvailability =
    previousKey === previousCheck?.key ? previousCheck : null;
  const retained = previousAvailability?.previous;
  const previousAvailable =
    retained !== undefined &&
    state.head?.workspaceId === retained.workspaceId &&
    state.head.generation === retained.generation + 1;
  useEffect(() => {
    if (previousKey === null) return;
    let active = true;
    void controller.previous().then(
      (head) => {
        if (active)
          setPreviousCheck({
            key: previousKey,
            previous: head && {
              workspaceId: head.workspaceId,
              generation: head.generation,
              revision: head.revision,
            },
          });
      },
      (error: unknown) => {
        if (active)
          setPreviousCheck({
            key: previousKey,
            error: String(error),
          });
      },
    );
    return () => {
      active = false;
    };
  }, [controller, previousKey]);
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
  const [comparisonVisit, setComparisonVisit] = useState(0);
  const [libraryEditorRequest, setLibraryEditorRequest] = useState<
    object | null
  >(null);
  const [presetNotice, setPresetNotice] = useState<string | null>(null);
  const [exportChoice, setExportChoice] = useState<
    "downloaded" | "skipped" | null
  >(null);
  const [rawExport, setRawExport] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [importPending, setImportPending] = useState<DataActionSection | null>(
    null,
  );
  const [dataError, setDataError] = useState<{
    section: DataActionSection;
    message: string;
  } | null>(null);
  const [recoveryImportFilename, setRecoveryImportFilename] = useState<
    string | null
  >(null);
  const importJob = useRef<AbortController | null>(null);
  const replacementJob = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      importJob.current?.abort();
      replacementJob.current?.abort();
    },
    [],
  );
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
    (
      targets: CareerDraftTarget[],
      action: () => void,
      issueNavigation = false,
    ) => {
      if (controller.getSnapshot().saving) return;
      const dirty = targets.filter((target) => controller.isDirty(target));
      const clean = targets.filter((target) => !controller.isDirty(target));
      const proceed = () => {
        if (dirty.length) setGuard({ action, targets: dirty, issueNavigation });
        else action();
      };
      if (clean.length)
        void (async () => {
          for (const target of clean) {
            const state = controller.getSnapshot();
            if (!(target === "form" ? state.draft : state.orderDraft)) continue;
            if ((await controller.cancel(target)).kind !== "discarded") return;
          }
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
      if ((await controller.cancel(target)).kind !== "discarded") return;
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
      if (route.current.destination !== next) {
        setInlineOrderReview(null);
        setResolvedRecoveryScopes([]);
      }
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
      const { head, draft, recovery } = controller.getSnapshot();
      if (
        editing &&
        head &&
        (destinationExists(head.document, next, draft?.scope) ||
          (readScope(head.document, editing) === null &&
            recoveryForScope(recovery, editing)))
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
  const keepPreviewCurrent = Boolean(
    activeResume &&
    /^(resume-layout|resume-wording|resume-content)\//.test(destination),
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
  const preview = useLivePreview(
    controller,
    activeResume?.id ?? "",
    keepPreviewCurrent,
    state.preferences.automaticRefresh,
    automaticResumeIds,
  );
  const previewResume =
    activeResume ??
    documentValue?.resumes.find((resume) => resume.id === preview.selected) ??
    documentValue?.resumes[0];
  const readingIdentity = JSON.stringify([
    state.head?.workspaceId,
    state.head?.generation,
    previewResume?.id,
  ]);
  const [reading, setReading] = useState(() => ({
    identity: readingIdentity,
    ref: { current: { page: 1, scale: "page-width" } as PdfViewPosition },
  }));
  if (reading.identity !== readingIdentity)
    setReading({
      identity: readingIdentity,
      ref: { current: { page: 1, scale: "page-width" } },
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
    issueNavigation = false,
  ) => {
    const next = parseDestination(incoming);
    const focusIssue = () =>
      setIssueFocus(
        focusFieldId
          ? {
              fieldId: focusFieldId,
              resumeId: next.split("/")[1],
              scope: next.split("/")[0],
            }
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
        setInlineOrderReview(null);
        setResolvedRecoveryScopes([]);
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
      } else if (isResumeComparison(next)) {
        setComparisonVisit((visit) => visit + 1);
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
      const { head, draft, recovery } = controller.getSnapshot();
      const recoverable = editing ? recoveryForScope(recovery, editing) : null;
      if (
        editing &&
        head &&
        (destinationExists(
          head.document,
          next,
          initialValues !== undefined ? editing : draft?.scope,
        ) ||
          (readScope(head.document, editing) === null && recoverable))
      )
        controller.open(
          editing,
          editing.startsWith("entries/") ? "order" : "form",
        );
      if (initialValues !== undefined && !recoverable)
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
    resolveTargets(routeTargets(next), perform, issueNavigation);
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
  const openOutputIssue = (target: ResumeOutputTarget) => {
    if (target.destination === destination) {
      const [scope, resumeId] = target.destination.split("/");
      setIssueFocus({ fieldId: target.fieldId, resumeId, scope });
      return;
    }
    navigate(target.destination, undefined, target.fieldId, false, true);
  };
  const resetAt = state.workspaceReset?.at;
  const handledReset = useRef<number | undefined>(undefined);
  useEffect(() => {
    const reset = controller.getSnapshot().workspaceReset;
    // Navigation waits until the deletion settles (navigation is refused while saving).
    if (!resetAt || !reset || state.saving || handledReset.current === resetAt)
      return;
    handledReset.current = resetAt;
    // The deleted workspace's resumes and records no longer exist: show the fresh
    // Overview with no resume selected, and forget its public PDF state.
    void releases?.store.reset();
    navigate("overview", undefined, undefined, true);
    if (reset.source === "elsewhere")
      toast.add({
        type: "info",
        title: "Workspace data was deleted in another tab or device",
        description: "This tab now shows the fresh workspace.",
      });
    // Runs once per adopted fresh workspace; `navigate` reads current routing state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetAt, state.saving]);
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
  const canExportDrafts = exportableDrafts(controller).length > 0;
  const downloadRecovery = (allowRaw: boolean) => {
    const drafts = exportableDrafts(controller);
    if (!drafts.length) return;
    const reportError = (message: string) => {
      if (settingsPanel(route.current.destination) === "data")
        setDataError(message ? { section: "drafts", message } : null);
      else setLocalError(message);
    };
    if (oversizedRecovery(drafts).length && !allowRaw) {
      setRawExport(true);
      reportError(
        "A draft exceeds normal recovery limits. Keep this tab open. Choose Export raw recovery chunks to preserve its complete JSON; chunks require reassembly and are not a normal recovery import.",
      );
      return;
    }
    try {
      for (const file of recoveryFiles(
        drafts,
        controller.getSnapshot().head!.workspaceId,
      ))
        download(file.content, file.name);
      reportError("");
      setRawExport(false);
    } catch (error) {
      reportError(String(error));
    }
  };
  const exportRecovery = () => downloadRecovery(false);

  const requestWorkspaceReview = (
    source:
      | {
          kind: "replace";
          incoming: CareerDocument;
          section: "workspace" | "sample";
          filename?: string;
        }
      | { kind: "import" }
      | { kind: "restore"; generation?: number },
    signal?: AbortSignal,
  ) => {
    const { index, destination } = route.current;
    const origin = settingsPanel(destination);
    if (origin !== "data" && origin !== "account" && origin !== null) return;
    if (origin === null && source.kind !== "restore") return;
    const job = new AbortController();
    replacementJob.current?.abort();
    if (!signal) importJob.current?.abort();
    replacementJob.current = job;
    const isCurrent = () =>
      !job.signal.aborted &&
      !signal?.aborted &&
      route.current.index === index &&
      route.current.destination === destination;
    const reportError = (message: string) => {
      if (origin === "data") {
        const section =
          source.kind === "replace" ? source.section : "workspace";
        setDataError(message ? { section, message } : null);
      } else setLocalError(message);
    };
    if (origin === "data") setLocalError("");
    reportError("");
    resolveTargets(controller.navigationTargets(), () => {
      if (!isCurrent()) return;
      const { head, durable, storageMode } = controller.getSnapshot();
      if (!head || !durable || storageMode === "session") {
        reportError(
          storageMode === "session"
            ? "Return to durable saving before replacing or restoring the workspace."
            : "Durable saving is unavailable. Reload before replacing the workspace.",
        );
        return;
      }
      void (async () => {
        const incoming =
          source.kind === "replace"
            ? source.incoming
            : source.kind === "import"
              ? (await readGuestWorkspace())?.document
              : undefined;
        if (source.kind === "import" && !incoming)
          throw new Error("No workspace is saved in this browser as a guest.");
        if (!isCurrent()) return;
        const previous = await controller.previous();
        if (!isCurrent()) return;
        const matchesPrevious =
          previous?.workspaceId === head.workspaceId &&
          previous.generation === head.generation - 1;
        if (
          source.kind === "restore" &&
          (!matchesPrevious ||
            (source.generation !== undefined &&
              source.generation !== head.generation))
        ) {
          setPreviousRetry((retry) => retry + 1);
          void controller.refresh();
          throw new Error(
            "The previous workspace is no longer available for this replacement.",
          );
        }
        if (
          !sameWorkspaceRevision(controller.getSnapshot().head, head) ||
          (previous && !matchesPrevious)
        ) {
          await controller.refresh();
          throw new Error(
            "Saved content changed while opening the review. Open it again to review the current workspace.",
          );
        }
        if (source.kind === "restore" && previous) {
          setReview({ panel: origin, head, kind: "restore", previous });
        } else if (source.kind !== "restore" && incoming) {
          setReview({
            panel: origin,
            head,
            kind: source.kind,
            previous,
            incoming,
            filename: source.kind === "replace" ? source.filename : undefined,
          });
        }
        setExportChoice(null);
        setReviewFailure(null);
      })().catch((error: unknown) => {
        if (isCurrent())
          reportError(error instanceof Error ? error.message : String(error));
      });
    });
  };

  const retryUnconfirmed =
    reviewFailure?.reason === "offline" ||
    reviewFailure?.reason === "uncertain";
  const reviewedCopyUnavailable =
    review?.kind === "restore" &&
    !retryUnconfirmed &&
    (state.head?.workspaceId !== review.head.workspaceId ||
      state.head.generation !== review.head.generation ||
      (previousAvailability &&
        !previousAvailability.error &&
        !sameWorkspaceRevision(retained ?? null, review.previous)));
  const staleReview = Boolean(
    review &&
    (reviewedCopyUnavailable ||
      reviewFailure?.reason === "conflict" ||
      reviewFailure?.reason === "replaced" ||
      (!retryUnconfirmed && !sameWorkspaceRevision(state.head, review.head))),
  );
  const confirmWorkspaceReview = async () => {
    if (
      !review ||
      staleReview ||
      (review.kind !== "restore" && review.previous && !exportChoice)
    )
      return;
    const restored = review.kind === "restore";
    const result = await controller.replace(
      review.head,
      review.kind === "restore" ? undefined : review.incoming,
      review.kind === "import" ? "import" : "replace",
    );
    if (!result.ok) {
      setReviewFailure(result);
      if (
        result.reason === "conflict" ||
        result.reason === "replaced" ||
        (restored && result.reason === "invalid")
      ) {
        setPreviousRetry((retry) => retry + 1);
        void controller.refresh();
      }
      return;
    }
    setReplacementNotice({
      panel: review.panel,
      workspaceId: review.head.workspaceId,
      generation: review.head.generation + 1,
      restored,
    });
    setReview(null);
  };

  const importFile = async (
    source: File | ((signal: AbortSignal) => Promise<File>),
    section: DataActionSection,
  ) => {
    const filename = typeof source === "function" ? undefined : source.name;
    if (section === "drafts") setRecoveryImportFilename(null);
    const { index, destination } = route.current;
    importJob.current?.abort();
    replacementJob.current?.abort();
    const job = new AbortController();
    importJob.current = job;
    setImportPending(null);
    const isCurrent = () =>
      !job.signal.aborted &&
      route.current.index === index &&
      route.current.destination === destination;
    const progress = setTimeout(() => {
      if (isCurrent()) setImportPending(section);
    }, 500);
    try {
      const file =
        typeof source === "function" ? await source(job.signal) : source;
      if (!isCurrent()) return;
      const recovery = section === "drafts";
      if (file.size > (recovery ? RECOVERY_BYTES : WORKSPACE_BYTES))
        throw new Error("Import exceeds its byte limit.");
      const envelope = await importPortable(
        file,
        recovery ? "recovery" : "workspace",
        job.signal,
      );
      if (!isCurrent()) return;
      setLocalError("");
      setDataError(null);
      if (envelope.format === "verso.recovery") {
        await controller.importRecovery(envelope.drafts);
        if (isCurrent() && filename) setRecoveryImportFilename(filename);
      } else if (section !== "drafts") {
        requestWorkspaceReview(
          { kind: "replace", incoming: envelope.document, section, filename },
          job.signal,
        );
      }
    } catch (error) {
      if (isCurrent()) {
        setDataError({
          section,
          message:
            section === "drafts" && filename
              ? `Could not import “${filename}”. ${String(error)}`
              : String(error),
        });
      }
    } finally {
      clearTimeout(progress);
      if (importJob.current === job) setImportPending(null);
    }
  };
  const loadSample = async () => {
    setLoadingSample(true);
    setLocalError("");
    setDataError(null);
    try {
      await importFile(async (signal) => {
        const response = await fetch("/examples/alex-morgan.schema-2.json", {
          signal,
        });
        if (!response.ok)
          throw new Error(
            "Sample workspace could not be loaded. Please try again.",
          );
        return new File([await response.blob()], "alex-morgan.schema-2.json", {
          type: "application/json",
        });
      }, "sample");
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
  const comparingResumes = isResumeComparison(destination);
  const libraryKind = libraryDestinationKind(destination);
  const libraryDestination = libraryKind !== null;
  const scopeId = comparingResumes ? "" : scope.split("/")[1];
  // Creating a test or certificate always returns to its language entry.
  const evidenceReturn = scope.startsWith("language-evidence/")
    ? (state.draft?.values as { languageEntryId?: unknown } | undefined)
        ?.languageEntryId
    : undefined;
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
                : comparingResumes
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
          : scope.startsWith("language-evidence/")
            ? "New test or certificate"
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

  /** Resolve the language draft, then open one transaction that creates a
   * certification and attaches it. A language that was never saved stops here. */
  const createEvidence = (languageEntryId: string) =>
    resolveTargets(controller.navigationTargets(), () => {
      const head = controller.getSnapshot().head?.document;
      const owner = head?.sections.some(
        (section) =>
          section.kind === "languages" &&
          section.entries.some((entry) => entry.id === languageEntryId),
      );
      const target = head?.sections.find(
        (section) =>
          section.kind === "certifications" &&
          !section.archived &&
          section.entries.length < 300,
      );
      if (!owner || !target) {
        setLocalError(
          owner
            ? "Add a Certifications section before creating a test or certificate."
            : "Save the language before adding a test or certificate.",
        );
        return;
      }
      setLocalError("");
      const entry = createEntry("certifications");
      navigate(`language-evidence/${entry.id}`, {
        languageEntryId,
        sectionId: target.id,
        attachmentId: crypto.randomUUID(),
        entry,
      });
    });

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

  const reviewLayoutAsDefaults = (resumeId: string) => {
    const next = "settings/defaults";
    const generation = controller.getSnapshot().head?.generation;
    resolveTargets(routeTargets(next), () => {
      const head = controller.getSnapshot().head;
      const resume = head?.document.resumes.find(
        (item) => item.id === resumeId,
      );
      if (!head || head.generation !== generation || !resume) {
        setLocalError(
          "This resume is unavailable. Open a saved resume to use its layout.",
        );
        return;
      }
      setLocalError("");
      const appearance = layoutAppearance(resume.layout);
      navigate(
        next,
        sameAppearance(appearance, head.document.defaults)
          ? undefined
          : appearance,
      );
    });
  };

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
      if ((await controller.cancel(target)).kind !== "discarded") return false;
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
    createEntry: (sectionId, open) => {
      const { head, saving } = controller.getSnapshot();
      const section = head?.document.sections.find(
        ({ id }) => id === sectionId,
      );
      if (!section || saving || section.entries.length >= 300) return;
      const entry = createEntry(section.kind);
      open(`new-entry/${sectionId}/${entry.id}`, entry);
    },
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
        layout: structuredClone(appLayoutDefaults),
      };
      navigate(
        `${kind}/${base.id}`,
        kind === "starter"
          ? { ...base, sections: [], summaryIncluded: false }
          : base,
      );
    },
  };
  const addResume = () =>
    resolveTargets(controller.navigationTargets(), () => {
      navigate("resumes");
      setAddingResume(true);
    });
  const { create: createResume, compare: compareResumes } =
    resumeCollectionActions(documentValue, state.saving);
  const recoveryLabel = (draft: CareerDraft): string => {
    const [kind, id] = draft.scope.split("/");
    const values = draft.values as { name?: unknown } | null;
    const name = typeof values?.name === "string" ? values.name.trim() : "";
    const section = documentValue.sections.find((item) => item.id === id);
    if (kind === "entries") return `${section?.name || "Section"} entry order`;
    if (kind === "section" || kind === "new-section")
      return section?.name || name || "a new section";
    if (kind === "entry" || kind === "new-entry") {
      const entry = documentValue.sections
        .flatMap((item) => item.entries)
        .find((entry) => entry.id === id);
      if (entry) return careerEntryLabel(entry, contentLanguage);
      const parsed = entrySchema.safeParse(draft.values);
      return parsed.success
        ? careerEntryLabel(parsed.data, contentLanguage)
        : name || "an unsaved entry";
    }
    if (kind === "starter-create") return "a resume from a starter";
    if (kind.startsWith("resume") || kind === "selection") {
      const resume = documentValue.resumes.find((item) => item.id === id);
      const part = (
        {
          "resume-wording": "Wording",
          "resume-details": "Name & color",
          "resume-layout": "Layout",
          "resume-content": "Content & order",
          selection: "Content & order",
        } as Record<string, string>
      )[kind];
      return [resume?.name || name || "an untitled resume", part]
        .filter(Boolean)
        .join(" · ");
    }
    if (kind === "preset" || kind === "starter")
      return (
        name || (kind === "preset" ? "a layout preset" : "a resume starter")
      );
    return (
      (
        {
          "language-evidence": "a new test or certificate",
          profile: "Profile",
          summary: "Summary",
          languages: "Content languages",
          defaults: "Resume defaults",
          sections: "Section order",
        } as Record<string, string>
      )[kind] ?? "this form"
    );
  };
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
  const editingScope = destinationScope(view.destination);
  const reviewScope = inlineOrderReview ?? editingScope;
  const reviewTarget = reviewScope?.startsWith("entries/") ? "order" : "form";
  const reviewEditor =
    reviewTarget === "order" ? state.orderDraft : state.draft;
  const storedDraft =
    reviewScope &&
    !resolvedRecoveryScopes.includes(reviewScope) &&
    (!reviewEditor ||
      (reviewEditor.scope === reviewScope &&
        !controller.hasPreviewDraft(reviewEditor))) &&
    (inlineOrderReview || reviewEditor)
      ? recoveryForScope(state.recovery, reviewScope, reviewEditor?.draftId)
      : null;
  const savedRecoveryValues = storedDraft
    ? readScope(documentValue, storedDraft.scope)
    : undefined;
  const beforeEntryReorder = () => {
    const current = controller.getSnapshot();
    if (current.saving || storedDraft || !listSection) return false;
    const scope = `entries/${listSection.id}`;
    if (
      !current.orderDraft &&
      !resolvedRecoveryScopes.includes(scope) &&
      recoveryForScope(current.recovery, scope)
    ) {
      setInlineOrderReview(scope);
      return false;
    }
    return true;
  };
  const recoveryParent = (draft: CareerDraft, doc: CareerDocument): string => {
    const [kind, id] = draft.scope.split("/");
    if (kind === "defaults" || kind === "languages") return "settings/data";
    if (kind === "preset") return "presets";
    if (kind === "starter") return "starters";
    if (kind === "starter-create") return "resumes";
    if (kind.startsWith("resume") || kind === "selection")
      return doc.resumes.some((resume) => resume.id === id)
        ? `resume-overview/${id}`
        : "resumes";
    if (kind === "language-evidence") {
      const parent = (draft.values as { languageEntryId?: unknown } | null)
        ?.languageEntryId;
      const section = doc.sections.find((section) =>
        section.entries.some((entry) => entry.id === parent),
      );
      return section ? `list/${section.id}` : "overview";
    }
    const section =
      kind === "entry"
        ? doc.sections.find((section) =>
            section.entries.some((entry) => entry.id === id),
          )
        : doc.sections.find((section) => section.id === id);
    return section ? `list/${section.id}` : "overview";
  };
  const dismissRecovery = async (draft: CareerDraft) => {
    if (inlineOrderReview) {
      setInlineOrderReview(null);
      return;
    }
    if (
      reviewEditor &&
      (await controller.cancel(reviewTarget)).kind !== "discarded"
    )
      return;
    if (route.current.destination === view.destination)
      navigate(
        recoveryParent(
          draft,
          controller.getSnapshot().head?.document ?? documentValue,
        ),
        undefined,
        undefined,
        true,
      );
  };
  const recoveryDialog = storedDraft && (
    <DraftRecoveryDialog
      key={reviewScope}
      draft={storedDraft}
      document={documentValue}
      language={contentLanguage}
      name={recoveryLabel(storedDraft)}
      subject={
        (storedDraft.scope.startsWith("entry/") ||
          storedDraft.scope.startsWith("new-entry/")) &&
        contextSection
          ? contextSection.kind === "experience"
            ? "this experience"
            : `this ${CAREER_TERMS[contextSection.kind].entry}`
          : undefined
      }
      saved={savedRecoveryValues != null}
      saving={state.saving}
      onDismiss={() => void dismissRecovery(storedDraft)}
      onContinue={async (draft) => {
        const recovery = await controller.reloadRecovery();
        if (route.current.destination !== view.destination) return;
        const current =
          recovery &&
          recoveryForScope(
            recovery,
            reviewScope ?? draft.scope,
            reviewEditor?.draftId,
          );
        if (recovery && (!current || !matchesDraftVersion(draft, current)))
          return;
        if (controller.restore(draft, true)) setInlineOrderReview(null);
      }}
      onDiscard={async (draft) => {
        await controller.refresh("local");
        if (route.current.destination !== view.destination)
          return "unconfirmed";
        const result = await controller.discardRecovery(draft);
        if (
          result !== "discarded" ||
          route.current.destination !== view.destination
        )
          return result;
        const head = controller.getSnapshot().head;
        if (head && readScope(head.document, draft.scope) != null) {
          setResolvedRecoveryScopes((scopes) => [
            ...scopes,
            reviewScope ?? draft.scope,
          ]);
          setInlineOrderReview(null);
          if (reviewEditor)
            controller.open(reviewEditor.scope, reviewTarget, true);
        } else await dismissRecovery(draft);
        return result;
      }}
    />
  );
  const uncertainSave =
    state.saveStatus.kind === "failed" &&
    state.saveStatus.reason === "uncertain";
  const recoveryIssue = (target: CareerDraftTarget) => {
    const order = target === "order";
    const draft = order ? state.orderDraft : state.draft;
    const failed = (
      order ? state.orderRecoveryStatus : state.recoveryStatus
    ).startsWith("Recovery failed");
    const reconcile =
      uncertainSave &&
      draft?.operationId &&
      !(order ? orderConflict : formConflict);
    return draft && (failed || reconcile) ? (
      <Alert>
        <AlertTitle>
          {reconcile
            ? "Save outcome unknown"
            : "Edits could not be stored on this device"}
        </AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          {reconcile && (
            <>
              <p>
                Update the draft to the current saved content, review it, then
                Save.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={state.saving}
                onClick={() => controller.reconcile(target)}
              >
                Update to current
              </Button>
            </>
          )}
          {failed && (
            <>
              <p>
                Keep this tab open or export your edits to recover them later.
              </p>
              <Button variant="outline" size="sm" onClick={exportRecovery}>
                Export recovery
              </Button>
            </>
          )}
        </AlertDescription>
      </Alert>
    ) : null;
  };
  const formReviewOpen = Boolean(storedDraft && reviewTarget === "form");
  const listedRecovery = state.recovery.filter(
    (draft) =>
      draft.draftId !== state.draft?.draftId &&
      draft.draftId !== state.orderDraft?.draftId,
  );
  const undoReplacement = (
    <Button
      size="sm"
      variant="outline"
      className="justify-self-start"
      disabled={state.saving || !canReplaceWorkspace}
      onClick={() =>
        requestWorkspaceReview({
          kind: "restore",
          generation: state.head?.generation,
        })
      }
    >
      Undo replacement
    </Button>
  );
  const noticeOffersUndo =
    currentReplacementNotice &&
    !currentReplacementNotice.restored &&
    canReplaceWorkspace &&
    (previousAvailable || !previousAvailability || previousAvailability.error);
  const workspaceReplacementNotice = currentReplacementNotice ? (
    <Alert role="status">
      <AlertTitle>
        {currentReplacementNotice.restored
          ? "Previous workspace restored"
          : "Workspace replaced"}
      </AlertTitle>
      {noticeOffersUndo && (
        <>
          <AlertDescription>{PREVIOUS_WORKSPACE_EXPLANATION}</AlertDescription>
          {undoReplacement}
        </>
      )}
    </Alert>
  ) : null;
  const dataSectionFeedback = (section: DataActionSection) => {
    const error = [
      section === "workspace" ? state.error : "",
      section === "workspace" ? localError : "",
      section === "drafts" ? state.orderError : "",
      dataError?.section === section ? dataError.message : "",
    ]
      .filter(Boolean)
      .join("\n");
    return (
      <>
        {importPending === section && (
          <p role="status" className="text-sm text-muted-foreground">
            Validating import… Your saved workspace is unchanged.
          </p>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Action needs attention</AlertTitle>
            <AlertDescription className="wrap-anywhere whitespace-pre-wrap">
              {error}
            </AlertDescription>
          </Alert>
        )}
      </>
    );
  };
  const dataPanel = (
    <div className="flex flex-col gap-4">
      <SettingsSection
        title="Workspace"
        description="Backups contain saved career details, resumes, and workspace settings. Importing a backup opens a review before replacing the workspace."
      >
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          {accountMode ? (
            <p>
              Saved content is stored in your account. Drafts and unconfirmed
              Saves stay in this browser. Clearing browser storage or eviction
              can remove them.
            </p>
          ) : state.storageMode === "durable" ? (
            <p>
              Saved content is stored in this browser. Clearing browser storage
              or eviction can remove local data.
            </p>
          ) : null}
          <p role="status">{state.status}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              try {
                exportWorkspace();
              } catch (error) {
                setDataError({ section: "workspace", message: String(error) });
              }
            }}
          >
            <Download data-icon="inline-start" aria-hidden="true" />
            Download workspace backup
          </Button>
          <RestoreFileButton
            id="workspace-import"
            label="Import workspace backup"
            icon={FileUp}
            onSelect={(file) => void importFile(file, "workspace")}
          />
        </div>
        {dataSectionFeedback("workspace")}
        {panel === "data" && workspaceReplacementNotice}
        {previousAvailable && !noticeOffersUndo && (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">
              {PREVIOUS_WORKSPACE_EXPLANATION}
            </p>
            {undoReplacement}
          </div>
        )}
        {previousAvailability?.error && (
          <Alert variant="destructive">
            <AlertTitle>Could not check for a previous workspace</AlertTitle>
            <AlertDescription>{previousAvailability.error}</AlertDescription>
            <Button
              size="sm"
              variant="outline"
              className="justify-self-start"
              onClick={() => setPreviousRetry((retry) => retry + 1)}
            >
              Retry previous workspace check
            </Button>
          </Alert>
        )}
      </SettingsSection>
      <Separator />
      <Collapsible>
        <h3>
          <CollapsibleTrigger
            render={<Button size="sm" variant="ghost" />}
            className={disclosureTriggerClassName}
          >
            <DisclosureChevron />
            <DisclosureLabel>Draft recovery</DisclosureLabel>
          </CollapsibleTrigger>
        </h3>
        <CollapsibleContent>
          <DisclosureGuide>
            <SettingsSection
              title="Unsaved drafts"
              description="Recover edits after a reload, crash, or closed tab. Import drafts from another browser to continue editing them here."
            >
              <RecoveryList
                drafts={listedRecovery}
                disabled={state.saving}
                label={recoveryLabel}
                document={documentValue}
                language={contentLanguage}
                outdated={(draft) =>
                  Boolean(state.head && draftConflict(state.head, draft))
                }
                onRestore={restoreRecovery}
                onDiscard={(draft) => controller.discardRecovery(draft)}
                onExport={exportRecovery}
              />
              {!canExportDrafts && (
                <p className="text-sm text-muted-foreground">
                  No unsaved drafts on this device
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <RestoreFileButton
                  id="recovery-import"
                  label="Import unsaved drafts"
                  icon={FilePenLine}
                  onSelect={(file) => void importFile(file, "drafts")}
                />
                {canExportDrafts && (
                  <Button size="sm" variant="outline" onClick={exportRecovery}>
                    <Download data-icon="inline-start" aria-hidden="true" />
                    Export unsaved drafts
                  </Button>
                )}
                {panel === "data" && (state.draft || state.orderDraft) && (
                  <Button
                    size="sm"
                    variant="outline"
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
              </div>
              {dataSectionFeedback("drafts")}
              {recoveryImportFilename && (
                <p role="status" className="text-sm wrap-anywhere">
                  Imported recovery file <bdi>{recoveryImportFilename}</bdi>.
                </p>
              )}
              {rawExport && canExportDrafts && (
                <Button
                  size="sm"
                  variant="outline"
                  className="self-start"
                  onClick={() => downloadRecovery(true)}
                >
                  Export raw recovery chunks
                </Button>
              )}
            </SettingsSection>
          </DisclosureGuide>
        </CollapsibleContent>
      </Collapsible>
      <Separator />
      <SettingsSection
        title="Sample workspace"
        description="Open a review of fictional career details and resumes."
      >
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          disabled={loadingSample || state.saving || !canReplaceWorkspace}
          onClick={() => void loadSample()}
        >
          {loadingSample ? "Loading sample…" : "Load sample workspace"}
        </Button>
        {dataSectionFeedback("sample")}
      </SettingsSection>
      <Separator />
      <DeleteWorkspaceData
        owner={accountMode ? "account" : "guest"}
        head={state.head}
        available={canReplaceWorkspace}
        busy={state.saving}
        unsaved={
          listedRecovery.length +
          (["form", "order"] as const).filter((target) =>
            controller.isDirty(target),
          ).length
        }
        previousAvailable={previousAvailable}
        publicLinks={
          releases?.state.list
            ? {
                links: releases.state.list.links.length,
                releases: releases.state.list.links.reduce(
                  (sum, link) => sum + link.releases.length,
                  0,
                ),
              }
            : undefined
        }
        deletion={state.workspaceDeletion}
        exportWorkspace={(head) => exportWorkspace(head)}
        refreshRecovery={async () => {
          await controller.reloadRecovery();
        }}
        onDelete={(reviewed) => controller.deleteWorkspaceData(reviewed)}
        onResolve={(id) => controller.resolveWorkspaceDeletion(id)}
        onRetry={(id) => controller.retryWorkspaceDeletion(id)}
        onCancelAttempt={(id) => controller.cancelWorkspaceDeletion(id)}
        onDeleted={(result) =>
          toast.add({
            type: "success",
            title:
              result.by === "another-request"
                ? "Workspace data was already deleted"
                : "Workspace data deleted",
            description:
              result.cleanup === "pending"
                ? "You're starting fresh. This browser's local copy still needs clearing in Settings › Data."
                : "You're starting fresh.",
          })
        }
      />
    </div>
  );
  const settingsForm =
    state.draft && settingsDraft ? (
      <div className="flex flex-col gap-4">
        {recoveryIssue("form")}
        <fieldset
          disabled={state.saving || formReviewOpen}
          className="flex flex-col gap-4"
        >
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
        {formConflict && !formReviewOpen ? (
          <ConflictPanel
            conflict={formConflict}
            disabled={state.saving}
            onKeepDraft={() => controller.reconcile()}
            onUseSaved={() => {
              const savedScope = state.draft!.scope;
              return controller.cancel().then((outcome) => {
                if (outcome.kind === "discarded") controller.open(savedScope);
              });
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
            disabled={
              (!controller.isDirty() && !restoredDraft) ||
              state.saving ||
              formReviewOpen
            }
            onClick={() => {
              const savedScope = state.draft!.scope;
              void controller.cancel().then((outcome) => {
                if (outcome.kind === "discarded") controller.open(savedScope);
              });
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={!controller.isDirty() || state.saving || formReviewOpen}
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
      >
        {panel === "editing-preview" ? (
          <DeviceSettings
            values={state.preferences}
            change={(patch) => void controller.changePreferences(patch)}
          />
        ) : panel === "data" ? (
          dataPanel
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
                disabled={state.saving || !canReplaceWorkspace}
                review={() => requestWorkspaceReview({ kind: "import" })}
                error={localError}
                notice={workspaceReplacementNotice}
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
        {panel ? recoveryDialog : null}
      </SettingsDialog>
      {!panel ? recoveryDialog : null}
      <SignOutConfirmation
        actions={accountActions}
        unconfirmed={unconfirmedAccountWork}
        exportRecovery={exportRecovery}
      />

      <ResumeManager
        document={documentValue}
        saving={state.saving}
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
            if ((await controller.cancel(target)).kind !== "discarded")
              return false;
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
            addResume={addResume}
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
            onMobilePreview={preview.commands.mobile}
            output={(visible) =>
              state.head && previewResume ? (
                <LiveOutput
                  preview={preview}
                  head={state.head}
                  resume={previewResume}
                  visible={visible}
                  showSelector={!activeResume}
                  canPublish={Boolean(accountMode && releases)}
                  onIssue={openOutputIssue}
                  reading={reading}
                />
              ) : null
            }
          >
            {state.head && (
              <LivePdfRelease
                coordinator={preview.coordinator}
                releases={accountMode ? releases : null}
                workspaceId={state.head.workspaceId}
              />
            )}
            {state.recoveryCleanupPending && (
              <Alert>
                <AlertTitle>Recovery cleanup pending</AlertTitle>
                <AlertDescription>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void controller.retryRecoveryCleanup()}
                  >
                    Retry recovery cleanup
                  </Button>
                </AlertDescription>
              </Alert>
            )}
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
                    : destination === "resumes" || comparingResumes
                      ? "Resumes · Independent content and wording"
                      : libraryDestination
                        ? "Library - Reusable configurations"
                        : destination === "backups"
                          ? "Workspace"
                          : "Career details · Shared content"}
                </p>
              </div>
              {destination === "resumes" && (
                <div className="ms-auto flex max-w-full flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    disabled={compareResumes.disabled}
                    onClick={() => navigate("resume-compare")}
                  >
                    <Columns2 data-icon="inline-start" />
                    {compareResumes.label}
                  </Button>
                  <Button disabled={createResume.disabled} onClick={addResume}>
                    <Plus data-icon="inline-start" />
                    {createResume.label}
                  </Button>
                </div>
              )}
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
            {rawExport && canExportDrafts && (
              <Button variant="outline" onClick={() => downloadRecovery(true)}>
                Export raw recovery chunks
              </Button>
            )}
            {!panel && workspaceReplacementNotice}
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
                          if (done) {
                            setReplacementNotice({
                              panel: null,
                              workspaceId: sessionReview.head.workspaceId,
                              generation: sessionReview.head.generation + 1,
                              restored: false,
                            });
                            setSessionReview(null);
                          } else
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
            {listSection && recoveryIssue("order")}
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
                  onUseSaved={() => void controller.cancel("order")}
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
                saving={
                  state.saving ||
                  Boolean(storedDraft && reviewTarget === "order")
                }
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
                onCancel={() => void controller.cancel("order")}
                onOpen={(entry) => navigate(`entry/${entry.id}`)}
                onCreate={() =>
                  careerActions.createEntry(listSection.id, navigate)
                }
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
                <CareerResumeCollection
                  document={documentValue}
                  navigate={navigate}
                  actions={resumeActions}
                />
              ) : destination.startsWith("resume-overview/") && activeResume ? (
                <ResumeOverview
                  document={documentValue}
                  resume={activeResume}
                />
              ) : comparingResumes ? (
                <ResumeComparison
                  key={`${destination}:${comparisonVisit}`}
                  document={documentValue}
                  initialLeftId={destination.split("/")[1]}
                />
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
                    {recoveryIssue("form")}
                    <fieldset disabled={state.saving || formReviewOpen}>
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
                        void controller.cancel().then((outcome) => {
                          if (outcome.kind === "discarded")
                            navigate(`resume-overview/${activeResume.id}`);
                        })
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
                  data-live-preview-editor={keepPreviewCurrent ? "" : undefined}
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
                      {recoveryIssue("form")}
                      <fieldset
                        disabled={state.saving || formReviewOpen}
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
                            <Button
                              id="use-layout-for-blank-resumes"
                              variant="outline"
                              className="h-auto min-h-8 max-w-full self-start py-1 text-start whitespace-normal"
                              onClick={() =>
                                reviewLayoutAsDefaults(activeResume.id)
                              }
                            >
                              Use this layout for new blank resumes…
                            </Button>
                            <LayoutFields
                              focusField={
                                issueFocus?.scope === "resume-layout"
                                  ? issueFocus.fieldId
                                  : undefined
                              }
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
                            preview={preview.coordinator}
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
                            preview={preview.coordinator}
                            focusRequest={
                              issueFocus?.scope === "resume-content"
                                ? issueFocus
                                : null
                            }
                            disabled={state.saving}
                            key={state.draft.draftId}
                            scope={state.draft.scope}
                            values={state.draft.values}
                            document={documentValue}
                            language={contentLanguage}
                            onChange={(values) => controller.change(values)}
                            onCreateEvidence={createEvidence}
                            onOpenEntry={(entryId) =>
                              navigate(`entry/${entryId}`)
                            }
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
                        !formReviewOpen &&
                        !(
                          formConflict.saved === undefined &&
                          !formConflict.replaced
                        ) && (
                          <ConflictPanel
                            conflict={formConflict}
                            disabled={state.saving}
                            onKeepDraft={() => controller.reconcile()}
                            onUseSaved={() => void controller.cancel()}
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
                          void controller.cancel().then((outcome) => {
                            if (outcome.kind === "discarded")
                              navigate(
                                typeof evidenceReturn === "string"
                                  ? `entry/${evidenceReturn}`
                                  : scope.startsWith("resume/")
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
                              );
                          })
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
                                typeof evidenceReturn === "string"
                                  ? `entry/${evidenceReturn}`
                                  : scope.startsWith("resume/")
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
                dataPanel
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
                    {kind === "languages" && (
                      <FieldDescription>
                        Languages you speak, with optional proficiency and test
                        results. Settings › Content languages controls the
                        languages you write resumes in.
                      </FieldDescription>
                    )}
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
                    {guard?.issueNavigation
                      ? "Save your changes before opening the editor for this issue."
                      : guard?.targets[0] === "order"
                        ? "Save or discard the pending entry order before leaving this section. Cancel keeps editing."
                        : "Save or discard this form's changes before leaving it. Cancel keeps editing."}
                  </DialogDescription>
                </DialogHeader>
                {guard?.issueNavigation && state.error && (
                  <p role="alert" className="text-sm text-destructive">
                    {state.error}
                  </p>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setGuard(null)}>
                    {guard?.issueNavigation ? "Keep editing" : "Cancel"}
                  </Button>
                  {!guard?.issueNavigation && (
                    <Button
                      variant="outline"
                      disabled={state.saving}
                      onClick={() => void resolveGuard(false)}
                    >
                      Discard
                    </Button>
                  )}
                  <Button
                    disabled={state.saving}
                    onClick={() => void resolveGuard(true)}
                  >
                    {guard?.issueNavigation ? "Save and go" : "Save"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <WorkspaceReplacementDialog
              review={review}
              saving={state.saving}
              stale={staleReview}
              error={
                retryUnconfirmed
                  ? "Your account did not confirm this change. Retry from this review to check the same request."
                  : reviewedCopyUnavailable
                    ? `${PREVIOUS_WORKSPACE_UNAVAILABLE} Close this review to see the current workspace options.`
                    : staleReview
                      ? "Saved content changed since this review. Close it and review the current workspace again."
                      : (reviewFailure?.message ?? "")
              }
              exportChoice={exportChoice}
              onClose={() => setReview(null)}
              onDownload={(previous) => {
                try {
                  exportWorkspace(previous);
                  setExportChoice("downloaded");
                  setReviewFailure(null);
                } catch (error) {
                  setReviewFailure({
                    message: `Download failed. Try again or continue without downloading. ${String(error)}`,
                  });
                }
              }}
              onContinue={() => {
                setExportChoice("skipped");
                setReviewFailure(null);
              }}
              onConfirm={() => void confirmWorkspaceReview()}
            />
          </CareerWorkspaceShell>
        )}
      </ResumeManager>
    </div>
  );
}
