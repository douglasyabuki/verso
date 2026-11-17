import "server-only";

import { z } from "zod";

import { accountsEnabled, getAuth } from "@/lib/account/auth";
import { AccountStoreError } from "@/lib/account/workspace-repository";
import type { AccountErrorCode } from "@/types-and-constants/account";
import { ACCOUNT_SESSION_HEADER } from "@/types-and-constants/account";
import { WORKSPACE_BYTES } from "@/types-and-constants/career";

/** Request bodies carry at most one workspace plus small request metadata. */
const MAX_BODY_BYTES = WORKSPACE_BYTES + 64 * 1024;

const STATUS: Record<AccountErrorCode, number> = {
  unauthorized: 401,
  session_mismatch: 403,
  forbidden_origin: 403,
  invalid: 400,
  payload_too_large: 413,
  conflict: 409,
  replaced: 409,
  operation_mismatch: 409,
  not_found: 404,
  quota_exceeded: 409,
  unavailable: 503,
};

const NO_STORE = { "Cache-Control": "no-store" };

/** Build a typed JSON error response.
 * @param code Account error code.
 * @param message User-facing explanation without private content.
 * @returns {Response} Uncached error response with the mapped status.
 * @example return accountError("not_found", "No previous workspace.")
 */
export function accountError(
  code: AccountErrorCode,
  message: string,
): Response {
  return Response.json(
    { code, message },
    { status: STATUS[code], headers: NO_STORE },
  );
}

/** Build an uncached success response.
 * @param body JSON-serializable result.
 * @returns {Response} 200 response with Cache-Control: no-store.
 * @example return accountJson(head)
 */
export function accountJson(body: unknown): Response {
  return Response.json(body, { headers: NO_STORE });
}

/** Authorize one account request and run its operation with the session-derived owner.
 * Verifies the database session (no cookie cache), binds the request to the client's
 * session ID, requires a same-origin Origin on mutations, and maps failures to typed responses.
 * @param request Incoming Route Handler request.
 * @param operation Work receiving the verified user ID; never trust a body-supplied owner.
 * @returns {Promise<Response>} Operation response or typed error.
 * @example return accountRequest(request, (userId) => accountJson(await load(userId)))
 */
export async function accountRequest(
  request: Request,
  operation: (userId: string) => Promise<Response>,
): Promise<Response> {
  if (!accountsEnabled())
    return accountError("unavailable", "Accounts are not enabled.");
  if (request.method !== "GET" && request.method !== "HEAD") {
    const expected = new URL(process.env.BETTER_AUTH_URL!).origin;
    if (request.headers.get("origin") !== expected)
      return accountError("forbidden_origin", "Cross-origin request rejected.");
  }
  try {
    const session = await getAuth().api.getSession({
      headers: request.headers,
      query: { disableCookieCache: true },
    });
    if (!session)
      return accountError("unauthorized", "Sign in again to continue.");
    if (request.headers.get(ACCOUNT_SESSION_HEADER) !== session.session.id)
      return accountError(
        "session_mismatch",
        "This tab belongs to a different sign-in. Reload to continue.",
      );
    return await operation(session.user.id);
  } catch (error) {
    if (error instanceof AccountStoreError)
      return accountError(error.code, error.message);
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return accountError("invalid", "The request is malformed.");
    if (error instanceof PayloadTooLargeError)
      return accountError("payload_too_large", error.message);
    return accountError(
      "unavailable",
      "Account storage is unavailable. Your work is kept on this device.",
    );
  }
}

class PayloadTooLargeError extends Error {}

/** Read and validate a bounded JSON body; unknown fields are rejected by strict schemas.
 * @param request Incoming request.
 * @param schema Strict zod schema for the body.
 * @returns Parsed body; throws a typed error for oversized or malformed input.
 * @example const body = await readAccountBody(request, saveRequestSchema)
 */
export async function readAccountBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES)
    throw new PayloadTooLargeError(
      "This change is too large to send in one request.",
    );
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES)
    throw new PayloadTooLargeError(
      "This change is too large to send in one request.",
    );
  return schema.parse(JSON.parse(text));
}

const opaqueId = z.string().min(1).max(200);
const revision = z.number().int().nonnegative();

/** Strict body schema for one scope Save. */
export const saveRequestSchema = z.strictObject({
  id: z.uuid(),
  workspaceId: opaqueId,
  generation: revision,
  scope: z.string().min(1).max(300),
  baseline: z.unknown(),
  values: z.unknown(),
  draftId: opaqueId.optional(),
  draftVersion: z.number().int().positive().optional(),
  fingerprint: z.string().max(MAX_BODY_BYTES),
  baselineRevision: revision.optional(),
  knownRevision: revision,
});

/** Strict query schema for a conditional workspace freshness check. */
export const workspaceCheckSchema = z.strictObject({
  workspaceId: opaqueId,
  revision: z
    .string()
    .regex(/^\d{1,15}$/)
    .transform(Number),
  generation: z
    .string()
    .regex(/^\d{1,15}$/)
    .transform(Number),
});

/** Strict body schema for reviewed replacement, import, or rollback. */
export const replaceRequestSchema = z.strictObject({
  operationId: z.uuid(),
  kind: z.enum(["replace", "rollback", "import"]),
  reviewed: z.strictObject({
    workspaceId: opaqueId,
    revision,
    generation: revision,
  }),
  document: z.unknown().optional(),
});
