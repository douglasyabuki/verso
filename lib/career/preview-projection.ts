import type { PreviewResumeScope } from "@/lib/career/model";
import type { RichText } from "@/lib/career/wording";
import type {
  CareerDocument,
  CareerDraft,
  CareerEntry,
  CareerResume,
  CareerSection,
} from "@/types-and-constants/career";

type WordingKind = "rich" | "plain";

const encoder = new TextEncoder();
const committed = new WeakMap<
  CareerDocument,
  { resume: CareerResume; pieces: Map<string, string> }
>();
const metadata = new WeakMap<
  CareerDocument,
  {
    bytes: number;
    targets: Map<string, WordingKind>;
    sections: Map<
      string,
      { section: CareerSection; entries: Map<string, CareerEntry> }
    >;
  }
>();

/** Recognize active resume form scopes (including retained selection recovery).
 * @param draft Current independent form draft.
 * @param resumeId Previewed resume.
 * @returns The supported scope, or null for other forms.
 * @example resumePreviewScope(draft, resume.id)
 */
export function resumePreviewScope(
  draft: CareerDraft | null,
  resumeId: string,
): PreviewResumeScope | null {
  const [scope, id] = draft?.scope.split("/") ?? [];
  if (id !== resumeId) return null;
  if (scope === "selection") return "resume-content";
  if (
    scope === "resume-content" ||
    scope === "resume-layout" ||
    scope === "resume-wording"
  )
    return scope;
  return null;
}

/** Yield before further projection work if this batch used its time slice.
 * @param current Reports whether the version still owns the request.
 * @returns Cooperative checkpoint that throws on supersession.
 * @example const checkpoint = previewCheckpoint(isCurrent); await checkpoint()
 */
export function previewCheckpoint(current: () => boolean) {
  let start = performance.now();
  return async () => {
    if (performance.now() - start > 5) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      start = performance.now();
    }
    if (!current()) throw new DOMException("Preview superseded", "AbortError");
  };
}

/** Count the UTF-8 size of a serialized value.
 * @param value JSON data.
 * @returns Number of serialized bytes.
 * @example jsonBytes({ name: "Miguel" })
 */
function jsonBytes(value: unknown) {
  return encoder.encode(JSON.stringify(value)).byteLength;
}

/** Index only identities and byte counts across the committed head.
 * @param document Committed workspace, kept on the calling thread.
 * @param checkpoint Cooperative yield and version check.
 * @returns Cached byte size and record lookups.
 * @example await indexHead(document, checkpoint)
 */
async function indexHead(
  document: CareerDocument,
  checkpoint: () => Promise<void>,
) {
  const cached = metadata.get(document);
  if (cached) return cached;
  const { sections, resumes, starters, presets, ...header } = document;
  let bytes = jsonBytes({
    ...header,
    sections: [],
    resumes: [],
    starters: [],
    presets: [],
  });
  const targets = new Map<string, WordingKind>([[document.summary.id, "rich"]]);
  const sectionIndex = new Map<
    string,
    { section: CareerSection; entries: Map<string, CareerEntry> }
  >();
  const indexFields = (record: Pick<CareerEntry, "fields" | "links">) => {
    for (const field of record.fields)
      if (field.type === "text") targets.set(field.id, "plain");
    for (const link of record.links) targets.set(link.id, "plain");
  };
  indexFields(document.profile);
  for (const { entries, ...section } of sections) {
    bytes +=
      jsonBytes({ ...section, entries: [] }) + Math.max(0, entries.length - 1);
    targets.set(section.id, "plain");
    const entryIndex = new Map<string, CareerEntry>();
    sectionIndex.set(section.id, {
      section: document.sections[sectionIndex.size],
      entries: entryIndex,
    });
    for (const entry of entries) {
      entryIndex.set(entry.id, entry);
      indexFields(entry);
      for (const achievement of entry.achievements)
        targets.set(achievement.id, "rich");
      bytes += jsonBytes(entry);
      await checkpoint();
    }
    await checkpoint();
  }
  bytes += Math.max(0, sections.length - 1);
  for (const records of [resumes, starters, presets]) {
    bytes += Math.max(0, records.length - 1);
    for (const record of records) {
      bytes += jsonBytes(record);
      await checkpoint();
    }
  }
  const index = { bytes, targets, sections: sectionIndex };
  metadata.set(document, index);
  return index;
}

/** Build independently replaceable pieces of the active resume projection.
 * @param document Committed workspace.
 * @param resume Active committed resume.
 * @param draft Form version included in a draft request, if any.
 * @param scope Supported draft scope.
 * @param checkpoint Cooperative yield and version check.
 * @returns Serialized pieces for transfer and comparison, limited to one resume.
 * @example await projectPreview(document, resume, null, null, checkpoint)
 */
export async function projectPreview(
  document: CareerDocument,
  resume: CareerResume,
  draft: CareerDraft | null,
  scope: PreviewResumeScope | null,
  checkpoint: () => Promise<void>,
) {
  const index = await indexHead(document, checkpoint);
  const cached = committed.get(document);
  const basePieces = cached?.resume === resume ? cached.pieces : null;
  if (!draft && basePieces) return basePieces;
  if (!basePieces && draft)
    await projectPreview(document, resume, null, null, checkpoint);
  const currentBase = committed.get(document);
  const cachedBase = currentBase?.resume === resume ? currentBase.pieces : null;
  const pieces = new Map(cachedBase ?? []);
  const put = (key: string, value: unknown) => {
    if (value !== undefined) pieces.set(key, JSON.stringify(value));
  };
  const locale = resume.language;
  const wording = (values: Record<string, RichText>) =>
    Object.hasOwn(values, locale) ? { [locale]: values[locale] } : {};
  const field = <T extends CareerEntry["fields"][number]>(value: T) => ({
    ...value,
    wording: wording(value.wording),
  });
  const link = <T extends CareerEntry["links"][number]>(value: T) => ({
    ...value,
    label: wording(value.label),
  });
  if (!cachedBase) {
    put("profile", {
      id: document.profile.id,
      fields: document.profile.fields.map(field),
      links: document.profile.links.map(link),
    });
    put("summary", {
      id: document.summary.id,
      wording: wording(document.summary.wording),
    });
    put("outsideBytes", index.bytes - jsonBytes(resume));
    const { overrides, ...base } = resume;
    for (const [key, value] of Object.entries(base))
      put("resume/" + key, value);
    for (const [id, value] of Object.entries(overrides)) {
      put("override/" + id, value);
      await checkpoint();
    }
    for (const [id, kind] of index.targets) {
      put("target/" + id, kind);
      await checkpoint();
    }
  }
  const values = draft?.scope.startsWith("selection/")
    ? {
        selection: draft.values,
        profileSelection: resume.profileSelection,
        summaryIncluded: resume.summaryIncluded,
      }
    : draft?.values;
  const selection = new Map<string, Set<string>>();
  const include = (value: unknown) => {
    if (!Array.isArray(value)) return;
    for (const item of value) {
      if (!item || typeof item.sectionId !== "string") continue;
      const ids = selection.get(item.sectionId) ?? new Set<string>();
      selection.set(item.sectionId, ids);
      if (Array.isArray(item.entryIds))
        for (const id of item.entryIds) if (typeof id === "string") ids.add(id);
    }
  };
  if (!cachedBase) include(resume.selection);
  if (scope === "resume-content")
    include((values as { selection?: unknown } | null)?.selection);
  for (const [id, ids] of selection) {
    const record = index.sections.get(id);
    if (!record) continue;
    const { entries: _, ...section } = record.section;
    void _;
    put("section/" + id, { ...section, heading: wording(section.heading) });
    for (const entryId of ids) {
      const entry = record.entries.get(entryId);
      if (!entry) continue;
      if (pieces.has("entry/" + entryId)) continue;
      put("entry/" + entryId, [
        id,
        {
          ...entry,
          fields: entry.fields.map(field),
          links: entry.links.map(link),
          achievements: entry.achievements.map((item) => ({
            ...item,
            wording: wording(item.wording),
          })),
        },
      ]);
      await checkpoint();
    }
  }
  if (scope) {
    const keyed =
      values && typeof values === "object" && !Array.isArray(values);
    put("draftShape", keyed ? "record" : "raw");
    if (keyed) {
      for (const [key, value] of Object.entries(values)) {
        put("draft/" + key, value);
        await checkpoint();
      }
    } else put("draftValue", values);
  }
  if (!draft) committed.set(document, { resume, pieces });
  return pieces;
}
