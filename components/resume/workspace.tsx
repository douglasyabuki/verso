"use client";

import { ChevronDown, Download, FileText } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { EditorPane } from "@/components/resume/editor-pane";
import { PreviewPane } from "@/components/resume/preview-pane";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { toast } from "@/components/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TooltipProvider } from "@/components/ui/tooltip";
import { views } from "@/components/workspace/navigation";
import { WorkspaceDataMenu } from "@/components/workspace/workspace-data-menu";
import { WorkspaceFeedback } from "@/components/workspace/workspace-feedback";
import {
  type Confirmation,
  WorkspaceOverlays,
} from "@/components/workspace/workspace-overlays";
import { WorkspaceProvider } from "@/components/workspace/workspace-provider";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import {
  WorkspaceSaveStatus,
  WorkspaceToolbar,
} from "@/components/workspace/workspace-toolbar";
import { AppearanceControl } from "@/components/workspace/workspace-utility-rail";
import { useResumeCompiler } from "@/hooks/resume/use-resume-compiler";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
import { useWorkspaceExports } from "@/hooks/workspace/use-workspace-exports";
import { useWorkspaceLayout } from "@/hooks/workspace/use-workspace-layout";
import { createExampleDocument } from "@/lib/resume/example";
import { downloadFile, fileSlug } from "@/lib/resume/files";
import {
  type Locale,
  localized,
  localizedFields,
  parseBackup,
  plain,
  type Section,
  serializeBackup,
  validateOutput,
} from "@/lib/resume/model";
import { fingerprint } from "@/lib/workspace/storage";

export function Workspace() {
  return (
    <WorkspaceProvider>
      <TooltipProvider>
        <WorkspaceView />
      </TooltipProvider>
    </WorkspaceProvider>
  );
}

function WorkspaceView() {
  const { state, controller } = useWorkspace();
  const { document } = state;
  const [view, setView] = useState("content");
  const [sectionId, setSectionId] = useState("profile");
  const [variantId, setVariantId] = useState("general");
  const [locale, setLocale] = useState<Locale>("en-US");
  const [autoSync, setAutoSync] = useState(true);
  const [mobilePanel, setMobilePanel] = useState("editor");
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const input = useRef<HTMLInputElement>(null);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const { layout, changeLayout } = useWorkspaceLayout();
  const activeSectionId =
    sectionId === "profile" ||
    document.sections.some((section) => section.id === sectionId)
      ? sectionId
      : "profile";
  const variant =
    document.variants.find((item) => item.id === variantId) ??
    document.variants[0];
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
  const exports = useWorkspaceExports({ document, variant, locale, compiler });
  const dirty =
    !state.backupFingerprint ||
    state.currentFingerprint !== state.backupFingerprint;
  const reviewCount = localizedFields(document).filter(
    (field) =>
      field.value[locale].needsReview && plain(field.value, locale).trim(),
  ).length;
  const busy = exports.exporting || compiler.isPending;
  const navigate = (next: string, section?: string) => {
    setView(next);
    if (section) setSectionId(section);
    setMobilePanel("editor");
  };
  const addSection = () => {
    if (state.saving) return;
    const id = crypto.randomUUID();
    const section: Section = {
      id,
      kind: "custom",
      heading: localized("Custom section", "Seção personalizada"),
      entries: [],
    };
    controller.edit((draft) => {
      draft.sections.push(section);
      draft.variants.forEach((variant) =>
        variant.sections.push({ sectionId: id, visible: true, entries: [] }),
      );
    });
    navigate("content", id);
  };
  const exportJson = () => {
    try {
      const snapshot = document;
      const serialized = serializeBackup(snapshot);
      parseBackup(serialized);
      downloadFile(
        serialized,
        `${fileSlug(snapshot.profile.name)}-workspace-r${snapshot.revision}.json`,
        "application/json",
      );
      void controller.markBackup(snapshot);
      toast.add({
        type: "success",
        title: "Download requested",
        description:
          "JSON backup download initiated. Browser saving and backup freshness are tracked separately.",
      });
    } catch (error) {
      toast.add({
        type: "error",
        title: "Action could not finish",
        description: (error as Error).message,
      });
    }
  };
  const importJson = async (file?: File) => {
    if (!file) return;
    try {
      if (!file.name.toLowerCase().endsWith(".json") || file.size > 5_000_000)
        throw new Error("Choose a JSON backup no larger than 5 MB.");
      const document = parseBackup(await file.text());
      const backupFingerprint = await fingerprint(document);
      controller.requestReplacement("Import JSON workspace?", {
        document,
        backupFingerprint,
      });
    } catch (error) {
      toast.add({
        type: "error",
        title: "Action could not finish",
        description: (error as Error).message,
      });
    } finally {
      if (input.current) input.current.value = "";
    }
  };
  const dataMenu = (
    <WorkspaceDataMenu
      dirty={dirty}
      disabled={state.saving}
      importJson={() => input.current?.click()}
      exportJson={exportJson}
      example={() =>
        controller.requestReplacement("Load fictional example?", {
          document: createExampleDocument(),
          backupFingerprint: null,
        })
      }
      recover={
        state.recovery
          ? () =>
              controller.requestReplacement(
                "Recover previous workspace?",
                state.recovery!,
              )
          : undefined
      }
      resume={controller.reviewOverwrite}
    />
  );
  const editor = (
    <EditorPane
      document={document}
      view={view}
      sectionId={activeSectionId}
      setSectionId={setSectionId}
      locale={locale}
      variant={variant}
      update={controller.edit}
      confirm={(title, description, action) =>
        setConfirmation({ title, description, action })
      }
      validation={validation}
      setVariantId={setVariantId}
      disabled={state.saving}
    />
  );
  const preview = (
    <PreviewPane
      compiler={compiler}
      validation={validation}
      autoSync={autoSync}
      setAutoSync={setAutoSync}
      busy={busy}
      locale={locale}
    />
  );
  return (
    <WorkspaceShell
      sidebarOpen={layout.sidebar}
      onSidebarChange={(sidebar) => changeLayout({ sidebar })}
      dataMenu={dataMenu}
      sidebar={
        <WorkspaceSidebar
          document={document}
          locale={locale}
          view={view}
          sectionId={activeSectionId}
          navigate={navigate}
          addSection={addSection}
          reviewCount={reviewCount}
          utilities={
            <div className="flex items-center gap-2">
              {dataMenu}
              <AppearanceControl />
              <span className="text-xs text-muted-foreground">
                Data & appearance
              </span>
            </div>
          }
        />
      }
      toolbar={
        <WorkspaceToolbar
          title={views.find((item) => item.id === view)?.label ?? "Content"}
          preview={layout.preview}
          togglePreview={() => changeLayout({ preview: !layout.preview })}
        />
      }
      overlays={
        <WorkspaceOverlays
          confirmation={confirmation}
          dismiss={() => setConfirmation(undefined)}
        />
      }
    >
      <WorkspaceFeedback />
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <label htmlFor="variant-picker" className="sr-only">
            Active resume variant
          </label>
          <NativeSelect
            id="variant-picker"
            className="max-w-48"
            value={variant.id}
            onChange={(event) => setVariantId(event.target.value)}
          >
            {document.variants.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {item.name || "Untitled variant"}
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
          <span className="text-xs text-muted-foreground">
            {dirty ? "Changes since JSON backup" : "Matches JSON backup"} ·
            Draft r{document.revision}
          </span>
          <Button
            size="sm"
            disabled={validation.errors.length > 0 || exports.exporting}
            onClick={() => void exports.runExport("pdf")}
          >
            <Download data-icon="inline-start" />
            {exports.exporting ? "Exporting…" : "Download PDF"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="More export options"
                  disabled={exports.exporting}
                />
              }
            >
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => void exports.runExport("both")}
                >
                  Both languages (ZIP)
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={validation.errors.length > 0}
                  onClick={() => void exports.runExport("latex")}
                >
                  LaTeX + assets
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <WorkspaceSaveStatus className="text-xs text-muted-foreground sm:hidden" />
      </div>
      {!desktop && (
        <div className="shrink-0 border-b px-4 py-2">
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
        {desktop && layout.preview ? (
          <ResizablePanelGroup
            orientation="horizontal"
            defaultLayout={{
              editor: layout.split,
              preview: 100 - layout.split,
            }}
            onLayoutChanged={(sizes) => changeLayout({ split: sizes.editor })}
          >
            <ResizablePanel id="editor" minSize="30%">
              {editor}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel id="preview" minSize="30%">
              {preview}
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : desktop || mobilePanel === "editor" ? (
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
    </WorkspaceShell>
  );
}
