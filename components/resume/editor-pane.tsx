"use client";

import { Trash2 } from "lucide-react";

import { ContentEditor } from "@/components/resume/content-editor";
import { SettingsEditor } from "@/components/resume/template-editor";
import { TranslationsEditor } from "@/components/resume/translations-editor";
import { VariantsEditor } from "@/components/resume/variants-editor";
import { Button } from "@/components/ui/button";
import { librarySectionLabel, views } from "@/components/workspace/navigation";
import { useIssueFocus } from "@/hooks/resume/use-issue-focus";
import { validateOutput } from "@/lib/resume/validation";
import type { ConfirmAction } from "@/types-and-constants/editor";
import type {
  IssueNavigation,
  Locale,
  ResumeDocument,
} from "@/types-and-constants/resume";
import type { WorkspaceEdit } from "@/types-and-constants/workspace";

export function EditorPane({
  document,
  view,
  sectionId,
  setSectionId,
  locale,
  variant,
  update,
  confirm,
  validation,
  setVariantId,
  disabled,
  issueNavigation,
  onIssueFocused,
}: {
  document: ResumeDocument;
  view: string;
  sectionId: string;
  setSectionId: (id: string) => void;
  locale: Locale;
  variant: ResumeDocument["variants"][number];
  update: WorkspaceEdit;
  confirm: ConfirmAction;
  validation: ReturnType<typeof validateOutput>;
  setVariantId: (id: string) => void;
  disabled: boolean;
  issueNavigation?: IssueNavigation;
  onIssueFocused: (id: string) => void;
}) {
  useIssueFocus({
    navigation: issueNavigation,
    disabled,
    onFocused: onIssueFocused,
  });
  const section = document.sections.find((item) => item.id === sectionId);
  return (
    <div className="@container h-full overflow-auto p-4 sm:p-6">
      <fieldset
        disabled={disabled}
        className="mx-auto flex max-w-3xl min-w-0 flex-col gap-6 disabled:opacity-70"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {view === "content"
                ? sectionId === "profile"
                  ? "Profile"
                  : section
                    ? librarySectionLabel(section)
                    : "Career library"
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
            key={`${sectionId}:${issueNavigation?.id ?? ""}`}
            issueTarget={
              issueNavigation?.pending
                ? issueNavigation.issue.target
                : undefined
            }
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
          <TranslationsEditor
            key={variant.id}
            document={document}
            update={update}
            locale={locale}
            variant={variant}
          />
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
      </fieldset>
    </div>
  );
}
