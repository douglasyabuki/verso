"use client";

import { FileText } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { PreviewPane } from "@/components/output/preview-pane";
import { IssuesPanel } from "@/components/review/issues-panel";
import { LanguageFlag } from "@/components/shared/language-flag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResumeIdentityDialog } from "@/components/variants/resume-identity-dialog";
import { EditorPane } from "@/components/workspace/editor-pane";
import { WorkspaceDataMenu } from "@/components/workspace/workspace-data-menu";
import { WorkspaceFeedback } from "@/components/workspace/workspace-feedback";
import {
  WorkspaceHeader,
  WorkspaceResumeControls,
} from "@/components/workspace/workspace-header";
import { WorkspaceOverlays } from "@/components/workspace/workspace-overlays";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { AppearanceControl } from "@/components/workspace/workspace-utility-rail";
import { useResumeCompiler } from "@/hooks/output/use-resume-compiler";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useCareerActions } from "@/hooks/workspace/use-career-actions";
import { useResumeActions } from "@/hooks/workspace/use-resume-actions";
import { WorkflowLinksContext } from "@/hooks/workspace/use-workflow-links";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
import { useWorkspaceBackups } from "@/hooks/workspace/use-workspace-backups";
import { useWorkspaceExports } from "@/hooks/workspace/use-workspace-exports";
import { useWorkspaceHistory } from "@/hooks/workspace/use-workspace-history";
import { useWorkspaceLayout } from "@/hooks/workspace/use-workspace-layout";
import { useWorkspaceNavigation } from "@/hooks/workspace/use-workspace-navigation";
import { createExampleDocument } from "@/lib/resume/example";
import { reviewItems } from "@/lib/review/review-queue";
import { validateOutput } from "@/lib/review/validation";
import { localizedFields } from "@/lib/wording/localization";
import {
  resolveIssueDestination,
  resolveOwnerDestination,
} from "@/lib/workspace/destinations";
import type { Confirmation } from "@/types-and-constants/editor";
import { languageNames } from "@/types-and-constants/languages";
import type { WorkspaceFocusTarget } from "@/types-and-constants/navigation";
import type { IssueNavigation } from "@/types-and-constants/navigation";
import type { Issue } from "@/types-and-constants/review";

export function WorkspaceView() {
  const { state, controller } = useWorkspace();
  const shortcuts = useWorkspaceHistory();
  const { document } = state;
  const navigation = useWorkspaceNavigation({
    document,
    controller,
    blocked: state.replacing || !!state.pending,
  });
  const {
    view,
    activeSectionId,
    variant,
    setVariantId: changeVariant,
    locale,
    setLocale: changeLocale,
    mobilePanel,
    setMobilePanel,
    addSection: createSection,
  } = navigation;
  const [autoSync, setAutoSync] = useState(true);
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const resumeActions = useResumeActions({
    controller,
    navigation,
    confirm: (title, description, action) =>
      setConfirmation({ title, description, action }),
  });
  const { input, exportJson, importJson, requestImport } = useWorkspaceBackups({
    document,
    controller,
  });
  const desktop = useMediaQuery("(min-width: 1024px)");
  const { layout, changeLayout } = useWorkspaceLayout();
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [issueNavigation, setIssueNavigation] = useState<
    IssueNavigation & {
      epoch: number;
      variantId: string;
      navigationToken: string;
    }
  >();
  const setVariantId = (id: string) => {
    setIssueNavigation((current) =>
      current ? { ...current, pending: false } : current,
    );
    changeVariant(id);
  };
  const setLocale: typeof changeLocale = (next) => {
    setIssueNavigation((current) =>
      current ? { ...current, pending: false } : current,
    );
    changeLocale(next);
  };
  const careerActions = useCareerActions({
    controller,
    navigation,
    confirm: (title, description, action, returnFocus, destructive) =>
      setConfirmation({ title, description, action, returnFocus, destructive }),
    onChanged: () => setIssueNavigation(undefined),
  });
  const onIssueFocused = useCallback((id: string) => {
    setIssueNavigation((current) =>
      current?.id === id ? { ...current, pending: false } : current,
    );
  }, []);
  const onIssue = (issue: Issue) => {
    if (
      !issue.target ||
      state.replacing ||
      state.pending ||
      !controller.commitEditorDrafts()
    )
      return;
    const destination = resolveIssueDestination(document, issue, variant.id);
    if (!destination) return;
    if (
      destination.kind === "career-section" ||
      destination.kind === "career-summary"
    )
      navigation.setCareerLocale(issue.locale);
    else if (destination.kind === "resume") changeLocale(issue.locale);
    const navigationToken = navigation.open(destination);
    if (destination.kind === "career-section") {
      navigation.setCareerContexts((current) => ({
        ...current,
        [destination.sectionId]: {
          entryId: issue.target?.entryId ?? "",
          query: "",
          showArchived: !!issue.target?.entryId,
        },
      }));
    }
    setIssueNavigation({
      id: crypto.randomUUID(),
      issue,
      pending: true,
      epoch: state.textHistoryEpoch,
      variantId: issue.target.variantId ?? variant.id,
      navigationToken,
    });
    if (!desktop) setIssuesOpen(false);
  };
  const validations = useMemo(
    () => ({
      "en-US": validateOutput(document, variant, "en-US"),
      "pt-BR": validateOutput(document, variant, "pt-BR"),
    }),
    [document, variant],
  );
  const validation = validations[locale];
  const compiler = useResumeCompiler({
    document,
    variantId: variant.id,
    locale,
    autoSync,
    ...document.compiler,
  });
  const exports = useWorkspaceExports({ document, variant, locale, compiler });
  const backupStatus = !state.backupFingerprint
    ? "No JSON backup recorded"
    : !state.currentFingerprint
      ? "Checking JSON backup status…"
      : state.currentFingerprint !== state.backupFingerprint
        ? "JSON backup is out of date"
        : "JSON backup is up to date";
  const reviewCount = reviewItems(document).length;
  const fullWidth = ["career-overview", "resumes", "review", "data"].includes(
    view,
  );
  const resumeWorkspace = navigation.destination.kind === "resume";
  const onOwner = (target: WorkspaceFocusTarget) => {
    if (!controller.commitEditorDrafts()) return;
    const field = localizedFields(document).find(
      (field) => field.path === target.path,
    );
    const destination = resolveOwnerDestination(document, target);
    if (!field || !destination) {
      navigation.open({ kind: "review" }, true);
      return;
    }
    const currentDestination = navigation.destination;
    if (!target.resumeId) navigation.setCareerLocale(target.locale);
    const entry = document.sections
      .flatMap((section) => section.entries)
      .find(
        (entry) =>
          target.path === `entries.${entry.id}.title` ||
          entry.bullets.some(
            (bullet) => target.path === `bullets.${bullet.id}.body`,
          ),
      );
    if (!target.resumeId)
      navigation.setCareerContexts((current) => ({
        ...current,
        [field.sectionId]: {
          entryId: entry?.id ?? "",
          query: "",
          showArchived: !!entry?.archived,
        },
      }));
    navigation.open(destination, true);
    if (!navigation.reviewContext)
      navigation.setScopedReviews((current) => ({
        ...current,
        [target.resumeId ?? field.sectionId]: {
          current: {
            path: target.path,
            locale: target.locale,
            resumeId: target.resumeId,
          },
          filters: {
            owner: "all",
            language: target.locale,
            section: "all",
            reason: "all",
            output: "all",
            archive: "active",
          },
          scroll: 0,
        },
      }));
    if (!navigation.reviewContext)
      navigation.setReturnDestination(currentDestination);
  };
  const busy = exports.exporting || compiler.isPending;
  const dataActions = (inline = false) => (
    <WorkspaceDataMenu
      inline={inline}
      backupStatus={backupStatus}
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
                "Restore previous work?",
                state.recovery!,
              )
          : undefined
      }
      resume={controller.reviewOverwrite}
    />
  );
  const dataMenu = dataActions();
  const editor = (
    <WorkflowLinksContext.Provider
      value={{
        editCareer: (path, targetLocale) => {
          const field = localizedFields(document).find(
            (field) => field.path === path,
          );
          if (!field) return;
          const entry = document.sections
            .flatMap((section) => section.entries)
            .find((entry) =>
              entry.bullets.some(
                (bullet) => path === `bullets.${bullet.id}.body`,
              ),
            );
          const back = navigation.destination;
          navigation.setCareerContexts((current) => ({
            ...current,
            [field.sectionId]: {
              entryId: entry?.id ?? "",
              query: "",
              showArchived: !!entry?.archived,
            },
          }));
          navigation.setCareerLocale(targetLocale);
          const destination = resolveOwnerDestination(
            document,
            { path, locale: targetLocale },
            true,
          );
          if (destination) {
            const navigationToken = navigation.open(destination, true);
            setIssueNavigation({
              id: crypto.randomUUID(),
              pending: true,
              epoch: state.textHistoryEpoch,
              variantId: variant.id,
              navigationToken,
              issue: {
                id: path,
                path,
                message: "Edit shared career text",
                category: "translation",
                locale: targetLocale,
                section: field.source,
                entry: "",
                field: field.label,
                target: {
                  sectionId: field.sectionId,
                  entryId: entry?.id,
                  fieldKey: `${path}.${targetLocale}`,
                  scope: "shared",
                },
              },
            });
          }
          navigation.setReturnDestination(back);
        },
      }}
    >
      <EditorPane
        resumeActions={resumeActions}
        careerActions={careerActions}
        document={document}
        view={view}
        sectionId={activeSectionId}
        locale={
          navigation.destination.kind === "career-section" ||
          navigation.destination.kind === "career-summary" ||
          navigation.destination.kind === "career-profile"
            ? navigation.careerLocale
            : locale
        }
        variant={variant}
        update={controller.edit}
        confirm={(title, description, action, returnFocus, destructive) =>
          setConfirmation({
            title,
            description,
            action,
            returnFocus,
            destructive,
          })
        }
        validation={
          navigation.destination.kind === "career-section" ||
          navigation.destination.kind === "career-summary" ||
          navigation.destination.kind === "career-profile"
            ? validations[navigation.careerLocale]
            : validation
        }
        disabled={state.replacing || !!state.pending}
        issueNavigation={
          issueNavigation?.epoch === state.textHistoryEpoch &&
          issueNavigation.navigationToken === navigation.focusToken &&
          issueNavigation.variantId === variant.id
            ? issueNavigation
            : undefined
        }
        onIssueFocused={onIssueFocused}
        onOpen={onIssue}
        navigation={navigation}
        dataMenu={dataActions(true)}
        onOwner={onOwner}
      />
    </WorkflowLinksContext.Provider>
  );
  const preview = (
    <div className="flex h-full min-h-0 flex-col">
      {!resumeWorkspace && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b p-2">
          <span className="text-xs text-muted-foreground">
            Previewing {variant.name || "Untitled resume"} ·{" "}
            {languageNames[locale]}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              navigation.open({
                kind: "resume",
                resumeId: variant.id,
                page: "content",
              })
            }
          >
            Open resume
          </Button>
        </div>
      )}
      <PreviewPane
        compiler={compiler}
        validation={validation}
        autoSync={autoSync}
        setAutoSync={setAutoSync}
        busy={busy}
        locale={locale}
        onIssues={() => setIssuesOpen(true)}
      />
    </div>
  );
  const languageItems = [
    { value: "en-US", label: "English" },
    { value: "pt-BR", label: "Português" },
  ];
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
        setIssueNavigation((current) =>
          current ? { ...current, pending: false } : current,
        );
        setMobilePanel(value);
      }}
      className="h-dvh min-h-0 gap-0"
    >
      <WorkspaceShell
        sidebarOpen={layout.sidebar}
        onSidebarChange={(sidebar) => changeLayout({ sidebar })}
        dataMenu={dataMenu}
        sidebar={
          <WorkspaceSidebar
            actions={resumeActions}
            careerActions={careerActions}
            blocked={state.replacing || !!state.pending}
            document={document}
            destination={navigation.destination}
            open={(destination) => {
              setIssueNavigation(undefined);
              navigation.open(destination);
            }}
            resumeId={variant.id}
            createResume={navigation.createResume}
            addSection={() => {
              setIssueNavigation((current) =>
                current ? { ...current, pending: false } : current,
              );
              createSection();
            }}
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
          <WorkspaceHeader
            context={
              resumeWorkspace ? (
                <WorkspaceResumeControls
                  document={document}
                  variant={variant}
                  setVariantId={setVariantId}
                  locale={locale}
                  setLocale={setLocale}
                  exporting={exports.exporting}
                  runExport={exports.runExport}
                  hasErrors={validation.errors.length > 0}
                  hasBilingualErrors={
                    validations["en-US"].errors.length > 0 ||
                    validations["pt-BR"].errors.length > 0
                  }
                />
              ) : (
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                  {!fullWidth &&
                    navigation.destination.kind !== "career-profile" && (
                      <div className="flex max-w-full flex-wrap items-center gap-2 text-sm">
                        <Label htmlFor="career-language">
                          {view === "shared-defaults"
                            ? "Defaults language"
                            : "Editing language"}
                        </Label>
                        <Select
                          items={languageItems}
                          value={
                            view === "shared-defaults"
                              ? locale
                              : navigation.careerLocale
                          }
                          disabled={state.replacing || !!state.pending}
                          onValueChange={(value) => {
                            if (
                              value === null ||
                              state.replacing ||
                              state.pending
                            )
                              return;
                            if (view === "shared-defaults")
                              setLocale(value as typeof locale);
                            else
                              navigation.setCareerLocale(
                                value as typeof locale,
                              );
                          }}
                        >
                          <SelectTrigger
                            appearance="utility"
                            id="career-language"
                          >
                            <LanguageFlag
                              locale={
                                view === "shared-defaults"
                                  ? locale
                                  : navigation.careerLocale
                              }
                            />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {languageItems.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <LanguageFlag
                                      locale={option.value as typeof locale}
                                    />
                                    {option.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                </div>
              )
            }
            shortcuts={shortcuts}
            previewAvailable={!fullWidth}
            mobilePreviewControls={
              !desktop &&
              !fullWidth && (
                <div className="max-w-full min-w-0 overflow-x-auto px-1 pt-1 pb-2">
                  <TabsList variant="line" aria-label="Workspace panel">
                    <TabsTrigger
                      value="editor"
                      disabled={state.replacing || !!state.pending}
                    >
                      <FileText data-icon="inline-start" />
                      Editor
                    </TabsTrigger>
                    <TabsTrigger
                      value="preview"
                      disabled={state.replacing || !!state.pending}
                    >
                      PDF preview
                    </TabsTrigger>
                  </TabsList>
                </div>
              )
            }
            title={
              navigation.destination.kind === "resume"
                ? variant.name || "Untitled resume"
                : navigation.destination.kind === "career-section" ||
                    navigation.destination.kind === "career-summary" ||
                    navigation.destination.kind === "career-profile"
                  ? "Career details"
                  : (
                      {
                        "career-overview": "Career details",
                        resumes: "All resumes",
                        review: "Text to review",
                        data: "Backups & settings",
                        "shared-defaults": "Default layout",
                      } as Record<string, string>
                    )[view]
            }
            preview={layout.preview}
            togglePreview={() => {
              if (controller.commitEditorDrafts())
                changeLayout({ preview: !layout.preview });
            }}
          />
        }
        overlays={
          <>
            {resumeActions.editing && (
              <ResumeIdentityDialog
                key={resumeActions.editing.id}
                resume={resumeActions.editing}
                close={resumeActions.close}
                returnFocus={resumeActions.returnFocus}
                save={resumeActions.save}
              />
            )}
            <WorkspaceOverlays
              confirmation={confirmation}
              dismiss={() => setConfirmation(undefined)}
            />
          </>
        }
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
        {!fullWidth && (
          <IssuesPanel
            document={document}
            variant={variant}
            validation={validations}
            compiler={compiler}
            open={issuesOpen}
            setOpen={setIssuesOpen}
            onIssue={onIssue}
            disabled={state.replacing || !!state.pending}
          />
        )}
        <Input
          ref={input}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-label="Restore from a JSON backup"
          onChange={(event) => void importJson(event.target.files?.[0])}
        />
      </WorkspaceShell>
    </Tabs>
  );
}
