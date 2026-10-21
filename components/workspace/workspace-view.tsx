"use client";

import { FileText } from "lucide-react";
import { useMemo, useState } from "react";

import { EditorPane } from "@/components/resume/editor-pane";
import { PreviewPane } from "@/components/resume/preview-pane";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { views } from "@/components/workspace/navigation";
import { WorkspaceDataMenu } from "@/components/workspace/workspace-data-menu";
import { WorkspaceFeedback } from "@/components/workspace/workspace-feedback";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceOverlays } from "@/components/workspace/workspace-overlays";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";
import { AppearanceControl } from "@/components/workspace/workspace-utility-rail";
import { useResumeCompiler } from "@/hooks/resume/use-resume-compiler";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
import { useWorkspaceBackups } from "@/hooks/workspace/use-workspace-backups";
import { useWorkspaceExports } from "@/hooks/workspace/use-workspace-exports";
import { useWorkspaceHistory } from "@/hooks/workspace/use-workspace-history";
import { useWorkspaceLayout } from "@/hooks/workspace/use-workspace-layout";
import { useWorkspaceNavigation } from "@/hooks/workspace/use-workspace-navigation";
import { createExampleDocument } from "@/lib/resume/example";
import { localizedFields, plain } from "@/lib/resume/localization";
import { validateOutput } from "@/lib/resume/validation";
import type { Confirmation } from "@/types-and-constants/editor";

export function WorkspaceView() {
  const { state, controller } = useWorkspace();
  const shortcuts = useWorkspaceHistory();
  const { document } = state;
  const {
    view,
    activeSectionId,
    setSectionId,
    variant,
    setVariantId,
    locale,
    setLocale,
    mobilePanel,
    setMobilePanel,
    navigate,
    addSection,
  } = useWorkspaceNavigation({
    document,
    controller,
    blocked: state.replacing || !!state.pending,
  });
  const [autoSync, setAutoSync] = useState(true);
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const { input, exportJson, importJson, requestImport } = useWorkspaceBackups({
    document,
    controller,
  });
  const desktop = useMediaQuery("(min-width: 1024px)");
  const { layout, changeLayout } = useWorkspaceLayout();
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
  const dataMenu = (
    <WorkspaceDataMenu
      dirty={dirty}
      disabled={state.saving}
      importJson={requestImport}
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
      disabled={state.replacing || !!state.pending}
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
          shortcuts={shortcuts}
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
      <WorkspaceHeader
        document={document}
        variant={variant}
        setVariantId={setVariantId}
        locale={locale}
        setLocale={setLocale}
        dirty={dirty}
        exporting={exports.exporting}
        runExport={exports.runExport}
        hasErrors={validation.errors.length > 0}
      />
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
