"use client";

import { useState } from "react";

import { LocalizedField } from "@/components/resume/fields";
import { TranslationReference } from "@/components/resume/translation-reference";
import { Button } from "@/components/ui/button";
import {
  editTranslation,
  findLocalized,
  markTranslationReviewed,
  plain,
  translationSnapshot,
} from "@/lib/resume/localization";
import type {
  Issue,
  Locale,
  ResumeDocument,
} from "@/types-and-constants/resume";
import type { WorkspaceEdit } from "@/types-and-constants/workspace";

export function WordingField({
  document,
  path,
  locale,
  update,
  label,
  required,
  multiline = false,
  description,
  errors = [],
  showReference = false,
}: {
  document: ResumeDocument;
  path: string;
  locale: Locale;
  update: WorkspaceEdit;
  label: string;
  required?: boolean;
  multiline?: boolean;
  description?: string;
  errors?: Issue[];
  showReference?: boolean;
}) {
  const [reviewMessage, setReviewMessage] = useState("");
  const value = findLocalized(document, path);
  if (!value) return null;
  const referenceLocale = locale === "en-US" ? "pt-BR" : "en-US";
  const target = translationSnapshot(value, locale);
  const reference = translationSnapshot(value, referenceLocale);
  const populated = !!plain(value, locale).trim();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Shared wording · Editing updates every resume that inherits this
        language.
      </p>
      <LocalizedField
        fieldKey={`${path}.${locale}`}
        label={label}
        value={value}
        locale={locale}
        required={required}
        multiline={multiline}
        description={description}
        error={errors.find((error) => error.path === path)?.message}
        onChange={(spans, group) =>
          update((draft) => {
            const field = findLocalized(draft, path);
            if (field) editTranslation(field, locale, spans);
          }, group)
        }
      />
      {(showReference || populated) && (
        <TranslationReference
          snapshot={value[locale].reviewedCounterpart}
          current={reference}
        />
      )}
      {populated && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => {
            let accepted = false;
            update((draft) => {
              accepted = markTranslationReviewed(
                draft,
                path,
                target,
                reference,
                referenceLocale,
              );
            });
            setReviewMessage(
              accepted
                ? "Review saved."
                : "Wording changed or is unavailable. Check the current wording and review again.",
            );
          }}
        >
          Mark reviewed
        </Button>
      )}
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        {reviewMessage}
      </p>
    </div>
  );
}
