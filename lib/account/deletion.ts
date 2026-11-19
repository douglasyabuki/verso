import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { getPrisma } from "@/lib/account/prisma";
import {
  AccountStoreError,
  lockOwner,
  TRANSACTION,
} from "@/lib/account/workspace-repository";
import type { Prisma } from "@/lib/generated/prisma/client";
import { ACCOUNT_DELETION } from "@/types-and-constants/account";

type Transaction = Prisma.TransactionClient;

/** Signed binding between one prepared deletion intent, its owner, and its session. */
export type DeletionCapability = {
  userId: string;
  sessionId: string;
  expires: number;
  intent: string;
};

const INTENT_PREFIX = "verso-deletion:";

/** Sign a capability payload with the auth secret.
 * @param payload Base64url-encoded capability JSON.
 * @returns {Buffer} HMAC-SHA256 digest bound to Verso account deletion.
 * @example sign(payload).toString("base64url")
 */
function sign(payload: string): Buffer {
  return createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
    .update(`verso-delete:${payload}`)
    .digest();
}

/** Require a recently created session before account deletion.
 * @param session Initiating session row read under the owner lock.
 * @param now Current time in milliseconds.
 * @returns {void} Returns for a live session created within `ACCOUNT_DELETION.freshMs`; throws `unauthorized` for a missing or expired session and `reauthenticate` for an older one.
 * @example assertFreshDeletionSession(session, Date.now())
 */
export function assertFreshDeletionSession(
  session: { expiresAt: Date; createdAt: Date } | null,
  now: number,
): void {
  if (!session || session.expiresAt.getTime() <= now)
    throw new AccountStoreError("unauthorized", "Sign in again to continue.");
  if (now - session.createdAt.getTime() > ACCOUNT_DELETION.freshMs)
    throw new AccountStoreError(
      "reauthenticate",
      "Sign in again to confirm it is you before deleting your account.",
    );
}

/** Read and verify the initiating session under the owner lock.
 * @param tx Interactive transaction holding the owner lock.
 * @param userId Session-derived owner.
 * @param sessionId Verified initiating session ID.
 * @returns {Promise<void>} Resolves for a fresh session; throws like `assertFreshDeletionSession`.
 * @example await requireFreshSession(tx, userId, sessionId)
 */
async function requireFreshSession(
  tx: Transaction,
  userId: string,
  sessionId: string,
): Promise<void> {
  assertFreshDeletionSession(
    await tx.session.findFirst({
      where: { id: sessionId, userId },
      select: { expiresAt: true, createdAt: true },
    }),
    Date.now(),
  );
}

/** Prepare one deletion attempt and return its signed status capability.
 * Any earlier attempt for the owner is cancelled, so only the newest confirmation can delete.
 * @param userId Owner derived from the verified server session.
 * @param sessionId Verified initiating session.
 * @returns {Promise<string>} Capability `<payload>.<signature>` valid for `ACCOUNT_DELETION.capabilityMs`; throws `reauthenticate` when the session is not fresh.
 * @example const capability = await prepareAccountDeletion(userId, sessionId)
 */
export async function prepareAccountDeletion(
  userId: string,
  sessionId: string,
): Promise<string> {
  const intent = `${INTENT_PREFIX}${randomUUID()}`;
  const expires = Date.now() + ACCOUNT_DELETION.capabilityMs;
  await getPrisma().$transaction(async (tx) => {
    await lockOwner(tx, userId);
    await requireFreshSession(tx, userId, sessionId);
    await tx.verification.deleteMany({
      where: { identifier: { startsWith: INTENT_PREFIX }, value: userId },
    });
    await tx.verification.create({
      data: {
        id: randomUUID(),
        identifier: intent,
        value: userId,
        expiresAt: new Date(expires),
      },
    });
  }, TRANSACTION);
  const payload = Buffer.from(
    JSON.stringify({ userId, sessionId, expires, intent }),
  ).toString("base64url");
  return `${payload}.${sign(payload).toString("base64url")}`;
}

/** Verify a status capability. It never authenticates a request by itself.
 * @param token Untrusted capability from the request header.
 * @param allowExpired Accept an expired but authentic capability, for settling an earlier outcome.
 * @returns {DeletionCapability} Owner, session, expiry, and intent binding; throws `invalid` for malformed or forged capabilities, and for expired ones unless `allowExpired`.
 * @example const binding = readDeletionCapability(request.headers.get(ACCOUNT_DELETION_HEADER))
 */
export function readDeletionCapability(
  token: string | null,
  allowExpired = false,
): DeletionCapability {
  const invalid = new AccountStoreError(
    "invalid",
    "The deletion confirmation is no longer valid. Start again.",
  );
  if (!token || token.length > 4096) throw invalid;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) throw invalid;
  const expected = sign(payload);
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw invalid;
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw invalid;
  }
  const binding = value as Partial<DeletionCapability>;
  if (
    typeof binding.userId !== "string" ||
    typeof binding.sessionId !== "string" ||
    typeof binding.intent !== "string" ||
    !binding.intent.startsWith(INTENT_PREFIX) ||
    typeof binding.expires !== "number" ||
    (!allowExpired && binding.expires <= Date.now())
  )
    throw invalid;
  return binding as DeletionCapability;
}

/** Report whether a stored Better Auth OAuth state links a provider to this owner.
 * @param value Verification row value; Better Auth 1.7 stores OAuth state as JSON with `link.userId` for link flows.
 * @param userId Owner being deleted.
 * @returns {boolean} True only when the state's explicit link owner equals `userId`.
 * @example ownsLinkState('{"link":{"userId":"u1"}}', "u1") // true
 */
export function ownsLinkState(value: string, userId: string): boolean {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || !("link" in parsed))
      return false;
    const link: unknown = parsed.link;
    return (
      !!link &&
      typeof link === "object" &&
      "userId" in link &&
      link.userId === userId
    );
  } catch {
    return false;
  }
}

/** Delete the account and everything it owns in one transaction, serialized with Saves under the owner lock.
 * Cascades remove sessions, provider links, the workspace, the previous workspace, receipts, public links, and releases.
 * @param userId Owner derived from the verified server session.
 * @param sessionId Verified current session; must match the capability.
 * @param token Signed capability from `prepareAccountDeletion`.
 * @returns {Promise<void>} Resolves after commit; failures roll back. Throws `session_mismatch` for another session's capability, `deletion_cancelled` when the intent was settled or replaced, and `reauthenticate` for a stale session.
 * @example await deleteAccount(userId, sessionId, capability)
 */
export async function deleteAccount(
  userId: string,
  sessionId: string,
  token: string | null,
): Promise<void> {
  const binding = readDeletionCapability(token);
  if (binding.userId !== userId || binding.sessionId !== sessionId)
    throw new AccountStoreError(
      "session_mismatch",
      "Your sign-in changed. Confirm deletion again.",
    );
  await getPrisma().$transaction(async (tx) => {
    await lockOwner(tx, userId);
    await requireFreshSession(tx, userId, sessionId);
    const intent = await tx.verification.findFirst({
      where: {
        identifier: binding.intent,
        value: userId,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!intent)
      throw new AccountStoreError(
        "deletion_cancelled",
        "This deletion attempt was cancelled. Confirm again to start a new one.",
      );
    const states = await tx.verification.findMany({
      where: { identifier: { startsWith: "auth-state:" } },
      select: { id: true, value: true },
    });
    const owned = states
      .filter((state) => ownsLinkState(state.value, userId))
      .map((state) => state.id);
    if (owned.length)
      await tx.verification.deleteMany({ where: { id: { in: owned } } });
    await tx.verification.deleteMany({
      where: { identifier: { startsWith: INTENT_PREFIX }, value: userId },
    });
    await tx.user.delete({ where: { id: userId } });
  }, TRANSACTION);
}

/** Settle an unknown deletion outcome without a session, cancelling a not-yet-committed attempt.
 * Accepts expired capabilities because the intent they name can no longer delete. Serializes with `deleteAccount` under the owner lock, so a later replay of the same capability cannot delete.
 * @param token Signed status capability; it never authorizes deletion.
 * @returns {Promise<{ deleted: boolean }>} `deleted: true` when the account no longer exists; otherwise false after cancelling the intent.
 * @example const { deleted } = await settleAccountDeletion(capability)
 */
export async function settleAccountDeletion(
  token: string | null,
): Promise<{ deleted: boolean }> {
  const binding = readDeletionCapability(token, true);
  return getPrisma().$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "user" WHERE id = ${binding.userId} FOR UPDATE`;
    if (rows.length === 0) return { deleted: true };
    await tx.verification.deleteMany({
      where: { identifier: binding.intent, value: binding.userId },
    });
    return { deleted: false };
  }, TRANSACTION);
}
