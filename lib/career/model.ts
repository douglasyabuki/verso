import { z } from "zod";

import { richTextSchema } from "@/lib/career/wording";
import type {
  CareerDocument,
  CareerEntry,
  CareerSection,
} from "@/types-and-constants/career";
import {
  BUILTIN_FIELDS,
  FIELD_TYPES,
  RECOVERY_BYTES,
  RESUME_COLORS,
  SECTION_KINDS,
  WORKSPACE_BYTES,
} from "@/types-and-constants/career";

const id = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9_-]+$/);
const text = z.string().max(20_000);
const language = z
  .string()
  .max(100)
  .refine((value) => {
    try {
      return Intl.getCanonicalLocales(value)[0] === value;
    } catch {
      return false;
    }
  }, "Use a canonical language tag, such as en-US or pt-BR.");
const wording = z.record(language, text);
const date = z
  .string()
  .refine(
    (value) =>
      !value || (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(value) && validDate(value)),
    "Use a valid YYYY, YYYY-MM, or YYYY-MM-DD date.",
  );
const url = z
  .string()
  .max(4000)
  .refine((value) => {
    if (!value) return true;
    try {
      return ["https:", "http:", "mailto:", "tel:"].includes(
        new URL(value).protocol,
      );
    } catch {
      return false;
    }
  }, "Use an http, https, mailto, or tel link.");

/** Check calendar components without permitting date rollover.
 * @param value Entered partial ISO date.
 * @returns {boolean} Whether all entered components describe a calendar date.
 * @example validDate("2024-02-29") // true
 */
function validDate(value: string): boolean {
  const [year, month = 1, day = 1] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  return (
    day <=
    new Date(Date.UTC(year < 100 ? year + 400 : year, month, 0)).getUTCDate()
  );
}

export const fieldSchema = z
  .strictObject({
    id,
    key: z.string().max(80),
    type: z.enum(FIELD_TYPES),
    fact: z.string().max(4000),
    wording,
  })
  .superRefine((field, ctx) => {
    const validator =
      field.type === "date"
        ? date
        : field.type === "url"
          ? url
          : field.type === "email"
            ? z.union([z.literal(""), z.email()])
            : null;
    const result = validator?.safeParse(field.fact);
    if (result && !result.success)
      ctx.addIssue({
        code: "custom",
        path: ["fact"],
        message: result.error.issues[0].message,
      });
    if (field.type === "text" && field.fact)
      ctx.addIssue({
        code: "custom",
        message: "Display text belongs in language wording, not shared facts.",
      });
    if (field.type !== "text" && Object.keys(field.wording).length)
      ctx.addIssue({
        code: "custom",
        message: "Shared facts cannot have localized copies.",
      });
  });
const achievementSchema = z.strictObject({
  id,
  archived: z.boolean(),
  wording: z.record(language, richTextSchema),
});
const linkSchema = z.strictObject({
  id,
  archived: z.boolean(),
  url,
  label: wording,
});

export const entrySchema = z.strictObject({
  id,
  name: z.string().max(500),
  archived: z.boolean(),
  fields: z.array(fieldSchema).max(30),
  achievements: z.array(achievementSchema).max(100),
  links: z.array(linkSchema).max(30),
});
export const sectionSchema = z.strictObject({
  id,
  kind: z.enum(SECTION_KINDS),
  name: z.string().max(500),
  heading: wording,
  archived: z.boolean(),
  entries: z.array(entrySchema).max(300),
});
const layoutSchema = z.strictObject({
  paper: z.enum(["a4", "letter"]),
  font: z.enum(["inter", "source-sans", "source-serif"]),
  fontSize: z.number().min(8).max(18),
});
const selectionSchema = z.strictObject({
  sectionId: id,
  hidden: z.boolean().optional(),
  hiddenEntryIds: z.array(id).max(300).optional(),
  entryIds: z.array(id).max(300),
  achievementIds: z.array(id).max(30_000),
  fieldIds: z.array(id).max(9000),
  linkIds: z.array(id).max(9000),
});
const resumeSchema = z.strictObject({
  id,
  name: z.string().max(500),
  color: z.enum(RESUME_COLORS).optional(),
  language,
  template: z.literal("yabuki-reference@1.0.2"),
  selection: z.array(selectionSchema).max(100),
  profileSelection: z.array(id).max(60).optional(),
  summaryIncluded: z.boolean().optional(),
  overrides: z.record(id, richTextSchema),
  layout: layoutSchema,
});

export const careerDocumentSchema = z
  .strictObject({
    languages: z
      .array(z.strictObject({ tag: language, active: z.boolean() }))
      .min(1),
    profile: z.strictObject({
      id,
      fields: z.array(fieldSchema).max(30),
      links: z.array(linkSchema).max(30),
    }),
    summary: z.strictObject({
      id,
      wording: z.record(language, richTextSchema),
    }),
    sections: z.array(sectionSchema).max(100),
    resumes: z.array(resumeSchema).max(120),
    starters: z
      .array(
        z.strictObject({
          id,
          name: z.string().max(500),
          sections: z
            .array(
              z.strictObject({
                kind: z.enum(SECTION_KINDS),
                visibleFields: z.array(z.string().max(80)).max(30),
              }),
            )
            .max(100),
          layout: layoutSchema,
        }),
      )
      .max(100),
    presets: z
      .array(
        z.strictObject({ id, name: z.string().max(500), layout: layoutSchema }),
      )
      .max(100),
    defaults: layoutSchema,
  })
  .superRefine((document, ctx) => {
    const ids = new Set<string>();
    const languages = new Set<string>();
    const wordingIds = new Set<string>();
    const richIds = new Set([document.summary.id]);
    const allFields = [...document.profile.fields];
    const allLinks = [...document.profile.links];
    const wordings: Record<string, unknown>[] = [document.summary.wording];
    const addId = (value: string) => {
      if (ids.has(value))
        ctx.addIssue({
          code: "custom",
          message: `Duplicate identity: ${value}`,
        });
      ids.add(value);
    };
    for (const item of document.languages) {
      if (languages.has(item.tag))
        ctx.addIssue({ code: "custom", message: "Duplicate language." });
      languages.add(item.tag);
    }
    const profileTypes: Record<string, string> = {
      fullName: "text",
      email: "email",
      phone: "phone",
      city: "text",
      country: "text",
    };
    if (
      document.profile.fields.length !== 5 ||
      new Set(document.profile.fields.map((field) => field.key)).size !== 5 ||
      document.profile.fields.some(
        (field) => profileTypes[field.key] !== field.type,
      )
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Profile must retain the supported fullName, email, phone, city, and country field shapes.",
      });
    addId(document.profile.id);
    addId(document.summary.id);
    wordingIds.add(document.summary.id);
    let count = 0;
    for (const section of document.sections) {
      addId(section.id);
      wordingIds.add(section.id);
      wordings.push(section.heading);
      count += section.entries.length;
      for (const entry of section.entries) {
        addId(entry.id);
        allFields.push(...entry.fields);
        allLinks.push(...entry.links);
        if (entry.fields.length !== BUILTIN_FIELDS[section.kind].length)
          ctx.addIssue({
            code: "custom",
            message:
              "Entries must retain their built-in fields; empty values are allowed.",
          });
        const keys = new Set<string>();
        for (const field of entry.fields) {
          if (
            !(BUILTIN_FIELDS[section.kind] as readonly string[]).includes(
              field.key,
            )
          )
            ctx.addIssue({
              code: "custom",
              message: `Unsupported ${section.kind} field: ${field.key}`,
            });
          const expectedType = ["start", "end", "issued", "expires"].includes(
            field.key,
          )
            ? "date"
            : field.key === "url"
              ? "url"
              : field.key === "credential"
                ? "credential"
                : "text";
          if (field.type !== expectedType)
            ctx.addIssue({
              code: "custom",
              message: `Invalid built-in field type for ${field.key}.`,
            });
          if (keys.has(field.key))
            ctx.addIssue({
              code: "custom",
              message: `Duplicate field: ${field.key}`,
            });
          keys.add(field.key);
        }
        for (const achievement of entry.achievements) {
          addId(achievement.id);
          wordingIds.add(achievement.id);
          richIds.add(achievement.id);
          wordings.push(achievement.wording);
        }
      }
    }
    if (count > 10_000)
      ctx.addIssue({
        code: "custom",
        message: "A workspace supports up to 10,000 career entries.",
      });
    for (const field of allFields) {
      addId(field.id);
      if (field.type === "text") wordingIds.add(field.id);
      wordings.push(field.wording);
    }
    for (const link of allLinks) {
      addId(link.id);
      wordingIds.add(link.id);
      wordings.push(link.label);
    }
    for (const values of wordings)
      for (const tag of Object.keys(values))
        if (!languages.has(tag))
          ctx.addIssue({
            code: "custom",
            message: `Unregistered wording language: ${tag}`,
          });
    for (const item of [...document.starters, ...document.presets])
      addId(item.id);
    for (const resume of document.resumes) {
      addId(resume.id);
      if (resume.profileSelection) {
        const pool = [
          ...document.profile.fields.filter(
            (field) => field.key !== "fullName",
          ),
          ...document.profile.links,
        ];
        if (
          new Set(resume.profileSelection).size !==
            resume.profileSelection.length ||
          resume.profileSelection.some(
            (value) => !pool.some((item) => item.id === value),
          )
        )
          ctx.addIssue({
            code: "custom",
            message: "Duplicate or dangling contact selection.",
          });
      }
      if (!languages.has(resume.language))
        ctx.addIssue({
          code: "custom",
          message: "Resume language is missing.",
        });
      for (const key of Object.keys(resume.overrides))
        if (!wordingIds.has(key))
          ctx.addIssue({
            code: "custom",
            message: `Dangling wording customization: ${key}`,
          });
      for (const [key, value] of Object.entries(resume.overrides))
        if (typeof value !== "string" && !richIds.has(key))
          ctx.addIssue({
            code: "custom",
            message:
              "Inline formatting is supported only in summaries and achievement/detail prose.",
          });
      const selectedSections = new Set<string>();
      for (const selected of resume.selection) {
        if (selectedSections.has(selected.sectionId))
          ctx.addIssue({
            code: "custom",
            message: "Duplicate section selection.",
          });
        selectedSections.add(selected.sectionId);
        if (
          new Set(selected.hiddenEntryIds).size !==
            (selected.hiddenEntryIds?.length ?? 0) ||
          selected.hiddenEntryIds?.some(
            (value) => !selected.entryIds.includes(value),
          )
        )
          ctx.addIssue({
            code: "custom",
            message: "Hidden entries must retain their configured selection.",
          });
        const section = document.sections.find(
          (item) => item.id === selected.sectionId,
        );
        if (!section) {
          ctx.addIssue({
            code: "custom",
            message: "Dangling section selection.",
          });
          continue;
        }
        const entries = section.entries.filter((item) =>
          selected.entryIds.includes(item.id),
        );
        const pools = [
          section.entries.map((item) => item.id),
          entries.flatMap((item) => item.achievements.map((value) => value.id)),
          entries.flatMap((item) => item.fields.map((value) => value.id)),
          entries.flatMap((item) => item.links.map((value) => value.id)),
        ];
        [
          selected.entryIds,
          selected.achievementIds,
          selected.fieldIds,
          selected.linkIds,
        ].forEach((values, index) => {
          if (
            new Set(values).size !== values.length ||
            values.some((value) => !pools[index].includes(value))
          )
            ctx.addIssue({
              code: "custom",
              message: "Duplicate or dangling resume selection.",
            });
        });
      }
    }
  });

export const workspaceEnvelopeSchema = z.strictObject({
  format: z.literal("verso.workspace"),
  schemaVersion: z.literal(2),
  exportedAt: z.iso.datetime(),
  workspaceId: id,
  document: careerDocumentSchema,
});
export const draftSchema = z.strictObject({
  draftId: id,
  draftVersion: z.number().int().positive(),
  workspaceId: id,
  scope: z
    .string()
    .max(370)
    .regex(
      /^(profile|summary|languages|sections|(entry|section|entries|selection|new-section|resume|resume-details|resume-content|resume-wording)\/[A-Za-z0-9_-]{1,120}|new-entry\/[A-Za-z0-9_-]{1,120}\/[A-Za-z0-9_-]{1,120})$/,
      "Unsupported editing scope.",
    ),
  baseline: z.unknown(),
  baselineRevision: z.number().int().nonnegative(),
  generation: z.number().int().nonnegative(),
  values: z.unknown(),
  operationId: id.optional(),
  fingerprint: z.string().max(WORKSPACE_BYTES).optional(),
});
export const recoveryEnvelopeSchema = z.strictObject({
  format: z.literal("verso.recovery"),
  schemaVersion: z.literal(1),
  exportedAt: z.iso.datetime(),
  sourceWorkspaceId: id,
  drafts: z.array(draftSchema),
});

/** Validate a schema-2 document including its serialized byte ceiling.
 * @param value Untrusted document.
 * @returns {CareerDocument} Validated document; throws on malformed values/references or capacity overflow.
 * @example validateDocument(createCareerDocument())
 */
export function validateDocument(value: unknown): CareerDocument {
  if (
    new TextEncoder().encode(JSON.stringify(value)).byteLength > WORKSPACE_BYTES
  )
    throw new Error("Workspace exceeds 64 MiB.");
  return careerDocumentSchema.parse(value);
}

/** Parse portable workspace or recovery JSON without mutating storage.
 * @param source UTF-8 JSON text.
 * @param kind Required envelope format.
 * @returns Validated envelope, preserving malformed field values inside bounded recovery drafts; throws on rejection.
 * @example parsePortable(json, "workspace")
 */
export function parsePortable(source: string, kind: "workspace" | "recovery") {
  const bytes = new TextEncoder().encode(source).byteLength;
  if (bytes > (kind === "workspace" ? WORKSPACE_BYTES : RECOVERY_BYTES))
    throw new Error("Import exceeds its byte limit.");
  const value: unknown = JSON.parse(source);
  if (kind === "workspace") {
    const result = workspaceEnvelopeSchema.parse(value);
    validateDocument(result.document);
    return result;
  }
  const result = recoveryEnvelopeSchema.parse(value);
  const ids = new Set<string>();
  for (const draft of result.drafts) {
    if (ids.has(draft.draftId)) throw new Error("Duplicate draft identity.");
    ids.add(draft.draftId);
    if (
      new TextEncoder().encode(JSON.stringify(draft)).byteLength >
      WORKSPACE_BYTES
    )
      throw new Error(
        "A recovery draft exceeds 64 MiB; keep the source and export explicit chunks.",
      );
  }
  return result;
}

/** Create a clean language-agnostic schema-2 workspace with no mandatory counterpart.
 * @param tag Initial canonical content language, defaulting to en-US.
 * @returns {CareerDocument} Empty career data and independent portable configuration.
 * @example createCareerDocument("pt-BR")
 */
export function createCareerDocument(tag = "en-US"): CareerDocument {
  const defaults = {
    paper: "a4" as const,
    font: "inter" as const,
    fontSize: 10,
  };
  return validateDocument({
    languages: [{ tag, active: true }],
    profile: {
      id: crypto.randomUUID(),
      fields: ["fullName", "email", "phone", "city", "country"].map((key) => ({
        id: crypto.randomUUID(),
        key,
        type: key === "email" ? "email" : key === "phone" ? "phone" : "text",
        fact: "",
        wording: {},
      })),
      links: [],
    },
    summary: { id: crypto.randomUUID(), wording: {} },
    sections: (
      [
        "experience",
        "projects",
        "education",
        "skills",
        "certifications",
      ] as const
    ).map((kind) => ({
      id: crypto.randomUUID(),
      kind,
      name: kind[0].toUpperCase() + kind.slice(1),
      heading: {},
      archived: false,
      entries: [],
    })),
    resumes: [],
    starters: [],
    presets: [],
    defaults,
  });
}

/** Create an entry with stable built-in field identities and empty wording.
 * @param kind Supported career section kind.
 * @returns {CareerEntry} Independent entry, not selected by any resume.
 * @example createEntry("experience")
 */
export function createEntry(kind: CareerSection["kind"]): CareerEntry {
  return {
    id: crypto.randomUUID(),
    name: "",
    archived: false,
    fields: BUILTIN_FIELDS[kind].map((key) => ({
      id: crypto.randomUUID(),
      key,
      type: ["start", "end", "issued", "expires"].includes(key)
        ? "date"
        : key === "url"
          ? "url"
          : key === "credential"
            ? "credential"
            : "text",
      fact: "",
      wording: {},
    })),
    achievements: [],
    links: [],
  };
}

/** Duplicate a career entry with independent nested identities and unchanged content.
 * @param entry Source career entry.
 * @returns {CareerEntry} Deep copy with fresh entry/field/achievement/link IDs and no resume selections.
 * @example duplicateEntry(entry)
 */
export function duplicateEntry(entry: CareerEntry): CareerEntry {
  return {
    ...structuredClone(entry),
    id: crypto.randomUUID(),
    name: `${entry.name} copy`,
    fields: entry.fields.map((field) => ({
      ...structuredClone(field),
      id: crypto.randomUUID(),
    })),
    achievements: entry.achievements.map((item) => ({
      ...structuredClone(item),
      id: crypto.randomUUID(),
    })),
    links: entry.links.map((item) => ({
      ...structuredClone(item),
      id: crypto.randomUUID(),
    })),
  };
}

/** Read one exact editing scope without coupling order to wording.
 * @param document Current committed document.
 * @param scope Supported exact scope path; whole-document Save is never supported.
 * @returns {unknown} Scope values, null for a new identity, or undefined for a missing/unsupported target.
 * @example readScope(document, `entries/${section.id}`) // ordered IDs only
 */
export function readScope(document: CareerDocument, scope: string): unknown {
  if (scope === "profile") return document.profile;
  if (scope === "summary") return document.summary;
  if (scope === "languages") return document.languages;
  if (scope === "sections")
    return document.sections.map((section) => section.id);
  if (
    !/^(entry|section|entries|selection|new-section|resume|resume-details|resume-content|resume-wording)\/[A-Za-z0-9_-]{1,120}$|^new-entry\/[A-Za-z0-9_-]{1,120}\/[A-Za-z0-9_-]{1,120}$/.test(
      scope,
    )
  )
    return undefined;
  const [kind, target, child] = scope.split("/");
  if (kind.startsWith("resume")) {
    const resume = document.resumes.find((item) => item.id === target);
    if (kind === "resume") return resume ?? null;
    if (!resume) return undefined;
    if (kind === "resume-details")
      return { name: resume.name, color: resume.color ?? "indigo" };
    if (kind === "resume-wording") return resume.overrides;
    if (kind === "resume-content")
      return {
        selection: resume.selection,
        profileSelection: resume.profileSelection,
        summaryIncluded: resume.summaryIncluded,
      };
  }
  if (kind === "selection")
    return document.resumes.find((item) => item.id === target)?.selection;
  const section = document.sections.find((item) => item.id === target);
  if (kind === "entries") return section?.entries.map((entry) => entry.id);
  if (kind === "new-entry")
    return section
      ? (section.entries.find((entry) => entry.id === child) ?? null)
      : undefined;
  if (kind === "entry")
    return document.sections
      .flatMap((item) => item.entries)
      .find((entry) => entry.id === target);
  if (kind === "section" || kind === "new-section") {
    if (!section) return kind === "new-section" ? null : undefined;
    return {
      id: section.id,
      kind: section.kind,
      name: section.name,
      heading: section.heading,
      archived: section.archived,
    };
  }
  return undefined;
}

/** Require all previous shared identities and field definitions to survive an edit.
 * @param before Existing nested shared records.
 * @param after Proposed nested shared records.
 * @returns {void} No value; throws if existing content is deleted or field meaning changes.
 * @example retainIdentities(entry.links, draft.links)
 */
function retainIdentities(
  before: { id: string; key?: string; type?: string }[],
  after: { id: string; key?: string; type?: string }[],
): void {
  for (const item of before) {
    const next = after.find((value) => value.id === item.id);
    if (!next)
      throw new Error(
        "Archive shared content instead of removing or changing its identity.",
      );
    if (item.key !== next.key || item.type !== next.type)
      throw new Error("Built-in field identity, key, and type cannot change.");
  }
}

/** Reorder identities without replacing their latest content.
 * @param items Latest committed records.
 * @param values Proposed ordered identities.
 * @returns Records in requested order; throws on missing, duplicate, added, or removed identities.
 * @example reorderRecords(section.entries, orderedIds)
 */
function reorderRecords<T extends { id: string }>(
  items: T[],
  values: unknown,
): T[] {
  const order = z.array(id).parse(values);
  if (
    order.length !== items.length ||
    new Set(order).size !== order.length ||
    order.some((value) => !items.some((item) => item.id === value))
  )
    throw new Error("Order must retain every existing identity exactly once.");
  return order.map((value) => items.find((item) => item.id === value)!);
}

/** Apply a whitelisted editing scope, preserving unrelated changes and archive-only identities.
 * @param document Latest committed document.
 * @param scope Exact supported editing scope. Replacement uses a separate reviewed transaction.
 * @param values Proposed scope values.
 * @returns {CareerDocument} Validated immutable document; throws on malformed input, deletion, identity drift, or missing target.
 * @example applyScope(document, "summary", summaryDraft)
 */
export function applyScope(
  document: CareerDocument,
  scope: string,
  values: unknown,
): CareerDocument {
  const baseline = readScope(document, scope);
  if (baseline === undefined)
    throw new Error(
      "Unsupported scope or original record missing. Restore as new or export recovery.",
    );
  // Copy the branches this operation can replace. Wording strings are immutable;
  // copying all of them before full validation duplicates near-capacity content.
  const next = {
    ...document,
    sections: document.sections.map((section) => ({
      ...section,
      entries: [...section.entries],
    })),
    resumes: document.resumes.map((resume) => ({ ...resume })),
  };
  const [kind, target, child] = scope.split("/");
  if (kind === "resume") {
    if (values === null)
      next.resumes = next.resumes.filter((item) => item.id !== target);
    else {
      if (baseline !== null)
        throw new Error(
          "Existing resumes can only be changed through their editing scopes.",
        );
      const resume = resumeSchema.parse(values);
      if (resume.id !== target)
        throw new Error("Resume identity must match its scope.");
      next.resumes.push(resume);
    }
  } else if (kind === "resume-details") {
    const details = resumeSchema
      .pick({ name: true, color: true })
      .parse(values);
    Object.assign(
      next.resumes.find((item) => item.id === target)!,
      details,
    );
  } else if (kind === "resume-wording") {
    next.resumes.find((item) => item.id === target)!.overrides =
      resumeSchema.shape.overrides.parse(values);
  } else if (kind === "resume-content") {
    const content = resumeSchema
      .pick({ selection: true, profileSelection: true, summaryIncluded: true })
      .parse(values);
    // The selection scope remains supported for existing immutable recovery requests.
    const selected = applyScope(
      document,
      `selection/${target}`,
      content.selection,
    );
    const resume = selected.resumes.find((item) => item.id === target)!;
    if (
      content.profileSelection?.some(
        (value) =>
          document.profile.links.some(
            (link) => link.id === value && link.archived,
          ) &&
          !(
            document.resumes.find((item) => item.id === target)!
              .profileSelection ??
            document.profile.links
              .filter((link) => !link.archived)
              .map((link) => link.id)
          ).includes(value),
      )
    )
      throw new Error("Archived contacts are unavailable for new selections.");
    Object.assign(resume, content);
    return validateDocument(selected);
  } else if (scope === "profile") {
    const profile = careerDocumentSchema.shape.profile.parse(values);
    if (profile.id !== document.profile.id)
      throw new Error("Profile identity cannot change.");
    retainIdentities(document.profile.fields, profile.fields);
    retainIdentities(document.profile.links, profile.links);
    next.profile = profile;
  } else if (scope === "summary") {
    const summary = careerDocumentSchema.shape.summary.parse(values);
    if (summary.id !== document.summary.id)
      throw new Error("Summary identity cannot change.");
    next.summary = summary;
  } else if (scope === "languages") {
    const languages = careerDocumentSchema.shape.languages.parse(values);
    if (
      document.languages.some(
        (item) => !languages.some((value) => value.tag === item.tag),
      )
    )
      throw new Error("Deactivate languages instead of erasing them.");
    next.languages = languages;
  } else if (scope === "sections")
    next.sections = reorderRecords(next.sections, values);
  else if (kind === "new-section") {
    if (baseline !== null) throw new Error("Section identity already exists.");
    const properties = sectionSchema.omit({ entries: true }).parse(values);
    if (properties.id !== target)
      throw new Error("New section identity must match its scope.");
    next.sections.push({ ...properties, entries: [] });
  } else if (kind === "selection") {
    const resume = next.resumes.find((item) => item.id === target)!;
    const selected = z.array(selectionSchema).max(100).parse(values);
    for (const selection of selected) {
      const section = next.sections.find(
        (item) => item.id === selection.sectionId,
      );
      const prior = resume.selection.find(
        (item) => item.sectionId === selection.sectionId,
      );
      if (section?.archived && !selection.hidden && (!prior || prior.hidden))
        throw new Error(
          "Archived sections are unavailable for new selections.",
        );
      if (
        selection.entryIds.some(
          (value) =>
            !selection.hiddenEntryIds?.includes(value) &&
            prior?.hiddenEntryIds?.includes(value) &&
            (section?.archived ||
              section?.entries.some(
                (entry) => entry.id === value && entry.archived,
              )),
        )
      )
        throw new Error("Archived entries are unavailable for new selections.");
      for (const entryId of selection.entryIds)
        if (
          !prior?.entryIds.includes(entryId) &&
          (section?.archived ||
            section?.entries.find((entry) => entry.id === entryId)?.archived)
        )
          throw new Error(
            "Archived content is unavailable for new selections.",
          );
      for (const entry of section?.entries ?? []) {
        if (
          selection.achievementIds.some(
            (value) =>
              !prior?.achievementIds.includes(value) &&
              entry.achievements.some(
                (item) => item.id === value && item.archived,
              ),
          ) ||
          selection.linkIds.some(
            (value) =>
              !prior?.linkIds.includes(value) &&
              entry.links.some((item) => item.id === value && item.archived),
          )
        )
          throw new Error(
            "Archived content is unavailable for new selections.",
          );
      }
    }
    resume.selection = selected;
  } else if (kind === "entry") {
    for (const section of next.sections) {
      const index = section.entries.findIndex((entry) => entry.id === target);
      if (index >= 0) {
        const entry = entrySchema.parse(values);
        const original = section.entries[index];
        if (entry.id !== target)
          throw new Error("Entry identity cannot change.");
        retainIdentities(original.fields, entry.fields);
        retainIdentities(original.achievements, entry.achievements);
        retainIdentities(original.links, entry.links);
        section.entries[index] = entry;
      }
    }
  } else {
    const section = next.sections.find((item) => item.id === target)!;
    if (kind === "entries")
      section.entries = reorderRecords(section.entries, values);
    if (kind === "section") {
      const properties = sectionSchema.omit({ entries: true }).parse(values);
      if (properties.id !== section.id || properties.kind !== section.kind)
        throw new Error("Section identity and kind cannot change.");
      Object.assign(section, properties);
    }
    if (kind === "new-entry") {
      if (baseline !== null) throw new Error("Entry identity already exists.");
      const entry = entrySchema.parse(values);
      if (entry.id !== child)
        throw new Error("New entry identity must match its scope.");
      section.entries.push(entry);
    }
  }
  return validateDocument(next);
}
