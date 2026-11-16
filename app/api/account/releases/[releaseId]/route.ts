import {
  accountJson,
  accountRequest,
  readAccountBody,
} from "@/lib/account/api";
import { releaseActionSchema, routeId } from "@/lib/account/release-api";
import { deleteRelease, updateRelease } from "@/lib/account/release-repository";

/** Revoke or restore one pinned release. */
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/account/releases/[releaseId]">,
): Promise<Response> {
  const { releaseId } = await context.params;
  return accountRequest(request, async (userId) =>
    accountJson(
      await updateRelease(
        userId,
        routeId(releaseId),
        await readAccountBody(request, releaseActionSchema),
      ),
    ),
  );
}

/** Permanently delete one release and its stored PDF. */
export async function DELETE(
  request: Request,
  context: RouteContext<"/api/account/releases/[releaseId]">,
): Promise<Response> {
  const { releaseId } = await context.params;
  return accountRequest(request, async (userId) =>
    accountJson(await deleteRelease(userId, routeId(releaseId))),
  );
}
