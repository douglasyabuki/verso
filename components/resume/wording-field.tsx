"use client";

import { LocalizedField } from "@/components/resume/fields";
import { WordingSourceBadge } from "@/components/resume/semantic-badges/wording-source-badge";
import { TranslationComparison } from "@/components/resume/translation-comparison";
import { WordingComparisonDetails } from "@/components/resume/wording-comparison-details";
import { WordingStatus } from "@/components/resume/wording-status";
import {
  confirmTranslationPair,
  editTranslation,
  findLocalized,
  plain,
  translationSnapshot,
} from "@/lib/resume/localization";
import type { Locale } from "@/types-and-constants/languages";
import type { ResumeDocument } from "@/types-and-constants/resume";
import type { Issue } from "@/types-and-constants/review";
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
      <div className="flex flex-wrap items-center gap-2">
        <WordingSourceBadge source="library" />
        <WordingStatus
          missing={!populated && !!required}
          review={value[locale].needsReview}
        />
      </div>
      <LocalizedField
        fieldKey={`${path}.${locale}`}
        label={label}
        value={value}
        locale={locale}
        required={required}
        multiline={multiline}
        hint={description}
        error={errors.find((error) => error.path === path)?.message}
        onChange={(spans, group) =>
          update((draft) => {
            const field = findLocalized(draft, path);
            if (field) editTranslation(field, locale, spans);
          }, group)
        }
      />
      {(showReference || populated || required) && (
        <WordingComparisonDetails expanded={showReference}>
          <TranslationComparison
            review={value}
            target={target}
            reference={reference}
            snapshot={value[locale].reviewedCounterpart}
            needsReview={value[locale].needsReview}
            owner="the career library"
            onConfirm={() => {
              let accepted = false;
              update((draft) => {
                accepted = confirmTranslationPair(
                  draft,
                  path,
                  target,
                  reference,
                );
              });
              return accepted;
            }}
          />
        </WordingComparisonDetails>
      )}
    </div>
  );
}
