import type { CareerHead, SaveRequest } from "@/stores/career/persistence";
import type { AccountOperationStatus } from "@/types-and-constants/account";
import type { CareerDocument, CareerDraft } from "@/types-and-constants/career";

/** Workspace identity and revision a whole-workspace operation was reviewed against. */
export type WorkspaceIdentity = Pick<
  CareerHead,
  "workspaceId" | "revision" | "generation"
>;

/** Durable record of one account deletion attempt, written before it is sent. */
export type WorkspaceResetMarker = {
  operationId: string;
  reviewed: WorkspaceIdentity;
  /** Hex SHA-256 the server records in the attempt's receipt. */
  requestHash: string;
  createdAt: number;
};

/** Outcome of deleting workspace data or resolving an earlier attempt.
 * `deleted.by` says whether the receipt proves this attempt deleted the workspace;
 * `cleanup: "pending"` means only this browser's local copy still needs clearing. */
export type WorkspaceResetOutcome =
  | {
      status: "deleted";
      by: "this-request" | "another-request" | "unknown";
      head: CareerHead;
      cleanup: "complete" | "pending";
      operationId?: string;
    }
  /** The outcome is unresolved: the reviewed workspace still exists and the
   * attempt could still commit (`unconfirmed`), or the server did not answer. */
  | {
      status: "pending";
      reason: "unconfirmed" | "offline";
      operationId: string;
    }
  /** The attempt can never commit: cancelled on the server, or the workspace changed. */
  | { status: "not-deleted"; reason: "cancelled" | "changed" };

/** Owner of committed workspace, recovery, receipt, and previous-workspace storage.
 * The guest backend commits to IndexedDB; an account backend keeps recovery and
 * immutable requests locally and treats only server acknowledgment as commit.
 * Every method rejects with `CareerStorageError` codes or storage exceptions.
 */
export interface CareerBackend {
  /** Storage owner; drives status wording and cross-tab channel isolation. */
  readonly kind: "guest" | "account";
  /** BroadcastChannel name shared only by tabs of the same owner. */
  readonly channelName: string;
  load(initial?: CareerDocument): Promise<CareerHead>;
  drafts(): Promise<CareerDraft[]>;
  uncertainDrafts(): Promise<CareerDraft[]>;
  /** Store recovery; `workspaceId` is the workspace the writer observed and fences stale tabs. */
  writeDraft(draft: CareerDraft, workspaceId: string): Promise<void>;
  discardDraft(
    id: string,
    version: number,
    operationId?: string,
  ): Promise<void>;
  confirmDraftDiscard(
    id: string,
    version: number,
    operationId?: string,
  ): Promise<{ finished: Promise<boolean> }>;
  retryDraftCleanup(): Promise<void>;
  prepare(
    request: SaveRequest,
    fresh: boolean,
    workspaceId: string,
  ): Promise<void>;
  commit(operationId: string): Promise<CareerHead>;
  acknowledge(operationId: string): Promise<void>;
  /** Replace (or roll back when `incoming` is undefined) the reviewed revision.
   * `kind` labels account receipts; guest storage ignores it. */
  replace(
    reviewed: CareerHead,
    incoming?: CareerDocument,
    kind?: "replace" | "import",
  ): Promise<CareerHead>;
  previous(): Promise<CareerHead | undefined>;
  /** Permanently delete the reviewed workspace's data and adopt a fresh workspace.
   * Throws `conflict` when the workspace changed since review; accounts may return a
   * pending outcome when the server did not answer. */
  resetWorkspace(reviewed: WorkspaceIdentity): Promise<WorkspaceResetOutcome>;
  /** Account only: unresolved deletion attempts recorded in this browser. */
  pendingResets?(): Promise<WorkspaceResetMarker[]>;
  /** Account only: resolve one attempt from server state and its receipt, never by resending. */
  resolveReset?(operationId: string): Promise<WorkspaceResetOutcome>;
  /** Account only: resend the same attempt (same operation ID and reviewed identity). */
  retryReset?(operationId: string): Promise<WorkspaceResetOutcome>;
  /** Account only: cancel the attempt on the server under the owner lock. */
  cancelReset?(operationId: string): Promise<WorkspaceResetOutcome>;
  pruneCompleted(days?: number, count?: number): Promise<void>;
  readDevicePreferences(): Promise<unknown>;
  /** Account only: conditional freshness check; "unchanged" transfers no document. */
  check?(known: CareerHead): Promise<CareerHead | "unchanged">;
  /** Account only: last server-confirmed head cached locally (no network). */
  cachedHead?(): Promise<CareerHead | undefined>;
  /** Account only: recorded server outcome of an operation, without replaying it. */
  operationStatus?(operationId: string): Promise<AccountOperationStatus>;
  /** Account only: record a server-confirmed outcome found by status lookup and acknowledge it locally. */
  resolveCommitted?(
    operationId: string,
    result: Pick<CareerHead, "revision" | "generation">,
  ): Promise<void>;
  writeDevicePreferences(values: unknown): Promise<void>;
  close(): void;
}
