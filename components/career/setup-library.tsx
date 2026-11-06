"use client";

import { ArrowDown, ArrowUp, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { LayoutFields, StyleSample } from "@/components/career/layout-editor";
import { CareerSectionIcon } from "@/components/content/career-section-icon";
import { CareerSectionIconPicker } from "@/components/content/career-section-icon-picker";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DisclosureChevron,
  DisclosureGuide,
  DisclosureLabel,
  disclosureTriggerClassName,
} from "@/components/ui/disclosure";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { presetSchema, starterSchema } from "@/lib/career/model";
import type { CareerDocument } from "@/types-and-constants/career";
import {
  BUILTIN_FIELDS,
  CAREER_FIELD_LABELS,
  SECTION_KINDS,
} from "@/types-and-constants/career";
import { defaultSectionIcons } from "@/types-and-constants/section-icons";

type Navigate = (scope: string, values?: unknown) => void;
type Setup =
  CareerDocument["presets"][number] | CareerDocument["starters"][number];

/** Link to reusable configurations without adding a top-level navigation group. */
export function ReusableSetups({ navigate }: { navigate: Navigate }) {
  return (
    <Collapsible>
      <CollapsibleTrigger
        render={<Button variant="ghost" />}
        className={disclosureTriggerClassName}
      >
        <DisclosureChevron />
        <DisclosureLabel>Reusable setups</DisclosureLabel>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <DisclosureGuide>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("presets")}>
              Layout presets
            </Button>
            <Button variant="outline" onClick={() => navigate("starters")}>
              Resume starters
            </Button>
          </div>
        </DisclosureGuide>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Browse committed setups; deletion requires review and retains all copied resume settings. */
export function SetupLibrary({
  kind,
  document,
  navigate,
  commit,
  disabled,
}: {
  kind: "preset" | "starter";
  document: CareerDocument;
  navigate: Navigate;
  commit: (
    scope: string,
    value: unknown,
    reviewed: unknown,
  ) => Promise<boolean>;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<Setup | null>(null);
  const records = kind === "preset" ? document.presets : document.starters;
  const create = () => {
    const base = {
      id: crypto.randomUUID(),
      name: "",
      template: "yabuki-reference@1.0.3",
      layout: structuredClone(document.defaults),
    };
    navigate(
      `${kind}/${base.id}`,
      kind === "starter"
        ? { ...base, sections: [], summaryIncluded: false }
        : base,
    );
  };
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle size="section">
            {kind === "preset" ? "Layout presets" : "Resume starters"}
          </CardTitle>
          <CardDescription>
            {kind === "preset"
              ? "Appearance only. Loading a preset copies its settings into a Layout draft."
              : "Empty structure, field defaults, and layout. Use Duplicate resume to reuse content."}{" "}
            Existing resumes keep independent copies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field>
            <FieldLabel htmlFor="setup-search">Search {kind}s</FieldLabel>
            <Input
              id="setup-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </Field>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={() => navigate("resumes")}>
            Back to resumes
          </Button>
          <Button disabled={disabled || records.length >= 100} onClick={create}>
            <Plus data-icon="inline-start" />
            Create {kind}
          </Button>
        </CardFooter>
      </Card>
      {!records.length && (
        <p className="text-xs text-muted-foreground">
          No saved {kind}s yet. Create one here or capture it from a saved
          resume.
        </p>
      )}
      {records
        .filter((item) =>
          item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
        )
        .map((item) => (
          <Card size="sm" key={item.id}>
            <CardHeader>
              <CardTitle>{item.name}</CardTitle>
              <CardDescription>
                {kind === "starter" &&
                "sections" in item &&
                Array.isArray(item.sections)
                  ? `${item.sections.length} empty sections / `
                  : ""}
                {item.layout.paper.toUpperCase()} / {item.layout.font}
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                variant="outline"
                disabled={disabled}
                onClick={() => navigate(`${kind}/${item.id}`)}
              >
                <Pencil data-icon="inline-start" />
                Edit
              </Button>
              <Button
                variant="outline"
                disabled={disabled || records.length >= 100}
                onClick={() => {
                  const copy = {
                    ...structuredClone(item),
                    id: crypto.randomUUID(),
                    name: `${item.name} copy`.slice(0, 500),
                  };
                  navigate(`${kind}/${copy.id}`, copy);
                }}
              >
                <Copy data-icon="inline-start" />
                Duplicate
              </Button>
              <Button
                variant="ghost"
                disabled={disabled}
                onClick={() => setDeleting(structuredClone(item))}
              >
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
            </CardFooter>
          </Card>
        ))}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => !open && !disabled && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {kind}?</DialogTitle>
            <DialogDescription>
              Delete {deleting?.name}? Existing resumes keep their copied
              settings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={disabled}
              onClick={() =>
                deleting &&
                void commit(`${kind}/${deleting.id}`, null, deleting).then(
                  (saved) => saved && setDeleting(null),
                )
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Edit a named reusable setup as one recoverable form scope. */
export function SetupEditor({
  kind,
  values,
  onChange,
}: {
  kind: "preset" | "starter";
  values: unknown;
  onChange: (value: unknown) => void;
}) {
  const item = values as Setup;
  if (!item || typeof item !== "object" || !("layout" in item))
    return (
      <p>
        Deletion is pending. Save retries deletion; Cancel keeps the saved
        setup.
      </p>
    );
  const starter =
    kind === "starter" ? (item as CareerDocument["starters"][number]) : null;
  if (
    starter &&
    (!Array.isArray(starter.sections) ||
      starter.sections.some(
        (section) =>
          !section ||
          !SECTION_KINDS.includes(section.kind) ||
          typeof section.label !== "string" ||
          !Array.isArray(section.visibleFields),
      ))
  )
    return (
      <Field>
        <FieldLabel htmlFor="recovered-setup">
          Recovered setup (JSON)
        </FieldLabel>
        <Input
          id="recovered-setup"
          defaultValue={JSON.stringify(values)}
          onChange={(event) => {
            try {
              onChange(JSON.parse(event.target.value));
            } catch {}
          }}
        />
      </Field>
    );
  const sections = starter?.sections ?? [];
  const updateSections = (next: typeof sections) =>
    onChange({ ...item, sections: next });
  const parsed = (kind === "preset" ? presetSchema : starterSchema).safeParse(
    values,
  );
  return (
    <FieldGroup>
      <Field data-invalid={!item.name?.trim()}>
        <FieldLabel htmlFor="setup-name">
          {kind === "preset" ? "Preset name" : "Starter name"}
        </FieldLabel>
        <Input
          id="setup-name"
          maxLength={500}
          value={item.name}
          aria-invalid={!item.name?.trim()}
          onChange={(event) => onChange({ ...item, name: event.target.value })}
        />
      </Field>
      {starter && (
        <>
          <Field>
            <FieldLabel>
              <Checkbox
                checked={starter.summaryIncluded}
                onCheckedChange={(checked) =>
                  onChange({ ...item, summaryIncluded: !!checked })
                }
              />
              Include summary by default
            </FieldLabel>
          </Field>
          {sections.map((section, index) => (
            <Card size="sm" key={section.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CareerSectionIcon kind={section.kind} icon={section.icon} />
                  {section.label || "Empty section"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor={`starter-label-${section.id}`}>
                      Structural label
                    </FieldLabel>
                    <Input
                      id={`starter-label-${section.id}`}
                      value={section.label}
                      onChange={(event) =>
                        updateSections(
                          sections.map((row, i) =>
                            i === index
                              ? { ...row, label: event.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                  </Field>
                  {section.kind === "custom" && (
                    <CareerSectionIconPicker
                      description="This icon is copied to new empty sections. Save the starter to keep this choice."
                      value={section.icon}
                      onChange={(icon) =>
                        updateSections(
                          sections.map((row, i) =>
                            i === index ? { ...row, icon } : row,
                          ),
                        )
                      }
                    />
                  )}
                  <Field>
                    <FieldLabel>
                      <Checkbox
                        checked={!section.hidden}
                        onCheckedChange={(checked) =>
                          updateSections(
                            sections.map((row, i) =>
                              i === index ? { ...row, hidden: !checked } : row,
                            ),
                          )
                        }
                      />
                      Show section by default
                    </FieldLabel>
                  </Field>
                  <fieldset>
                    <legend className="mb-2 text-sm font-medium">
                      Fields selected with new entries
                    </legend>
                    <FieldGroup>
                      {BUILTIN_FIELDS[section.kind].map((key) => (
                        <Field key={key}>
                          <FieldLabel>
                            <Checkbox
                              checked={section.visibleFields.includes(key)}
                              onCheckedChange={(checked) =>
                                updateSections(
                                  sections.map((row, i) =>
                                    i === index
                                      ? {
                                          ...row,
                                          visibleFields: checked
                                            ? [...row.visibleFields, key]
                                            : row.visibleFields.filter(
                                                (value) => value !== key,
                                              ),
                                        }
                                      : row,
                                  ),
                                )
                              }
                            />
                            {CAREER_FIELD_LABELS[key] ?? key}
                          </FieldLabel>
                        </Field>
                      ))}
                    </FieldGroup>
                  </fieldset>
                </FieldGroup>
              </CardContent>
              <CardFooter>
                <Button
                  variant="ghost"
                  aria-label={`Move ${section.label} up`}
                  disabled={index === 0}
                  onClick={() => {
                    const next = [...sections];
                    [next[index - 1], next[index]] = [
                      next[index],
                      next[index - 1],
                    ];
                    updateSections(next);
                  }}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Move ${section.label} down`}
                  disabled={index === sections.length - 1}
                  onClick={() => {
                    const next = [...sections];
                    [next[index + 1], next[index]] = [
                      next[index],
                      next[index + 1],
                    ];
                    updateSections(next);
                  }}
                >
                  <ArrowDown />
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    updateSections(sections.filter((_, i) => i !== index))
                  }
                >
                  Remove section
                </Button>
              </CardFooter>
            </Card>
          ))}
          <Field>
            <FieldLabel htmlFor="add-starter-section">
              Add empty section
            </FieldLabel>
            <Select
              value={null}
              onValueChange={(kind) => {
                if (!kind) return;
                const key = kind as (typeof SECTION_KINDS)[number];
                updateSections([
                  ...sections,
                  {
                    id: crypto.randomUUID(),
                    kind: key,
                    icon: defaultSectionIcons[key],
                    label: key[0].toUpperCase() + key.slice(1),
                    hidden: false,
                    visibleFields: [...BUILTIN_FIELDS[key]],
                  },
                ]);
              }}
              disabled={sections.length >= 100}
            >
              <SelectTrigger id="add-starter-section">
                <SelectValue placeholder="Choose section kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {SECTION_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      <CareerSectionIcon kind={kind} />
                      {kind[0].toUpperCase() + kind.slice(1)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </>
      )}
      <LayoutFields
        values={item.layout}
        onChange={(layout) => onChange({ ...item, layout })}
      />
      {!parsed.success && (
        <p role="alert" className="text-xs text-destructive">
          {parsed.error.issues.map((issue) => issue.message).join(" ")}
        </p>
      )}
    </FieldGroup>
  );
}

/** Copy appearance into the mounted layout draft without committing it. */
export function PresetPicker({
  document,
  values,
  onChange,
  navigate,
  capture,
}: {
  document: CareerDocument;
  values: unknown;
  onChange: (value: unknown) => void;
  navigate: Navigate;
  capture: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const item = document.presets.find((item) => item.id === selected);
  const matching = document.presets.find(
    (item) => JSON.stringify(item.layout) === JSON.stringify(values),
  );
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Presets</CardTitle>
        <CardDescription>
          {matching
            ? `Matches ${matching.name}`
            : "Load appearance only, then Save layout. Content selections and wording stay independent."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="preset-search">Search presets</FieldLabel>
            <Input
              id="preset-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="layout-preset">Layout preset</FieldLabel>
            <Select
              items={document.presets.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              value={selected || null}
              onValueChange={(value) => setSelected(value ?? "")}
            >
              <SelectTrigger id="layout-preset">
                <SelectValue placeholder="Choose a preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {document.presets
                    .filter((item) =>
                      item.name.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          {item && <StyleSample values={item.layout} />}
        </FieldGroup>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" onClick={() => navigate("presets")}>
          Manage presets
        </Button>
        <Button
          variant="outline"
          disabled={document.presets.length >= 100}
          onClick={capture}
        >
          Save as preset
        </Button>
        <Button
          variant="outline"
          disabled={!item}
          onClick={() => item && onChange(structuredClone(item.layout))}
        >
          Load into layout
        </Button>
      </CardFooter>
    </Card>
  );
}
