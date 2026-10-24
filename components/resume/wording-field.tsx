"use client";

import { LocalizedField } from "@/components/resume/fields";
import { TranslationComparison } from "@/components/resume/translation-comparison";
import {
  confirmTranslationPair,
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
      {(showReference || populated || required) && (
        <TranslationComparison
          review={value}
          target={target}
          reference={reference}
          snapshot={value[locale].reviewedCounterpart}
          needsReview={value[locale].needsReview}
          owner="the career library"
          onConfirm={(both) => {
            let accepted = false;
            update((draft) => {
              accepted = both
                ? confirmTranslationPair(draft, path, target, reference)
                : markTranslationReviewed(
                    draft,
                    path,
                    target,
                    reference,
                    referenceLocale,
                  );
            });
            return accepted;
          }}
        />
      )}
    </div>
  );
}
