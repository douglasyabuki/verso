"use client";

import {
  ArrowDownUp,
  ContactRound,
  File,
  Mail,
  Palette,
  RotateCcw,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
  Type,
} from "lucide-react";
import { useId, useState } from "react";

import { LayoutColorPicker } from "@/components/career/layout-color-picker";
import { LayoutFieldGrid } from "@/components/output/layout/layout-field-grid";
import { MarginGuide } from "@/components/output/layout/margin-guide";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DisclosureChevron,
  DisclosureGuide,
  DisclosureLabel,
  disclosureTriggerClassName,
} from "@/components/ui/disclosure";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { templateSettings } from "@/lib/career/layout";
import { contactRows } from "@/lib/career/layout";
import {
  type LayoutColor,
  resolvedLayoutColor,
  templateDimensionDisplay,
  templateDimensionExplanation,
} from "@/lib/career/layout-display";
import { layoutSchema, resumeLayoutSchema } from "@/lib/career/model";
import type { CareerResume } from "@/types-and-constants/career";
import { appLayoutDefaults } from "@/types-and-constants/layout";
import {
  numericLayoutControls,
  templateSettingLabels,
} from "@/types-and-constants/output";

const choices: Record<string, readonly string[]> = {
  paper: ["a4", "letter"],
  font: ["inter", "source-sans", "source-serif"],
  headerAlignment: ["left", "center"],
  nameWeight: ["regular", "bold", "black"],
  contactIcons: ["on", "off"],
  contactRows: ["auto", "1", "2", "3", "4", "custom"],
  contactSeparator: ["space", "dot", "bar"],
  sectionWeight: ["regular", "bold", "black"],
  sectionCasing: ["original", "uppercase"],
  sectionDivider: ["on", "off"],
  entryTitleWeight: ["regular", "bold", "black"],
  entrySubtitleWeight: ["regular", "bold", "black"],
  bulletMarker: ["disc", "dash", "hollow-circle"],
  pageNumbering: ["hidden", "shown"],
  pageNumberAlignment: ["left", "center", "right"],
  pageNumberFormat: ["page-x", "page-x-of-y"],
};
const groups = [
  {
    name: "Typography",
    icon: Type,
    keys: [
      "font",
      "fontSize",
      "lineHeight",
      "sectionSize",
      "sectionWeight",
      "sectionCasing",
      "sectionDivider",
      "dividerThickness",
      "entryTitleSize",
      "entryTitleWeight",
      "entrySubtitleSize",
      "entrySubtitleWeight",
    ],
  },

  {
    name: "Page & margins",
    icon: File,
    keys: [
      "paper",
      "marginTop",
      "marginBottom",
      "marginLeft",
      "marginRight",
      "pageNumbering",
      "pageNumberAlignment",
      "pageNumberFormat",
      "targetPages",
    ],
  },
  {
    name: "Header & contacts",
    icon: ContactRound,
    keys: [
      "nameSize",
      "nameWeight",
      "headerAlignment",
      "nameContactGap",
      "headerGap",
      "contactIcons",
      "contactRows",
      "contactRowSizes",
      "contactRowGap",
      "contactSeparator",
    ],
  },
  {
    name: "Spacing & details",
    icon: ArrowDownUp,
    keys: [
      "sectionGap",
      "sectionBelow",
      "headingSubtitleGap",
      "beforeDetailsGap",
      "entryGap",
      "paragraphGap",
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
    icon: Palette,
    keys: [
      "headingColor",
      "bodyColor",
      "secondaryColor",
      "linkColor",
      "iconColor",
      "dividerColor",
    ],
  },
];
const dependentFields: Record<string, readonly string[]> = {
  sectionDivider: ["dividerThickness"],
  pageNumbering: ["pageNumberAlignment", "pageNumberFormat"],
  contactRows: ["contactRowSizes"],
  contactRowGap: ["contactSeparator"],
};
const dependentKeys = Object.values(dependentFields).flat();

const extraLabels: Record<string, string> = {
  paper: "Paper",
  font: "Font family",
  contactRows: "Contacts per row",
  contactRowSizes: "Custom row sizes",
  contactRowGap: "Between contact rows (pt)",
  contactSeparator: "Contact separator",
};
const friendly: Record<string, string> = {
  a4: "A4",
  letter: "US Letter",
  inter: "Inter",
  "source-sans": "Source Sans 3",
  "source-serif": "Source Serif 4",
  auto: "Automatic wrapping",
  custom: "Custom rows",
  regular: "Regular",
  bold: "Bold",
  black: "Black",
  original: "Original casing",
  uppercase: "Uppercase",
  "page-x": "Page X",
  "page-x-of-y": "Page X of Y",
  "hollow-circle": "Hollow circle",
};

/** Render draft appearance with group resets; only the caller can commit or compile it.
 * @param props Draft values, immutable reset defaults, and optional guarded content navigation.
 * @returns Shared controls for resume, preset, and starter appearance editors.
 * @example <LayoutFields values={draft} defaults={savedDefaults} onChange={change} resumeLayout />
 */
export function LayoutFields({
  values,
  onChange,
  contacts = [],
  editContacts,
  defaults = appLayoutDefaults,
  resumeLayout = false,
}: {
  values: unknown;
  onChange: (value: unknown) => void;
  contacts?: string[];
  editContacts?: () => void;
  defaults?: CareerResume["layout"];
  resumeLayout?: boolean;
}) {
  const id = useId();
  const [opened, setOpened] = useState<Record<string, boolean>>({
    Typography: true,
    "Page & margins": true,
  });
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const data = (values && typeof values === "object" ? values : {}) as Record<
    string,
    unknown
  >;
  const parsed = resumeLayoutSchema.safeParse(values);
  const issues = parsed.success ? [] : parsed.error.issues;
  const copiedDefaults = layoutSchema.safeParse(data.defaults);
  const baseline = (resumeLayout && copiedDefaults.success
    ? copiedDefaults.data
    : defaults) as unknown as Record<string, unknown>;
  const change = (key: string, value: unknown) =>
    onChange({ ...data, [key]: value });
  const guide = layoutSchema.safeParse({
    ...appLayoutDefaults,
    ...Object.fromEntries(
      ["paper", "marginTop", "marginBottom", "marginLeft", "marginRight"].map(
        (key) => [key, data[key]],
      ),
    ),
  });
  const display = (key: string, value: unknown) =>
    value === "template-default"
      ? templateDimensionDisplay(key)
      : Array.isArray(value)
        ? value.length
          ? value.join(", ")
          : ""
        : String(value ?? "");
  const checks: Record<string, { label: string; on: string; off: string }> = {
    sectionDivider: { label: "Section divider", on: "on", off: "off" },
    pageNumbering: { label: "Show page numbers", on: "shown", off: "hidden" },
    contactIcons: { label: "Contact icons", on: "on", off: "off" },
  };
  const renderField = (key: string) => {
    const error = issues.find((issue) => issue.path[0] === key)?.message;
    const numeric = numericLayoutControls.find(
      (control) => control.key === key,
    );
    const color = key.endsWith("Color");
    const inactive =
      (key === "iconColor" && data.contactIcons === "off") ||
      (["dividerThickness", "dividerColor"].includes(key) &&
        data.sectionDivider === "off") ||
      (["pageNumberAlignment", "pageNumberFormat"].includes(key) &&
        data.pageNumbering === "hidden") ||
      (key === "contactRowSizes" && data.contactRows !== "custom");
    if (inactive && !color && !error) return null;
    const label =
      checks[key]?.label ??
      extraLabels[key] ??
      templateSettingLabels[key as keyof typeof templateSettingLabels] ??
      key;
    const fieldId = `${id}-${key}`;
    if (color)
      return (
        <LayoutColorPicker
          key={key}
          id={fieldId}
          label={label}
          setting={key as LayoutColor}
          layout={data as CareerResume["layout"]}
          defaults={baseline as CareerResume["layout"]}
          disabled={inactive}
          error={error}
          change={(value) => change(key, value)}
        />
      );
    const options = choices[key];
    const value = baseline[key];
    const shownDefault =
      value === "template-default"
        ? templateDimensionDisplay(key)
        : (friendly[String(value)] ?? display(key, value));
    const defaultText = `${shownDefault}${numeric && (typeof value === "number" || typeof shownDefault === "number") ? ` ${numeric.unit}` : ""}`;
    const AlignmentIcon = key.toLowerCase().includes("alignment")
      ? {
          left: TextAlignStart,
          center: TextAlignCenter,
          right: TextAlignEnd,
        }
      : undefined;
    return (
      <div
        key={key}
        className={
          key === "paper" ? "col-span-full flex flex-col gap-4" : "min-w-0"
        }
      >
        <Field
          data-invalid={!!error}
          onMouseEnter={() => key.startsWith("margin") && setHovered(key)}
          onMouseLeave={() => key.startsWith("margin") && setHovered(null)}
          onFocusCapture={() => key.startsWith("margin") && setFocused(key)}
          onBlurCapture={(event) => {
            if (
              key.startsWith("margin") &&
              !event.currentTarget.contains(event.relatedTarget)
            )
              setFocused(null);
          }}
        >
          {checks[key] ? (
            <FieldLabel htmlFor={fieldId}>
              <Checkbox
                id={fieldId}
                checked={data[key] === checks[key].on}
                aria-invalid={!!error}
                aria-describedby={`${fieldId}-description`}
                onCheckedChange={(checked) =>
                  change(key, checked ? checks[key].on : checks[key].off)
                }
              />
              {label}
            </FieldLabel>
          ) : (
            <>
              <div className="flex min-w-0 items-center gap-1.5">
                <FieldLabel htmlFor={fieldId}>
                  {label}
                  {numeric && !label.includes("(") ? ` (${numeric.unit})` : ""}
                </FieldLabel>
                {key === "targetPages" && (
                  <InfoHint label={label}>
                    Warning threshold only; content is never removed or
                    automatically fitted.
                  </InfoHint>
                )}
              </div>
              {key === "contactRows" ? (
                <Select
                  items={options.map((value) => ({
                    value,
                    label: friendly[value] ?? value,
                  }))}
                  value={String(data[key] ?? "")}
                  onValueChange={(value) => value && change(key, value)}
                >
                  <SelectTrigger
                    id={fieldId}
                    aria-invalid={!!error}
                    aria-describedby={`${fieldId}-description`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {options.map((value) => (
                        <SelectItem key={value} value={value}>
                          {friendly[value] ?? value}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : options ? (
                <ToggleGroup
                  multiple={false}
                  aria-label={label}
                  id={fieldId}
                  variant="outline"
                  size="sm"
                  aria-describedby={`${fieldId}-description`}
                  value={[String(data[key] ?? "")]}
                  onValueChange={(value) =>
                    value.length && change(key, value[0])
                  }
                  className="max-w-full flex-wrap"
                >
                  {options.map((option) => {
                    const Icon =
                      AlignmentIcon?.[option as "left" | "center" | "right"];
                    return (
                      <ToggleGroupItem
                        key={option}
                        value={option}
                        aria-label={`${label}: ${friendly[option] ?? option}`}
                      >
                        {Icon && <Icon aria-hidden="true" />}
                        {key === "bulletMarker" && (
                          <span aria-hidden="true">
                            {
                              {
                                disc: "\u2022",
                                dash: "\u2014",
                                "hollow-circle": "\u25cb",
                              }[option]
                            }
                          </span>
                        )}
                        {friendly[option] ??
                          option[0].toUpperCase() + option.slice(1)}
                      </ToggleGroupItem>
                    );
                  })}
                </ToggleGroup>
              ) : (
                <Input
                  id={fieldId}
                  aria-invalid={!!error}
                  aria-describedby={`${fieldId}-description${error ? ` ${fieldId}-error` : ""}`}
                  inputMode={key === "contactRowSizes" ? "text" : "decimal"}
                  value={display(key, data[key])}
                  onFocus={(event) => {
                    if (data[key] === "template-default")
                      event.currentTarget.select();
                  }}
                  onClick={(event) => {
                    if (data[key] === "template-default")
                      event.currentTarget.select();
                  }}
                  onChange={(event) => {
                    const text = event.target.value;
                    change(
                      key,
                      key === "contactRowSizes"
                        ? text.trim() &&
                          text
                            .split(",")
                            .every((part) => /^\s*\d+\s*$/.test(part))
                          ? text.split(",").map(Number)
                          : text.trim()
                            ? text
                            : []
                        : text.trim() &&
                            !text.endsWith(".") &&
                            Number.isFinite(Number(text))
                          ? Number(text)
                          : text,
                    );
                  }}
                />
              )}
            </>
          )}
          <FieldDescription id={`${fieldId}-description`}>
            Default:{" "}
            {checks[key]
              ? baseline[key] === checks[key].on
                ? "Enabled"
                : "Disabled"
              : defaultText}
            .
            {(data[key] === "template-default" ||
              baseline[key] === "template-default") && (
              <> {templateDimensionExplanation(key)}</>
            )}
          </FieldDescription>
          {key === "contactRowSizes" && (
            <FieldDescription>
              Items in each row, e.g. 3, 2. Extra contacts wrap in a final row;
              unused rows are ignored.
            </FieldDescription>
          )}
          {inactive && error && (
            <FieldDescription>
              This retained value needs correction before Save, even while its
              feature is disabled.
            </FieldDescription>
          )}
          {error && <FieldError id={`${fieldId}-error`}>{error}</FieldError>}
        </Field>
        {key === "paper" &&
          (guide.success ? (
            <MarginGuide
              values={templateSettings(guide.data)}
              active={hovered ?? focused}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Correct paper and margin values to show the margin guide.
            </p>
          ))}
        {key === "contactRowSizes" &&
          data.contactRows === "custom" &&
          parsed.success &&
          contacts.length > 1 && (
            <fieldset className="mt-3 flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">
                Start a new row before
              </legend>
              {contacts.slice(1).map((contact, offset) => {
                const position = offset + 1;
                let total = 0;
                const breaks = parsed.data.contactRowSizes
                  .map((size) => (total += size))
                  .filter((index) => index < contacts.length);
                return (
                  <Field key={position}>
                    <FieldLabel>
                      <Checkbox
                        checked={breaks.includes(position)}
                        onCheckedChange={(checked) => {
                          const next = [
                            ...new Set(
                              checked
                                ? [...breaks, position]
                                : breaks.filter((index) => index !== position),
                            ),
                          ].sort((a, b) => a - b);
                          const bounds = [0, ...next, contacts.length];
                          change(
                            "contactRowSizes",
                            bounds
                              .slice(1)
                              .map((end, index) => end - bounds[index]),
                          );
                        }}
                      />
                      {contact}
                    </FieldLabel>
                  </Field>
                );
              })}
            </fieldset>
          )}
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-5">
      <StyleSample values={values} />
      {issues.some((issue) => issue.path[0] === "defaults") && (
        <FieldError>
          Layout defaults are invalid. Load a valid preset or reconcile this
          draft before saving.
        </FieldError>
      )}
      {groups.map((group) => (
        <Collapsible
          key={group.name}
          open={
            opened[group.name] ||
            issues.some((issue) => group.keys.includes(String(issue.path[0])))
          }
          onOpenChange={(value) =>
            setOpened({ ...opened, [group.name]: value })
          }
        >
          <CollapsibleTrigger
            render={<Button variant="ghost" />}
            className={disclosureTriggerClassName}
          >
            <DisclosureChevron />
            <group.icon aria-hidden="true" />
            <DisclosureLabel>{group.name}</DisclosureLabel>
          </CollapsibleTrigger>
          <CollapsibleContent keepMounted>
            <DisclosureGuide>
              <div className="mb-4 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  aria-label={`Reset ${group.name} to ${resumeLayout ? "layout" : "app"} defaults`}
                  disabled={group.keys.every(
                    (key) =>
                      JSON.stringify(data[key]) ===
                      JSON.stringify(baseline[key]),
                  )}
                  onClick={() =>
                    onChange({
                      ...data,
                      ...Object.fromEntries(
                        group.keys.map((key) => [
                          key,
                          structuredClone(baseline[key]),
                        ]),
                      ),
                    })
                  }
                >
                  <RotateCcw aria-hidden="true" data-icon="inline-start" />
                  {resumeLayout ? "Reset group" : "Reset to app defaults"}
                </Button>
              </div>
              {group.name === "Header & contacts" && (
                <p className="mb-4 text-xs text-muted-foreground">
                  Full name is required. Selected contacts:{" "}
                  {contacts.join(" / ") || "None"}. Empty values are omitted.
                  {editContacts && (
                    <>
                      {" "}
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        onClick={editContacts}
                      >
                        Edit profile content
                      </Button>
                    </>
                  )}
                </p>
              )}
              <LayoutFieldGrid layout="pair">
                {group.keys
                  .filter((key) => !dependentKeys.includes(key))
                  .map((key) => {
                    const children = dependentFields[key];
                    return children ? (
                      <div key={key} className="flex min-w-0 flex-col gap-4">
                        {renderField(key)}
                        {children.map(renderField)}
                      </div>
                    ) : (
                      renderField(key)
                    );
                  })}
              </LayoutFieldGrid>
            </DisclosureGuide>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}

/** Show fictional appearance feedback without compiling or claiming PDF pagination. */
export function StyleSample({ values }: { values: unknown }) {
  const parsed = resumeLayoutSchema.safeParse(values);
  if (!parsed.success)
    return (
      <p className="text-xs text-muted-foreground">
        Style sample is available when layout values are valid.
      </p>
    );
  const value = parsed.data;
  const color = (key: LayoutColor) => resolvedLayoutColor(value, key).hex;
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-xs text-muted-foreground">
        Style sample: illustrative, not your PDF. Wrapping and pagination may
        differ.
      </figcaption>
      <div
        className="overflow-hidden rounded-lg border p-4"
        style={{
          background: "white",
          color: color("bodyColor"),
          fontFamily: value.font === "source-serif" ? "serif" : "sans-serif",
          fontSize: value.fontSize,
          lineHeight: value.lineHeight,
        }}
      >
        <div
          style={{
            textAlign: value.headerAlignment,
            marginBottom:
              value.headerGap === "template-default" ? 12 : value.headerGap,
          }}
        >
          <div
            style={{
              fontSize:
                value.nameSize === "template-default" ? 20 : value.nameSize,
              fontWeight:
                value.nameWeight === "regular"
                  ? 400
                  : value.nameWeight === "bold"
                    ? 700
                    : 900,
            }}
          >
            Alex Example
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: value.contactRowGap,
              marginTop:
                value.nameContactGap === "template-default"
                  ? 8
                  : value.nameContactGap,
            }}
          >
            {contactRows(
              [
                "alex@example.com",
                "Example City",
                "example.com",
                "+1 555 0100",
              ],
              value,
            ).map((row, index) => (
              <div
                key={index}
                className="flex flex-wrap items-center justify-center gap-2"
                style={{
                  justifyContent:
                    value.headerAlignment === "left" ? "flex-start" : "center",
                }}
              >
                {row.map((contact, i) => (
                  <span
                    key={contact}
                    className="inline-flex items-center gap-1"
                  >
                    {i > 0 && value.contactSeparator !== "space" && (
                      <span>
                        {value.contactSeparator === "bar" ? "|" : "\u00b7"}
                      </span>
                    )}
                    {value.contactIcons === "on" && (
                      <Mail
                        aria-hidden="true"
                        className="size-3"
                        style={{ color: color("iconColor") }}
                      />
                    )}
                    {contact}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            color: color("headingColor"),
            fontSize:
              value.sectionSize === "template-default" ? 12 : value.sectionSize,
            fontWeight:
              value.sectionWeight === "regular"
                ? 400
                : value.sectionWeight === "bold"
                  ? 700
                  : 900,
            borderBottom:
              value.sectionDivider === "on"
                ? `${value.dividerThickness === "template-default" ? 1 : value.dividerThickness}px solid ${color("dividerColor")}`
                : undefined,
          }}
        >
          {value.sectionCasing === "uppercase" ? "EXPERIENCE" : "Experience"}
        </div>
        <div
          style={{
            marginTop:
              value.sectionBelow === "template-default"
                ? 8
                : value.sectionBelow * 3.78,
            marginBottom:
              value.entryGap === "template-default" ? 7 : value.entryGap,
          }}
        >
          <div
            style={{
              fontSize:
                value.entryTitleSize === "template-default"
                  ? value.fontSize
                  : value.entryTitleSize,
              fontWeight:
                value.entryTitleWeight === "regular"
                  ? 400
                  : value.entryTitleWeight === "bold"
                    ? 700
                    : 900,
            }}
          >
            Example role
          </div>
          <div
            style={{
              fontSize:
                value.entrySubtitleSize === "template-default"
                  ? value.fontSize
                  : value.entrySubtitleSize,
              color: color("secondaryColor"),
              fontWeight:
                value.entrySubtitleWeight === "regular"
                  ? 400
                  : value.entrySubtitleWeight === "bold"
                    ? 700
                    : 900,
            }}
          >
            Example organization
          </div>
          <p
            style={{
              marginTop:
                value.beforeDetailsGap === "template-default"
                  ? 6
                  : value.beforeDetailsGap,
            }}
          >
            {value.bulletMarker === "dash"
              ? "-"
              : value.bulletMarker === "hollow-circle"
                ? "o"
                : "\u2022"}{" "}
            Meaningful work and a measurable achievement.
          </p>
          <span style={{ color: color("linkColor") }}>example.com/project</span>
        </div>
      </div>
    </figure>
  );
}
