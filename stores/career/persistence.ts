import {
  applyScope,
  draftSchema,
  readScope,
  validateDocument,
} from "@/lib/career/model";
import type { CareerDocument, CareerDraft } from "@/types-and-constants/career";

export type CareerHead = {
  key: "guest";
  workspaceId: string;
  revision: number;
  generation: number;
  document: CareerDocument;
};
export type SaveRequest = {
  id: string;
  workspaceId: string;
  generation: number;
  scope: string;
  baseline: unknown;
  values: unknown;
  draftId?: string;
  draftVersion?: number;
  fingerprint: string;
  baselineRevision?: number;
};
type Operation = {
  request: SaveRequest;
  completedAt?: number;
  awaitingAcknowledgment?: boolean;
  result?: Pick<CareerHead, "revision" | "generation">;
};
const STORES = [
  "heads",
  "previous",
  "drafts",
  "operations",
  "preferences",
] as const;

/** Await a request inside its owning transaction.
 * @param request IndexedDB request.
 * @returns Promise resolving to the request result; transaction completion is acknowledged separately.
 * @example await requestResult(store.get("guest"))
 */
function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Compare JSON scope values structurally, keeping array order and ignoring object key order.
 * @param left First scope.
 * @param right Second scope.
 * @returns {boolean} Whether values match; omitted object properties match undefined, while null and array order remain meaningful.
 * @example sameScope({ title: "A" }, { title: "A" })
 */
export function sameScope(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right))
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameScope(value, right[index]))
    );
  if (!left || !right || typeof left !== "object" || typeof right !== "object")
    return false;
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  const keys = Object.keys(a).filter((key) => a[key] !== undefined);
  return (
    keys.length ===
      Object.keys(b).filter((key) => b[key] !== undefined).length &&
    keys.every((key) => Object.hasOwn(b, key) && sameScope(a[key], b[key]))
  );
}

/** Open the target-only local database; never reads or converts legacy browser storage.
 * @returns {Promise<CareerStorage>} Open storage owner; caller must close it on unmount.
 * @example const storage = await openCareerStorage()
 */
export async function openCareerStorage(): Promise<CareerStorage> {
  const request = indexedDB.open("verso-local", 1);
  request.onupgradeneeded = () => {
    for (const name of STORES) request.result.createObjectStore(name);
  };
  return new CareerStorage(await requestResult(request));
}

/** Own transactional committed workspace, recovery, receipts, and previous-workspace storage.
 * @param database Open IndexedDB database.
 * @example const storage = await openCareerStorage(); await storage.load(); storage.close()
 */
export class CareerStorage {
  constructor(private database: IDBDatabase) {
    database.onversionchange = () => database.close();
  }

  /** Release the database connection after the owning view unmounts.
   * @returns {void} No value.
   * @example storage.close()
   */
  close(): void {
    this.database.close();
  }

  /** Execute a strict-durability transaction, acknowledging only complete.
   * @param names Stores affected atomically.
   * @param mode Readonly or readwrite.
   * @param action Request-only async transaction work, without network/hashing/compiler awaits.
   * @returns Promise of action result after transaction completion; rejects on abort without partial writes.
   * @example storage.transaction(["heads"], "readonly", tx => ...)
   */
  private async transaction<T>(
    names: (typeof STORES)[number][],
    mode: IDBTransactionMode,
    action: (transaction: IDBTransaction) => Promise<T>,
  ): Promise<T> {
    let tx: IDBTransaction;
    try {
      tx = this.database.transaction(names, mode, { durability: "strict" });
    } catch {
      tx = this.database.transaction(names, mode);
    }
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(tx.error ?? new Error("Storage transaction aborted."));
      tx.onerror = () => {};
    });
    try {
      const result = await action(tx);
      await done;
      return result;
    } catch (error) {
      try {
        tx.abort();
      } catch {}
      await done.catch(() => {});
      throw error;
    }
  }

  /** Load or atomically initialize clean schema-2 guest content.
   * @param initial Initial content only used when no committed head exists.
   * @returns {Promise<CareerHead>} Durable committed head.
   * @example await storage.load(createCareerDocument())
   */
  async load(initial?: CareerDocument): Promise<CareerHead> {
    return this.transaction(
      ["heads"],
      initial ? "readwrite" : "readonly",
      async (tx) => {
        const store = tx.objectStore("heads");
        const current = await requestResult<CareerHead | undefined>(
          store.get("guest"),
        );
        if (current) {
          validateDocument(current.document);
          return current;
        }
        if (!initial) throw new Error("No saved workspace is available.");
        const head: CareerHead = {
          key: "guest",
          workspaceId: crypto.randomUUID(),
          revision: 0,
          generation: 0,
          document: validateDocument(initial),
        };
        store.put(head, "guest");
        return head;
      },
    );
  }

  /** Persist a bounded recovery version, refusing to replace a newer acknowledged version.
   * @param draft Uncommitted scope/baseline values; malformed field values remain recoverable.
   * @returns {Promise<void>} Resolves only when the recovery transaction completes.
   * @example await storage.writeDraft(draft)
   */
  async writeDraft(draft: CareerDraft): Promise<void> {
    draftSchema.parse(draft);
    if (
      new TextEncoder().encode(JSON.stringify(draft)).byteLength >
      64 * 1024 * 1024
    )
      throw new Error(
        "Recovery exceeds 64 MiB. Keep this tab open and export recovery chunks.",
      );
    await this.transaction(["drafts"], "readwrite", async (tx) => {
      const store = tx.objectStore("drafts");
      const old = await requestResult<CareerDraft | undefined>(
        store.get(draft.draftId),
      );
      if (!old || old.draftVersion <= draft.draftVersion)
        store.put(structuredClone(draft), draft.draftId);
    });
  }

  /** Return unresolved drafts without age/count expiry or destructive cleanup.
   * @returns {Promise<CareerDraft[]>} All durable uncommitted recovery records.
   * @example await storage.drafts()
   */
  async drafts(): Promise<CareerDraft[]> {
    return this.transaction(["drafts"], "readonly", async (tx) =>
      requestResult(tx.objectStore("drafts").getAll()),
    );
  }

  /** Discard only the explicitly resolved recovery version, preserving newer typing.
   * @param id Draft identity.
   * @param version Exact resolved version.
   * @param operationId Interrupted request explicitly resolved with this draft.
   * @returns {Promise<void>} Completed conditional cleanup.
   * @example await storage.discardDraft(draft.draftId, draft.draftVersion)
   */
  async discardDraft(
    id: string,
    version: number,
    operationId?: string,
  ): Promise<void> {
    const key = `resolved-draft/${id}/${version}`;
    const intent = { id, version, operationId };
    await this.transaction(["preferences"], "readwrite", async (tx) => {
      tx.objectStore("preferences").put(intent, key);
    });
    await this.cleanupDraft(key, intent);
  }

  /** Retry durable, explicitly resolved versions; never delete a newer draft.
   * @returns Completion of all pending cleanup attempts; failure retains the intent for next load.
   * @example await storage.retryDraftCleanup()
   */
  async retryDraftCleanup(): Promise<void> {
    const intents = await this.transaction(
      ["preferences"],
      "readonly",
      async (tx) => {
        const store = tx.objectStore("preferences");
        const keys = await requestResult(store.getAllKeys());
        const values = await requestResult(store.getAll());
        return keys.flatMap((key, index) =>
          typeof key === "string" && key.startsWith("resolved-draft/")
            ? [
                {
                  key,
                  value: values[index] as {
                    id: string;
                    version: number;
                    operationId?: string;
                  },
                },
              ]
            : [],
        );
      },
    );
    for (const { key, value } of intents) await this.cleanupDraft(key, value);
  }

  /** Remove an exact resolved version and its durable intent in one transaction.
   * @param key Internal cleanup intent identity.
   * @param intent Explicitly resolved draft identity/version.
   * @returns Completed atomic cleanup, preserving any newer recovery.
   * @example await this.cleanupDraft(key, { id, version })
   */
  private async cleanupDraft(
    key: string,
    intent: { id: string; version: number; operationId?: string },
  ): Promise<void> {
    await this.transaction(
      ["drafts", "preferences", "operations"],
      "readwrite",
      async (tx) => {
        const store = tx.objectStore("drafts");
        const draft = await requestResult<CareerDraft | undefined>(
          store.get(intent.id),
        );
        if (draft?.draftVersion === intent.version) store.delete(intent.id);
        const operationId =
          intent.operationId ??
          (draft?.draftVersion === intent.version
            ? draft.operationId
            : undefined);
        if (operationId) {
          const operations = tx.objectStore("operations");
          const operation = await requestResult<Operation | undefined>(
            operations.get(operationId),
          );
          if (
            operation?.request.draftId === intent.id &&
            operation.request.draftVersion === intent.version
          ) {
            if (operation.result)
              operations.put(
                { ...operation, awaitingAcknowledgment: false },
                operationId,
              );
            else operations.delete(operationId);
          }
        }
        tx.objectStore("preferences").delete(key);
      },
    );
  }

  /** Persist one immutable request before attempting its commit.
   * @param request Validated scope/baseline/payload and stable operation identity.
   * @param fresh True only for a newly allocated operation ID, false for any retry/recovery.
   * @returns {Promise<void>} Durable request confirmation; unknown retries and ID reuse with different bytes throw.
   * @example await storage.prepare(request)
   */
  async prepare(request: SaveRequest, fresh = true): Promise<void> {
    const fingerprint = JSON.stringify([
      request.workspaceId,
      request.generation,
      request.scope,
      request.baseline,
      request.values,
      request.draftId,
      request.draftVersion,
    ]);
    if (fingerprint !== request.fingerprint)
      throw new Error(
        "Save request fingerprint differs from its immutable content.",
      );
    await this.transaction(["operations"], "readwrite", async (tx) => {
      const store = tx.objectStore("operations");
      const old = await requestResult<Operation | undefined>(
        store.get(request.id),
      );
      if (
        old &&
        (old.request.fingerprint !== request.fingerprint ||
          (old.request.baselineRevision !== undefined &&
            old.request.baselineRevision !== request.baselineRevision))
      )
        throw new Error(
          "Operation identity cannot be reused with changed content.",
        );
      if (!old && !fresh)
        throw new Error(
          "Save outcome unknown. Compare current content and reconcile before a new Save.",
        );
      if (!old)
        store.put(
          { request: structuredClone(request) } satisfies Operation,
          request.id,
        );
    });
  }

  /** Atomically recheck generation and scope, commit a Save, receipt, and exact recovery cleanup.
   * @param operationId Previously prepared stable operation ID.
   * @returns {Promise<CareerHead>} Prior receipt or newly acknowledged head; missing history is unknown and never replayed.
   * @example await storage.commit(operationId)
   */
  async commit(operationId: string): Promise<CareerHead> {
    return this.transaction(
      ["heads", "operations", "drafts"],
      "readwrite",
      async (tx) => {
        const operations = tx.objectStore("operations");
        const operation = await requestResult<Operation | undefined>(
          operations.get(operationId),
        );
        if (!operation)
          throw new Error(
            "Save outcome unknown. Compare current content and reconcile before a new Save.",
          );
        const request = operation.request;
        const heads = tx.objectStore("heads");
        const head = await requestResult<CareerHead>(heads.get("guest"));
        if (
          head.workspaceId !== request.workspaceId ||
          head.generation !== request.generation
        )
          throw new Error(
            "Workspace was replaced. Compare or restore this draft as new.",
          );
        if (operation.result) {
          if (request.draftId) {
            const drafts = tx.objectStore("drafts");
            const draft = await requestResult<CareerDraft | undefined>(
              drafts.get(request.draftId),
            );
            if (draft?.draftVersion === request.draftVersion)
              drafts.delete(request.draftId);
          }
          return head;
        }
        if (
          !sameScope(readScope(head.document, request.scope), request.baseline)
        )
          throw new Error(
            "This scope changed in another save. Compare and reconcile; your draft is retained.",
          );
        const document = applyScope(
          head.document,
          request.scope,
          request.values,
        );
        const next = { ...head, revision: head.revision + 1, document };
        heads.put(next, "guest");
        operations.put(
          {
            ...operation,
            completedAt: Date.now(),
            awaitingAcknowledgment: true,
            result: { revision: next.revision, generation: next.generation },
          },
          operationId,
        );
        if (request.draftId) {
          const drafts = tx.objectStore("drafts");
          const draft = await requestResult<CareerDraft | undefined>(
            drafts.get(request.draftId),
          );
          if (draft?.draftVersion === request.draftVersion)
            drafts.delete(request.draftId);
        }
        return next;
      },
    );
  }

  /** Mark a received commit outcome eligible for bounded receipt retention.
   * @param operationId Confirmed immutable Save/Undo/Redo operation.
   * @returns Completed acknowledgment; failure leaves the receipt protected.
   * @example await storage.acknowledge(request.id)
   */
  async acknowledge(operationId: string): Promise<void> {
    await this.transaction(["operations"], "readwrite", async (tx) => {
      const store = tx.objectStore("operations");
      const operation = await requestResult<Operation | undefined>(
        store.get(operationId),
      );
      if (operation?.result)
        store.put({ ...operation, awaitingAcknowledgment: false }, operationId);
    });
  }

  /** Discover interrupted completed Saves whose exact draft cleanup already committed.
   * @returns Recoverable requests for explicit comparison/retry, never automatic replay.
   * @example const interrupted = await storage.uncertainDrafts()
   */
  async uncertainDrafts(): Promise<CareerDraft[]> {
    return this.transaction(["operations", "heads"], "readonly", async (tx) => {
      const operations = await requestResult<Operation[]>(
        tx.objectStore("operations").getAll(),
      );
      const head = await requestResult<CareerHead | undefined>(
        tx.objectStore("heads").get("guest"),
      );
      return operations
        .filter(
          (op) =>
            op.awaitingAcknowledgment &&
            op.request.draftId &&
            op.request.draftVersion,
        )
        .map(({ request }) => ({
          draftId: request.draftId!,
          draftVersion: request.draftVersion!,
          workspaceId: request.workspaceId,
          generation: request.generation,
          baselineRevision: request.baselineRevision ?? head?.revision ?? 0,
          scope: request.scope,
          baseline: request.baseline,
          values: request.values,
          operationId: request.id,
          fingerprint: request.fingerprint,
        }));
    });
  }

  /** Replace or roll back only the destination revision reviewed by the user, rotating one previous workspace atomically.
   * @param reviewed Destination head that was reviewed.
   * @param incoming Validated incoming document, or undefined to use the previous workspace.
   * @returns {Promise<CareerHead>} Newly committed generation; failure changes neither head nor previous workspace.
   * @example await storage.replace(reviewed, incoming)
   */
  async replace(
    reviewed: CareerHead,
    incoming?: CareerDocument,
  ): Promise<CareerHead> {
    if (incoming) validateDocument(incoming);
    return this.transaction(["heads", "previous"], "readwrite", async (tx) => {
      const heads = tx.objectStore("heads");
      const previous = tx.objectStore("previous");
      const current = await requestResult<CareerHead>(heads.get("guest"));
      if (
        current.workspaceId !== reviewed.workspaceId ||
        current.generation !== reviewed.generation ||
        current.revision !== reviewed.revision
      )
        throw new Error(
          "Workspace changed since review. Review the current workspace again.",
        );
      const prior = incoming
        ? undefined
        : await requestResult<CareerHead | undefined>(previous.get("guest"));
      const document = validateDocument(incoming ?? prior?.document);
      const next = {
        ...current,
        revision: current.revision + 1,
        generation: current.generation + 1,
        document,
      };
      previous.put(current, "guest");
      heads.put(next, "guest");
      return next;
    });
  }

  /** Inspect the durable snapshot before replacement or export.
   * @returns {Promise<CareerHead | undefined>} One previous committed workspace, if present.
   * @example await storage.previous()
   */
  async previous(): Promise<CareerHead | undefined> {
    return this.transaction(["previous"], "readonly", async (tx) =>
      requestResult(tx.objectStore("previous").get("guest")),
    );
  }

  /** Prune eligible completed receipts without touching pending requests or unresolved drafts.
   * @param days Completed-record retention in days, default 30.
   * @param count Maximum completed records, default 1,000.
   * @returns {Promise<void>} Completed cleanup; protected operations remain regardless of age/count.
   * @example await storage.pruneCompleted()
   */
  async pruneCompleted(days = 30, count = 1000): Promise<void> {
    await this.transaction(
      ["operations", "drafts"],
      "readwrite",
      async (tx) => {
        const drafts = await requestResult<CareerDraft[]>(
          tx.objectStore("drafts").getAll(),
        );
        const protectedIds = new Set(
          drafts.map((draft) => draft.operationId).filter(Boolean),
        );
        const operations = tx.objectStore("operations");
        const all = await requestResult<Operation[]>(operations.getAll());
        const eligible = all
          .filter(
            (item) =>
              item.completedAt &&
              !item.awaitingAcknowledgment &&
              !protectedIds.has(item.request.id),
          )
          .sort((a, b) => b.completedAt! - a.completedAt!);
        eligible.forEach((item, index) => {
          if (
            index >= count ||
            item.completedAt! < Date.now() - days * 86_400_000
          )
            operations.delete(item.request.id);
        });
      },
    );
  }
}
