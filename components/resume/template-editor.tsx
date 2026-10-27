"use client";

import { useId, useState } from "react";

import { TemplateIdentityBadge } from "@/components/resume/semantic-badges/template-identity-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
import { resolveSettings } from "@/lib/resume/settings";
import type { EditorProps } from "@/types-and-constants/editor";
import { languageNames } from "@/types-and-constants/languages";
import type { TemplateSettings } from "@/types-and-constants/output";

export function SettingsEditor({
  document,
  variant,
  locale,
  update,
  initialScope = "variant",
  sharedDefaults = false,
}: Pick<EditorProps, "document" | "variant" | "locale" | "update"> & {
  initialScope?: string;
  sharedDefaults?: boolean;
}) {
  const { state } = useWorkspace();
  const [scope, setScope] = useState(initialScope);
  const selectId = useId();
  const scopeVariant = sharedDefaults
    ? { ...variant, settings: {}, localeSettings: {} }
    : scope === "variant"
      ? { ...variant, localeSettings: {} }
      : variant;
  const values = resolveSettings(
    scope === "base" ? { ...document, localeSettings: {} } : document,
    scopeVariant,
    locale,
  );
  const output = resolveSettings(document, variant, locale);
  const target =
    scope === "base"
      ? document.settings
      : scope === "locale"
        ? document.localeSettings[locale] || {}
        : scope === "variant"
          ? variant.settings
          : variant.localeSettings[locale] || {};
  const change = (
    key: keyof TemplateSettings,
    value: number | string | undefined,
  ) =>
    update((draft) => {
      const selectedVariant = draft.variants.find(
        (item) => item.id === variant.id,
      )!;
      const target =
        scope === "base"
          ? draft.settings
          : scope === "locale"
            ? (draft.localeSettings[locale] ||= {})
            : scope === "variant"
              ? selectedVariant.settings
              : (selectedVariant.localeSettings[locale] ||= {});
      if (value === undefined)
        delete (target as Partial<TemplateSettings>)[key];
      else Object.assign(target, { [key]: value });
    });
  const controls: {
    key: keyof TemplateSettings;
    label: string;
    values: (string | number)[];
    unit?: string;
  }[] = [
    { key: "pageSize", label: "Page size", values: ["a4", "letter"] },
    {
      key: "fontSize",
      label: "Text size",
      values: [9, 10, 10.5, 11, 11.5, 12],
      unit: "pt",
    },
    {
      key: "lineHeight",
      label: "Line height",
      values: [1, 1.1, 1.2, 1.3, 1.4],
    },
    {
      key: "sectionGap",
      label: "Section spacing",
      values: [0, 2, 4, 6, 8],
      unit: "mm",
    },
    {
      key: "marginTop",
      label: "Top margin",
      values: [10, 15, 18, 20, 25, 30, 35],
      unit: "mm",
    },
    {
      key: "marginBottom",
      label: "Bottom margin",
      values: [10, 15, 18, 20, 25, 25.4, 30, 35],
      unit: "mm",
    },
    {
      key: "marginSide",
      label: "Side margins",
      values: [10, 15, 18, 20, 25, 30, 35],
      unit: "mm",
    },
    {
      key: "targetPages",
      label: "Target number of pages",
      values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    },
  ];
  const scopeItems = sharedDefaults
    ? [
        { value: "base", label: "All resumes" },
        { value: "locale", label: `All resumes · ${languageNames[locale]}` },
      ]
    : [
        {
          value: "variant",
          label: `Resume · ${variant.name || "Untitled resume"}`,
        },
        {
          value: "variant-locale",
          label: `This resume · ${languageNames[locale]}`,
        },
      ];
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle size="section">Layout settings</CardTitle>
          <CardDescription>Inter · Single column</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <TemplateIdentityBadge
              id={document.template.id}
              version={document.template.version}
            />
            <Field>
              <div className="flex items-center gap-2">
                <FieldLabel htmlFor={selectId}>Apply settings to</FieldLabel>
                <InfoHint label="which layout settings apply">
                  Settings for this resume and language take priority over its
                  general settings, then language defaults, then defaults for
                  all resumes. Choose Use default to remove a custom setting.
                </InfoHint>
              </div>
              <Select
                items={scopeItems}
                value={scope}
                disabled={state.replacing || !!state.pending}
                onValueChange={(value) => {
                  if (value === null || state.replacing || state.pending)
                    return;
                  setScope(value);
                }}
              >
                <SelectTrigger
                  appearance="utility"
                  id={selectId}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {scopeItems.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              {controls.map((control) => {
                const id = selectId + control.key;
                const current = target[control.key];
                const choices = Array.from(
                  new Set([
                    ...control.values,
                    ...(current !== undefined ? [current] : []),
                  ]),
                );
                const settingItems = [
                  ...(scope !== "base"
                    ? [{ value: "inherit", label: "Use default" }]
                    : []),
                  ...choices.map((value) => ({
                    value: String(value),
                    label:
                      value === "a4"
                        ? "A4"
                        : value === "letter"
                          ? "US Letter"
                          : `${value}${control.unit ? " " + control.unit : ""}`,
                  })),
                ];
                return (
                  <Field key={control.key}>
                    <FieldLabel htmlFor={id}>{control.label}</FieldLabel>
                    <Select
                      items={settingItems}
                      value={String(current ?? "inherit")}
                      disabled={state.replacing || !!state.pending}
                      onValueChange={(value) => {
                        if (value === null || state.replacing || state.pending)
                          return;
                        change(
                          control.key,
                          value === "inherit"
                            ? undefined
                            : control.key === "pageSize"
                              ? value
                              : Number(value),
                        );
                      }}
                    >
                      <SelectTrigger
                        id={id}
                        data-issue-field={`settings.${control.key}`}
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {settingItems.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {current === undefined ? "Using default" : "Set here"}:{" "}
                      {values[control.key]}
                      {control.unit ? " " + control.unit : ""}. From:{" "}
                      {current !== undefined
                        ? sharedDefaults
                          ? scope === "base"
                            ? "All resumes"
                            : "All resumes in this language"
                          : scope === "variant"
                            ? "Resume"
                            : "This resume in this language"
                        : !sharedDefaults &&
                            scope === "variant-locale" &&
                            variant.settings[control.key] !== undefined
                          ? "Resume"
                          : scope !== "base" &&
                              scope !== "locale" &&
                              document.localeSettings[locale]?.[control.key] !==
                                undefined
                            ? "All resumes in this language"
                            : "All resumes"}
                    </FieldDescription>
                  </Field>
                );
              })}
            </FieldGroup>
            <p className="text-xs text-muted-foreground">
              Current PDF layout: {output.pageSize.toUpperCase()},{" "}
              {output.fontSize} pt · Target {output.targetPages} pages
              <InfoHint label="page target" size="sm">
                Content is never removed to meet the page target.
              </InfoHint>
            </p>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">Included in backups</p>
        </CardFooter>
      </Card>
    </div>
  );
}

export function CompilerSettings({
  document,
  update,
}: Pick<EditorProps, "document" | "update">) {
  const { state } = useWorkspace();
  const selectId = useId();
  return (
    <Card>
      <CardHeader>
        <CardTitle size="section">PDF generation</CardTitle>
        <CardDescription>
          Choose how long to allow PDF tools to start and PDFs to be created.
          Changing these settings restarts the PDF tools.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {(["initializationTimeoutMs", "compilationTimeoutMs"] as const).map(
            (key) => {
              const timeoutItems = Array.from(
                new Set([
                  5_000,
                  10_000,
                  30_000,
                  60_000,
                  120_000,
                  300_000,
                  600_000,
                  document.compiler[key],
                ]),
              ).map((value) => ({
                value: String(value),
                label: `${value / 1000} seconds`,
              }));
              return (
                <Field key={key}>
                  <FieldLabel htmlFor={selectId + key}>
                    {key === "initializationTimeoutMs"
                      ? "Maximum startup time"
                      : "Maximum PDF creation time"}
                  </FieldLabel>
                  <Select
                    items={timeoutItems}
                    value={String(document.compiler[key])}
                    disabled={state.replacing || !!state.pending}
                    onValueChange={(value) => {
                      if (value === null || state.replacing || state.pending)
                        return;
                      update((draft) => {
                        draft.compiler[key] = Number(value);
                      });
                    }}
                  >
                    <SelectTrigger id={selectId + key} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {timeoutItems.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              );
            },
          )}
        </FieldGroup>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          These time limits apply to all resumes and are included in backups.
        </p>
      </CardFooter>
    </Card>
  );
}
