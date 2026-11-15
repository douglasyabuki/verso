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
  | "unavailable";

/** Kinds of committed account operations recorded as receipts. */
export type AccountOperationKind = "save" | "replace" | "rollback" | "import";

/** Explicit scope Save sent immediately after local preparation. */
export type AccountSaveRequest = ScopeRequest & {
  /** Revision of the client's committed head; outside the immutable fingerprint. */
  knownRevision: number;
};

/** Reviewed whole-workspace replacement, import, or rollback. */
export type AccountReplaceRequest = {
  operationId: string;
  kind: Exclude<AccountOperationKind, "save">;
  reviewed: Pick<CommittedHead, "workspaceId" | "revision" | "generation">;
  /** Incoming document; omitted for rollback to the previous workspace. */
  document?: unknown;
};

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
  workspace: "/api/account/workspace",
  operations: "/api/account/workspace/operations",
  replace: "/api/account/workspace/replace",
  previous: "/api/account/workspace/previous",
} as const;
