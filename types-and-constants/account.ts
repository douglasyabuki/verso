import type { CommittedHead, ScopeRequest } from "@/lib/career/commit";

/** Error codes returned by account Route Handlers as `{ code, message }`. */
export type AccountErrorCode =
  | "unauthorized"
  | "session_mismatch"
  | "forbidden_origin"
  | "invalid"
  | "payload_too_large"
  | "conflict"
  | "replaced"
  | "operation_mismatch"
  | "not_found"
  | "quota_exceeded"
  | "reauthenticate"
  | "deletion_cancelled"
  | "unavailable";

/** Kinds of committed account operations recorded as receipts. `reset` proves
 * which request deleted a workspace's data; `reset-cancelled` is the tombstone that
 * stops a delayed deletion request with the same operation ID from committing. */
export type AccountOperationKind =
  "save" | "replace" | "rollback" | "import" | "reset" | "reset-cancelled";

/** Explicit scope Save sent immediately after local preparation. */
export type AccountSaveRequest = ScopeRequest & {
  /** Revision of the client's committed head; outside the immutable fingerprint. */
  knownRevision: number;
};

/** Reviewed whole-workspace replacement, import, or rollback. */
export type AccountReplaceRequest = {
  operationId: string;
  kind: "replace" | "rollback" | "import";
  reviewed: Pick<CommittedHead, "workspaceId" | "revision" | "generation">;
  /** Incoming document; omitted for rollback to the previous workspace. */
  document?: unknown;
};

/** Confirmed deletion of the reviewed account workspace's data. */
export type AccountResetRequest = {
  operationId: string;
  reviewed: Pick<CommittedHead, "workspaceId" | "revision" | "generation">;
  confirmation: typeof WORKSPACE_DELETION.confirmation;
};

/** Server-side cancellation of one deletion attempt, serialized with it under the owner lock. */
export type AccountResetCancelRequest = Omit<
  AccountResetRequest,
  "confirmation"
>;

/** Cancellation outcome: `deleted` when the attempt had already committed. */
export type AccountResetCancelResponse =
  { deleted: true; head: CommittedHead } | { deleted: false };

/** Committed head identity returned by the server. */
export type AccountHeadIdentity = Pick<
  CommittedHead,
  "workspaceId" | "revision" | "generation"
>;

/** Save outcome. `document` is present only when the client's known revision was
 * stale, so it must adopt the server document instead of applying the patch locally. */
export type AccountSaveResponse = AccountHeadIdentity & {
  replayed: boolean;
  document?: CommittedHead["document"];
};

/** Conditional workspace load result when the client's known head is still current.
 * The document is omitted so a freshness check transfers only head identity. */
export type AccountWorkspaceUnchanged = AccountHeadIdentity & {
  unchanged: true;
};

/** Recorded outcome of an operation, used to resolve uncertain retries. */
export type AccountOperationStatus =
  | {
      status: "committed";
      kind: AccountOperationKind;
      requestHash: string;
      result: Omit<AccountHeadIdentity, "workspaceId">;
    }
  | { status: "unknown" };

/** Header binding an account request to the client's current session ID, so a
 * request queued under a previous sign-in is rejected after an account switch. */
export const ACCOUNT_SESSION_HEADER = "X-Verso-Session";

/** Account API routes. */
export const ACCOUNT_ROUTES = {
  options: "/api/auth-options",
  session: "/api/auth/get-session",
  workspace: "/api/account/workspace",
  operations: "/api/account/workspace/operations",
  replace: "/api/account/workspace/replace",
  previous: "/api/account/workspace/previous",
  reset: "/api/account/workspace/reset",
  account: "/api/account",
} as const;

/** Header carrying the signed, session-bound account deletion capability. */
export const ACCOUNT_DELETION_HEADER = "X-Verso-Deletion";

/** Account deletion bounds. */
export const ACCOUNT_DELETION = {
  /** Deletion requires a session created at most this long ago; older sessions sign in again first. */
  freshMs: 15 * 60_000,
  /** A prepared deletion confirmation expires after this long. */
  capabilityMs: 30 * 60_000,
  /** Text the user types to confirm permanent deletion. */
  confirmation: "DELETE",
} as const;

/** Workspace data deletion (guests and accounts). */
export const WORKSPACE_DELETION = {
  /** Text the user types to confirm permanently deleting workspace data. */
  confirmation: "DELETE",
} as const;

/** Sync freshness bounds for signed-in workspaces. Checks are conditional loads
 * (session lookup plus one workspace read when unchanged), so every constant here
 * trades remote freshness against billed database operations. */
export const ACCOUNT_SYNC = {
  /** Minimum spacing between event-driven checks (focus, visibility, reconnect), shared across this browser's tabs. */
  eventMinMs: 60_000,
  /** Periodic check interval while a tab is visible and the owner is active; one leader tab per browser. */
  intervalMs: 300_000,
  /** Periodic checks pause after this long without input; the next input checks immediately (subject to `eventMinMs`). */
  idleMs: 900_000,
  /** Server receipt pruning runs at most once per this interval, inside a Save transaction. */
  pruneEveryMs: 86_400_000,
} as const;

/** Sign-in providers in display order. */
export const ACCOUNT_PROVIDERS = ["google", "github"] as const;

/** Display names for sign-in providers. */
export const ACCOUNT_PROVIDER_NAMES: Record<
  (typeof ACCOUNT_PROVIDERS)[number],
  string
> = { github: "GitHub", google: "Google" };
