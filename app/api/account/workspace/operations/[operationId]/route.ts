import { accountJson, accountRequest } from "@/lib/account/api";
import { accountOperationStatus } from "@/lib/account/workspace-repository";

/** Report whether an interrupted operation committed; `unknown` is never proof of failure. */
export async function GET(
  request: Request,
  context: RouteContext<"/api/account/workspace/operations/[operationId]">,
): Promise<Response> {
  const { operationId } = await context.params;
  return accountRequest(request, async (userId) =>
    accountJson(await accountOperationStatus(userId, operationId)),
  );
}
