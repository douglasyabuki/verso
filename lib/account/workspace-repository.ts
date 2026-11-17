import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { getPrisma } from "@/lib/account/prisma";
import {
  commitScopeRequest,
  type CommittedHead,
  replaceHead,
  scopeFingerprint,
} from "@/lib/career/commit";
import { createCareerDocument, validateDocument } from "@/lib/career/model";
import type { Prisma } from "@/lib/generated/prisma/client";
import type {
  AccountErrorCode,
  AccountOperationKind,
  AccountOperationStatus,
  AccountReplaceRequest,
  AccountSaveRequest,
  AccountSaveResponse,
  AccountWorkspaceUnchanged,
} from "@/types-and-constants/account";
import { ACCOUNT_SYNC } from "@/types-and-constants/account";
import type { CareerDocument } from "@/types-and-constants/career";

type Transaction = Prisma.TransactionClient;

export const TRANSACTION = { maxWait: 10_000, timeout: 20_000 };

/** Typed account storage failure mapped to an HTTP status by the API layer. */
export class AccountStoreError extends Error {
  constructor(
    readonly code: AccountErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AccountStoreError";
  }
}

/** Hash immutable request content for receipt comparison without storing payloads.
 * @param value Canonical request text.
 * @returns {string} Hex SHA-256 digest.
 * @example requestHash(request.fingerprint)
 */
export function requestHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Lock one user's row so this user's account writes serialize; reads after the lock see committed writers.
 * @param tx Interactive transaction.
 * @param userId Session-derived owner.
 * @returns Completion; throws `unauthorized` when the user no longer exists.
 * @example await lockOwner(tx, userId)
 */
export async function lockOwner(
  tx: Transaction,
  userId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "user" WHERE id = ${userId} FOR UPDATE`;
  if (rows.length === 0)
    throw new AccountStoreError("unauthorized", "Account not found.");
}

function toHead(row: {
  workspaceId: string;
  revision: number;
  generation: number;
  document: unknown;
}): CommittedHead {
  return {
    workspaceId: row.workspaceId,
    revision: row.revision,
    generation: row.generation,
    document: row.document as CareerDocument,
  };
}

const json = (document: CareerDocument) =>
  document as unknown as Prisma.InputJsonValue;

/** Load the owner's committed workspace, creating a clean schema-2 workspace on first access.
 * @param userId Session-derived owner.
 * @returns {Promise<CommittedHead>} Committed head; one read when it exists.
 * @example const head = await loadAccountWorkspace(userId)
 */
export async function loadAccountWorkspace(
  userId: string,
): Promise<CommittedHead> {
  const prisma = getPrisma();
  const existing = await prisma.accountWorkspace.findUnique({
    where: { userId },
  });
  if (existing) return toHead(existing);
  return prisma.$transaction(async (tx) => {
    await lockOwner(tx, userId);
    const current = await tx.accountWorkspace.findUnique({
      where: { userId },
    });
    if (current) return toHead(current);
    const created = await tx.accountWorkspace.create({
      data: {
        userId,
        workspaceId: randomUUID(),
        revision: 0,
        generation: 0,
        document: json(validateDocument(createCareerDocument())),
      },
    });
    return toHead(created);
  }, TRANSACTION);
}

/** Conditionally load the owner's workspace for a freshness check.
 * One read: when the known identity is current, only identity is returned (no document transfer).
 * @param userId Session-derived owner.
 * @param known Client's committed head identity.
 * @returns Unchanged identity, or the current committed head (created on first access).
 * @example await checkAccountWorkspace(userId, { workspaceId, revision: 4, generation: 0 })
 */
export async function checkAccountWorkspace(
  userId: string,
  known: Pick<CommittedHead, "workspaceId" | "revision" | "generation">,
): Promise<CommittedHead | AccountWorkspaceUnchanged> {
  const row = await getPrisma().accountWorkspace.findUnique({
    where: { userId },
  });
  if (!row) return loadAccountWorkspace(userId);
  if (
    row.workspaceId === known.workspaceId &&
    row.revision === known.revision &&
    row.generation === known.generation
  )
    return {
      unchanged: true,
      workspaceId: row.workspaceId,
      revision: row.revision,
      generation: row.generation,
    };
  return toHead(row);
}

/** Read the single retained previous workspace.
 * @param userId Session-derived owner.
 * @returns Previous committed head, or undefined.
 * @example await loadPreviousAccountWorkspace(userId)
 */
export async function loadPreviousAccountWorkspace(
  userId: string,
): Promise<CommittedHead | undefined> {
  const row = await getPrisma().accountPreviousWorkspace.findUnique({
    where: { userId },
  });
  return row ? toHead(row) : undefined;
}

/** Atomically commit one prepared scope Save with an idempotent receipt.
 * The server rechecks the scope baseline and generation; unrelated changes never conflict.
 * @param userId Session-derived owner; never taken from the request.
 * @param request Immutable request plus the client's known revision.
 * @returns New or replayed head identity; includes the document only when the client's known revision is stale.
 * @example await commitAccountSave(userId, request)
 */
export async function commitAccountSave(
  userId: string,
  request: AccountSaveRequest,
): Promise<AccountSaveResponse> {
  if (scopeFingerprint(request) !== request.fingerprint)
    throw new AccountStoreError(
      "invalid",
      "Save request fingerprint differs from its immutable content.",
    );
  const hash = requestHash(request.fingerprint);
  return getPrisma().$transaction(async (tx) => {
    await lockOwner(tx, userId);
    const receipt = await tx.accountOperation.findUnique({
      where: { userId_operationId: { userId, operationId: request.id } },
    });
    const row = await tx.accountWorkspace.findUnique({ where: { userId } });
    if (!row)
      throw new AccountStoreError(
        "replaced",
        "Account workspace is not initialized. Reload it before saving.",
      );
    const head = toHead(row);
    if (receipt) {
      if (receipt.kind !== "save" || receipt.requestHash !== hash)
        throw new AccountStoreError(
          "operation_mismatch",
          "Operation identity cannot be reused with changed content.",
        );
      return {
        workspaceId: head.workspaceId,
        revision: receipt.resultRevision,
        generation: receipt.resultGeneration,
        replayed: true,
        ...(head.revision === receipt.resultRevision &&
        request.knownRevision + 1 === receipt.resultRevision
          ? {}
          : { document: head.document }),
      };
    }
    const decision = commitScopeRequest(head, request);
    if (!decision.ok)
      throw new AccountStoreError(decision.reason, decision.message);
    const next = decision.head;
    const now = new Date();
    const prune =
      !row.operationsPrunedAt ||
      now.getTime() - row.operationsPrunedAt.getTime() >=
        ACCOUNT_SYNC.pruneEveryMs;
    await tx.accountWorkspace.update({
      where: { userId },
      data: {
        revision: next.revision,
        document: json(next.document),
        ...(prune ? { operationsPrunedAt: now } : {}),
      },
    });
    await tx.accountOperation.create({
      data: {
        userId,
        operationId: request.id,
        kind: "save",
        requestHash: hash,
        resultRevision: next.revision,
        resultGeneration: next.generation,
      },
    });
    // Receipt retention runs at most daily inside an existing Save transaction,
    // keeping the read path free of writes.
    if (prune) await pruneOperations(tx, userId, now);
    return {
      workspaceId: next.workspaceId,
      revision: next.revision,
      generation: next.generation,
      replayed: false,
      ...(request.knownRevision === head.revision
        ? {}
        : { document: next.document }),
    };
  }, TRANSACTION);
}

/** Atomically replace, import into, or roll back the reviewed workspace revision.
 * The outgoing head becomes the one previous workspace; failure changes neither.
 * @param userId Session-derived owner.
 * @param request Reviewed identity, stable operation ID, and incoming document (absent for rollback).
 * @returns {Promise<CommittedHead>} Newly committed head with incremented generation, or the replayed current head.
 * @example await replaceAccountWorkspace(userId, { operationId, kind: "import", reviewed, document })
 */
export async function replaceAccountWorkspace(
  userId: string,
  request: AccountReplaceRequest,
): Promise<CommittedHead> {
  if ((request.kind === "rollback") !== (request.document === undefined))
    throw new AccountStoreError(
      "invalid",
      "Rollback takes no document; replacement and import require one.",
    );
  const incoming =
    request.document === undefined
      ? undefined
      : validateDocument(request.document);
  const hash = requestHash(
    JSON.stringify([request.kind, request.reviewed, request.document ?? null]),
  );
  return getPrisma().$transaction(async (tx) => {
    await lockOwner(tx, userId);
    const receipt = await tx.accountOperation.findUnique({
      where: {
        userId_operationId: { userId, operationId: request.operationId },
      },
    });
    const row = await tx.accountWorkspace.findUnique({ where: { userId } });
    if (!row)
      throw new AccountStoreError(
        "conflict",
        "Account workspace changed since review. Review it again.",
      );
    const current = toHead(row);
    if (receipt) {
      if (receipt.kind !== request.kind || receipt.requestHash !== hash)
        throw new AccountStoreError(
          "operation_mismatch",
          "Operation identity cannot be reused with changed content.",
        );
      return current;
    }
    let document = incoming;
    if (!document) {
      const previous = await tx.accountPreviousWorkspace.findUnique({
        where: { userId },
      });
      if (!previous)
        throw new AccountStoreError(
          "not_found",
          "No previous workspace is available.",
        );
      document = validateDocument(previous.document);
    }
    const decision = replaceHead(current, request.reviewed, document);
    if (!decision.ok)
      throw new AccountStoreError(decision.reason, decision.message);
    const next = decision.head;
    const outgoing = {
      workspaceId: current.workspaceId,
      revision: current.revision,
      generation: current.generation,
      document: json(current.document),
    };
    await tx.accountPreviousWorkspace.upsert({
      where: { userId },
      create: { userId, ...outgoing },
      update: outgoing,
    });
    await tx.accountWorkspace.update({
      where: { userId },
      data: {
        revision: next.revision,
        generation: next.generation,
        document: json(next.document),
      },
    });
    await tx.accountOperation.create({
      data: {
        userId,
        operationId: request.operationId,
        kind: request.kind,
        requestHash: hash,
        resultRevision: next.revision,
        resultGeneration: next.generation,
      },
    });
    return next;
  }, TRANSACTION);
}

/** Report whether an operation committed, so an interrupted client can resolve it without replay.
 * @param userId Session-derived owner.
 * @param operationId Client operation ID.
 * @returns Recorded receipt, or `unknown` when none is retained (never proof of failure).
 * @example await accountOperationStatus(userId, id)
 */
export async function accountOperationStatus(
  userId: string,
  operationId: string,
): Promise<AccountOperationStatus> {
  const receipt = await getPrisma().accountOperation.findUnique({
    where: { userId_operationId: { userId, operationId } },
  });
  if (!receipt) return { status: "unknown" };
  return {
    status: "committed",
    kind: receipt.kind as AccountOperationKind,
    requestHash: receipt.requestHash,
    result: {
      revision: receipt.resultRevision,
      generation: receipt.resultGeneration,
    },
  };
}

/** Prune the owner's oldest receipts beyond the retention policy.
 * Clients keep their own pending requests; a pruned receipt makes a retry "unknown", never replayed.
 * @param tx Prisma client or interactive transaction.
 * @param userId Session-derived owner.
 * @param now Reference time.
 * @param days Retention days, default 30.
 * @param count Maximum retained receipts, default 1,000.
 * @returns {Promise<number>} Number of receipts removed.
 */
async function pruneOperations(
  tx: Transaction,
  userId: string,
  now: Date,
  days = 30,
  count = 1000,
): Promise<number> {
  const cutoff = new Date(now.getTime() - days * 86_400_000);
  const keep = await tx.accountOperation.findMany({
    where: { userId, createdAt: { gte: cutoff } },
    orderBy: { createdAt: "desc" },
    take: count,
    select: { operationId: true },
  });
  const removed = await tx.accountOperation.deleteMany({
    where: {
      userId,
      operationId: { notIn: keep.map((item) => item.operationId) },
    },
  });
  return removed.count;
}

/** Prune the owner's oldest receipts immediately, outside the daily Save-time schedule.
 * Clients keep their own pending requests; a pruned receipt makes a retry "unknown", never replayed.
 * @param userId Session-derived owner.
 * @param days Retention days, default 30.
 * @param count Maximum retained receipts, default 1,000.
 * @returns {Promise<number>} Number of receipts removed.
 * @example await pruneAccountOperations(userId)
 */
export async function pruneAccountOperations(
  userId: string,
  days = 30,
  count = 1000,
): Promise<number> {
  return pruneOperations(getPrisma(), userId, new Date(), days, count);
}
