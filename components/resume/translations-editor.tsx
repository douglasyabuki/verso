"use client";

import { useState } from "react";

import { WordingField } from "@/components/resume/wording-field";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { localizedFields, plain } from "@/lib/resume/localization";
import type { EditorProps } from "@/types-and-constants/editor";
import type { Locale } from "@/types-and-constants/resume";

export function TranslationsEditor({
  document,
  update,
}: Pick<EditorProps, "document" | "update">) {
  const [filter, setFilter] = useState("all");
  const fields = localizedFields(document).filter(
    (field) =>
      filter === "all" ||
      (filter === "review"
        ? Object.values(field.value).some((value) => value.needsReview)
        : !plain(field.value, "en-US").trim() ||
          !plain(field.value, "pt-BR").trim()),
  );
  return (
    <div className="flex flex-col gap-5">
      <Field>
        <FieldLabel htmlFor="translation-filter">Show translations</FieldLabel>
        <NativeSelect
          id="translation-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <NativeSelectOption value="all">All wording</NativeSelectOption>
          <NativeSelectOption value="review">Needs review</NativeSelectOption>
          <NativeSelectOption value="missing">
            Missing wording
          </NativeSelectOption>
        </NativeSelect>
        <FieldDescription>
          Missing optional wording can stay empty. Review flags warn without
          blocking valid downloads.
        </FieldDescription>
      </Field>
      {!fields.length && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>All clear</EmptyTitle>
            <EmptyDescription>No wording matches this filter.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {fields.map((field) => (
        <Card key={field.path}>
          <CardHeader>
            <CardTitle>{field.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 @2xl:grid-cols-2">
              {(["en-US", "pt-BR"] as Locale[]).map((locale) => (
                <WordingField
                  key={locale}
                  document={document}
                  path={field.path}
                  locale={locale}
                  update={update}
                  label={locale === "en-US" ? "English" : "Português"}
                  multiline={field.multiline}
                />
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              Editing one language flags its existing counterpart for review.
            </p>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
