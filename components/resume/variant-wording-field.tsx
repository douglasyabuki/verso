"use client";

import {
  Check,
  ChevronRight,
  Languages,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { type ComponentProps, useState } from "react";

import { LocalizedField } from "@/components/resume/fields";
import { TranslationComparison } from "@/components/resume/translation-comparison";
import { WordingComparisonDetails } from "@/components/resume/wording-comparison-details";
import { WordingStatus } from "@/components/resume/wording-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { InfoHint } from "@/components/ui/info-hint";
import { useWorkflowLinks } from "@/hooks/workspace/use-workflow-links";
import { plain, translationSnapshot } from "@/lib/resume/localization";
import {
  acknowledgeSharedWording,
  confirmVariantTranslationPair,
  createWordingOverride,
  editWordingOverride,
  effectiveSnapshot,
  effectiveWording,
  resetWordingOverride,
  sharedWording,
  sharedWordingChanged,
  variantWording,
} from "@/lib/resume/wording";
import type { ConfirmAction } from "@/types-and-constants/editor";
import type {
  Issue,
  Locale,
  ResumeDocument,
  Variant,
} from "@/types-and-constants/resume";
import { languageNames } from "@/types-and-constants/resume";
import type { WorkspaceEdit } from "@/types-and-constants/workspace";

export function VariantWordingField({
  document,
  variant,
  path,
  locale,
  update,
  confirm,
  label,
  required = false,
  multiline = true,
  errors = [],
  showReference = false,
}: {
  document: ResumeDocument;
  variant: Variant;
  path: string;
  locale: Locale;
  update: WorkspaceEdit;
  confirm: ConfirmAction;
  label: string;
  required?: boolean;
  multiline?: boolean;
  errors?: Issue[];
  showReference?: boolean;
}) {
  const { editLibrary } = useWorkflowLinks();
  const [feedback, setFeedback] = useState({ identity: "", message: "" });
  const shared = sharedWording(document, path);
  if (!shared) return null;
  const field = variantWording(variant, path);
  const override = field?.overrides[locale];
  const value = effectiveWording(shared, variant, path);
  const other = locale === "en-US" ? "pt-BR" : "en-US";
  const target = effectiveSnapshot(shared, variant, path, locale);
  const reference = effectiveSnapshot(shared, variant, path, other);
  const baselineChanged = sharedWordingChanged(shared, variant, path, locale);
  const displayedLibrary = translationSnapshot(shared, locale);
  const feedbackIdentity = JSON.stringify([
    target,
    displayedLibrary,
    override?.sharedBaseline,
  ]);
  const fieldKey = `variants.${variant.id}.${path}.${locale}`;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={override ? "secondary" : "outline"}>
          {override ? "Customized for this resume" : "Uses library text"}
        </Badge>
        <span className="text-sm">
          {variant.name || "Untitled resume"} · {languageNames[locale]}
        </span>
        <WordingStatus
          missing={required && !plain(value, locale).trim()}
          review={value[locale].needsReview}
          library={baselineChanged}
        />
        <InfoHint label="wording scope">
          {override
            ? "Editing changes only this resume and language. Shared wording and facts stay in the library."
            : "This wording is inherited. Customize it for this resume, or edit it in the career library."}
        </InfoHint>
      </div>
      {override ? (
        <LocalizedField
          fieldKey={fieldKey}
          label={label}
          value={value}
          locale={locale}
          required={required}
          multiline={multiline}
          error={errors.find((issue) => issue.path === path)?.message}
          onChange={(spans, group) =>
            update(
              (draft) =>
                editWordingOverride(draft, variant.id, path, locale, spans),
              group,
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {label} · From library · read only
          </p>
          <p
            lang={locale}
            className="text-sm wrap-anywhere whitespace-pre-wrap"
          >
            {plain(value, locale) || "Empty wording"}
          </p>
          {errors.find((issue) => issue.path === path) && (
            <p role="alert" className="text-sm text-destructive">
              {errors.find((issue) => issue.path === path)?.message}
            </p>
          )}
          <Button
            data-issue-field={fieldKey}
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              update((draft) =>
                createWordingOverride(draft, variant.id, path, locale),
              )
            }
          >
            <Pencil data-icon="inline-start" />
            Customize for this resume
          </Button>
        </div>
      )}
      {override && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() =>
            confirm(
              "Reset to library wording?",
              `Remove only the ${languageNames[locale]} customization for ${variant.name || "this resume"}. Current library wording: ${plain(shared, locale) || "(empty)"}. Workspace undo can restore the override.`,
              () =>
                update((draft) =>
                  resetWordingOverride(draft, variant.id, path, locale),
                ),
            )
          }
        >
          <RotateCcw data-icon="inline-start" />
          Reset to library wording
        </Button>
      )}
      {field ? (
        <WordingComparisonDetails expanded={showReference}>
          <TranslationComparison
            review={field.review}
            target={target}
            reference={reference}
            snapshot={field.review[locale].reviewedCounterpart}
            needsReview={field.review[locale].needsReview}
            owner={variant.name || "this resume"}
            onConfirm={() => {
              let accepted = false;
              update((draft) => {
                accepted = confirmVariantTranslationPair(
                  draft,
                  variant.id,
                  path,
                  target,
                  reference,
                );
              });
              return accepted;
            }}
          />
        </WordingComparisonDetails>
      ) : (
        <p className="text-xs text-muted-foreground">
          Review inherited wording in the career library.
        </p>
      )}
      {baselineChanged && override && (
        <Collapsible defaultOpen={showReference}>
          <CollapsibleTrigger
            render={<Button variant="outline" size="sm" />}
            className="group"
          >
            <ChevronRight
              data-icon="inline-start"
              className="transition-transform group-data-panel-open:rotate-90"
            />
            Review library changes
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
              <p className="text-sm text-muted-foreground">
                Library changed. Compare it with your customization before
                keeping or resetting it.
                <InfoHint label="library-change review">
                  Editing alone does not clear this reminder. Keeping the
                  customization applies only to this resume and does not clear
                  translation reminders.
                </InfoHint>
              </p>
              <p
                lang={locale}
                className="text-sm wrap-anywhere whitespace-pre-wrap"
              >
                Previous library · read only:{" "}
                {override.sharedBaseline.spans
                  .map((span) => span.text)
                  .join("") || "(empty)"}
              </p>
              <p
                lang={locale}
                className="text-sm wrap-anywhere whitespace-pre-wrap"
              >
                Current library · read only:{" "}
                {plain(shared, locale) || "(empty)"}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-auto self-start whitespace-normal"
                onClick={() => {
                  let accepted = false;
                  update((draft) => {
                    accepted = acknowledgeSharedWording(
                      draft,
                      variant.id,
                      path,
                      displayedLibrary,
                      target,
                    );
                  });
                  setFeedback({
                    identity: accepted
                      ? JSON.stringify([
                          target,
                          displayedLibrary,
                          displayedLibrary,
                        ])
                      : feedbackIdentity,
                    message: accepted
                      ? `Customization kept for ${variant.name || "this resume"}.`
                      : "Library wording or customization changed. Compare the current versions and try again.",
                  });
                }}
              >
                <Check data-icon="inline-start" />
                Keep customization
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => editLibrary(path, locale)}
      >
        <Pencil data-icon="inline-start" />
        Edit in library
      </Button>

      <p
        role="status"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        {feedback.identity === feedbackIdentity ? feedback.message : ""}
      </p>
    </div>
  );
}

export function VariantWordingDetails({
  initiallyOpen = false,
  ...props
}: ComponentProps<typeof VariantWordingField> & { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const { document, variant, path, locale } = props;
  const shared = sharedWording(document, path);
  if (!shared) return null;
  const value = effectiveWording(shared, variant, path);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        render={<Button variant="ghost" size="sm" />}
        className="group h-auto flex-wrap justify-start whitespace-normal"
      >
        <Languages data-icon="inline-start" />
        {variantWording(variant, path)?.overrides[locale]
          ? "Customized wording"
          : "Library wording"}
        <ChevronRight
          data-icon="inline-end"
          className="transition-transform group-data-panel-open:rotate-90"
        />
      </CollapsibleTrigger>
      {!open && (
        <WordingStatus
          missing={!!props.required && !plain(value, locale).trim()}
          review={value[locale].needsReview}
          library={sharedWordingChanged(shared, variant, path, locale)}
        />
      )}
      <CollapsibleContent>
        {open && (
          <div className="pt-3">
            <VariantWordingField {...props} />
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
