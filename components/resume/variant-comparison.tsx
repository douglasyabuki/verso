"use client";

import { type ComponentProps, useState } from "react";

import { CheckField } from "@/components/resume/fields";
import { SectionIcon } from "@/components/resume/section-icon";
import { ReviewStatusBadge } from "@/components/resume/semantic-badges/review-status-badge";
import { WordingSourceBadge } from "@/components/resume/semantic-badges/wording-source-badge";
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
import { plain } from "@/lib/resume/localization";
import { entryLabel } from "@/lib/resume/section-fields";
import { resolveSettings } from "@/lib/resume/settings";
import {
  effectiveWording,
  sharedWordingChanged,
  variantWording,
} from "@/lib/resume/wording";
import type { Locale } from "@/types-and-constants/languages";
import { templateSettingLabels } from "@/types-and-constants/output";
import type {
  LocalizedText,
  ResumeDocument,
  Section,
  Span,
  Variant,
} from "@/types-and-constants/resume";
import type { Issue } from "@/types-and-constants/review";

type Cell = {
  status: string;
  spans?: Span[];
  source?: ComponentProps<typeof WordingSourceBadge>["source"];
  translation?: boolean;
  shared?: boolean;
};
type Row = {
  id: string;
  label: string;
  sectionId: string;
  sectionKind?: Section["kind"] | "summary";
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
  const { state } = useWorkspace();
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
      <p className="text-xs leading-normal text-muted-foreground">
        Create or duplicate a second resume to compare selected content, text,
        and layout settings.
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
        ? "custom"
        : "inherited",
      translation: value[locale].needsReview,
      shared: sharedWordingChanged(shared, selected, path, locale),
    };
  };
  const rows: Row[] = [
    {
      id: "summary",
      label: "Summary",
      sectionKind: "summary",
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
            ? "Shown in PDF"
            : "Empty · hidden from PDF",
        ),
      ),
    },
  ];
  for (const section of document.sections) {
    rows.push({
      id: section.id,
      label: plain(section.heading, locale) || "Untitled section",
      sectionKind: section.kind,
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
            status: `${index < 0 ? "Not selected" : `Selected · entry position ${index + 1}`} · ${entry.archived ? "Archived · hidden from PDF" : !selection.visible || index < 0 ? "Hidden from PDF" : "Shown in PDF"}`,
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
              `${index < 0 ? "Not selected" : `Selected · achievement position ${index + 1}`} · ${entry.archived ? "Archived · hidden from PDF" : !selected.visible || index < 0 ? "Hidden from PDF" : "Shown in PDF"}`,
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
      label: `Final setting · ${templateSettingLabels[key]}`,
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
  const languageItems = [
    { value: "en-US", label: "English" },
    { value: "pt-BR", label: "Português" },
  ];
  return (
    <div className="flex flex-col gap-4">
      <FieldGroup className="grid gap-4 @2xl:grid-cols-2">
        {variants.map((item, index) => {
          const comparisonItems = document.variants
            .filter((candidate) => candidate.id !== variants[1 - index].id)
            .map((candidate) => ({
              value: candidate.id,
              label: candidate.name || "Untitled resume",
            }));
          return (
            <Field key={index}>
              <FieldLabel htmlFor={`compare-${index}`}>
                {index ? "Right resume" : "Left resume"}
              </FieldLabel>
              <Select
                items={comparisonItems}
                value={item.id}
                disabled={state.replacing || !!state.pending}
                onValueChange={(value) => {
                  if (value === null || state.replacing || state.pending)
                    return;
                  if (index) setRightId(value);
                  else setLeftId(value);
                }}
              >
                <SelectTrigger
                  appearance="utility"
                  id={`compare-${index}`}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {comparisonItems.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          );
        })}
        <Field>
          <FieldLabel htmlFor="compare-language">
            Comparison language
          </FieldLabel>
          <Select
            items={languageItems}
            value={locale}
            disabled={state.replacing || !!state.pending}
            onValueChange={(value) => {
              if (value === null || state.replacing || state.pending) return;
              setLocale(value as Locale);
            }}
          >
            <SelectTrigger
              appearance="utility"
              id="compare-language"
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {languageItems.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <CheckField
          label="Differences only"
          checked={differences}
          onChange={setDifferences}
        />
      </FieldGroup>
      <p className="text-xs leading-normal text-muted-foreground">
        This comparison cannot be edited here. It includes content hidden from
        the resumes and any custom text saved for it. Layout settings show the
        final values used for each resume and language.
      </p>
      {!visible.length && <p role="status">No differences in this language.</p>}
      {visible.map((row) => {
        const changed =
          JSON.stringify(row.cells[0]) !== JSON.stringify(row.cells[1]);
        return (
          <Card key={row.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 [&>svg]:size-5 [&>svg]:shrink-0">
                {row.sectionKind && (
                  <SectionIcon
                    kind={row.sectionKind}
                    icon={
                      document.sections.find(
                        (section) => section.id === row.sectionId,
                      )?.icon
                    }
                  />
                )}
                <span className="min-w-0 wrap-anywhere">{row.label}</span>
              </CardTitle>
              <CardDescription>
                {changed ? "Different between resumes" : "Same in both resumes"}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 @2xl:grid-cols-2">
              {row.cells.map((cell, index) => (
                <div key={index} className="flex min-w-0 flex-col gap-2">
                  <p className="text-sm font-medium">
                    {variants[index].name || "Untitled resume"}
                  </p>
                  <p className="text-sm">{cell.status}</p>
                  <div className="flex flex-wrap gap-2">
                    {cell.source && <WordingSourceBadge source={cell.source} />}
                    {cell.translation && (
                      <ReviewStatusBadge state="translation" />
                    )}
                    {cell.shared && <ReviewStatusBadge state="library" />}
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
                        : "No text yet"}
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
                  Edit {item.name || "Untitled resume"}
                </Button>
              ))}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
