"use client";

import {
  ChevronRight,
  Files,
  Layers,
  Link2,
  Ruler,
  Scaling,
  TextInitial,
} from "lucide-react";
import { useId, useState } from "react";

import { LayoutColorField } from "@/components/output/layout/layout-color-field";
import { LayoutFieldGrid } from "@/components/output/layout/layout-field-grid";
import { LayoutFieldHeader } from "@/components/output/layout/layout-field-header";
import {
  LayoutIcon,
  layoutSettingIcons,
} from "@/components/output/layout/layout-icon";
import { MarginGuide } from "@/components/output/layout/margin-guide";
import { NumericLayoutField } from "@/components/output/layout/numeric-layout-field";
import { TemplateIdentityBadge } from "@/components/shared/semantic-badges/template-identity-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { useLayoutDrafts } from "@/hooks/output/use-layout-drafts";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
import { numericLayoutValue, resolveSettings } from "@/lib/output/settings";
import type { EditorProps } from "@/types-and-constants/editor";
import { languageNames } from "@/types-and-constants/languages";
import {
  defaultSettings,
  layoutPaperSizes,
  numericLayoutControls,
  templateSettingLabels,
  type TemplateSettings,
} from "@/types-and-constants/output";

const choiceControls = {
  fontFamily: [
    ["inter", "Inter"],
    ["source-sans-3", "Source Sans 3"],
    ["source-serif-4", "Source Serif 4"],
  ],
  nameWeight: [
    ["regular", "Regular"],
    ["bold", "Bold"],
    ["black", "Black"],
  ],
  headerAlignment: [
    ["left", "Left"],
    ["center", "Center"],
  ],
  contactIcons: [
    ["on", "On"],
    ["off", "Off"],
  ],
  sectionWeight: [
    ["regular", "Regular"],
    ["bold", "Bold"],
    ["black", "Black"],
  ],
  sectionCasing: [
    ["original", "Original"],
    ["uppercase", "Uppercase"],
  ],
  sectionDivider: [
    ["on", "On"],
    ["off", "Off"],
  ],
  entryTitleWeight: [
    ["regular", "Regular"],
    ["bold", "Bold"],
    ["black", "Black"],
  ],
  entrySubtitleWeight: [
    ["regular", "Regular"],
    ["bold", "Bold"],
    ["black", "Black"],
  ],
  bulletMarker: [
    ["disc", "Disc"],
    ["dash", "Dash"],
    ["hollow-circle", "Hollow circle"],
  ],
  pageNumbering: [
    ["hidden", "Hidden"],
    ["shown", "Shown"],
  ],
  pageNumberAlignment: [
    ["left", "Left"],
    ["center", "Center"],
    ["right", "Right"],
  ],
  pageNumberFormat: [
    ["page-x", "Page X"],
    ["page-x-of-y", "Page X of Y"],
  ],
} as const;

const appearanceGroups = [
  {
    name: "Header",
    keys: [
      "nameSize",
      "nameWeight",
      "headerAlignment",
      "nameContactGap",
      "headerGap",
      "contactIcons",
    ],
  },
  {
    name: "Sections",
    keys: [
      "sectionSize",
      "sectionWeight",
      "sectionCasing",
      "sectionGap",
      "sectionBelow",
      "sectionDivider",
      "dividerThickness",
    ],
  },
  {
    name: "Entry headings",
    keys: [
      "entryTitleSize",
      "entryTitleWeight",
      "entrySubtitleSize",
      "entrySubtitleWeight",
      "headingSubtitleGap",
      "beforeDetailsGap",
    ],
  },
  { name: "Entries and paragraphs", keys: ["entryGap", "paragraphGap"] },
  {
    name: "Bullets",
    keys: [
      "bulletMarker",
      "bulletIndent",
      "bulletTextGap",
      "bulletGap",
      "listAbove",
      "listBelow",
    ],
  },
  {
    name: "Colors",
    keys: [
      "headingColor",
      "bodyColor",
      "secondaryColor",
      "linkColor",
      "iconColor",
      "dividerColor",
    ],
  },
  {
    name: "Page numbering",
    keys: ["pageNumbering", "pageNumberAlignment", "pageNumberFormat"],
  },
] as const;

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
        { value: "base", label: "Default layout" },
        { value: "locale", label: `Default layout · ${languageNames[locale]}` },
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
  const [linkedMargins, setLinkedMargins] = useState(
    values.marginLeft === values.marginRight,
  );
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const drafts = useLayoutDrafts({
    document,
    values,
    change,
    linkedMargins,
    reveal: (key) => {
      const group = appearanceGroups.find((group) =>
        (group.keys as readonly string[]).includes(key),
      );
      if (group) setOpenGroups((open) => [...new Set([...open, group.name])]);
    },
  });
  const source = (key: keyof TemplateSettings) => {
    if (scope === "base" || target[key] !== undefined) return undefined;

    const origin =
      !sharedDefaults &&
      scope === "variant-locale" &&
      variant.settings[key] !== undefined
        ? "Resume"
        : scope !== "locale" &&
            document.localeSettings[locale]?.[key] !== undefined
          ? `Default layout · ${languageNames[locale]}`
          : "Default layout";
    return `Inherited from ${origin}`;
  };
  const reset = (key: keyof TemplateSettings) =>
    scope === "base" || target[key] !== undefined
      ? () => {
          drafts.flush({
            [key]: scope === "base" ? defaultSettings[key] : undefined,
          });
        }
      : undefined;
  const numeric = (keys: string[]) =>
    keys
      .map((key) =>
        numericLayoutControls.find((control) => control.key === key),
      )
      .filter((control) => control !== undefined)
      .map((control) => (
        <NumericLayoutField
          key={control.key}
          control={control}
          id={id + control.key}
          drafts={drafts}
          disabled={disabled}
          source={source(control.key)}
          reset={reset(control.key)}
          templateDefault={
            "templateDefault" in control
              ? () => {
                  drafts.flush({ [control.key]: "template-default" });
                }
              : undefined
          }
          highlight={setHovered}
        />
      ));
  const choice = (key: keyof typeof choiceControls) => {
    const Icon = layoutSettingIcons[key];
    const items = choiceControls[key].map(([value, label]) => ({
      value,
      label,
    }));
    return (
      <Field key={key} data-disabled={disabled}>
        <LayoutFieldHeader disabled={disabled} reset={reset(key)}>
          <div className="flex min-w-0 flex-1 basis-32 items-center gap-1.5">
            <FieldLabel htmlFor={id + key}>
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {templateSettingLabels[key]}
            </FieldLabel>
            {key === "pageNumbering" && (
              <InfoHint label={templateSettingLabels[key]}>
                Page numbers use the selected output language.
              </InfoHint>
            )}
          </div>
        </LayoutFieldHeader>
        <Select
          items={items}
          value={values[key]}
          disabled={disabled}
          onValueChange={(value) => {
            if (value && !disabled) drafts.flush({ [key]: value });
          }}
        >
          <SelectTrigger
            id={id + key}
            appearance="utility"
            className="w-full"
            aria-describedby={source(key) ? `${id}${key}-source` : undefined}
            data-issue-field={`settings.${key}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {source(key) && (
          <FieldDescription id={`${id}${key}-source`}>
            {source(key)}
          </FieldDescription>
        )}
      </Field>
    );
  };
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
              <FieldLabel htmlFor={id}>
                <Layers aria-hidden="true" className="size-4 shrink-0" />
                Apply settings to
              </FieldLabel>
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
            <LayoutFieldGrid layout="page">
              <Field>
                <LayoutFieldHeader
                  disabled={disabled}
                  reset={reset("pageSize")}
                >
                  <FieldLabel id={id + "paper"}>
                    <Scaling aria-hidden="true" className="size-4 shrink-0" />
                    Paper size
                  </FieldLabel>
                </LayoutFieldHeader>
                <ToggleGroup
                  multiple={false}
                  variant="outline"
                  value={[values.pageSize]}
                  disabled={disabled}
                  aria-labelledby={id + "paper"}
                  aria-describedby={
                    source("pageSize") ? id + "paper-source" : undefined
                  }
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
                {source("pageSize") && (
                  <FieldDescription id={id + "paper-source"}>
                    {source("pageSize")}
                  </FieldDescription>
                )}
              </Field>
              {numeric(["targetPages"])}
            </LayoutFieldGrid>
          </FieldSet>
          <Separator />
          <FieldSet
            disabled={disabled}
            className="@container/layout-margins min-w-0"
          >
            <FieldLegend>
              <span className="flex items-center gap-2">
                <Ruler className="size-4" />
                Margins
              </span>
            </FieldLegend>
            <div className="grid min-w-0 items-start gap-4 @min-[40rem]/layout-margins:grid-cols-[minmax(0,1fr)_11rem]">
              <FieldGroup className="min-w-0 gap-4">
                <Field>
                  <div className="flex items-center gap-1.5">
                    <FieldLabel id={id + "linked"}>
                      <Link2 aria-hidden="true" className="size-4 shrink-0" />
                      Link left and right margins
                    </FieldLabel>
                    <InfoHint label="link left and right margins">
                      Linking keeps current values. Your next left or right
                      margin edit updates both. Use default resets only its
                      field.
                    </InfoHint>
                  </div>
                  <ToggleGroup
                    multiple={false}
                    variant="outline"
                    value={[linkedMargins ? "linked" : "separate"]}
                    disabled={disabled}
                    aria-labelledby={id + "linked"}
                    onValueChange={(selection) => {
                      if (selection[0] && drafts.flush())
                        setLinkedMargins(selection[0] === "linked");
                    }}
                  >
                    <ToggleGroupItem value="linked">Linked</ToggleGroupItem>
                    <ToggleGroupItem value="separate">Separate</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
                <LayoutFieldGrid layout="pair">
                  {numeric([
                    "marginTop",
                    "marginBottom",
                    "marginLeft",
                    "marginRight",
                  ])}
                </LayoutFieldGrid>
              </FieldGroup>
              <MarginGuide values={values} active={hovered ?? focused} />
            </div>
          </FieldSet>
          <Separator />
          <FieldSet disabled={disabled}>
            <FieldLegend>
              <span className="flex items-center gap-2">
                <TextInitial aria-hidden="true" className="size-4" />
                Body typography
              </span>
            </FieldLegend>
            <LayoutFieldGrid>
              {choice("fontFamily")}
              {numeric(["fontSize", "lineHeight"])}
            </LayoutFieldGrid>
            <TemplateIdentityBadge
              id={document.template.id}
              version={document.template.version}
            />
          </FieldSet>
          {appearanceGroups.map((group) => (
            <Collapsible
              key={group.name}
              className="min-w-0"
              open={openGroups.includes(group.name)}
              onOpenChange={(open) => {
                if (drafts.flush())
                  setOpenGroups((groups) =>
                    open
                      ? [...new Set([...groups, group.name])]
                      : groups.filter((name) => name !== group.name),
                  );
              }}
            >
              <div className="flex items-center gap-1.5">
                <CollapsibleTrigger className="group/layout-group grid min-w-0 flex-1 grid-cols-[1rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1 rounded-md p-2 text-left transition-colors hover:bg-muted focus-visible:outline-ring data-panel-open:bg-muted/50 motion-reduce:transition-none">
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 text-muted-foreground transition-transform duration-200 group-data-panel-open/layout-group:rotate-90 motion-reduce:transition-none"
                  />
                  <span className="text-sm font-medium">{group.name}</span>
                  <span className="col-start-2 min-w-0 text-xs leading-relaxed text-muted-foreground group-data-panel-open/layout-group:hidden">
                    {group.keys
                      .slice(0, 3)
                      .map((key) => {
                        const control = numericLayoutControls.find(
                          (control) => control.key === key,
                        );
                        const value = control
                          ? numericLayoutValue(values, control.key)
                          : values[key];
                        const label = control
                          ? value === undefined
                            ? "Automatic"
                            : `${value} ${control.unit}`
                          : value === "template-default"
                            ? "Template default"
                            : value;
                        return `${templateSettingLabels[key]}: ${label}`;
                      })
                      .join(" · ")}
                  </span>
                </CollapsibleTrigger>
                {group.name === "Colors" && (
                  <InfoHint label="colors">
                    Named text colors meet 4.5:1 contrast against white.
                    Template-default links use the section color; secondary text
                    and icons use an explicit body color or the original grays.
                    Explicit link colors also apply within headings and
                    emphasis.
                  </InfoHint>
                )}
              </div>
              <CollapsibleContent keepMounted>
                <FieldSet
                  disabled={disabled}
                  className="ms-4 me-2 mt-3 mb-2 min-w-0 border-s py-1 ps-4"
                >
                  <FieldLegend className="sr-only">{group.name}</FieldLegend>
                  <LayoutFieldGrid
                    layout={
                      group.name === "Colors"
                        ? "colors"
                        : group.keys.length === 2
                          ? "pair"
                          : "standard"
                    }
                  >
                    {group.name === "Colors"
                      ? group.keys.map((key) => (
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
                        ))
                      : group.keys.map((key) =>
                          key in choiceControls
                            ? choice(key as keyof typeof choiceControls)
                            : numeric([key]),
                        )}
                  </LayoutFieldGrid>
                </FieldSet>
              </CollapsibleContent>
            </Collapsible>
          ))}
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
