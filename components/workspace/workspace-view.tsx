"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { EditorPane } from "@/components/workspace/editor-pane";
import {
  WorkspaceBackupControls,
  WorkspaceBackupImportInput,
} from "@/components/workspace/workspace-backup-controls";
import { WorkspaceDialogs } from "@/components/workspace/workspace-dialogs";
import { WorkspaceFeedback } from "@/components/workspace/workspace-feedback";
import { WorkspaceHeaderControls } from "@/components/workspace/workspace-header-controls";
import {
  WorkspaceIssues,
  WorkspacePreview,
} from "@/components/workspace/workspace-output-panels";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { WorkspaceSidebarControls } from "@/components/workspace/workspace-sidebar-controls";
import { useWorkspaceWorkflow } from "@/contexts/workspace-workflow";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
import { useWorkspaceLayout } from "@/hooks/workspace/use-workspace-layout";

export function WorkspaceView() {
  const { state, controller } = useWorkspace();
  const {
    navigation: { mobilePanel, setMobilePanel },
    issues,
    view: { fullWidth },
  } = useWorkspaceWorkflow();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const { layout, changeLayout } = useWorkspaceLayout();
  const dataMenu = <WorkspaceBackupControls />;
  const editor = <EditorPane />;
  const preview = <WorkspacePreview />;
  return (
    <Tabs
      value={mobilePanel}
      onValueChange={(value) => {
        if (
          (value !== "editor" && value !== "preview") ||
          value === mobilePanel ||
          state.replacing ||
          state.pending ||
          !controller.commitEditorDrafts()
        )
          return;
        issues.cancelFocus();
        setMobilePanel(value);
      }}
      className="h-dvh min-h-0 gap-0"
    >
      <WorkspaceShell
        sidebarOpen={layout.sidebar}
        onSidebarChange={(sidebar) => changeLayout({ sidebar })}
        dataMenu={dataMenu}
        sidebar={<WorkspaceSidebarControls />}
        toolbar={
          <WorkspaceHeaderControls
            desktop={desktop}
            preview={layout.preview}
            togglePreview={() => {
              if (controller.commitEditorDrafts())
                changeLayout({ preview: !layout.preview });
            }}
          />
        }
        overlays={<WorkspaceDialogs />}
      >
        <WorkspaceFeedback />
        <div className="min-h-0 flex-1">
          {fullWidth ? (
            editor
          ) : desktop && layout.preview ? (
            <ResizablePanelGroup
              orientation="horizontal"
              defaultLayout={{
                editor: layout.split,
                preview: 100 - layout.split,
              }}
              resizeTargetMinimumSize={{
                fine: 5,
                coarse: 16,
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
          ) : desktop ? (
            editor
          ) : (
            <>
              <TabsContent value="editor" className="h-full min-h-0">
                {editor}
              </TabsContent>
              <TabsContent value="preview" className="h-full min-h-0">
                {preview}
              </TabsContent>
            </>
          )}
        </div>
        <WorkspaceIssues />
        <WorkspaceBackupImportInput />
      </WorkspaceShell>
    </Tabs>
  );
}
