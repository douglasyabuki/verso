import type { CareerDraft } from "@/types-and-constants/career";
import { RECOVERY_BYTES, WORKSPACE_BYTES } from "@/types-and-constants/career";

type RecoveryExportLimits = { fileBytes: number; draftBytes: number };
const defaults: RecoveryExportLimits = {
  fileBytes: RECOVERY_BYTES,
  draftBytes: WORKSPACE_BYTES,
};
const bytes = (value: string) => new TextEncoder().encode(value).byteLength;

/** Identify drafts that cannot be imported as normal bounded recovery records.
 * @param drafts Captured unresolved draft versions.
 * @param ceiling Maximum serialized draft bytes, normally 64 MiB.
 * @returns IDs requiring explicit raw-chunk export instead of a durable-recovery claim.
 * @example oversizedRecovery(drafts)
 */
export function oversizedRecovery(
  drafts: CareerDraft[],
  ceiling = WORKSPACE_BYTES,
): string[] {
  return drafts
    .filter((draft) => bytes(JSON.stringify(draft)) > ceiling)
    .map((draft) => draft.draftId);
}

/** Produce bounded independent recovery files and a versioned inventory without removing drafts.
 * @param drafts Captured unresolved draft versions; callers obtain explicit raw-chunk choice first.
 * @param sourceWorkspaceId Original workspace lineage.
 * @param limits Byte ceilings, overridable only for boundary tests.
 * @returns Files yielded one at a time; the final manifest lists every included ID/version and file.
 * @example for (const file of recoveryFiles(drafts, workspaceId)) download(file.content, file.name)
 */
export function* recoveryFiles(
  drafts: CareerDraft[],
  sourceWorkspaceId: string,
  limits = defaults,
): Generator<{ name: string; content: string }> {
  const exportedAt = new Date().toISOString();
  const envelope = {
    format: "verso.recovery",
    schemaVersion: 1,
    exportedAt,
    sourceWorkspaceId,
  };
  const inventory: {
    name: string;
    drafts: { draftId: string; draftVersion: number }[];
    raw?: boolean;
  }[] = [];
  let batch: CareerDraft[] = [];
  let sequence = 0;
  const pack = (values: CareerDraft[]) =>
    JSON.stringify({ ...envelope, drafts: values });
  const emptyBytes = bytes(pack([]));
  let batchBytes = emptyBytes;
  function file(values: CareerDraft[]) {
    const name = `verso-recovery-${++sequence}.json`;
    inventory.push({
      name,
      drafts: values.map(({ draftId, draftVersion }) => ({
        draftId,
        draftVersion,
      })),
    });
    return { name, content: pack(values) };
  }
  for (const draft of drafts) {
    const raw = JSON.stringify(draft);
    const draftBytes = bytes(raw);
    if (
      draftBytes > limits.draftBytes ||
      emptyBytes + draftBytes > limits.fileBytes
    ) {
      if (batch.length) {
        yield file(batch);
        batch = [];
        batchBytes = emptyBytes;
      }
      // Six bytes per UTF-16 unit bounds JSON escaping, including control characters.
      const size = Math.min(
        1024 * 1024,
        Math.floor((limits.fileBytes - 512) / 6),
      );
      if (size < 1)
        throw new Error(
          "Recovery file ceiling is too small for chunk metadata.",
        );
      const chunks = Math.ceil(raw.length / size);
      for (let index = 0; index < chunks; index++) {
        const name = `verso-recovery-raw-${draft.draftId}-${index + 1}.json`;
        const content = JSON.stringify({
          format: "verso.recovery.raw",
          schemaVersion: 1,
          sourceWorkspaceId,
          draftId: draft.draftId,
          draftVersion: draft.draftVersion,
          index,
          chunks,
          encoding: "json-text-fragment",
          data: raw.slice(index * size, (index + 1) * size),
        });
        if (bytes(content) > limits.fileBytes)
          throw new Error("Recovery chunk exceeds its byte ceiling.");
        inventory.push({
          name,
          drafts: [
            { draftId: draft.draftId, draftVersion: draft.draftVersion },
          ],
          raw: true,
        });
        yield { name, content };
      }
    } else {
      if (batch.length && batchBytes + 1 + draftBytes > limits.fileBytes) {
        yield file(batch);
        batch = [];
        batchBytes = emptyBytes;
      }
      batchBytes += draftBytes + (batch.length ? 1 : 0);
      batch.push(draft);
    }
  }
  if (batch.length || !drafts.length) yield file(batch);
  // Bound manifest pages too; each page is independently versioned and identifies its siblings.
  const pages: (typeof inventory)[] = [];
  let page: typeof inventory = [];
  const manifest = (files: typeof inventory, index: number, count: number) =>
    JSON.stringify({
      format: "verso.recovery.manifest",
      schemaVersion: 1,
      sourceWorkspaceId,
      page: index,
      pages: count,
      files,
    });
  // A single recovery file can contain enough small drafts that its inventory
  // needs several pages. Repeat its filename with disjoint draft lists.
  const entries = inventory.flatMap((item) =>
    item.drafts.length
      ? item.drafts.map((draft) => ({ ...item, drafts: [draft] }))
      : [item],
  );
  for (const item of entries) {
    if (
      page.length &&
      bytes(manifest(page.concat(item), entries.length, entries.length)) >
        limits.fileBytes
    ) {
      pages.push(page);
      page = [];
    }
    if (
      bytes(manifest([item], entries.length, entries.length)) > limits.fileBytes
    )
      throw new Error("Recovery manifest metadata exceeds its byte ceiling.");
    page.push(item);
  }
  if (page.length) pages.push(page);
  for (let index = 0; index < pages.length; index++) {
    const content = manifest(pages[index], index + 1, pages.length);
    if (bytes(content) > limits.fileBytes)
      throw new Error("Recovery manifest exceeds its byte ceiling.");
    yield { name: `verso-recovery-manifest-${index + 1}.json`, content };
  }
}
