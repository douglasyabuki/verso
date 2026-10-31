"use client";

import { FileText } from "lucide-react";

import { LanguageFlag } from "@/components/shared/language-flag";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  WorkspaceHeader,
  WorkspaceResumeControls,
} from "@/components/workspace/workspace-header";
import { useWorkspaceOutput } from "@/contexts/workspace-output";
import { useWorkspaceWorkflow } from "@/contexts/workspace-workflow";
import { useWorkspace } from "@/hooks/workspace/use-workspace";

/** Connect workflow/output controls to the header and layout-owned preview toggle. */
export function WorkspaceHeaderControls({
  desktop,
  preview,
  togglePreview,
}: {
  desktop: boolean;
  preview: boolean;
  togglePreview: () => void;
}) {
  const { state } = useWorkspace();
  const { document } = state;
  const {
    navigation,
    selection: { setVariantId, setLocale },
    shortcuts,
    view: { fullWidth, resumeWorkspace },
  } = useWorkspaceWorkflow();
  const { variant, locale, view } = navigation;
  const { validation, validations, exports } = useWorkspaceOutput();
  const languageItems = [
    { value: "en-US", label: "English" },
    { value: "pt-BR", label: "Português" },
  ];
  return (
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
        ) : !fullWidth && navigation.destination.kind !== "career-profile" ? (
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="flex max-w-full flex-wrap items-center gap-2 text-sm">
              <Label htmlFor="career-language">
                {view === "shared-defaults"
                  ? "Defaults language"
                  : "Editing language"}
              </Label>
              <Select
                items={languageItems}
                value={
                  view === "shared-defaults" ? locale : navigation.careerLocale
                }
                disabled={state.replacing || !!state.pending}
                onValueChange={(value) => {
                  if (value === null || state.replacing || state.pending)
                    return;
                  if (view === "shared-defaults")
                    setLocale(value as typeof locale);
                  else navigation.setCareerLocale(value as typeof locale);
                }}
              >
                <SelectTrigger appearance="utility" id="career-language">
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
                      <SelectItem key={option.value} value={option.value}>
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
          </div>
        ) : null
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
      preview={preview}
      togglePreview={() => {
        togglePreview();
      }}
    />
  );
}
