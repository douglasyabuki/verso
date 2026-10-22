"use client";

import { type ComponentProps, useState } from "react";

import { LocalizedField } from "@/components/resume/fields";
import { TranslationReference } from "@/components/resume/translation-reference";
import { WordingField } from "@/components/resume/wording-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { plain, translationSnapshot } from "@/lib/resume/localization";
import {
  acknowledgeSharedWording,
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
  const [message, setMessage] = useState("");
  const shared = sharedWording(document, path);
  if (!shared) return null;
  const field = variantWording(variant, path);
  const override = field?.overrides[locale];
  const value = effectiveWording(shared, variant, path);
  const other = locale === "en-US" ? "pt-BR" : "en-US";
  const target = effectiveSnapshot(shared, variant, path, locale);
  const reference = effectiveSnapshot(shared, variant, path, other);
  const baselineChanged = sharedWordingChanged(shared, variant, path, locale);
  const fieldKey = `variants.${variant.id}.${path}.${locale}`;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={override ? "secondary" : "outline"}>
          {override ? "Variant override" : "Shared wording"}
        </Badge>
        <span className="text-sm">
          {variant.name || "Untitled variant"} · {locale}
        </span>
        {value[locale].needsReview && (
          <Badge variant="outline">Translation review</Badge>
        )}
        {baselineChanged && (
          <Badge variant="outline">Shared wording changed</Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {override
          ? `Editing this override changes only ${variant.name || "this variant"} in ${locale}. Shared wording and facts stay in the library.`
          : `This language uses shared library wording. Create an override explicitly to change only ${variant.name || "this variant"} in ${locale}.`}
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
            Create override
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
              "Reset to shared wording?",
              `Remove only the ${locale} override for ${variant.name || "this variant"}. Current shared wording: ${plain(shared, locale) || "(empty)"}. Workspace undo can restore the override.`,
              () =>
                update((draft) =>
                  resetWordingOverride(draft, variant.id, path, locale),
                ),
            )
          }
        >
          Reset to shared
        </Button>
      )}
      {field && (
        <>
          <p className="text-sm text-muted-foreground">
            Effective counterpart:{" "}
            {reference.source === "override"
              ? "Variant override"
              : "Shared wording"}{" "}
            ? {other}
          </p>
          <TranslationReference
            snapshot={field.review[locale].reviewedCounterpart}
            current={reference}
          />
          {plain(value, locale).trim() && (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => {
                let accepted = false;
                update((draft) => {
                  accepted = markVariantTranslationReviewed(
                    draft,
                    variant.id,
                    path,
                    target,
                    reference,
                  );
                });
                setMessage(
                  accepted
                    ? "Variant translation review saved."
                    : "Wording or its source changed. Review the current pair again.",
                );
              }}
            >
              Mark variant translation reviewed
            </Button>
          )}
        </>
      )}
      {baselineChanged && override && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Shared wording changed beneath this override. This review is
            separate from translation review.
          </p>
          <p
            lang={locale}
            className="text-sm wrap-anywhere whitespace-pre-wrap"
          >
            Previously reviewed shared wording:{" "}
            {override.sharedBaseline.spans.map((span) => span.text).join("") ||
              "(empty)"}
          </p>
          <p
            lang={locale}
            className="text-sm wrap-anywhere whitespace-pre-wrap"
          >
            Current shared wording: {plain(shared, locale) || "(empty)"}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => {
              const displayed = translationSnapshot(shared, locale);
              let accepted = false;
              update((draft) => {
                accepted = acknowledgeSharedWording(
                  draft,
                  variant.id,
                  path,
                  displayed,
                );
              });
              setMessage(
                accepted
                  ? "Shared wording review saved. Translation review is unchanged."
                  : "Shared wording changed. Review it again.",
              );
            }}
          >
            Acknowledge shared wording
          </Button>
        </div>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Edit shared library wording
        </summary>
        <p className="my-3 text-sm text-muted-foreground">
          Shared edits affect every variant inheriting this language and can
          flag overrides for review. They do not replace overrides.
        </p>
        <WordingField
          document={document}
          path={path}
          locale={locale}
          update={update}
          label={label}
          required={required}
          multiline={multiline}
          showReference
        />
      </details>
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        {message}
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
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-medium">
        <Badge variant="outline">
          {variantWording(variant, path)?.overrides[locale]
            ? "Variant override"
            : "Shared wording"}
        </Badge>{" "}
        {value[locale].needsReview && (
          <Badge variant="outline">Translation review</Badge>
        )}{" "}
        {sharedWordingChanged(shared, variant, path, locale) && (
          <Badge variant="outline">Shared wording changed</Badge>
        )}{" "}
        Wording: {variant.name || "Untitled variant"} ({locale})
      </summary>
      {open && (
        <div className="pt-3">
          <VariantWordingField {...props} />
        </div>
      )}
    </details>
  );
}
