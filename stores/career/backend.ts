import type { CareerHead, SaveRequest } from "@/stores/career/persistence";
import type { AccountOperationStatus } from "@/types-and-constants/account";
import type { CareerDocument, CareerDraft } from "@/types-and-constants/career";

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
  writeDraft(draft: CareerDraft): Promise<void>;
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
  prepare(request: SaveRequest, fresh?: boolean): Promise<void>;
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
