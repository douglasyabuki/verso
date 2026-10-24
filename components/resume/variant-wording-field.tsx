"use client";

import { type ComponentProps, useState } from "react";

import { LocalizedField } from "@/components/resume/fields";
import { TranslationComparison } from "@/components/resume/translation-comparison";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useWorkflowLinks } from "@/hooks/workspace/use-workflow-links";
import { plain, translationSnapshot } from "@/lib/resume/localization";
import {
  acknowledgeSharedWording,
  confirmVariantTranslationPair,
  createWordingOverride,
  editWordingOverride,
  effectiveSnapshot,
  effectiveWording,
  markVariantTranslationReviewed,
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
        {value[locale].needsReview && (
          <Badge variant="outline">Compare translations</Badge>
        )}
        {baselineChanged && (
          <Badge variant="outline">Review library changes</Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {override
          ? `Editing this override changes only ${variant.name || "this resume"} in ${languageNames[locale]}. Shared wording and facts stay in the library.`
          : `This language uses shared library wording. Create an override explicitly to change only ${variant.name || "this resume"} in ${languageNames[locale]}.`}
      </p>
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
        <div className="flex flex-col gap-2">
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
          Reset to library wording
        </Button>
      )}
      {field ? (
        <TranslationComparison
          review={field.review}
          target={target}
          reference={reference}
          snapshot={field.review[locale].reviewedCounterpart}
          needsReview={field.review[locale].needsReview}
          owner={variant.name || "this resume"}
          onConfirm={(both) => {
            let accepted = false;
            update((draft) => {
              accepted = both
                ? confirmVariantTranslationPair(
                    draft,
                    variant.id,
                    path,
                    target,
                    reference,
                  )
                : markVariantTranslationReviewed(
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
      ) : (
        <p className="text-sm text-muted-foreground">
          Both languages inherit library wording. Compare and confirm in the
          career library; no independent resume comparison is recorded here.
        </p>
      )}
      {baselineChanged && override && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Library wording changed beneath this customization. Compare the
            previous library wording, current library wording, and your
            customization above. Edit it, keep it after checking, or reset to
            library wording. Editing alone never clears this reminder, even when
            the text matches the library. This decision applies only to this
            resume and is separate from translation comparison.
          </p>
          <p
            lang={locale}
            className="text-sm wrap-anywhere whitespace-pre-wrap"
          >
            Previous library baseline:{" "}
            {override.sharedBaseline.spans.map((span) => span.text).join("") ||
              "(empty)"}
          </p>
          <p
            lang={locale}
            className="text-sm wrap-anywhere whitespace-pre-wrap"
          >
            Current library wording: {plain(shared, locale) || "(empty)"}
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
                  ? JSON.stringify([target, displayedLibrary, displayedLibrary])
                  : feedbackIdentity,
                message: accepted
                  ? `Customization retained for ${variant.name || "this resume"}. Library-change reminder cleared; translation reminders are unchanged.`
                  : "Library wording or customization changed. Compare the current versions and try again.",
              });
            }}
          >
            Keep this customization after checking library changes
          </Button>
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => editLibrary(path, locale)}
      >
        Edit in career library
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
      <CollapsibleTrigger className="cursor-pointer text-left text-sm font-medium">
        <Badge variant="outline">
          {variantWording(variant, path)?.overrides[locale]
            ? "Customized for this resume"
            : "Uses library text"}
        </Badge>{" "}
        {value[locale].needsReview && (
          <Badge variant="outline">Compare translations</Badge>
        )}{" "}
        {sharedWordingChanged(shared, variant, path, locale) && (
          <Badge variant="outline">Review library changes</Badge>
        )}{" "}
        Wording: {variant.name || "Untitled resume"} ({languageNames[locale]})
      </CollapsibleTrigger>
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
