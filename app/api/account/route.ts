import { z } from "zod";

import {
  accountError,
  accountJson,
  accountRequest,
  readAccountBody,
} from "@/lib/account/api";
import { accountsEnabled } from "@/lib/account/auth";
import {
  deleteAccount,
  prepareAccountDeletion,
  settleAccountDeletion,
} from "@/lib/account/deletion";
import { AccountStoreError } from "@/lib/account/workspace-repository";
import {
  ACCOUNT_DELETION,
  ACCOUNT_DELETION_HEADER,
} from "@/types-and-constants/account";

const prepareSchema = z.strictObject({ intent: z.literal("prepare") });

const deleteSchema = z.strictObject({
  confirmation: z.literal(ACCOUNT_DELETION.confirmation),
});

/** Better Auth cookies that must not survive deletion, with and without the secure prefix. */
const AUTH_COOKIES = [
  "better-auth.session_token",
  "better-auth.session_data",
  "better-auth.dont_remember",
  "better-auth.state",
];

/** Prepare a deletion attempt for the verified owner and return its signed capability. */
export async function POST(request: Request): Promise<Response> {
  return accountRequest(request, async (userId, sessionId) => {
    await readAccountBody(request, prepareSchema);
    return accountJson({
      capability: await prepareAccountDeletion(userId, sessionId),
    });
  });
}

/** Permanently delete the verified owner's account, then expire its auth cookies. */
export async function DELETE(request: Request): Promise<Response> {
  const response = await accountRequest(request, async (userId, sessionId) => {
    await readAccountBody(request, deleteSchema);
    await deleteAccount(
      userId,
      sessionId,
      request.headers.get(ACCOUNT_DELETION_HEADER),
    );
    return accountJson({ deleted: true });
  });
  if (!response.ok) return response;
  for (const name of AUTH_COOKIES) {
    response.headers.append(
      "Set-Cookie",
      `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    );
    response.headers.append(
      "Set-Cookie",
      `__Secure-${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    );
  }
  return response;
}

/** Settle an unknown deletion outcome with the signed capability; needs no session because the account may be gone. */
export async function PATCH(request: Request): Promise<Response> {
  if (!accountsEnabled())
    return accountError("unavailable", "Accounts are not enabled.");
  if (
    request.headers.get("origin") !==
    new URL(process.env.BETTER_AUTH_URL!).origin
  )
    return accountError("forbidden_origin", "Cross-origin request rejected.");
  try {
    return accountJson(
      await settleAccountDeletion(request.headers.get(ACCOUNT_DELETION_HEADER)),
    );
  } catch (error) {
    if (error instanceof AccountStoreError)
      return accountError(error.code, error.message);
    return accountError(
      "unavailable",
      "Account storage is unavailable. Try again shortly.",
    );
  }
}
