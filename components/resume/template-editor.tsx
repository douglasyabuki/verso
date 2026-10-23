"use client";

import { useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { resolveSettings } from "@/lib/resume/settings";
import type { EditorProps } from "@/types-and-constants/editor";
import type { TemplateSettings } from "@/types-and-constants/resume";

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
      label: "Body size",
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
      label: "Page-count target",
      values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    },
  ];
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle size="section">The reference template</CardTitle>
          <CardDescription>
            Inter typography, sepia headings, and a single-column layout adapted
            from your Overleaf resume.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Badge variant="outline">
              {document.template.id}@{document.template.version}
            </Badge>
            <Field>
              <FieldLabel htmlFor={selectId}>Apply settings to</FieldLabel>
              <NativeSelect
                id={selectId}
                value={scope}
                onChange={(event) => setScope(event.target.value)}
              >
                {sharedDefaults ? (
                  <>
                    <NativeSelectOption value="base">
                      Workspace defaults
                    </NativeSelectOption>
                    <NativeSelectOption value="locale">
                      Language defaults · {locale}
                    </NativeSelectOption>
                  </>
                ) : (
                  <>
                    <NativeSelectOption value="variant">
                      Resume · {variant.name || "Untitled resume"}
                    </NativeSelectOption>
                    <NativeSelectOption value="variant-locale">
                      Resume language · {locale}
                    </NativeSelectOption>
                  </>
                )}
              </NativeSelect>
              <FieldDescription>
                Precedence: Workspace defaults → Language defaults → Resume →
                Resume language.
              </FieldDescription>
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
                return (
                  <Field key={control.key}>
                    <FieldLabel htmlFor={id}>{control.label}</FieldLabel>
                    <NativeSelect
                      id={id}
                      data-issue-field={`settings.${control.key}`}
                      value={current ?? "inherit"}
                      onChange={(event) =>
                        change(
                          control.key,
                          event.target.value === "inherit"
                            ? undefined
                            : control.key === "pageSize"
                              ? event.target.value
                              : Number(event.target.value),
                        )
                      }
                    >
                      {scope !== "base" && (
                        <NativeSelectOption value="inherit">
                          Inherit
                        </NativeSelectOption>
                      )}
                      {choices.map((value) => (
                        <NativeSelectOption key={value} value={value}>
                          {value === "a4"
                            ? "A4"
                            : value === "letter"
                              ? "US Letter"
                              : `${value}${control.unit ? " " + control.unit : ""}`}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <FieldDescription>
                      Effective: {values[control.key]}
                      {control.unit ? " " + control.unit : ""}. Source:{" "}
                      {current !== undefined
                        ? sharedDefaults
                          ? scope === "base"
                            ? "Workspace defaults"
                            : "Language defaults"
                          : scope === "variant"
                            ? "Resume"
                            : "Resume language"
                        : !sharedDefaults &&
                            scope === "variant-locale" &&
                            variant.settings[control.key] !== undefined
                          ? "Resume"
                          : scope !== "base" &&
                              scope !== "locale" &&
                              document.localeSettings[locale]?.[control.key] !==
                                undefined
                            ? "Language defaults"
                            : "Workspace defaults"}
                      .{" "}
                      {scope !== "base" &&
                        "Choose Inherit to reset this setting."}
                    </FieldDescription>
                  </Field>
                );
              })}
            </FieldGroup>
            <p className="text-xs text-muted-foreground">
              Current output: {output.pageSize.toUpperCase()}, {output.fontSize}{" "}
              pt, target {output.targetPages} pages. Content is never removed to
              meet the target.
            </p>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            All template settings and overrides are included in JSON backups.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export function CompilerSettings({
  document,
  update,
}: Pick<EditorProps, "document" | "update">) {
  const selectId = useId();
  return (
    <Card>
      <CardHeader>
        <CardTitle size="section">Browser compiler</CardTitle>
        <CardDescription>
          Initialization and compilation have independent timeouts. Changing
          these settings restarts the engine.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {(["initializationTimeoutMs", "compilationTimeoutMs"] as const).map(
            (key) => (
              <Field key={key}>
                <FieldLabel htmlFor={selectId + key}>
                  {key === "initializationTimeoutMs"
                    ? "Initialization timeout"
                    : "Compilation timeout"}
                </FieldLabel>
                <NativeSelect
                  id={selectId + key}
                  value={document.compiler[key]}
                  onChange={(event) =>
                    update((draft) => {
                      draft.compiler[key] = Number(event.target.value);
                    })
                  }
                >
                  {Array.from(
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
                  ).map((value) => (
                    <NativeSelectOption key={value} value={value}>
                      {value / 1000} seconds
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            ),
          )}
        </FieldGroup>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Timeouts apply across the workspace and are included in JSON backups.
        </p>
      </CardFooter>
    </Card>
  );
}
