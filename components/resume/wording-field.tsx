"use client";

import { LocalizedField } from "@/components/resume/fields";
import { editTranslation, findLocalized } from "@/lib/resume/localization";
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
}) {
  const value = findLocalized(document, path);
  if (!value) return null;
  return (
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
      onReviewed={() =>
        update((draft) => {
          const field = findLocalized(draft, path);
          if (field) field[locale].needsReview = false;
        })
      }
    />
  );
}
