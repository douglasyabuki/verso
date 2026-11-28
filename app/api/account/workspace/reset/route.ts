import {
  accountJson,
  accountRequest,
  readAccountBody,
  resetCancelSchema,
  resetRequestSchema,
} from "@/lib/account/api";
import {
  cancelAccountWorkspaceReset,
  resetAccountWorkspace,
} from "@/lib/account/workspace-repository";

/** Permanently delete the reviewed workspace's data, including public PDFs, and return the fresh workspace. */
export async function POST(request: Request): Promise<Response> {
  return accountRequest(request, async (userId) =>
    accountJson(
      await resetAccountWorkspace(
        userId,
        await readAccountBody(request, resetRequestSchema),
      ),
    ),
  );
}

/** Cancel an unresolved deletion attempt, or report that it already committed. */
export async function PATCH(request: Request): Promise<Response> {
  return accountRequest(request, async (userId) =>
    accountJson(
      await cancelAccountWorkspaceReset(
        userId,
        await readAccountBody(request, resetCancelSchema),
      ),
    ),
  );
}
