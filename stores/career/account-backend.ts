import { applyCommitted } from "@/lib/career/commit";
import { validateDocument } from "@/lib/career/model";
import type {
  CareerBackend,
  WorkspaceIdentity,
  WorkspaceResetOutcome,
} from "@/stores/career/backend";
import {
  type CareerHead,
  type CareerStorage,
  CareerStorageError,
  openCareerStorage,
  saveFailureReason,
  type SaveRequest,
} from "@/stores/career/persistence";
import {
  ACCOUNT_ROUTES,
  ACCOUNT_SESSION_HEADER,
  type AccountErrorCode,
  type AccountOperationStatus,
  type AccountReplaceRequest,
  type AccountResetCancelResponse,
  type AccountResetRequest,
  type AccountSaveResponse,
  type AccountWorkspaceUnchanged,
  WORKSPACE_DELETION,
} from "@/types-and-constants/account";
import type { CareerDocument, CareerDraft } from "@/types-and-constants/career";
import type { SaveFailureReason } from "@/types-and-constants/career-status";

/** Signed-in owner whose requests this backend sends. */
export type AccountIdentity = { userId: string; sessionId: string };

/** Options for the account backend. */
export type AccountBackendOptions = {
  /** Called when the server rejects the session (expired, signed out, or switched). */
  onSessionInvalid?: (code: "unauthorized" | "session_mismatch") => void;
  /** Injectable fetch for tests. */
  fetch?: typeof fetch;
};

const FAILURES: Record<AccountErrorCode, SaveFailureReason> = {
  unauthorized: "session",
  session_mismatch: "session",
  forbidden_origin: "invalid",
  invalid: "invalid",
  payload_too_large: "invalid",
  conflict: "conflict",
  replaced: "replaced",
  operation_mismatch: "invalid",
  not_found: "invalid",
  quota_exceeded: "invalid",
  reauthenticate: "session",
  deletion_cancelled: "invalid",
  unavailable: "offline",
};

/** Hex SHA-256 of one deletion attempt's reviewed identity, matching the server receipt hash.
 * @param reviewed Reviewed workspace identity and revision.
 * @returns {Promise<string>} Lowercase hex digest.
 * @example await resetHash({ workspaceId, revision: 2, generation: 0 })
 */
async function resetHash(reviewed: WorkspaceIdentity): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify([
        "reset",
        reviewed.workspaceId,
        reviewed.revision,
        reviewed.generation,
      ]),
    ),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Compare two reviewed identities.
 * @param a First identity.
 * @param b Second identity.
 * @returns {boolean} True when workspace ID, revision, and generation match.
 * @example sameIdentity(head, marker.reviewed)
 */
const sameIdentity = (a: WorkspaceIdentity, b: WorkspaceIdentity) =>
  a.workspaceId === b.workspaceId &&
  a.revision === b.revision &&
  a.generation === b.generation;

const OFFLINE =
  "Not yet saved to your account. Your change is kept on this device; retry Save when you are back online.";

/** Account storage: PostgreSQL (through the account API) is authoritative for
 * committed content; drafts, immutable Save requests, and cleanup intents stay in an
 * account-isolated IndexedDB database. A Save succeeds only on server acknowledgment.
 * @example const backend = await openAccountBackend({ userId, sessionId })
 */
export class AccountCareerBackend implements CareerBackend {
  readonly kind = "account";

  readonly channelName: string;

  private head: CareerHead | null = null;

  private readonly abort = new AbortController();

  private readonly fetcher: typeof fetch;

  private localAcknowledgmentFailed = new Set<string>();

  /** Stable replacement operation IDs per reviewed attempt, so a retried
   * replacement replays its receipt instead of failing as a second operation. */
  private replaceAttempts = new Map<
    string,
    { operationId: string; incoming?: CareerDocument }
  >();

  /** Server-confirmed deletions whose local cleanup failed, so a retry needs no request. */
  private confirmedResets = new Map<
    string,
    { deletedId: string; head: CareerHead }
  >();

  constructor(
    private readonly local: CareerStorage,
    private readonly device: CareerStorage,
    private readonly identity: AccountIdentity,
    private readonly options: AccountBackendOptions = {},
  ) {
    this.channelName = `verso-account-${identity.userId}`;
    this.fetcher = options.fetch ?? fetch.bind(globalThis);
  }

  /** Send one account API request, mapping every failure to a typed storage error.
   * Network failures and unavailable servers are `offline`: the outcome is unconfirmed.
   * @param path API route.
   * @param body JSON body for POST requests.
   * @returns Parsed JSON response.
   * @example await this.request(ACCOUNT_ROUTES.workspace)
   */
  private async request<T>(
    path: string,
    body?: unknown,
    method: "POST" | "PATCH" = "POST",
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher(path, {
        method: body === undefined ? "GET" : method,
        credentials: "same-origin",
        cache: "no-store",
        signal: this.abort.signal,
        headers: {
          [ACCOUNT_SESSION_HEADER]: this.identity.sessionId,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new CareerStorageError("offline", OFFLINE);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new CareerStorageError("offline", OFFLINE);
    }
    if (response.ok) return payload as T;
    const { code, message } = (payload ?? {}) as {
      code?: AccountErrorCode;
      message?: string;
    };
    if (code === "unauthorized" || code === "session_mismatch")
      this.options.onSessionInvalid?.(code);
    const reason = (code && FAILURES[code]) ?? "offline";
    // The server code stays available to callers that distinguish outcomes the
    // Save failure reasons merge (for example a cancelled deletion).
    throw Object.assign(
      new CareerStorageError(
        reason,
        reason === "offline"
          ? OFFLINE
          : (message ?? "Account request rejected."),
      ),
      { serverCode: code },
    );
  }

  /** Load the authoritative account head; `initial` is ignored because the server creates it.
   * @returns {Promise<CareerHead>} Validated committed head.
   * @example await backend.load()
   */
  async load(): Promise<CareerHead> {
    const head = await this.request<CareerHead>(ACCOUNT_ROUTES.workspace);
    return this.adopt(head);
  }

  /** Validate and remember a server-confirmed head, caching it for other tabs and offline start.
   * Cache failures are ignored: the cache is a hint and never proves a commit.
   * @param head Server head.
   * @returns {Promise<CareerHead>} Validated head.
   * @example return this.adopt(head)
   */
  private async adopt(head: CareerHead): Promise<CareerHead> {
    this.head = {
      workspaceId: head.workspaceId,
      revision: head.revision,
      generation: head.generation,
      document: validateDocument(head.document),
    };
    await this.local.cacheAccountHead(this.head).catch(() => {});
    return this.head;
  }

  /** Conditionally load the account head: when `known` is current the server returns
   * identity only (session lookup plus one read), so freshness checks never transfer the document.
   * @param known Head currently shown by this tab.
   * @returns "unchanged", or the newer validated head.
   * @example const result = await backend.check(head)
   */
  async check(known: CareerHead): Promise<CareerHead | "unchanged"> {
    const query = new URLSearchParams({
      workspaceId: known.workspaceId,
      revision: String(known.revision),
      generation: String(known.generation),
    });
    const result = await this.request<CareerHead | AccountWorkspaceUnchanged>(
      `${ACCOUNT_ROUTES.workspace}?${query}`,
    );
    if ("unchanged" in result) {
      if (
        this.head?.revision !== known.revision ||
        this.head.generation !== known.generation
      )
        this.head = known;
      return "unchanged";
    }
    return this.adopt(result);
  }

  /** Read the locally cached server head without a network request.
   * @returns Cached head, or undefined.
   * @example await backend.cachedHead()
   */
  async cachedHead(): Promise<CareerHead | undefined> {
    return this.local.cachedAccountHead().catch(() => undefined);
  }

  /** Ask the server whether an operation committed, without sending it again.
   * @param operationId Prepared operation ID.
   * @returns Recorded receipt, or `unknown` (never proof of failure).
   * @example await backend.operationStatus(draft.operationId)
   */
  operationStatus(operationId: string): Promise<AccountOperationStatus> {
    return this.request<AccountOperationStatus>(
      `${ACCOUNT_ROUTES.operations}/${encodeURIComponent(operationId)}`,
    );
  }

  /** Record a server-confirmed outcome discovered by status lookup, cleaning up the exact draft version.
   * @param operationId Operation the server reports as committed.
   * @param result Committed revision and generation.
   * @returns Completion after local recording and acknowledgment.
   * @example await backend.resolveCommitted(id, status.result)
   */
  async resolveCommitted(
    operationId: string,
    result: Pick<CareerHead, "revision" | "generation">,
  ): Promise<void> {
    await this.local.recordCommitted(operationId, result);
    await this.local.acknowledge(operationId);
  }

  /** Send a prepared request and confirm it only on server acknowledgment.
   * Retries reuse the stored request, so the server replays its receipt instead of committing twice.
   * @param operationId Prepared operation ID.
   * @returns {Promise<CareerHead>} Acknowledged head.
   * @example await backend.commit(request.id)
   */
  async commit(operationId: string): Promise<CareerHead> {
    const request = await this.local.operation(operationId);
    if (!request)
      throw new CareerStorageError(
        "uncertain",
        "Save outcome unknown. Compare current content and reconcile before a new Save.",
      );
    const head = this.head ?? (await this.load());
    const response = await this.request<AccountSaveResponse>(
      ACCOUNT_ROUTES.operations,
      { ...request, knownRevision: head.revision },
    );
    let next: CareerHead;
    if (response.document)
      next = {
        workspaceId: response.workspaceId,
        revision: response.revision,
        generation: response.generation,
        document: validateDocument(response.document),
      };
    else if (
      response.revision === head.revision + 1 &&
      response.generation === head.generation
    )
      next = applyCommitted(head, request.scope, request.values);
    else next = await this.load();
    next = await this.adopt(next);
    try {
      await this.local.recordCommitted(operationId, response);
    } catch {
      // The server commit is confirmed. The local request stays prepared; a later
      // retry replays the receipt. Report it as cleanup pending, not failure.
      this.localAcknowledgmentFailed.add(operationId);
    }
    return next;
  }

  /** Mark the local receipt eligible for retention cleanup.
   * @param operationId Acknowledged operation.
   * @returns Completion; throws when local bookkeeping failed so status shows cleanup retry.
   * @example await backend.acknowledge(id)
   */
  async acknowledge(operationId: string): Promise<void> {
    if (this.localAcknowledgmentFailed.delete(operationId))
      throw new CareerStorageError(
        "storage",
        "Saved to your account; local cleanup retries on next load.",
      );
    await this.local.acknowledge(operationId);
  }

  /** Replace or roll back the reviewed account revision; the server keeps one previous workspace.
   * @param reviewed Destination head the user reviewed.
   * @param incoming Validated document, or undefined to roll back.
   * @param kind Replacement kind recorded in the receipt, default "replace".
   * @returns {Promise<CareerHead>} Newly committed head.
   * @example await backend.replace(reviewed, incoming)
   */
  async replace(
    reviewed: CareerHead,
    incoming?: CareerDocument,
    kind: "replace" | "import" = "replace",
  ): Promise<CareerHead> {
    const kindValue = incoming ? kind : "rollback";
    const key = JSON.stringify([
      kindValue,
      reviewed.workspaceId,
      reviewed.revision,
      reviewed.generation,
    ]);
    let attempt = this.replaceAttempts.get(key);
    if (!attempt || attempt.incoming !== incoming) {
      attempt = { operationId: crypto.randomUUID(), incoming };
      this.replaceAttempts.set(key, attempt);
    }
    const body: AccountReplaceRequest = {
      operationId: attempt.operationId,
      kind: kindValue,
      reviewed: {
        workspaceId: reviewed.workspaceId,
        revision: reviewed.revision,
        generation: reviewed.generation,
      },
      ...(incoming ? { document: validateDocument(incoming) } : {}),
    };
    const head = await this.request<CareerHead>(ACCOUNT_ROUTES.replace, body);
    this.replaceAttempts.delete(key);
    return this.adopt(head);
  }

  /** Read the account's one previous workspace.
   * @returns Previous head, or undefined.
   * @example await backend.previous()
   */
  async previous(): Promise<CareerHead | undefined> {
    const head = await this.request<CareerHead | null>(ACCOUNT_ROUTES.previous);
    return head ?? undefined;
  }

  /** Permanently delete the reviewed account workspace's data, including public PDFs.
   * A per-attempt marker is stored before sending, and retries reuse its operation ID, so a
   * lost response is resolved from server state and the receipt, never by a new deletion.
   * @param reviewed Identity and revision the user confirmed deleting.
   * @returns Deleted (with local cleanup status), or pending when the server did not answer. Throws `conflict` when the workspace changed since review.
   * @example await backend.resetWorkspace(reviewed)
   */
  async resetWorkspace(
    reviewed: WorkspaceIdentity,
  ): Promise<WorkspaceResetOutcome> {
    const existing = (await this.local.resetMarkers()).find((marker) =>
      sameIdentity(marker.reviewed, reviewed),
    );
    const marker = existing ?? {
      operationId: crypto.randomUUID(),
      reviewed: {
        workspaceId: reviewed.workspaceId,
        revision: reviewed.revision,
        generation: reviewed.generation,
      },
      requestHash: await resetHash(reviewed),
      createdAt: Date.now(),
    };
    // Nothing is sent unless this attempt is durably recorded first.
    if (!existing) await this.local.writeResetMarker(marker);
    return this.sendReset(marker.operationId);
  }

  /** Send one recorded deletion attempt and finish it locally on acknowledgment.
   * @param operationId Recorded attempt.
   * @returns Outcome; an unanswered request is resolved from server state.
   * @example await this.sendReset(id)
   */
  private async sendReset(operationId: string): Promise<WorkspaceResetOutcome> {
    const marker = (await this.local.resetMarkers()).find(
      (item) => item.operationId === operationId,
    );
    if (!marker) return { status: "not-deleted", reason: "changed" };
    const body: AccountResetRequest = {
      operationId,
      reviewed: marker.reviewed,
      confirmation: WORKSPACE_DELETION.confirmation,
    };
    let head: CareerHead;
    try {
      head = await this.request<CareerHead>(ACCOUNT_ROUTES.reset, body);
    } catch (error) {
      if (saveFailureReason(error) === "offline")
        return this.resolveReset(operationId);
      // A changed workspace can never satisfy this attempt's reviewed check, and a
      // cancelled attempt can never commit: neither needs further resolution.
      const code = (error as { serverCode?: AccountErrorCode }).serverCode;
      if (code === "conflict" || code === "deletion_cancelled")
        await this.local.removeResetMarker(operationId).catch(() => {});
      throw error;
    }
    if (head.workspaceId === marker.reviewed.workspaceId)
      return this.resolveReset(operationId);
    return this.finishReset(
      operationId,
      marker.reviewed.workspaceId,
      head,
      "this-request",
    );
  }

  /** Adopt a server-confirmed fresh workspace and clean up this browser's copy in one transaction.
   * @param operationId Attempt being resolved.
   * @param deletedId Deleted workspace ID.
   * @param head Fresh server head.
   * @param by Whether the receipt proves this attempt deleted the workspace.
   * @returns Deleted outcome; `cleanup: "pending"` when the local transaction failed.
   * @example await this.finishReset(id, deletedId, head, "this-request")
   */
  private async finishReset(
    operationId: string,
    deletedId: string,
    head: CareerHead,
    by: "this-request" | "another-request" | "unknown",
  ): Promise<WorkspaceResetOutcome> {
    const fresh: CareerHead = {
      workspaceId: head.workspaceId,
      revision: head.revision,
      generation: head.generation,
      document: validateDocument(head.document),
    };
    if (!this.head || this.head.generation <= fresh.generation)
      this.head = fresh;
    try {
      await this.local.completeWorkspaceReset(operationId, deletedId, fresh);
      this.confirmedResets.delete(operationId);
      return {
        status: "deleted",
        by,
        head: fresh,
        cleanup: "complete",
        operationId,
      };
    } catch {
      this.confirmedResets.set(operationId, { deletedId, head: fresh });
      return {
        status: "deleted",
        by,
        head: fresh,
        cleanup: "pending",
        operationId,
      };
    }
  }

  /** Unresolved deletion attempts recorded in this browser.
   * @returns Recorded markers in creation order.
   * @example await backend.pendingResets()
   */
  pendingResets() {
    return this.local.resetMarkers();
  }

  /** Resolve one attempt from server state and its receipt, without resending it.
   * A changed workspace ID proves the reviewed workspace is gone, and the receipt says whether
   * this attempt deleted it. An unchanged identity stays pending because the attempt could
   * still commit, unless the revision moved on, which makes the attempt impossible.
   * @param operationId Recorded attempt.
   * @returns Deleted, pending, or not-deleted outcome.
   * @example await backend.resolveReset(id)
   */
  async resolveReset(operationId: string): Promise<WorkspaceResetOutcome> {
    const confirmed = this.confirmedResets.get(operationId);
    if (confirmed)
      return this.finishReset(
        operationId,
        confirmed.deletedId,
        confirmed.head,
        "this-request",
      );
    const marker = (await this.local.resetMarkers()).find(
      (item) => item.operationId === operationId,
    );
    if (!marker) return { status: "not-deleted", reason: "changed" };
    let head: CareerHead;
    try {
      head = await this.request<CareerHead>(ACCOUNT_ROUTES.workspace);
    } catch (error) {
      if (saveFailureReason(error) === "offline")
        return { status: "pending", reason: "offline", operationId };
      throw error;
    }
    if (head.workspaceId === marker.reviewed.workspaceId) {
      await this.adopt(head);
      if (sameIdentity(head, marker.reviewed))
        return { status: "pending", reason: "unconfirmed", operationId };
      // Revisions only increase, so the reviewed check can never pass again.
      await this.local.removeResetMarker(operationId).catch(() => {});
      return { status: "not-deleted", reason: "changed" };
    }
    let by: "this-request" | "another-request" | "unknown" = "unknown";
    try {
      const status = await this.operationStatus(operationId);
      by =
        status.status === "committed" &&
        status.kind === "reset" &&
        status.requestHash === marker.requestHash
          ? "this-request"
          : "another-request";
    } catch {}
    return this.finishReset(operationId, marker.reviewed.workspaceId, head, by);
  }

  /** Resend the same recorded attempt; the server replays its receipt or rejects a changed workspace.
   * @param operationId Recorded attempt.
   * @returns Outcome as for `resetWorkspace`.
   * @example await backend.retryReset(id)
   */
  retryReset(operationId: string): Promise<WorkspaceResetOutcome> {
    return this.sendReset(operationId);
  }

  /** Cancel one unresolved attempt on the server under the owner lock.
   * @param operationId Recorded attempt.
   * @returns `not-deleted` after cancellation, `deleted` when the attempt had already committed, or pending when the server did not answer.
   * @example await backend.cancelReset(id)
   */
  async cancelReset(operationId: string): Promise<WorkspaceResetOutcome> {
    const marker = (await this.local.resetMarkers()).find(
      (item) => item.operationId === operationId,
    );
    if (!marker) return { status: "not-deleted", reason: "cancelled" };
    let result: AccountResetCancelResponse;
    try {
      result = await this.request<AccountResetCancelResponse>(
        ACCOUNT_ROUTES.reset,
        { operationId, reviewed: marker.reviewed },
        "PATCH",
      );
    } catch (error) {
      if (saveFailureReason(error) === "offline")
        return { status: "pending", reason: "offline", operationId };
      throw error;
    }
    if (result.deleted)
      return this.finishReset(
        operationId,
        marker.reviewed.workspaceId,
        result.head,
        "this-request",
      );
    await this.local.removeResetMarker(operationId);
    return { status: "not-deleted", reason: "cancelled" };
  }

  drafts(): Promise<CareerDraft[]> {
    return this.local.drafts();
  }

  uncertainDrafts(): Promise<CareerDraft[]> {
    return this.local.uncertainDrafts();
  }

  writeDraft(draft: CareerDraft, workspaceId: string): Promise<void> {
    return this.local.writeDraft(draft, workspaceId);
  }

  discardDraft(id: string, version: number, operationId?: string) {
    return this.local.discardDraft(id, version, operationId);
  }

  confirmDraftDiscard(id: string, version: number, operationId?: string) {
    return this.local.confirmDraftDiscard(id, version, operationId);
  }

  retryDraftCleanup(): Promise<void> {
    return this.local.retryDraftCleanup();
  }

  prepare(
    request: SaveRequest,
    fresh: boolean,
    workspaceId: string,
  ): Promise<void> {
    return this.local.prepare(request, fresh, workspaceId);
  }

  pruneCompleted(days?: number, count?: number): Promise<void> {
    return this.local.pruneCompleted(days, count);
  }

  /** Device preferences stay device-only in the shared browser database. */
  readDevicePreferences(): Promise<unknown> {
    return this.device.readDevicePreferences();
  }

  writeDevicePreferences(values: unknown): Promise<void> {
    return this.device.writeDevicePreferences(values);
  }

  /** Abort in-flight requests so late responses never reach another owner, then release databases. */
  close(): void {
    this.abort.abort();
    this.local.close();
    this.device.close();
  }
}

/** Open the account backend for one signed-in owner.
 * @param identity Session-derived user and session IDs.
 * @param options Session-invalidation callback and optional fetch.
 * @returns {Promise<CareerBackend>} Backend with account-isolated local recovery.
 * @example new CareerController({ openBackend: () => openAccountBackend(identity) })
 */
export async function openAccountBackend(
  identity: AccountIdentity,
  options: AccountBackendOptions = {},
): Promise<CareerBackend> {
  const local = await openCareerStorage(`verso-account-${identity.userId}`);
  try {
    const device = await openCareerStorage();
    return new AccountCareerBackend(local, device, identity, options);
  } catch (error) {
    local.close();
    throw error;
  }
}
