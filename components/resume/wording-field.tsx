"use client";

import { LocalizedField } from "@/components/resume/fields";
import type {
  DocumentUpdate,
  Issue,
  Locale,
  ResumeDocument,
  Span,
} from "@/lib/resume/model";
import { editTranslation, findLocalized } from "@/lib/resume/model";

export function WordingField({
  document,
  path,
  locale,
  update,
  label,
  required,
  errors = [],
}: {
  document: ResumeDocument;
  path: string;
  locale: Locale;
  update: (change: DocumentUpdate) => void;
  label: string;
  required?: boolean;
  errors?: Issue[];
}) {
  const value = findLocalized(document, path);
  if (!value) return null;
  return (
    <LocalizedField
      label={label}
      value={value}
      locale={locale}
      required={required}
      error={errors.find((error) => error.path === path)?.message}
      onChange={(spans: Span[]) =>
        update((draft) => {
          const field = findLocalized(draft, path);
          if (field) editTranslation(field, locale, spans);
        })
      }
      onReviewed={() =>
        update((draft) => {
          const field = findLocalized(draft, path);
          if (field) field[locale].needsReview = false;
        })
      }
    />
  );
}
