"use client";

import { useState } from "react";

import { CheckField } from "@/components/resume/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { plain } from "@/lib/resume/localization";
import { entryLabel } from "@/lib/resume/section-fields";
import { resolveSettings } from "@/lib/resume/settings";
import {
  effectiveWording,
  sharedWordingChanged,
  variantWording,
} from "@/lib/resume/wording";
import type {
  Issue,
  Locale,
  LocalizedText,
  ResumeDocument,
  Span,
  Variant,
} from "@/types-and-constants/resume";
import { templateSettingLabels } from "@/types-and-constants/resume";

type Cell = {
  status: string;
  spans?: Span[];
  source?: string;
  translation?: boolean;
  shared?: boolean;
};
type Row = {
  id: string;
  label: string;
  sectionId: string;
  path?: string;
  entryId?: string;
  cells: Cell[];
};

export function VariantComparison({
  document,
  variant,
  locale: initialLocale,
  onOpen,
}: {
  document: ResumeDocument;
  variant: Variant;
  locale: Locale;
  onOpen: (issue: Issue) => void;
}) {
  const [leftId, setLeftId] = useState(variant.id);
  const [rightId, setRightId] = useState(
    document.variants.find((item) => item.id !== variant.id)?.id ?? "",
  );
  const [locale, setLocale] = useState(initialLocale);
  const [differences, setDifferences] = useState(false);
  const left = document.variants.find((item) => item.id === leftId) ?? variant;
  const right =
    document.variants.find(
      (item) => item.id === rightId && item.id !== left.id,
    ) ?? document.variants.find((item) => item.id !== left.id);
  if (!right)
    return (
      <p className="text-sm text-muted-foreground">
        Create or duplicate a second variant to compare selections, wording, and
        settings.
      </p>
    );
  const variants = [left, right];
  const wording = (
    shared: LocalizedText,
    path: string,
    selected: Variant,
    status: string,
  ): Cell => {
    const value = effectiveWording(shared, selected, path);
    return {
      status,
      spans: value[locale].spans,
      source: variantWording(selected, path)?.overrides[locale]
        ? "Variant override"
        : "Shared wording",
      translation: value[locale].needsReview,
      shared: sharedWordingChanged(shared, selected, path, locale),
    };
  };
  const rows: Row[] = [
    {
      id: "summary",
      label: "Profile summary",
      sectionId: "profile",
      path: "profile.summary",
      cells: variants.map((item) =>
        wording(
          document.profile.summary,
          "profile.summary",
          item,
          plain(
            effectiveWording(document.profile.summary, item, "profile.summary"),
            locale,
          ).trim()
            ? "In output"
            : "Empty · not in output",
        ),
      ),
    },
  ];
  for (const section of document.sections) {
    rows.push({
      id: section.id,
      label: plain(section.heading, locale) || "Untitled section",
      sectionId: section.id,
      cells: variants.map((item) => {
        const index = item.sections.findIndex(
          (selection) => selection.sectionId === section.id,
        );
        const selection = item.sections[index];
        return {
          status: `${selection?.visible ? "Visible" : "Hidden"} · section position ${index + 1} · ${selection?.entries.length ?? 0} selected entries`,
        };
      }),
    });
    for (const entry of section.entries) {
      const label = entryLabel(entry, section.kind, locale);
      rows.push({
        id: entry.id,
        label,
        sectionId: section.id,
        entryId: entry.id,
        cells: variants.map((item) => {
          const selection = item.sections.find(
            (selection) => selection.sectionId === section.id,
          )!;
          const index = selection.entries.findIndex(
            (selected) => selected.entryId === entry.id,
          );
          return {
            status: `${index < 0 ? "Not selected" : `Selected · entry position ${index + 1}`} · ${entry.archived ? "Archived · not in output" : !selection.visible || index < 0 ? "Not in output" : "In output"}`,
          };
        }),
      });
      for (const bullet of entry.bullets) {
        const path = `bullets.${bullet.id}.body`;
        rows.push({
          id: bullet.id,
          label: `${label} · ${plain(bullet.body, locale).slice(0, 80) || "Achievement"}`,
          sectionId: section.id,
          entryId: entry.id,
          path,
          cells: variants.map((item) => {
            const selected = item.sections.find(
              (selection) => selection.sectionId === section.id,
            )!;
            const selection = selected.entries.find(
              (selection) => selection.entryId === entry.id,
            );
            const index = selection?.bulletIds.indexOf(bullet.id) ?? -1;
            return wording(
              bullet.body,
              path,
              item,
              `${index < 0 ? "Not selected" : `Selected · achievement position ${index + 1}`} · ${entry.archived ? "Archived · not in output" : !selected.visible || index < 0 ? "Not in output" : "In output"}`,
            );
          }),
        });
      }
    }
  }
  const settings = variants.map((item) =>
    resolveSettings(document, item, locale),
  );
  for (const key of Object.keys(settings[0]) as (keyof (typeof settings)[0])[])
    rows.push({
      id: `settings.${templateSettingLabels[key]}`,
      label: `Effective setting · ${templateSettingLabels[key]}`,
      sectionId: "template",
      cells: settings.map((value) => ({
        status:
          key === "pageSize"
            ? value.pageSize === "a4"
              ? "A4"
              : "US Letter"
            : String(value[key]),
      })),
    });
  const visible = rows.filter(
    (row) =>
      !differences ||
      JSON.stringify(row.cells[0]) !== JSON.stringify(row.cells[1]),
  );
  return (
    <div className="flex flex-col gap-4">
      <FieldGroup className="grid gap-4 @2xl:grid-cols-2">
        {variants.map((item, index) => (
          <Field key={index}>
            <FieldLabel htmlFor={`compare-${index}`}>
              {index ? "Right variant" : "Left variant"}
            </FieldLabel>
            <NativeSelect
              id={`compare-${index}`}
              value={item.id}
              onChange={(event) =>
                index
                  ? setRightId(event.target.value)
                  : setLeftId(event.target.value)
              }
            >
              {document.variants
                .filter((candidate) => candidate.id !== variants[1 - index].id)
                .map((candidate) => (
                  <NativeSelectOption key={candidate.id} value={candidate.id}>
                    {candidate.name || "Untitled variant"}
                  </NativeSelectOption>
                ))}
            </NativeSelect>
          </Field>
        ))}
        <Field>
          <FieldLabel htmlFor="compare-language">
            Comparison language
          </FieldLabel>
          <NativeSelect
            id="compare-language"
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
          >
            <NativeSelectOption value="en-US">English</NativeSelectOption>
            <NativeSelectOption value="pt-BR">Português</NativeSelectOption>
          </NativeSelect>
        </Field>
        <CheckField
          label="Differences only"
          checked={differences}
          onChange={setDifferences}
        />
      </FieldGroup>
      <p className="text-sm text-muted-foreground">
        Read-only comparison. Excluded content and its retained overrides are
        included below. Settings show the final value after workspace, language,
        variant, and variant-language overrides.
      </p>
      {!visible.length && <p role="status">No differences in this language.</p>}
      {visible.map((row) => {
        const changed =
          JSON.stringify(row.cells[0]) !== JSON.stringify(row.cells[1]);
        return (
          <Card key={row.id}>
            <CardHeader>
              <CardTitle>{row.label}</CardTitle>
              <CardDescription>
                {changed
                  ? "Different between variants"
                  : "Same in both variants"}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 @2xl:grid-cols-2">
              {row.cells.map((cell, index) => (
                <div key={index} className="flex min-w-0 flex-col gap-2">
                  <p className="text-sm font-medium">
                    {variants[index].name || "Untitled variant"}
                  </p>
                  <p className="text-sm">{cell.status}</p>
                  <div className="flex flex-wrap gap-2">
                    {cell.source && (
                      <Badge
                        variant={
                          cell.source === "Variant override"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {cell.source}
                      </Badge>
                    )}
                    {cell.translation && (
                      <Badge variant="outline">Translation review</Badge>
                    )}
                    {cell.shared && (
                      <Badge variant="outline">Shared wording changed</Badge>
                    )}
                  </div>
                  {cell.spans && (
                    <p
                      lang={locale}
                      className="text-sm wrap-anywhere whitespace-pre-wrap"
                    >
                      {cell.spans.some((span) => span.text)
                        ? cell.spans.map((span, index) => (
                            <span key={index}>
                              {span.emphasis ? <em>{span.text}</em> : span.text}
                              {span.href && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  ({span.href})
                                </span>
                              )}
                            </span>
                          ))
                        : "Empty wording"}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              {variants.map((item) => (
                <Button
                  key={item.id}
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onOpen({
                      id: crypto.randomUUID(),
                      path: row.path ?? row.id,
                      category: "layout",
                      locale,
                      section: row.label,
                      entry: row.label,
                      field: row.label,
                      message: "Open comparison target",
                      target: {
                        sectionId: row.sectionId,
                        entryId: row.entryId,
                        variantId: item.id,
                        scope: "variant",
                        wordingPath: row.path,
                        fieldKey: row.path
                          ? `variants.${item.id}.${row.path}.${locale}`
                          : row.sectionId === "template"
                            ? row.id
                            : row.entryId
                              ? `variants.${item.id}.entries.${row.entryId}`
                              : `variants.${item.id}.sections.${row.sectionId}`,
                      },
                    })
                  }
                >
                  Edit {item.name || "Untitled variant"}
                </Button>
              ))}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
