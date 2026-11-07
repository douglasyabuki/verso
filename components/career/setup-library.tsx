"use client";

import {
  ArrowDown,
  ArrowUp,
  Copy,
  FileText,
  Palette,
  Pencil,
  Trash2,
} from "lucide-react";
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
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
import {
  layoutFromPreset,
  sameAppearance,
  sameLayout,
} from "@/lib/career/layout";
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

/** Browse reusable configuration collections without opening an editing scope.
 * @param props Guarded destination navigation.
 * @returns Collection descriptions, icons, and Edit navigation actions.
 * @example <LibraryOverview navigate={navigate} />
 */
export function LibraryOverview({ navigate }: { navigate: Navigate }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Reuse appearance or empty structure. To copy selected content and custom
        wording, use Duplicate resume from Resumes. Editing or deleting library
        items does not update existing resumes.
      </p>
      <div className="grid gap-4 @2xl:grid-cols-2">
        {(
          [
            [
              "presets",
              "Layout presets",
              "Reuse fonts, colors, spacing, and page settings.",
              Palette,
            ],
            [
              "starters",
              "Resume starters",
              "Create a resume with empty sections, field defaults, and layout.",
              FileText,
            ],
          ] as const
        ).map(([destination, label, description, Icon]) => (
          <Card key={destination} size="sm">
            <CardHeader>
              <CardTitle
                size="section"
                className="flex items-center gap-2 [&>svg]:size-5 [&>svg]:shrink-0"
              >
                <Icon aria-hidden="true" />
                {label}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button variant="outline" onClick={() => navigate(destination)}>
                <Pencil data-icon="inline-start" />
                Edit
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** Browse committed setups; deletion requires review and retains all copied resume settings. */
export function SetupLibrary({
  kind,
  document,
  navigate,
  commit,
  disabled,
  createResume,
  onUsePreset,
}: {
  createResume: (starterId?: string) => void;
  onUsePreset: (
    presetId: string,
    resumeId: string,
    complete: (error?: string) => void,
  ) => void;
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
  const [usingId, setUsingId] = useState<string | null>(null);
  const [resumeId, setResumeId] = useState("");
  const [useError, setUseError] = useState("");
  const [deleting, setDeleting] = useState<Setup | null>(null);
  const records = kind === "preset" ? document.presets : document.starters;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {kind === "preset"
          ? "Reuse fonts, colors, spacing, and page settings. Loading copies appearance into an unsaved Layout draft."
          : "Create a resume with empty sections, field defaults, and layout. Use Duplicate resume to copy selected content and custom wording."}{" "}
        Editing or deleting library items does not update existing resumes.
      </p>
      {!records.length && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No saved {kind}s yet</EmptyTitle>
            <EmptyDescription>
              Create one here or capture it from a saved resume.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {records.map((item) => (
        <Card size="sm" key={item.id}>
          <CardHeader>
            <CardTitle>{item.name || `Untitled ${kind}`}</CardTitle>
            <CardDescription>
              {kind === "starter" &&
              "sections" in item &&
              Array.isArray(item.sections)
                ? `${item.sections.length} empty sections / `
                : ""}
              {item.layout.paper.toUpperCase()} / {item.layout.font}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-end">
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
                  name: `${item.name || `Untitled ${kind}`} copy`.slice(0, 500),
                };
                navigate(`${kind}/${copy.id}`, copy);
              }}
            >
              <Copy data-icon="inline-start" />
              Duplicate
            </Button>
            <Button
              disabled={disabled}
              onClick={() => {
                if (kind === "starter") createResume(item.id);
                else {
                  setUsingId(item.id);
                  setResumeId("");
                  setUseError("");
                }
              }}
            >
              {kind === "preset" ? "Apply preset…" : "Create resume…"}
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
        open={usingId !== null}
        onOpenChange={(open) => {
          if (!open) setUsingId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply preset</DialogTitle>
            <DialogDescription>
              Load appearance into a resume’s Layout draft, then Save to keep
              it. Content and wording stay unchanged.
            </DialogDescription>
          </DialogHeader>
          {document.resumes.length ? (
            <Field>
              <FieldLabel htmlFor="preset-target">Resume</FieldLabel>
              <Select
                value={resumeId || null}
                onValueChange={(value) => setResumeId(value ?? "")}
                items={document.resumes.map((resume) => ({
                  value: resume.id,
                  label: resume.name || "Untitled resume",
                }))}
              >
                <SelectTrigger id="preset-target">
                  <SelectValue placeholder="Choose a resume" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {document.resumes.map((resume) => (
                      <SelectItem key={resume.id} value={resume.id}>
                        {resume.name || "Untitled resume"}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <p className="text-sm text-muted-foreground">
              Create a resume before using a preset.
            </p>
          )}
          {useError && <p role="alert">{useError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUsingId(null)}>
              Cancel
            </Button>
            {document.resumes.length ? (
              <Button
                disabled={disabled || !resumeId}
                onClick={() =>
                  usingId &&
                  onUsePreset(usingId, resumeId, (error) => {
                    if (error) setUseError(error);
                    else setUsingId(null);
                  })
                }
              >
                Load into layout
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setUsingId(null);
                  createResume();
                }}
              >
                Create resume…
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => !open && !disabled && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {kind}?</DialogTitle>
            <DialogDescription>
              Delete {deleting?.name || `Untitled ${kind}`}? Existing resumes
              keep their copied settings.
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

/** Offer optional preset reuse without requiring a preset to edit layout.
 * @param props Committed presets, current draft, guarded actions, and an optional load-announcement callback.
 * @returns A collapsed preset disclosure with a load status outside its contents.
 * @example <PresetPicker document={document} values={draft} onChange={change} navigate={navigate} capture={capture} />
 */
export function PresetPicker({
  document,
  values,
  onChange,
  navigate,
  capture,
  savedValues,
  onLoaded,
}: {
  document: CareerDocument;
  values: unknown;
  onChange: (value: unknown) => void;
  navigate: Navigate;
  capture: () => void;
  savedValues?: unknown;
  onLoaded?: () => void;
}) {
  const [selected, setSelected] = useState("");
  const [loaded, setLoaded] = useState(false);
  const item = document.presets.find((item) => item.id === selected);
  const matching = document.presets.find((item) =>
    sameAppearance(item.layout, values),
  );
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Adjust layout below, or optionally load a preset.
      </p>
      {!onLoaded &&
        loaded &&
        (savedValues === undefined ||
          JSON.stringify(savedValues) !== JSON.stringify(values)) && (
          <p role="status" className="text-sm text-muted-foreground">
            Preset loaded into unsaved layout. Save to keep these changes.
          </p>
        )}
      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger
          render={<Button variant="ghost" />}
          className={disclosureTriggerClassName}
        >
          <DisclosureChevron />
          <DisclosureLabel>Layout presets (optional)</DisclosureLabel>
        </CollapsibleTrigger>
        <CollapsibleContent keepMounted>
          <DisclosureGuide>
            <Card size="sm">
              <CardHeader>
                <CardTitle>Saved appearance</CardTitle>
                <CardDescription>
                  {matching
                    ? `Current appearance matches ${matching.name || "Untitled preset"}. `
                    : ""}
                  Loading copies appearance and sets the defaults for this
                  layout. Save layout to keep changes. Save as preset captures
                  saved appearance after resolving unsaved changes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {document.presets.length ? (
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="layout-preset">
                        Layout preset
                      </FieldLabel>
                      <Select
                        items={document.presets.map((preset) => ({
                          value: preset.id,
                          label: preset.name || "Untitled preset",
                        }))}
                        value={selected || null}
                        onValueChange={(value) => setSelected(value ?? "")}
                      >
                        <SelectTrigger id="layout-preset">
                          <SelectValue placeholder="Choose a preset to load" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {document.presets.map((preset) => (
                              <SelectItem key={preset.id} value={preset.id}>
                                {preset.name || "Untitled preset"}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    {item && <StyleSample values={item.layout} />}
                  </FieldGroup>
                ) : (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>No saved presets yet</EmptyTitle>
                      <EmptyDescription>
                        Edit layout directly below. You can save its appearance
                        as a preset for reuse.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
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
                  Save as preset…
                </Button>
                {document.presets.length > 0 && (
                  <Button
                    variant="outline"
                    disabled={!item}
                    onClick={() => {
                      if (
                        item &&
                        !sameLayout(layoutFromPreset(item.layout), values)
                      ) {
                        onChange(layoutFromPreset(item.layout));
                        setLoaded(true);
                        onLoaded?.();
                      }
                    }}
                  >
                    Load into layout
                  </Button>
                )}
              </CardFooter>
            </Card>
          </DisclosureGuide>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
