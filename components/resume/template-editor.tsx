"use client";

import { Files, Palette, Ruler, Type } from "lucide-react";
import { useId, useState } from "react";

import { LayoutColorField } from "@/components/resume/layout/layout-color-field";
import { LayoutIcon } from "@/components/resume/layout/layout-icon";
import { MarginGuide } from "@/components/resume/layout/margin-guide";
import { NumericLayoutField } from "@/components/resume/layout/numeric-layout-field";
import { TemplateIdentityBadge } from "@/components/resume/semantic-badges/template-identity-badge";
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
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
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
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLayoutDrafts } from "@/hooks/resume/use-layout-drafts";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
import { resolveSettings } from "@/lib/resume/settings";
import type { EditorProps } from "@/types-and-constants/editor";
import { languageNames } from "@/types-and-constants/languages";
import {
  layoutPaperSizes,
  numericLayoutControls,
  type TemplateSettings,
} from "@/types-and-constants/output";

type SettingsEditorProps = Pick<
  EditorProps,
  "document" | "variant" | "locale" | "update"
> & { initialScope?: string; sharedDefaults?: boolean };

export function SettingsEditor({
  initialScope = "variant",
  sharedDefaults = false,
  ...props
}: SettingsEditorProps) {
  const [scope, setScope] = useState(initialScope);
  return (
    <LayoutInspector
      key={`${props.variant.id}:${props.locale}:${scope}:${sharedDefaults}`}
      {...props}
      scope={scope}
      setScope={setScope}
      sharedDefaults={sharedDefaults}
    />
  );
}

function LayoutInspector({
  document,
  variant,
  locale,
  update,
  scope,
  setScope,
  sharedDefaults,
}: SettingsEditorProps & { scope: string; setScope: (scope: string) => void }) {
  const { state, controller } = useWorkspace();
  const id = useId();
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const disabled = state.replacing || !!state.pending;
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
  const change = (
    changes: Partial<
      Record<keyof TemplateSettings, number | string | undefined>
    >,
  ) => {
    const snapshot = controller.getSnapshot();
    if (
      snapshot.document !== document ||
      snapshot.pending ||
      snapshot.replacing
    )
      return;
    update((draft) => {
      const selected = draft.variants.find((item) => item.id === variant.id);
      if (!selected) return;
      const target =
        scope === "base"
          ? draft.settings
          : scope === "locale"
            ? (draft.localeSettings[locale] ||= {})
            : scope === "variant"
              ? selected.settings
              : (selected.localeSettings[locale] ||= {});
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined)
          delete (target as Partial<TemplateSettings>)[
            key as keyof TemplateSettings
          ];
        else Object.assign(target, { [key]: value });
      }
    });
  };
  const drafts = useLayoutDrafts({ document, values, change });
  const source = (key: keyof TemplateSettings) => {
    const origin =
      target[key] !== undefined
        ? scopeItems.find((item) => item.value === scope)?.label
        : !sharedDefaults &&
            scope === "variant-locale" &&
            variant.settings[key] !== undefined
          ? "Resume"
          : scope !== "base" &&
              scope !== "locale" &&
              document.localeSettings[locale]?.[key] !== undefined
            ? `All resumes · ${languageNames[locale]}`
            : "All resumes";
    return `${target[key] === undefined ? "Inherited" : "Set here"} · ${origin}`;
  };
  const reset = (key: keyof TemplateSettings) =>
    scope !== "base" && target[key] !== undefined
      ? () => {
          drafts.flush({ [key]: undefined });
        }
      : undefined;
  const numeric = (keys: string[]) =>
    numericLayoutControls
      .filter((control) => keys.includes(control.key))
      .map((control) => (
        <NumericLayoutField
          key={control.key}
          control={control}
          id={id + control.key}
          drafts={drafts}
          disabled={disabled}
          source={`${values[control.key]} ${control.unit} · ${source(control.key)}`}
          reset={reset(control.key)}
          highlight={setHovered}
        />
      ));
  return (
    <Card
      className="@container/layout-inspector"
      data-layout-inspector
      onFocusCapture={(event) =>
        setFocused(
          event.target instanceof HTMLElement
            ? (event.target
                .getAttribute("data-issue-field")
                ?.replace("settings.", "") ?? null)
            : null,
        )
      }
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(null);
      }}
    >
      <CardHeader>
        <CardTitle size="section">Layout settings</CardTitle>
        <CardDescription>
          Fine-tune the selected layout. Changes refresh the PDF.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field data-layout-scope>
            <div className="flex items-center gap-2">
              <FieldLabel htmlFor={id}>Apply settings to</FieldLabel>
              <InfoHint label="which layout settings apply">
                Settings for this resume and language take priority over its
                general settings, then language defaults, then defaults for all
                resumes. Use default removes an override.
              </InfoHint>
            </div>
            <Select
              items={scopeItems}
              value={scope}
              disabled={disabled}
              onValueChange={(value) => {
                if (value && !disabled && drafts.flush()) setScope(value);
              }}
            >
              <SelectTrigger id={id} appearance="utility" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {scopeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Separator />
          <FieldSet disabled={disabled}>
            <FieldLegend>
              <span className="flex items-center gap-2">
                <Files className="size-4" />
                Page
              </span>
            </FieldLegend>
            <FieldGroup>
              <Field>
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel id={id + "paper"}>Paper size</FieldLabel>
                  {reset("pageSize") && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={disabled}
                      onClick={reset("pageSize")}
                    >
                      Use default
                    </Button>
                  )}
                </div>
                <ToggleGroup
                  multiple={false}
                  variant="outline"
                  value={[values.pageSize]}
                  disabled={disabled}
                  aria-labelledby={id + "paper"}
                  aria-describedby={id + "paper-source"}
                  data-issue-field="settings.pageSize"
                  className="w-full flex-wrap"
                  onValueChange={(selection) => {
                    const value = selection[0];
                    if (!disabled && (value === "a4" || value === "letter"))
                      drafts.flush({ pageSize: value });
                  }}
                >
                  {(["a4", "letter"] as const).map((size) => (
                    <ToggleGroupItem
                      key={size}
                      value={size}
                      className="h-auto min-h-14 flex-1 gap-2 py-2"
                    >
                      <LayoutIcon kind={size} />
                      <span className="flex flex-col items-start">
                        <span>{layoutPaperSizes[size].label}</span>
                        <span className="text-xs text-muted-foreground">
                          {layoutPaperSizes[size].dimensions}
                        </span>
                      </span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <FieldDescription id={id + "paper-source"}>
                  {source("pageSize")}
                </FieldDescription>
              </Field>
              {numeric(["targetPages"])}
            </FieldGroup>
          </FieldSet>
          <Separator />
          <FieldSet disabled={disabled}>
            <FieldLegend>
              <span className="flex items-center gap-2">
                <Ruler className="size-4" />
                Margins
              </span>
            </FieldLegend>
            <div className="grid items-start gap-5 @min-[30rem]/layout-inspector:grid-cols-[minmax(0,1fr)_11rem]">
              <FieldGroup>
                {numeric(["marginTop", "marginBottom", "marginSide"])}
              </FieldGroup>
              <MarginGuide values={values} active={hovered ?? focused} />
            </div>
          </FieldSet>
          <Separator />
          <FieldSet disabled={disabled}>
            <FieldLegend>
              <span className="flex items-center gap-2">
                <Type className="size-4" />
                Typography & spacing
              </span>
            </FieldLegend>
            <FieldDescription>Inter · Single column</FieldDescription>
            <FieldGroup className="grid gap-4 @min-[36rem]/layout-inspector:grid-cols-2">
              {numeric(["fontSize", "lineHeight", "sectionGap"])}
            </FieldGroup>
            <TemplateIdentityBadge
              id={document.template.id}
              version={document.template.version}
            />
          </FieldSet>
          <Separator />
          <FieldSet disabled={disabled}>
            <FieldLegend>
              <span className="flex items-center gap-2">
                <Palette className="size-4" />
                Colors
              </span>
            </FieldLegend>
            <FieldDescription>
              Template default preserves the original colors. Body color
              includes names, titles, dates, secondary text, and icons.
            </FieldDescription>
            <FieldGroup>
              {(["headingColor", "bodyColor"] as const).map((key) => (
                <LayoutColorField
                  key={key}
                  setting={key}
                  value={values[key]}
                  explicit={target[key] !== undefined}
                  id={id + key}
                  disabled={disabled}
                  source={source(key)}
                  change={(value) => drafts.flush({ [key]: value })}
                  reset={reset(key)}
                />
              ))}
            </FieldGroup>
          </FieldSet>
        </FieldGroup>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Current PDF layout: {layoutPaperSizes[output.pageSize].label},{" "}
          {output.fontSize} pt · Target {output.targetPages} pages. Included in
          backups.
        </p>
      </CardFooter>
    </Card>
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
