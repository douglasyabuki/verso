"use client";

import {
  BookOpen,
  Braces,
  Check,
  ChevronRight,
  Download,
  FileText,
  FolderOpen,
  Languages,
  Layers2,
  Loader2,
  Menu,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import {
  ContentEditor,
  SettingsEditor,
  TranslationsEditor,
  VariantsEditor,
} from "@/components/resume/editors";
import type { ConfirmAction } from "@/components/resume/fields";
import { ThemeSelector } from "@/components/theme-selector";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useResumeCompiler } from "@/hooks/resume/use-resume-compiler";
import { useMediaQuery } from "@/hooks/use-media-query";
import { createExampleDocument } from "@/lib/resume/example";
import {
  bilingualZip,
  downloadFile,
  fileSlug,
  latexZip,
} from "@/lib/resume/files";
import type {
  DocumentUpdate,
  Locale,
  ResumeDocument,
  Section,
} from "@/lib/resume/model";
import {
  createEmptyDocument,
  locales,
  localized,
  localizedFields,
  parseBackup,
  plain,
  serializeBackup,
  validateOutput,
} from "@/lib/resume/model";

const PdfPreview = dynamic(() => import("@/components/resume/pdf-preview"), {
  ssr: false,
  loading: () => (
    <p className="p-8 text-sm text-muted-foreground">Loading PDF viewer…</p>
  ),
});
type Action =
  | { type: "edit"; update: DocumentUpdate }
  | { type: "replace"; document: ResumeDocument };

/** Apply edits to an isolated draft. @param document Current workspace. @param action Edit or validated replacement. @returns New workspace revision. @example reducer(doc, {type: "replace", document: imported}) */
function reducer(document: ResumeDocument, action: Action): ResumeDocument {
  if (action.type === "replace") return structuredClone(action.document);
  const draft = structuredClone(document);
  action.update(draft);
  draft.revision++;
  return draft;
}

const views = [
  {
    id: "content",
    label: "Content",
    icon: FolderOpen,
    description: "Build your career library",
  },
  {
    id: "translations",
    label: "Translations",
    icon: Languages,
    description: "Two languages. One story.",
  },
  {
    id: "variants",
    label: "Variants",
    icon: Layers2,
    description: "Choose what matters for each resume",
  },
  {
    id: "template",
    label: "Template",
    icon: Settings2,
    description: "Give your story room to breathe",
  },
];
const statusLabels: Record<string, string> = {
  idle: "Ready",
  queued: "Preview queued",
  initializing: "Loading compiler",
  ready: "Compiler ready",
  compiling: "Compiling PDF",
  successful: "Preview ready",
  failed: "Needs attention",
  "timed-out": "Compilation timed out",
};

export function Workspace() {
  const [document, dispatch] = useReducer(
    reducer,
    undefined,
    createEmptyDocument,
  );
  const [view, setView] = useState("content");
  const [sectionId, setSectionId] = useState("profile");
  const [variantId, setVariantId] = useState("general");
  const [locale, setLocale] = useState<Locale>("en-US");
  const [autoSync, setAutoSync] = useState(true);
  const [mobilePanel, setMobilePanel] = useState("editor");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [backup, setBackup] = useState(() =>
    serializeBackup(createEmptyDocument()),
  );
  const [recovery, setRecovery] = useState<{
    document: ResumeDocument;
    backup: string;
  }>();
  const [confirmation, setConfirmation] = useState<{
    title: string;
    description: string;
    action: () => void;
  }>();
  const [message, setMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const variant =
    document.variants.find((item) => item.id === variantId) ||
    document.variants[0];
  const section = document.sections.find((section) => section.id === sectionId);
  const serialized = useMemo(() => serializeBackup(document), [document]);
  const dirty = serialized !== backup;
  const validation = useMemo(
    () => validateOutput(document, variant, locale),
    [document, variant, locale],
  );
  const compiler = useResumeCompiler({
    document,
    variantId: variant.id,
    locale,
    autoSync,
    ...document.compiler,
  });
  const update = useCallback(
    (update: DocumentUpdate) => dispatch({ type: "edit", update }),
    [],
  );
  const confirm: ConfirmAction = (title, description, action) =>
    setConfirmation({ title, description, action });
  const reviewCount = localizedFields(document).filter(
    (field) =>
      field.value[locale].needsReview && plain(field.value, locale).trim(),
  ).length;
  const totalEntries = document.sections.reduce(
    (count, section) =>
      count + section.entries.filter((entry) => !entry.archived).length,
    0,
  );
  const busy =
    exporting ||
    compiler.status === "initializing" ||
    compiler.status === "compiling";

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const exportJson = () => {
    try {
      parseBackup(serialized);
    } catch (error) {
      setDownloadError(
        `Cannot export a portable backup: ${(error as Error).message}`,
      );
      return;
    }
    downloadFile(
      serialized,
      `${fileSlug(document.profile.name)}-workspace-r${document.revision}.json`,
      "application/json",
    );
    setBackup(serialized);
    setMessage("JSON backup export started for the current workspace.");
  };
  const importJson = async (file?: File) => {
    if (!file) return;
    try {
      if (!file.name.toLowerCase().endsWith(".json") || file.size > 5_000_000)
        throw new Error("Choose a JSON backup no larger than 5 MB.");
      const imported = parseBackup(await file.text());
      confirm(
        "Replace this workspace?",
        `Import ${imported.profile.name || "an unfinished profile"}, ${imported.sections.reduce((n, section) => n + section.entries.length, 0)} entries, and ${imported.variants.length} variants using ${imported.template.id}@${imported.template.version}. This replaces content and all template settings. One in-memory recovery snapshot will be kept.`,
        () => {
          setRecovery({ document: structuredClone(document), backup });
          dispatch({ type: "replace", document: imported });
          setBackup(serializeBackup(imported));
          setVariantId(imported.variants[0].id);
          setSectionId("profile");
          setMessage(
            "JSON workspace imported. The previous workspace can be recovered during this session.",
          );
        },
      );
    } catch (error) {
      setDownloadError((error as Error).message);
    } finally {
      if (input.current) input.current.value = "";
    }
  };
  const runExport = async (kind: "pdf" | "both" | "latex") => {
    setExporting(true);
    setDownloadError("");
    const snapshot = structuredClone(document);
    const selected = variant.id;
    const selectedLocale = locale;
    const prefix = `${fileSlug(snapshot.profile.name)}-${fileSlug(variant.name)}-r${snapshot.revision}`;
    try {
      if (kind === "both") {
        for (const language of locales) {
          const issues = validateOutput(
            snapshot,
            snapshot.variants.find((item) => item.id === selected)!,
            language,
          ).errors;
          if (issues.length)
            throw new Error(
              `Bilingual export needs valid ${language} content: ${issues.map((issue) => issue.message).join(" ")}`,
            );
        }
        const outputs = [];
        for (const language of locales)
          outputs.push(await compiler.getPdf(snapshot, selected, language));
        downloadFile(
          bilingualZip(snapshot, variant.name, outputs),
          prefix + "-bilingual.zip",
          "application/zip",
        );
      } else {
        const output = await compiler.getPdf(
          snapshot,
          selected,
          selectedLocale,
        );
        if (kind === "latex")
          downloadFile(
            await latexZip(output),
            `${prefix}-${selectedLocale}-latex.zip`,
            "application/zip",
          );
        else
          downloadFile(
            output.bytes,
            `${prefix}-${selectedLocale}.pdf`,
            "application/pdf",
          );
      }
      setMessage(
        `${kind === "both" ? "Bilingual ZIP" : kind === "latex" ? "LaTeX and assets" : "PDF"} download started. JSON backup freshness is unchanged.`,
      );
    } catch (error) {
      setDownloadError((error as Error).message);
    } finally {
      setExporting(false);
    }
  };
  const navigate = (next: string) => {
    setView(next);
    setMobilePanel("editor");
    setSheetOpen(false);
  };
  const addSection = () => {
    const id = crypto.randomUUID();
    const section: Section = {
      id,
      kind: "custom",
      heading: localized("Custom section", "Seção personalizada"),
      entries: [],
    };
    update((draft) => {
      draft.sections.push(section);
      draft.variants.forEach((variant) =>
        variant.sections.push({ sectionId: id, visible: true, entries: [] }),
      );
    });
    setSectionId(id);
    setView("content");
    setMobilePanel("editor");
  };
  const navigation = (
    <nav
      className="flex h-full flex-col gap-5 p-4"
      aria-label="Workspace navigation"
    >
      <div className="flex items-center gap-2 px-2 py-3">
        <BookOpen className="size-6" />
        <span className="text-xl font-semibold tracking-tight">
          verso<span className="text-muted-foreground">.</span>
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {views.map((item) => (
          <Button
            key={item.id}
            variant={view === item.id ? "secondary" : "ghost"}
            className="justify-start"
            aria-pressed={view === item.id}
            onClick={() => navigate(item.id)}
          >
            <item.icon data-icon="inline-start" />
            {item.label}
            {item.id === "translations" && reviewCount > 0 && (
              <Badge variant="outline" className="ml-auto">
                {reviewCount}
              </Badge>
            )}
          </Button>
        ))}
      </div>
      <Separator />
      <div className="flex min-h-0 flex-col gap-1 overflow-auto">
        <p className="px-2 py-1 text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
          Career library
        </p>
        <Button
          variant={
            view === "content" && sectionId === "profile"
              ? "secondary"
              : "ghost"
          }
          className="justify-start"
          onClick={() => {
            setSectionId("profile");
            navigate("content");
          }}
        >
          Profile
        </Button>
        {document.sections.map((section) => (
          <Button
            key={section.id}
            variant={
              view === "content" && sectionId === section.id
                ? "secondary"
                : "ghost"
            }
            className="min-w-0 justify-between gap-2"
            onClick={() => {
              setSectionId(section.id);
              navigate("content");
            }}
          >
            <span className="truncate">
              {plain(section.heading, locale) || "Untitled section"}
            </span>
            <span className="text-xs text-muted-foreground">
              {section.entries.filter((entry) => !entry.archived).length}
            </span>
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="justify-start"
          disabled={document.sections.length >= 30}
          onClick={addSection}
        >
          <Plus data-icon="inline-start" />
          Custom section
        </Button>
      </div>
      <div className="mt-auto flex flex-col gap-2 border-t pt-4">
        <p className="px-2 text-xs text-muted-foreground">
          {totalEntries} entries · {document.variants.length} variants
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            confirm(
              "Load the fictional example?",
              "This replaces the current workspace. One in-memory recovery snapshot will be kept. Export JSON first to keep a durable copy.",
              () => {
                setRecovery({ document: structuredClone(document), backup });
                dispatch({
                  type: "replace",
                  document: createExampleDocument(),
                });
                setVariantId("general");
                setSectionId("profile");
                setMessage(
                  "Fictional example loaded. Export JSON to keep your edits.",
                );
              },
            )
          }
        >
          Load example
        </Button>
      </div>
    </nav>
  );
  const editor = (
    <div className="@container h-full overflow-auto p-4 sm:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
              <span>Workspace</span>
              <ChevronRight className="size-3" />
              <span>{views.find((item) => item.id === view)?.label}</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {view === "content"
                ? sectionId === "profile"
                  ? "A story worth sharing."
                  : plain(section?.heading || localized(), locale) ||
                    "Career library"
                : views.find((item) => item.id === view)?.label}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {views.find((item) => item.id === view)?.description}
            </p>
          </div>
          {view === "content" && section?.kind === "custom" && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete custom section"
              onClick={() =>
                confirm(
                  "Delete this custom section?",
                  "All entries, achievements, and references to this section will be removed from every variant.",
                  () => {
                    update((draft) => {
                      draft.sections = draft.sections.filter(
                        (item) => item.id !== section.id,
                      );
                      draft.variants.forEach((variant) => {
                        variant.sections = variant.sections.filter(
                          (item) => item.sectionId !== section.id,
                        );
                      });
                    });
                    setSectionId("profile");
                  },
                )
              }
            >
              <Trash2 />
            </Button>
          )}
        </div>
        {view === "content" && (
          <ContentEditor
            key={sectionId}
            document={document}
            locale={locale}
            variant={variant}
            update={update}
            confirm={confirm}
            sectionId={sectionId}
            errors={validation.errors}
          />
        )}
        {view === "translations" && (
          <TranslationsEditor document={document} update={update} />
        )}
        {view === "variants" && (
          <VariantsEditor
            document={document}
            locale={locale}
            variant={variant}
            update={update}
            confirm={confirm}
            onVariant={setVariantId}
          />
        )}
        {view === "template" && (
          <SettingsEditor
            document={document}
            locale={locale}
            variant={variant}
            update={update}
          />
        )}
        <p className="pb-6 text-xs text-muted-foreground">
          Your draft is only in this tab. Export JSON regularly. Browser
          leaving-page warnings are best-effort and may not appear on tab
          closure or device shutdown.
        </p>
      </div>
    </div>
  );
  const preview = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background px-4 py-3">
        <span className="text-xs text-muted-foreground" role="status">
          {!autoSync && compiler.stale && !busy && !compiler.error
            ? "Auto-sync paused · Refresh to update"
            : statusLabels[compiler.status] || compiler.status}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <Field orientation="horizontal" className="w-auto">
            <Checkbox
              id="preview-auto-sync"
              checked={autoSync}
              onCheckedChange={setAutoSync}
              aria-describedby="preview-auto-sync-help"
            />
            <FieldLabel htmlFor="preview-auto-sync">Auto-sync</FieldLabel>
            <span id="preview-auto-sync-help" className="sr-only">
              Update the PDF preview after 800 milliseconds without changes.
              Turn off to refresh manually.
            </span>
          </Field>
          <Button
            variant="ghost"
            size="sm"
            onClick={compiler.refresh}
            disabled={busy}
          >
            <RefreshCw data-icon="inline-start" />
            Refresh
          </Button>
        </div>
      </div>
      {validation.errors.length > 0 && (
        <Alert className="rounded-none border-x-0">
          <AlertTitle>Draft needs {locale} content</AlertTitle>
          <AlertDescription>
            {validation.errors
              .slice(0, 3)
              .map((error) => error.message)
              .join(" ")}
            {validation.errors.length > 3
              ? ` +${validation.errors.length - 3} more issues.`
              : ""}{" "}
            A valid individual language can still be downloaded.
          </AlertDescription>
        </Alert>
      )}
      {validation.warnings.length > 0 && (
        <Alert className="rounded-none border-x-0">
          <AlertTitle>
            {validation.warnings.length} translation review flag
            {validation.warnings.length === 1 ? "" : "s"}
          </AlertTitle>
          <AlertDescription>
            You can preview and download this draft while reviewing its wording.
          </AlertDescription>
        </Alert>
      )}
      {compiler.error && validation.errors.length === 0 && (
        <Alert variant="destructive" className="rounded-none">
          <AlertTitle>Compilation could not finish</AlertTitle>
          <AlertDescription>
            {compiler.error.message} Previous preview retained. If assets are
            missing, run npm run compiler:prepare.
          </AlertDescription>
        </Alert>
      )}
      <div className="min-h-0 flex-1">
        <PdfPreview
          key={compiler.preview?.key}
          output={compiler.preview}
          stale={compiler.stale}
        />
      </div>
      {(compiler.error?.log || compiler.preview?.log) && (
        <details className="border-t bg-background p-3">
          <summary className="cursor-pointer text-xs">
            Compiler diagnostics
          </summary>
          <pre className="mt-3 max-h-60 overflow-auto text-xs whitespace-pre-wrap">
            {compiler.error?.log || compiler.preview?.log}
          </pre>
        </details>
      )}
    </div>
  );
  return (
    <div className="flex h-svh min-h-0 overflow-hidden bg-background">
      <aside className="hidden w-52 shrink-0 border-r bg-muted/25 md:block">
        {navigation}
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div className="md:hidden">
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Open workspace navigation"
                    />
                  }
                >
                  <Menu />
                </SheetTrigger>
                <SheetContent side="left">
                  <SheetHeader>
                    <SheetTitle>Verso workspace</SheetTitle>
                    <SheetDescription>
                      Career content, translations, and variants.
                    </SheetDescription>
                  </SheetHeader>
                  {navigation}
                </SheetContent>
              </Sheet>
            </div>
            <label htmlFor="variant-picker" className="sr-only">
              Active resume variant
            </label>
            <NativeSelect
              id="variant-picker"
              value={variant.id}
              onChange={(event) => setVariantId(event.target.value)}
            >
              {document.variants.map((variant) => (
                <NativeSelectOption key={variant.id} value={variant.id}>
                  {variant.name || "Untitled variant"}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <ToggleGroup
              value={[locale]}
              onValueChange={(values) => {
                if (values[0]) setLocale(values[0] as Locale);
              }}
              variant="outline"
              spacing={0}
              size="sm"
              aria-label="Resume language"
            >
              <ToggleGroupItem value="en-US">EN</ToggleGroupItem>
              <ToggleGroupItem value="pt-BR">PT</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeSelector />
            <Button
              variant="outline"
              onClick={() => input.current?.click()}
              size="sm"
            >
              <Upload data-icon="inline-start" />
              Import JSON
            </Button>
            <Button variant="outline" onClick={exportJson} size="sm">
              <Download data-icon="inline-start" />
              Export JSON
            </Button>
            <Button
              onClick={() => void runExport("pdf")}
              disabled={exporting || validation.errors.length > 0}
              size="sm"
            >
              {exporting ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <Download data-icon="inline-start" />
              )}
              PDF · {locale === "en-US" ? "EN" : "PT"}
            </Button>
          </div>
        </header>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2 text-xs sm:px-6">
          <span className="font-medium">
            Session only—export JSON to save your work
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            {dirty ? (
              "Changes not backed up"
            ) : (
              <>
                <Check className="size-3" />
                {document.revision ? "Matches JSON backup" : "No changes yet"}
              </>
            )}
            {recovery && (
              <Button
                variant="link"
                size="xs"
                onClick={() =>
                  confirm(
                    "Recover the previous workspace?",
                    "This swaps the current workspace with the one in the in-memory recovery snapshot. Neither copy is saved automatically.",
                    () => {
                      setRecovery({
                        document: structuredClone(document),
                        backup,
                      });
                      dispatch({
                        type: "replace",
                        document: recovery.document,
                      });
                      setBackup(recovery.backup);
                      setVariantId(recovery.document.variants[0].id);
                      setSectionId("profile");
                      setMessage("Previous workspace recovered.");
                    },
                  )
                }
              >
                Recover previous
              </Button>
            )}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 sm:px-6">
          <div className="text-xs text-muted-foreground">
            {variant.name || "Untitled variant"} <span className="px-1">/</span>{" "}
            {locale === "en-US" ? "English" : "Português"}
            <span className="px-1">/</span> Draft r{document.revision}
          </div>
          <div className="flex flex-wrap gap-1">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => void runExport("latex")}
              disabled={exporting || validation.errors.length > 0}
            >
              <Braces data-icon="inline-start" />
              LaTeX + assets
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => void runExport("both")}
              disabled={exporting}
            >
              <Download data-icon="inline-start" />
              Both languages
            </Button>
          </div>
        </div>
        {(message || downloadError) && (
          <div className="border-b px-4 py-2">
            <Alert variant={downloadError ? "destructive" : "default"}>
              <AlertTitle>
                {downloadError ? "Action could not finish" : "Workspace update"}
              </AlertTitle>
              <AlertDescription>
                {downloadError || message}
                <Button
                  variant="link"
                  size="xs"
                  onClick={() => {
                    setMessage("");
                    setDownloadError("");
                  }}
                >
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}
        {!desktop && (
          <div className="border-b p-2">
            <ToggleGroup
              value={[mobilePanel]}
              onValueChange={(values) => {
                if (values[0]) setMobilePanel(values[0]);
              }}
              variant="outline"
              spacing={0}
              aria-label="Workspace panel"
            >
              <ToggleGroupItem value="editor">
                <FileText data-icon="inline-start" />
                Editor
              </ToggleGroupItem>
              <ToggleGroupItem value="preview">PDF preview</ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}
        <div className="min-h-0 flex-1">
          {desktop ? (
            <ResizablePanelGroup orientation="horizontal">
              <ResizablePanel defaultSize="54%" minSize="30%">
                {editor}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize="46%" minSize="30%">
                {preview}
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : mobilePanel === "editor" ? (
            editor
          ) : (
            preview
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-label="Import workspace JSON"
          onChange={(event) => void importJson(event.target.files?.[0])}
        />
        <AlertDialog
          open={!!confirmation}
          onOpenChange={(open) => {
            if (!open) setConfirmation(undefined);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmation?.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {confirmation?.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const action = confirmation?.action;
                  setConfirmation(undefined);
                  action?.();
                }}
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
