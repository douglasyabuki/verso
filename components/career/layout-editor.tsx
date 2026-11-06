"use client";

import { Mail } from "lucide-react";
import { useId, useState } from "react";

import { LayoutColorField } from "@/components/output/layout/layout-color-field";
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
import { layoutSchema } from "@/lib/career/model";
import {
  numericLayoutControls,
  pdfColorPresets,
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
    name: "Page",
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
    name: "Header & profile",
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
    name: "Typography",
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
    name: "Spacing & details",
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
  "page-x": "Page X",
  "page-x-of-y": "Page X of Y",
};

/** Render appearance controls against the caller's uncommitted draft; no workspace or compiler writes. */
export function LayoutFields({
  values,
  onChange,
  contacts = [],
  editContacts,
}: {
  values: unknown;
  onChange: (value: unknown) => void;
  contacts?: string[];
  editContacts?: () => void;
}) {
  const id = useId();
  const [opened, setOpened] = useState<Record<string, boolean>>({
    Page: true,
    "Header & profile": true,
  });
  const data = (values && typeof values === "object" ? values : {}) as Record<
    string,
    unknown
  >;
  const parsed = layoutSchema.safeParse(values);
  const issues = parsed.success ? [] : parsed.error.issues;
  const change = (key: string, value: unknown) =>
    onChange({ ...data, [key]: value });
  return (
    <div className="flex flex-col gap-5">
      <StyleSample values={values} />
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
            <DisclosureLabel>{group.name}</DisclosureLabel>
          </CollapsibleTrigger>
          <CollapsibleContent keepMounted>
            <DisclosureGuide>
              {group.name === "Header & profile" && (
                <div className="mb-4 flex flex-col items-start gap-2">
                  <p className="text-xs text-muted-foreground">
                    Full name is required. Selected contacts:{" "}
                    {contacts.join(" / ") || "None"}. Empty values are omitted.
                  </p>
                  {editContacts && (
                    <Button variant="outline" size="sm" onClick={editContacts}>
                      Edit profile content
                    </Button>
                  )}
                </div>
              )}
              {group.name === "Page" && parsed.success && (
                <MarginGuide
                  values={templateSettings(parsed.data)}
                  active={null}
                />
              )}
              {group.name === "Header & profile" &&
                data.contactRows === "custom" &&
                parsed.success &&
                contacts.length > 1 && (
                  <fieldset className="mb-4">
                    <legend className="mb-2 text-sm font-medium">
                      Custom row breaks
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
                                      : breaks.filter(
                                          (index) => index !== position,
                                        ),
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
                            Start a new row before {contact}
                          </FieldLabel>
                        </Field>
                      );
                    })}
                  </fieldset>
                )}
              <LayoutFieldGrid layout="pair">
                {group.keys.map((key) => {
                  const error = issues.find(
                    (issue) => issue.path[0] === key,
                  )?.message;
                  const numeric = numericLayoutControls.find(
                    (control) => control.key === key,
                  );
                  const color = key.endsWith("Color");
                  const options = color
                    ? Object.keys(pdfColorPresets)
                    : choices[key];
                  const label =
                    extraLabels[key] ??
                    templateSettingLabels[
                      key as keyof typeof templateSettingLabels
                    ] ??
                    key;
                  const fieldId = `${id}-${key}`;
                  const inactive =
                    (key === "iconColor" && data.contactIcons === "off") ||
                    (["dividerThickness", "dividerColor"].includes(key) &&
                      data.sectionDivider === "off") ||
                    (["pageNumberAlignment", "pageNumberFormat"].includes(
                      key,
                    ) &&
                      data.pageNumbering === "hidden") ||
                    (key === "contactRowSizes" &&
                      data.contactRows !== "custom");
                  if (color && !error)
                    return (
                      <LayoutColorField
                        key={key}
                        setting={key as "headingColor"}
                        value={data[key] as keyof typeof pdfColorPresets}
                        id={fieldId}
                        disabled={inactive}
                        explicit={true}
                        change={(value) => change(key, value)}
                        reset={() => change(key, "template-default")}
                        source={
                          inactive
                            ? "Enable its related feature to use this color; the value is retained."
                            : undefined
                        }
                      />
                    );
                  return (
                    <Field
                      key={key}
                      data-invalid={!!error}
                      data-disabled={inactive}
                    >
                      <FieldLabel htmlFor={fieldId}>
                        {label}
                        {numeric && !label.includes("(")
                          ? ` (${numeric.unit})`
                          : ""}
                      </FieldLabel>
                      {options ? (
                        color ? (
                          <Select
                            items={options.map((value) => ({
                              value,
                              label:
                                pdfColorPresets[
                                  value as keyof typeof pdfColorPresets
                                ].label,
                            }))}
                            value={String(data[key] ?? "")}
                            onValueChange={(value) =>
                              value && change(key, value)
                            }
                            disabled={inactive}
                          >
                            <SelectTrigger id={fieldId} aria-invalid={!!error}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {options.map((value) => (
                                  <SelectItem key={value} value={value}>
                                    <span
                                      aria-hidden="true"
                                      className="size-3 rounded-full border"
                                      style={{
                                        background:
                                          pdfColorPresets[
                                            value as keyof typeof pdfColorPresets
                                          ].hex ?? "transparent",
                                      }}
                                    />
                                    {
                                      pdfColorPresets[
                                        value as keyof typeof pdfColorPresets
                                      ].label
                                    }
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        ) : (
                          <ToggleGroup
                            multiple={false}
                            aria-label={label}
                            id={fieldId}
                            variant="outline"
                            size="sm"
                            value={[String(data[key] ?? "")]}
                            onValueChange={(value) =>
                              value.length && change(key, value[0])
                            }
                            disabled={inactive}
                            className="max-w-full flex-wrap"
                          >
                            {options.map((option) => (
                              <ToggleGroupItem
                                key={option}
                                value={option}
                                aria-label={`${label}: ${friendly[option] ?? option}`}
                              >
                                {friendly[option] ??
                                  option[0].toUpperCase() + option.slice(1)}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        )
                      ) : (
                        <Input
                          id={fieldId}
                          aria-invalid={!!error}
                          aria-describedby={
                            error ? `${fieldId}-error` : undefined
                          }
                          disabled={inactive}
                          inputMode={
                            key === "contactRowSizes" ? "text" : "decimal"
                          }
                          placeholder={
                            numeric && "templateDefault" in numeric
                              ? "Template default"
                              : undefined
                          }
                          value={
                            data[key] === "template-default"
                              ? ""
                              : Array.isArray(data[key])
                                ? data[key].join(", ")
                                : String(data[key] ?? "")
                          }
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
                      {numeric && "templateDefault" in numeric && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="self-start"
                          onClick={() => change(key, "template-default")}
                        >
                          Use template default
                        </Button>
                      )}
                      {key === "contactRowSizes" && (
                        <FieldDescription>
                          Items in each row, e.g. 3, 2. Extra contacts wrap in a
                          final row; unused rows are ignored.
                        </FieldDescription>
                      )}
                      {key === "targetPages" && (
                        <FieldDescription>
                          Warning threshold only; content is never removed or
                          automatically fitted.
                        </FieldDescription>
                      )}
                      {inactive && (
                        <FieldDescription>
                          Available when its related feature is enabled. Your
                          value is retained.
                        </FieldDescription>
                      )}
                      {error && (
                        <FieldError id={`${fieldId}-error`}>{error}</FieldError>
                      )}
                    </Field>
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
  const parsed = layoutSchema.safeParse(values);
  if (!parsed.success)
    return (
      <p className="text-xs text-muted-foreground">
        Style sample is available when layout values are valid.
      </p>
    );
  const value = parsed.data;
  const color = (key: keyof typeof pdfColorPresets, fallback: string) =>
    pdfColorPresets[key].hex ?? fallback;
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
          color: color(value.bodyColor, "#000000"),
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
                        style={{ color: color(value.iconColor, "#808080") }}
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
            color: color(value.headingColor, "#704214"),
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
                ? `${value.dividerThickness === "template-default" ? 1 : value.dividerThickness}px solid ${color(value.dividerColor, "#808080")}`
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
              color: color(value.secondaryColor, "#404040"),
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
          <span style={{ color: color(value.linkColor, "#704214") }}>
            example.com/project
          </span>
        </div>
      </div>
    </figure>
  );
}
