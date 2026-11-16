import {
  accountJson,
  accountRequest,
  workspaceCheckSchema,
} from "@/lib/account/api";
import {
  checkAccountWorkspace,
  loadAccountWorkspace,
} from "@/lib/account/workspace-repository";

/** Load the signed-in owner's committed workspace, creating it on first access.
 * With `workspaceId`, `revision`, and `generation` query parameters it is a
 * conditional freshness check that omits the document when the head is unchanged.
 * Reads never write; receipt pruning runs inside Saves at most daily. */
export async function GET(request: Request): Promise<Response> {
  return accountRequest(request, async (userId) => {
    const params = new URL(request.url).searchParams;
    if (params.size === 0)
      return accountJson(await loadAccountWorkspace(userId));
    const known = workspaceCheckSchema.parse(Object.fromEntries(params));
    return accountJson(await checkAccountWorkspace(userId, known));
  });
}
