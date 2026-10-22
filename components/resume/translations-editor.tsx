"use client";

import { useRef, useState } from "react";

import { VariantWordingField } from "@/components/resume/variant-wording-field";
import { WordingField } from "@/components/resume/wording-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  localizedFields,
  plain,
  translationStatus,
} from "@/lib/resume/localization";
import { sharedWording } from "@/lib/resume/wording";
import type { EditorProps } from "@/types-and-constants/editor";
import type { Locale } from "@/types-and-constants/resume";

export function TranslationsEditor({
  document,
  update,
  locale,
  variant,
  confirm,
}: Pick<
  EditorProps,
  "document" | "update" | "locale" | "variant" | "confirm"
>) {
  const [scope, setScope] = useState("active");
  const [sectionId, setSectionId] = useState("all");
  const [target, setTarget] = useState<Locale>(locale);
  const [status, setStatus] = useState("all");
  const [activePath, setActivePath] = useState<string | null>(null);
  const cards = useRef(new Map<string, HTMLDivElement>());
  const selectedSection =
    sectionId === "all" ||
    sectionId === "profile" ||
    document.sections.some((section) => section.id === sectionId)
      ? sectionId
      : "all";
  const fields = localizedFields(
    document,
    scope === "active" ? variant : undefined,
  ).filter(
    (field) => selectedSection === "all" || field.sectionId === selectedSection,
  );
  const matches = (field: (typeof fields)[number]) => {
    const state = translationStatus(field, target);
    return (
      status === "all" ||
      (status === "missing"
        ? state.missing
        : status === "review"
          ? state.review
          : status === "shared"
            ? state.sharedReview
            : state.unresolved)
    );
  };
  const visible = fields.filter(
    (field) => matches(field) || field.path === activePath,
  );
  const unresolved = fields.filter(
    (field) => matches(field) && translationStatus(field, target).unresolved,
  );
  const activeIndex = fields.findIndex((field) => field.path === activePath);
  const previous = unresolved.findLast(
    (field) => fields.indexOf(field) < activeIndex,
  );
  const next = unresolved.find((field) => fields.indexOf(field) > activeIndex);
  const position = unresolved.findIndex((field) => field.path === activePath);

  function navigate(path: string) {
    setActivePath(path);
    const card = cards.current.get(path);
    card?.scrollIntoView({ block: "nearest" });
    const key = `${scope === "active" && sharedWording(document, path) ? `variants.${variant.id}.` : ""}${path}.${target}`;
    card
      ?.querySelector<HTMLElement>(`[data-issue-field="${CSS.escape(key)}"]`)
      ?.focus();
  }

  return (
    <div className="flex flex-col gap-5">
      <FieldGroup className="grid gap-4 @2xl:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="translation-scope">Variant scope</FieldLabel>
          <NativeSelect
            id="translation-scope"
            value={scope}
            onChange={(event) => {
              setScope(event.target.value);
              setActivePath(null);
            }}
          >
            <NativeSelectOption value="active">
              Active variant · {variant.name || "Untitled"}
            </NativeSelectOption>
            <NativeSelectOption value="library">All library</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="translation-section">Section</FieldLabel>
          <NativeSelect
            id="translation-section"
            value={selectedSection}
            onChange={(event) => {
              setSectionId(event.target.value);
              setActivePath(null);
            }}
          >
            <NativeSelectOption value="all">All sections</NativeSelectOption>
            <NativeSelectOption value="profile">Profile</NativeSelectOption>
            {document.sections.map((section) => (
              <NativeSelectOption key={section.id} value={section.id}>
                {plain(section.heading, target) ||
                  plain(
                    section.heading,
                    target === "en-US" ? "pt-BR" : "en-US",
                  ) ||
                  "Untitled section"}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="translation-language">
            Target language
          </FieldLabel>
          <NativeSelect
            id="translation-language"
            value={target}
            onChange={(event) => {
              setTarget(event.target.value as Locale);
              setActivePath(null);
            }}
          >
            <NativeSelectOption value="en-US">English</NativeSelectOption>
            <NativeSelectOption value="pt-BR">Português</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="translation-status">
            Show translations
          </FieldLabel>
          <NativeSelect
            id="translation-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setActivePath(null);
            }}
          >
            <NativeSelectOption value="all">All wording</NativeSelectOption>
            <NativeSelectOption value="missing">
              Missing required wording
            </NativeSelectOption>
            <NativeSelectOption value="review">
              Translation review
            </NativeSelectOption>
            <NativeSelectOption value="shared">
              Shared wording changed
            </NativeSelectOption>
            <NativeSelectOption value="unresolved">
              Unresolved
            </NativeSelectOption>
          </NativeSelect>
        </Field>
      </FieldGroup>
      <FieldDescription>
        Optional empty wording can stay empty. Review flags warn without
        blocking valid draft downloads. All library includes archived and
        unselected content; only selected output wording can block that output.
      </FieldDescription>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={!previous}
          onClick={() => previous && navigate(previous.path)}
        >
          Previous unresolved
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!next}
          onClick={() => next && navigate(next.path)}
        >
          Next unresolved
        </Button>
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-muted-foreground"
        >
          {position >= 0
            ? `${position + 1} of ${unresolved.length} unresolved`
            : `${unresolved.length} unresolved remaining`}
        </p>
      </div>
      {!visible.length && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>All clear</EmptyTitle>
            <EmptyDescription>
              No wording matches these filters.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {visible.map((field) => (
        <Card
          key={`${field.path}:${target}`}
          ref={(node) => {
            if (node) cards.current.set(field.path, node);
            else cards.current.delete(field.path);
          }}
          onFocusCapture={() => setActivePath(field.path)}
        >
          <CardHeader>
            <CardTitle>{field.label}</CardTitle>
            <CardDescription>Source: {field.source}</CardDescription>
          </CardHeader>
          <CardContent>
            {scope === "active" && sharedWording(document, field.path) ? (
              <VariantWordingField
                document={document}
                variant={variant}
                path={field.path}
                locale={target}
                update={update}
                confirm={confirm}
                label={field.label}
                required={field.required}
                multiline={field.multiline}
              />
            ) : (
              <WordingField
                document={document}
                path={field.path}
                locale={target}
                update={update}
                label={target === "en-US" ? "English" : "Português"}
                required={field.required}
                multiline={field.multiline}
                showReference
              />
            )}
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              Editing effective wording flags its existing effective counterpart
              for review. Variant review stays separate from library review.
            </p>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
