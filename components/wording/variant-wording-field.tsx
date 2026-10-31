"use client";

import { Check, ChevronRight, Pencil, RotateCcw } from "lucide-react";
import { type ComponentProps, useState } from "react";

import { LocalizedField } from "@/components/editor/fields";
import { LanguageFlag } from "@/components/shared/language-flag";
import { WordingSourceBadge } from "@/components/shared/semantic-badges/wording-source-badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { InfoHint } from "@/components/ui/info-hint";
import { TranslationComparison } from "@/components/wording/translation-comparison";
import { WordingComparisonDetails } from "@/components/wording/wording-comparison-details";
import { WordingStatus } from "@/components/wording/wording-status";
import { useWorkflowLinks } from "@/hooks/workspace/use-workflow-links";
import { plain, translationSnapshot } from "@/lib/wording/localization";
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
} from "@/lib/wording/wording";
import type { ConfirmAction } from "@/types-and-constants/editor";
import type { Locale } from "@/types-and-constants/languages";
import { languageNames } from "@/types-and-constants/languages";
import type { ResumeDocument, Variant } from "@/types-and-constants/resume";
import type { Issue } from "@/types-and-constants/review";
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
  const { editCareer } = useWorkflowLinks();
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
  const displayedShared = translationSnapshot(shared, locale);
  const feedbackIdentity = JSON.stringify([
    target,
    displayedShared,
    override?.sharedBaseline,
  ]);
  const fieldKey = `variants.${variant.id}.${path}.${locale}`;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <WordingSourceBadge source={override ? "custom" : "inherited"} />
        <span className="text-sm">
          {variant.name || "Untitled resume"} · {languageNames[locale]}
        </span>
        <WordingStatus
          missing={required && !plain(value, locale).trim()}
          review={value[locale].needsReview}
          sharedReview={baselineChanged}
        />
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
        <div className="flex flex-col gap-2 rounded-lg border border-transparent bg-field-readonly p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {label} · Shared text · read only
          </p>
          <p
            lang={locale}
            className="text-sm wrap-anywhere whitespace-pre-wrap"
          >
            {plain(value, locale) || "No text yet"}
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
          variant="destructive"
          size="sm"
          className="self-start"
          onClick={() =>
            confirm(
              "Use shared text?",
              `Remove only the ${languageNames[locale]} customization for ${variant.name || "this resume"}. Current shared text: ${plain(shared, locale) || "(empty)"}. Undo can restore your custom text.`,
              () =>
                update((draft) =>
                  resetWordingOverride(draft, variant.id, path, locale),
                ),
            )
          }
        >
          <RotateCcw data-icon="inline-start" />
          Use shared text
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
          Review shared text in Career details.
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
              className="transition-transform duration-200 group-data-panel-open:rotate-90 motion-reduce:transition-none"
            />
            Review shared text changes
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 flex flex-col gap-3 rounded-lg border border-transparent bg-field-readonly p-3">
              <p className="text-xs leading-normal text-muted-foreground">
                The shared text changed. Compare it with your custom text, then
                keep your text or switch to the shared text.
                <InfoHint label="shared text review">
                  Editing alone does not clear this reminder. Keeping your
                  custom text affects only this resume. Translation reminders
                  stay separate.
                </InfoHint>
              </p>
              <p
                lang={locale}
                className="text-sm wrap-anywhere whitespace-pre-wrap"
              >
                Previous shared text · read only:{" "}
                {override.sharedBaseline.spans
                  .map((span) => span.text)
                  .join("") || "(empty)"}
              </p>
              <p
                lang={locale}
                className="text-sm wrap-anywhere whitespace-pre-wrap"
              >
                Current shared text · read only:{" "}
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
                      displayedShared,
                      target,
                    );
                  });
                  setFeedback({
                    identity: accepted
                      ? JSON.stringify([
                          target,
                          displayedShared,
                          displayedShared,
                        ])
                      : feedbackIdentity,
                    message: accepted
                      ? `Custom text kept for ${variant.name || "this resume"}.`
                      : "The shared or custom text changed. Compare the latest versions and try again.",
                  });
                }}
              >
                <Check data-icon="inline-start" />
                Keep my custom text
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => editCareer(path, locale)}
      >
        <Pencil data-icon="inline-start" />
        Edit shared text
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
        <LanguageFlag locale={locale} />
        {variantWording(variant, path)?.overrides[locale]
          ? "Custom text"
          : "Shared text"}
        <ChevronRight
          data-icon="inline-end"
          className="transition-transform duration-200 group-data-panel-open:rotate-90 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      {!open && (
        <WordingStatus
          missing={!!props.required && !plain(value, locale).trim()}
          review={value[locale].needsReview}
          sharedReview={sharedWordingChanged(shared, variant, path, locale)}
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
