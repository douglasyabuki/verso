import {
  accountJson,
  accountRequest,
  readAccountBody,
} from "@/lib/account/api";
import { linkActionSchema, routeId } from "@/lib/account/release-api";
import { revokeLink, updateLink } from "@/lib/account/release-repository";

/** Move a link's latest release (rollback/advance) or toggle automatic release. */
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/account/releases/links/[linkId]">,
): Promise<Response> {
  const { linkId } = await context.params;
  return accountRequest(request, async (userId) =>
    accountJson(
      await updateLink(
        userId,
        routeId(linkId),
        await readAccountBody(request, linkActionSchema),
      ),
    ),
  );
}

/** Revoke a link: delete it with its releases so every URL under its token stops working. */
export async function DELETE(
  request: Request,
  context: RouteContext<"/api/account/releases/links/[linkId]">,
): Promise<Response> {
  const { linkId } = await context.params;
  return accountRequest(request, async (userId) =>
    accountJson(await revokeLink(userId, routeId(linkId))),
  );
}
