import {
  commitScopeRequest,
  type CommittedHead,
  replaceHead,
  resetHead,
  scopeFingerprint,
  type ScopeRequest,
} from "@/lib/career/commit";
import {
  createCareerDocument,
  draftSchema,
  validateDocument,
} from "@/lib/career/model";
import { matchesDraftVersion } from "@/lib/career/recovery";
import type {
  CareerBackend,
  WorkspaceIdentity,
  WorkspaceResetMarker,
  WorkspaceResetOutcome,
} from "@/stores/career/backend";
import {
  type CareerDocument,
  type CareerDraft,
  DRAFT_BYTES,
  mib,
} from "@/types-and-constants/career";
import type { SaveFailureReason } from "@/types-and-constants/career-status";

/** Typed storage failure so callers never classify errors by message text.
 * @example throw new CareerStorageError("conflict", "This scope changed in another save.")
 */
export class CareerStorageError extends Error {
  constructor(
    readonly code: SaveFailureReason,
    message: string,
  ) {
    super(message);
    this.name = "Error";
  }
}

/** Classify any Save/replacement failure without inspecting message text.
 * IndexedDB/DOM exceptions (abort, quota, closed database) are storage failures.
 * @param error Unknown thrown value.
 * @returns Failure reason; other errors are request/validation failures.
 * @example saveFailureReason(new DOMException("full", "QuotaExceededError")) // "storage"
 */
export function saveFailureReason(error: unknown): SaveFailureReason {
  if (error instanceof CareerStorageError) return error.code;
  if (typeof DOMException !== "undefined" && error instanceof DOMException)
    return "storage";
  return "invalid";
}

export { sameScope } from "@/lib/career/commit";

/** Committed head; `key` is present only on guest IndexedDB records. */
export type CareerHead = CommittedHead & { key?: "guest" };

export type SaveRequest = ScopeRequest;

type Operation = {
  request: SaveRequest;
  completedAt?: number;
  awaitingAcknowledgment?: boolean;
  result?: Pick<CareerHead, "revision" | "generation">;
};
type ResolvedDraft = { id: string; version: number; operationId?: string };

/** Preferences-store key prefixes owned by workspace data (device settings use other keys). */
const RESOLVED_PREFIX = "resolved-draft/";
const RESET_PREFIX = "workspace-reset/";

/** Error for a write prepared against a workspace whose data was deleted.
 * @returns {CareerStorageError} Typed `replaced` rejection.
 * @example throw deletedWorkspace()
 */
const deletedWorkspace = () =>
  new CareerStorageError(
    "replaced",
    "This workspace's data was deleted. The change was not stored; this tab now uses the fresh workspace.",
  );

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

/** Delete one deleted account's local recovery database after the server confirmed deletion.
 * Never touches the guest workspace or other accounts' databases.
 * @param userId Deleted account owner.
 * @param waitMs How long to wait while another open tab blocks deletion.
 * @returns {Promise<"deleted" | "blocked" | "failed">} `blocked` when another tab still holds the database open after `waitMs` (the browser finishes deletion once it closes); `failed` on an IndexedDB error.
 * @example await deleteAccountStorage(user.id)
 */
export function deleteAccountStorage(
  userId: string,
  waitMs = 3_000,
): Promise<"deleted" | "blocked" | "failed"> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.deleteDatabase(`verso-account-${userId}`);
    } catch {
      resolve("failed");
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    request.onsuccess = () => {
      clearTimeout(timer);
      resolve("deleted");
    };
    request.onerror = () => {
      clearTimeout(timer);
      resolve("failed");
    };
    request.onblocked = () => {
      timer ??= setTimeout(() => resolve("blocked"), waitMs);
    };
  });
}

/** Open the target-only local database; never reads or converts legacy browser storage.
 * @param name Database name: `verso-local` for guests and device preferences, or an
 * account-isolated `verso-account-<userId>` database for account recovery.
 * @returns {Promise<CareerStorage>} Open storage owner; caller must close it on unmount.
 * @example const storage = await openCareerStorage()
 */
export async function openCareerStorage(
  name = "verso-local",
): Promise<CareerStorage> {
  const request = indexedDB.open(name, 1);
  request.onupgradeneeded = () => {
    for (const store of STORES) request.result.createObjectStore(store);
  };
  return new CareerStorage(await requestResult(request), name);
}

/** Own transactional committed workspace, recovery, receipts, and previous-workspace storage.
 * @param database Open IndexedDB database.
 * @example const storage = await openCareerStorage(); await storage.load(); storage.close()
 */
export class CareerStorage implements CareerBackend {
  readonly kind = "guest";

  readonly channelName: string;

  /** Key of this database's head record: the committed guest head, or the
   * last acknowledged account head cached in an account-isolated database. */
  private readonly headKey: "guest" | "account";

  constructor(
    private database: IDBDatabase,
    name = "verso-local",
  ) {
    this.channelName = name;
    this.headKey = name === "verso-local" ? "guest" : "account";
    database.onversionchange = () => database.close();
  }

  /** Read the cached account head without any network request.
   * @returns Last acknowledged/loaded server head, or undefined when none was cached.
   * @example await local.cachedAccountHead()
   */
  async cachedAccountHead(): Promise<CareerHead | undefined> {
    if (this.headKey !== "account") return undefined;
    const head = await this.transaction(["heads"], "readonly", (tx) =>
      requestResult<CareerHead | undefined>(
        tx.objectStore("heads").get("account"),
      ),
    );
    if (!head) return undefined;
    validateDocument(head.document);
    return head;
  }

  /** Cache a server-acknowledged account head for other tabs and offline start.
   * Never replaces a newer cached generation/revision written by another tab.
   * @param head Server-confirmed committed head.
   * @returns Completion; the cache is a hint and never proves a commit.
   * @example await local.cacheAccountHead(head)
   */
  async cacheAccountHead(head: CommittedHead): Promise<void> {
    if (this.headKey !== "account") return;
    await this.transaction(
      ["heads", "drafts", "operations", "preferences"],
      "readwrite",
      async (tx) => {
        const store = tx.objectStore("heads");
        const current = await requestResult<CareerHead | undefined>(
          store.get("account"),
        );
        // Generation is monotonic across deletion, so a late response for a deleted
        // workspace can never replace the fresh workspace's cached head.
        if (
          current &&
          (current.generation > head.generation ||
            (current.workspaceId === head.workspaceId &&
              current.generation === head.generation &&
              current.revision > head.revision))
        )
          return;
        // Only deletion changes an account's workspace ID. Every record written
        // while this browser was bound to the cached workspace belongs to deleted
        // data; removing it with the head install keeps any later retry a no-op.
        if (current && current.workspaceId !== head.workspaceId)
          await this.removeWorkspaceRecords(tx);
        store.put(
          {
            workspaceId: head.workspaceId,
            revision: head.revision,
            generation: head.generation,
            document: head.document,
          },
          "account",
        );
      },
    );
  }

  /** Remove recovery, prepared requests, and cleanup intents inside a head-install transaction.
   * Deletion markers stay so each attempt is resolved by its own receipt lookup.
   * @param tx Transaction over drafts, operations, and preferences.
   * @param workspaceId Remove only records naming this workspace; omitted removes every record bound to the replaced head.
   * @returns Completion of the queued deletes.
   * @example await this.removeWorkspaceRecords(tx, deletedId)
   */
  private async removeWorkspaceRecords(
    tx: IDBTransaction,
    workspaceId?: string,
  ): Promise<void> {
    const drafts = tx.objectStore("drafts");
    const operations = tx.objectStore("operations");
    if (workspaceId === undefined) {
      drafts.clear();
      operations.clear();
      const preferences = tx.objectStore("preferences");
      const keys = await requestResult(preferences.getAllKeys());
      for (const key of keys)
        if (typeof key === "string" && key.startsWith(RESOLVED_PREFIX))
          preferences.delete(key);
      return;
    }
    for (const draft of await requestResult<CareerDraft[]>(drafts.getAll()))
      if (draft.workspaceId === workspaceId) drafts.delete(draft.draftId);
    for (const operation of await requestResult<Operation[]>(
      operations.getAll(),
    ))
      if (operation.request.workspaceId === workspaceId)
        operations.delete(operation.request.id);
  }

  /** Reject a write whose writer observed a workspace other than the stored one.
   * @param tx Transaction including heads.
   * @param workspaceId Workspace the writer observed; undefined skips the fence.
   * @returns Completion; throws `replaced` after that workspace's data was deleted.
   * @example await this.assertWorkspace(tx, head.workspaceId)
   */
  private async assertWorkspace(
    tx: IDBTransaction,
    workspaceId: string | undefined,
  ): Promise<void> {
    if (workspaceId === undefined) return;
    const head = await requestResult<CareerHead | undefined>(
      tx.objectStore("heads").get(this.headKey),
    );
    if (head && head.workspaceId !== workspaceId) throw deletedWorkspace();
  }

  /** Durably record one account deletion attempt before it is sent.
   * @param marker Stable operation ID, reviewed identity, and request hash.
   * @returns Completion; throws `replaced` when this browser already uses another workspace, or a storage error (then nothing may be sent).
   * @example await local.writeResetMarker(marker)
   */
  async writeResetMarker(marker: WorkspaceResetMarker): Promise<void> {
    await this.transaction(
      ["heads", "preferences"],
      "readwrite",
      async (tx) => {
        await this.assertWorkspace(tx, marker.reviewed.workspaceId);
        tx.objectStore("preferences").put(
          structuredClone(marker),
          `${RESET_PREFIX}${marker.operationId}`,
        );
      },
    );
  }

  /** List unresolved account deletion attempts.
   * @returns {Promise<WorkspaceResetMarker[]>} Markers in creation order.
   * @example await local.resetMarkers()
   */
  async resetMarkers(): Promise<WorkspaceResetMarker[]> {
    return this.transaction(["preferences"], "readonly", async (tx) => {
      const store = tx.objectStore("preferences");
      const keys = await requestResult(store.getAllKeys());
      const values = await requestResult(store.getAll());
      return keys
        .flatMap((key, index) =>
          typeof key === "string" && key.startsWith(RESET_PREFIX)
            ? [values[index] as WorkspaceResetMarker]
            : [],
        )
        .sort((a, b) => a.createdAt - b.createdAt);
    });
  }

  /** Remove one resolved deletion attempt's marker; other attempts are untouched.
   * @param operationId Resolved attempt.
   * @returns Completion.
   * @example await local.removeResetMarker(id)
   */
  async removeResetMarker(operationId: string): Promise<void> {
    await this.transaction(["preferences"], "readwrite", async (tx) => {
      tx.objectStore("preferences").delete(`${RESET_PREFIX}${operationId}`);
    });
  }

  /** Finish one server-confirmed account deletion in this browser in a single transaction.
   * Old-workspace records are removed only together with installing the fresh head, so a
   * delayed retry after newer work exists removes nothing but its own marker.
   * @param operationId Deletion attempt whose marker is resolved.
   * @param deletedId Workspace ID the server deleted.
   * @param head Fresh server head.
   * @returns Completion; failure leaves everything unchanged for a retry.
   * @example await local.completeWorkspaceReset(id, deletedId, head)
   */
  async completeWorkspaceReset(
    operationId: string,
    deletedId: string,
    head: CommittedHead,
  ): Promise<void> {
    await this.transaction(
      ["heads", "drafts", "operations", "preferences"],
      "readwrite",
      async (tx) => {
        const heads = tx.objectStore("heads");
        const current = await requestResult<CareerHead | undefined>(
          heads.get(this.headKey),
        );
        const install = () =>
          heads.put(
            {
              workspaceId: head.workspaceId,
              revision: head.revision,
              generation: head.generation,
              document: head.document,
            },
            this.headKey,
          );
        if (!current) {
          // Without a cached head, writes were unfenced: remove only records that
          // name the deleted workspace and keep everything else.
          await this.removeWorkspaceRecords(tx, deletedId);
          install();
        } else if (
          current.workspaceId !== head.workspaceId &&
          current.generation < head.generation
        ) {
          await this.removeWorkspaceRecords(tx);
          install();
        }
        // Otherwise this head or a newer one is already installed. That install
        // removed the deleted workspace's records, and newer work stays.
        tx.objectStore("preferences").delete(`${RESET_PREFIX}${operationId}`);
      },
    );
  }

  /** Permanently delete the reviewed guest workspace's data and adopt a fresh workspace atomically.
   * One transaction rechecks the reviewed identity and revision, clears the previous workspace,
   * drafts, receipts, and cleanup intents, and installs a fresh schema-2 head with a new
   * workspace ID. Device preferences stay.
   * @param reviewed Identity and revision the user confirmed deleting.
   * @returns {Promise<WorkspaceResetOutcome>} The fresh head; throws `conflict` without writes when the workspace changed since review.
   * @example await storage.resetWorkspace(reviewed)
   */
  async resetWorkspace(
    reviewed: WorkspaceIdentity,
  ): Promise<WorkspaceResetOutcome> {
    if (this.headKey !== "guest")
      throw new CareerStorageError(
        "invalid",
        "Account workspace data is deleted through the account.",
      );
    const document = validateDocument(createCareerDocument());
    const head = await this.transaction(
      [...STORES],
      "readwrite",
      async (tx) => {
        const heads = tx.objectStore("heads");
        const current = await requestResult<CareerHead | undefined>(
          heads.get("guest"),
        );
        if (!current)
          throw new CareerStorageError(
            "conflict",
            "Workspace changed since you reviewed it. Review it again.",
          );
        const decision = resetHead(
          current,
          reviewed,
          document,
          crypto.randomUUID(),
        );
        if (!decision.ok)
          throw new CareerStorageError(decision.reason, decision.message);
        tx.objectStore("previous").clear();
        await this.removeWorkspaceRecords(tx);
        const next: CareerHead = { ...decision.head, key: "guest" };
        heads.put(next, "guest");
        return next;
      },
    );
    return { status: "deleted", by: "this-request", head, cleanup: "complete" };
  }

  /** Read browser preferences independently of workspace/recovery data.
   * @returns Stored versioned record or undefined. @example await storage.readDevicePreferences()
   */
  async readDevicePreferences(): Promise<unknown> {
    return this.transaction(["preferences"], "readonly", (tx) =>
      requestResult(tx.objectStore("preferences").get("device-settings-v1")),
    );
  }

  /** Persist browser preferences with transaction-completion acknowledgment.
   * @param values Validated preference record. @returns Completion or storage failure.
   * @example await storage.writeDevicePreferences({ version: 1, values })
   */
  async writeDevicePreferences(values: unknown): Promise<void> {
    await this.transaction(["preferences"], "readwrite", async (tx) => {
      await requestResult(
        tx.objectStore("preferences").put(values, "device-settings-v1"),
      );
    });
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
   * @param workspaceId Workspace the writer observed when it captured the draft. A write
   * from a tab that has not adopted a fresh workspace yet is rejected as `replaced`.
   * @returns {Promise<void>} Resolves only when the recovery transaction completes.
   * @example await storage.writeDraft(draft, head.workspaceId)
   */
  async writeDraft(draft: CareerDraft, workspaceId?: string): Promise<void> {
    draftSchema.parse(draft);
    if (
      new TextEncoder().encode(JSON.stringify(draft)).byteLength > DRAFT_BYTES
    )
      throw new CareerStorageError(
        "storage",
        `Recovery exceeds ${mib(DRAFT_BYTES)}. Keep this tab open and export recovery chunks.`,
      );
    await this.transaction(["drafts", "heads"], "readwrite", async (tx) => {
      await this.assertWorkspace(tx, workspaceId);
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
    return this.transaction(
      ["drafts", "preferences"],
      "readonly",
      async (tx) => {
        const drafts = await requestResult<CareerDraft[]>(
          tx.objectStore("drafts").getAll(),
        );
        const versions = await this.resolvedDrafts(tx);
        return drafts.filter(
          (draft) => (versions.get(draft.draftId) ?? -1) < draft.draftVersion,
        );
      },
    );
  }

  /** Read resolved versions in the same transaction as recovery discovery.
   * @param tx Transaction including preferences.
   * @returns Maximum explicitly resolved version per draft.
   * @example await this.resolvedDrafts(tx)
   */
  private async resolvedDrafts(tx: IDBTransaction) {
    const store = tx.objectStore("preferences");
    const keys = await requestResult(store.getAllKeys());
    const values = await requestResult(store.getAll());
    const versions = new Map<string, number>();
    for (const [i, key] of keys.entries()) {
      if (typeof key !== "string" || !key.startsWith(RESOLVED_PREFIX)) continue;
      const { id, version } = values[i] as ResolvedDraft;
      versions.set(id, Math.max(version, versions.get(id) ?? -1));
    }
    return versions;
  }

  /** Discard the explicitly resolved recovery version and older stored versions of it, preserving newer typing.
   * @param id Draft identity.
   * @param version Resolved version; a stored version above it is retained.
   * @param operationId Interrupted request explicitly resolved with this draft.
   * @returns {Promise<void>} Completed conditional cleanup.
   * @example await storage.discardDraft(draft.draftId, draft.draftVersion)
   */
  async discardDraft(
    id: string,
    version: number,
    operationId?: string,
  ): Promise<void> {
    const cleanup = await this.recordDiscard(id, version, operationId);
    await cleanup.finished;
  }

  /** Acknowledge the durable discard intent before physical recovery cleanup completes.
   * @param id Resolved draft identity.
   * @param version Highest resolved version.
   * @param operationId Explicitly resolved interrupted request.
   * @param reviewed When supplied, refuse if the stored record has advanced since review.
   * @returns A cleanup result only after the intent commits; rejects before confirmation.
   * @example await storage.confirmDraftDiscard(draft.draftId, draft.draftVersion)
   */
  async confirmDraftDiscard(
    id: string,
    version: number,
    operationId?: string,
    reviewed?: CareerDraft,
  ) {
    const cleanup = await this.recordDiscard(
      id,
      version,
      operationId,
      reviewed,
    );
    return {
      finished: cleanup.finished.then(
        () => true,
        () => false,
      ),
    };
  }

  /** Write a versioned intent, then begin retryable removal.
   * @param id Resolved draft identity.
   * @param version Highest resolved version.
   * @param operationId Explicitly resolved interrupted request.
   * @param reviewed Stored draft version displayed to the user, if this was a recovery review.
   * @returns The separate removal promise after durable confirmation.
   * @example await this.recordDiscard(id, version)
   */
  private async recordDiscard(
    id: string,
    version: number,
    operationId?: string,
    reviewed?: CareerDraft,
  ) {
    const key = `${RESOLVED_PREFIX}${id}/${version}`;
    const intent = { id, version, operationId };
    await this.transaction(
      reviewed ? ["drafts", "preferences"] : ["preferences"],
      "readwrite",
      async (tx) => {
        if (reviewed) {
          const current = await requestResult<CareerDraft | undefined>(
            tx.objectStore("drafts").get(id),
          );
          if (
            current &&
            (current.draftVersion > version ||
              (current.draftVersion === version &&
                !matchesDraftVersion(reviewed, current)))
          )
            throw new CareerStorageError(
              "conflict",
              "A newer draft is available.",
            );
        }
        tx.objectStore("preferences").put(intent, key);
      },
    );
    return { finished: this.cleanupDraft(key, intent) };
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
          typeof key === "string" && key.startsWith(RESOLVED_PREFIX)
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

  /** Remove a resolved version (and older stored versions of it) with its durable intent in one transaction.
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
        // The resolved in-memory version is the newest; older stored versions of
        // the same draft were never newer edits, so they resolve with it.
        const resolved =
          draft !== undefined && draft.draftVersion <= intent.version;
        if (resolved) store.delete(intent.id);
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
   * @param workspaceId Workspace the writer observed; rejected as `replaced` after its data was deleted.
   * @returns {Promise<void>} Durable request confirmation; unknown retries and ID reuse with different bytes throw.
   * @example await storage.prepare(request, true, head.workspaceId)
   */
  async prepare(
    request: SaveRequest,
    fresh = true,
    workspaceId?: string,
  ): Promise<void> {
    if (scopeFingerprint(request) !== request.fingerprint)
      throw new CareerStorageError(
        "invalid",
        "Save request fingerprint differs from its immutable content.",
      );
    await this.transaction(["operations", "heads"], "readwrite", async (tx) => {
      await this.assertWorkspace(tx, workspaceId);
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
        throw new CareerStorageError(
          "invalid",
          "Operation identity cannot be reused with changed content.",
        );
      if (!old && !fresh)
        throw new CareerStorageError(
          "uncertain",
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
          throw new CareerStorageError(
            "uncertain",
            "Save outcome unknown. Compare current content and reconcile before a new Save.",
          );
        const request = operation.request;
        const heads = tx.objectStore("heads");
        const head = await requestResult<CareerHead>(heads.get("guest"));
        if (
          head.workspaceId !== request.workspaceId ||
          head.generation !== request.generation
        )
          throw new CareerStorageError(
            "replaced",
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
        const decision = commitScopeRequest(head, request);
        if (!decision.ok)
          throw new CareerStorageError(decision.reason, decision.message);
        const next = decision.head;
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
          if (
            draft !== undefined &&
            request.draftVersion !== undefined &&
            draft.draftVersion <= request.draftVersion
          )
            drafts.delete(request.draftId);
        }
        return next;
      },
    );
  }

  /** Read one prepared immutable request.
   * @param operationId Stable operation ID.
   * @returns The stored request, or undefined when none is retained.
   * @example const request = await storage.operation(id)
   */
  async operation(operationId: string): Promise<SaveRequest | undefined> {
    return this.transaction(["operations"], "readonly", async (tx) => {
      const operation = await requestResult<Operation | undefined>(
        tx.objectStore("operations").get(operationId),
      );
      return operation?.request;
    });
  }

  /** Record a commit confirmed elsewhere (the account server) and clean up the exact draft version.
   * The receipt stays protected until acknowledged, like a local guest commit.
   * @param operationId Prepared operation that the server acknowledged.
   * @param result Server-committed revision and generation.
   * @returns Completion; throws `uncertain` when the request is no longer stored.
   * @example await storage.recordCommitted(id, { revision: 4, generation: 0 })
   */
  async recordCommitted(
    operationId: string,
    result: Pick<CareerHead, "revision" | "generation">,
  ): Promise<void> {
    await this.transaction(
      ["operations", "drafts"],
      "readwrite",
      async (tx) => {
        const operations = tx.objectStore("operations");
        const operation = await requestResult<Operation | undefined>(
          operations.get(operationId),
        );
        if (!operation)
          throw new CareerStorageError(
            "uncertain",
            "Save outcome unknown. Compare current content and reconcile before a new Save.",
          );
        if (!operation.result)
          operations.put(
            {
              ...operation,
              completedAt: Date.now(),
              awaitingAcknowledgment: true,
              result,
            },
            operationId,
          );
        const { draftId, draftVersion } = operation.request;
        if (draftId) {
          const drafts = tx.objectStore("drafts");
          const draft = await requestResult<CareerDraft | undefined>(
            drafts.get(draftId),
          );
          if (draft?.draftVersion === draftVersion) drafts.delete(draftId);
        }
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
    return this.transaction(
      ["operations", "heads", "preferences"],
      "readonly",
      async (tx) => {
        const operations = await requestResult<Operation[]>(
          tx.objectStore("operations").getAll(),
        );
        const head = await requestResult<CareerHead | undefined>(
          tx.objectStore("heads").get(this.headKey),
        );
        const versions = await this.resolvedDrafts(tx);
        return operations
          .filter(
            (op) =>
              op.awaitingAcknowledgment &&
              op.request.draftId &&
              op.request.draftVersion &&
              (versions.get(op.request.draftId) ?? -1) <
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
      },
    );
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
      const stale = replaceHead(current, reviewed, current.document);
      if (!stale.ok) throw new CareerStorageError(stale.reason, stale.message);
      const prior = incoming
        ? undefined
        : await requestResult<CareerHead | undefined>(previous.get("guest"));
      const decision = replaceHead(
        current,
        reviewed,
        validateDocument(incoming ?? prior?.document),
      );
      if (!decision.ok)
        throw new CareerStorageError(decision.reason, decision.message);
      const next = decision.head;
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
