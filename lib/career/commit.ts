import { applyScope, readScope } from "@/lib/career/model";
import type { CareerDocument } from "@/types-and-constants/career";

/** Committed workspace state shared by every storage backend. */
export type CommittedHead = {
  workspaceId: string;
  revision: number;
  generation: number;
  document: CareerDocument;
};

/** Immutable Save request content; identical retries reuse `id` and bytes. */
export type ScopeRequest = {
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

/** Outcome of a pure scope commit or reviewed replacement decision. */
export type CommitDecision<H extends CommittedHead> =
  | { ok: true; head: H }
  | { ok: false; reason: "replaced" | "conflict"; message: string };

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

/** Build the immutable fingerprint that binds an operation ID to its exact request content.
 * @param request Workspace identity, scope, baseline, values, and draft version.
 * @returns {string} Stable JSON fingerprint; any content change produces a different value.
 * @example scopeFingerprint({ workspaceId, generation: 0, scope: "profile", baseline, values })
 */
export function scopeFingerprint(
  request: Pick<
    ScopeRequest,
    | "workspaceId"
    | "generation"
    | "scope"
    | "baseline"
    | "values"
    | "draftId"
    | "draftVersion"
  >,
): string {
  return JSON.stringify([
    request.workspaceId,
    request.generation,
    request.scope,
    request.baseline,
    request.values,
    request.draftId,
    request.draftVersion,
  ]);
}

/** Decide one scope Save against current committed state without performing I/O.
 * Unrelated changes elsewhere in the workspace never conflict; only the request's
 * own scope baseline and workspace generation are compared.
 * @param head Current committed head, read inside the caller's atomic boundary.
 * @param request Prepared immutable request.
 * @returns Next head with revision + 1 and unchanged generation, or a typed rejection.
 * @example const decision = commitScopeRequest(head, request); if (decision.ok) write(decision.head)
 */
export function commitScopeRequest<H extends CommittedHead>(
  head: H,
  request: Pick<
    ScopeRequest,
    "workspaceId" | "generation" | "scope" | "baseline" | "values"
  >,
): CommitDecision<H> {
  if (
    head.workspaceId !== request.workspaceId ||
    head.generation !== request.generation
  )
    return {
      ok: false,
      reason: "replaced",
      message: "Workspace was replaced. Compare or restore this draft as new.",
    };
  if (!sameScope(readScope(head.document, request.scope), request.baseline))
    return {
      ok: false,
      reason: "conflict",
      message:
        "This scope changed in another save. Compare and reconcile; your draft is retained.",
    };
  return {
    ok: true,
    head: applyCommitted(head, request.scope, request.values),
  };
}

/** Apply already-checked scope values as the next committed revision.
 * @param head Current committed head.
 * @param scope Exact editing scope.
 * @param values Validated scope values.
 * @returns {H} New head with revision + 1; generation and identity unchanged.
 * @example applyCommitted(head, "profile", values)
 */
export function applyCommitted<H extends CommittedHead>(
  head: H,
  scope: string,
  values: unknown,
): H {
  return {
    ...head,
    revision: head.revision + 1,
    document: applyScope(head.document, scope, values),
  };
}

/** Decide a reviewed replacement or rollback without performing I/O.
 * @param current Current committed head, read inside the caller's atomic boundary.
 * @param reviewed Destination head the user reviewed.
 * @param document Validated incoming or previous document.
 * @returns Next head with revision and generation incremented, or a conflict when the destination changed since review.
 * @example const decision = replaceHead(current, reviewed, incoming)
 */
export function replaceHead<H extends CommittedHead>(
  current: H,
  reviewed: Pick<CommittedHead, "workspaceId" | "revision" | "generation">,
  document: CareerDocument,
): CommitDecision<H> {
  if (
    current.workspaceId !== reviewed.workspaceId ||
    current.generation !== reviewed.generation ||
    current.revision !== reviewed.revision
  )
    return {
      ok: false,
      reason: "conflict",
      message:
        "Workspace changed since review. Review the current workspace again.",
    };
  return {
    ok: true,
    head: {
      ...current,
      revision: current.revision + 1,
      generation: current.generation + 1,
      document,
    },
  };
}

/** Decide a confirmed workspace-data deletion without performing I/O.
 * The fresh workspace receives a new identity, so every request prepared against
 * the deleted workspace is rejected by identity checks; revision and generation stay
 * monotonic so generation-ordered readers adopt it.
 * @param current Current committed head, read inside the caller's atomic boundary.
 * @param reviewed Workspace identity and revision the user confirmed deleting.
 * @param document Fresh validated schema-2 document.
 * @param workspaceId New workspace identity; never the reviewed one.
 * @returns Fresh head with a new identity and incremented revision/generation, or a conflict when the workspace changed since review.
 * @example const decision = resetHead(current, reviewed, createCareerDocument(), crypto.randomUUID())
 */
export function resetHead<H extends CommittedHead>(
  current: H,
  reviewed: Pick<CommittedHead, "workspaceId" | "revision" | "generation">,
  document: CareerDocument,
  workspaceId: string,
): CommitDecision<H> {
  if (
    current.workspaceId !== reviewed.workspaceId ||
    current.generation !== reviewed.generation ||
    current.revision !== reviewed.revision
  )
    return {
      ok: false,
      reason: "conflict",
      message:
        "Workspace changed since you reviewed it. Review the current workspace and confirm again.",
    };
  if (workspaceId === current.workspaceId)
    throw new Error("A fresh workspace requires a new identity.");
  return {
    ok: true,
    head: {
      ...current,
      workspaceId,
      revision: current.revision + 1,
      generation: current.generation + 1,
      document,
    },
  };
}
