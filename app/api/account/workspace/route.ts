import { accountJson, accountRequest } from "@/lib/account/api";
import {
  loadAccountWorkspace,
  pruneAccountOperations,
} from "@/lib/account/workspace-repository";

/** Load the signed-in owner's committed workspace, creating it on first access. */
export async function GET(request: Request): Promise<Response> {
  return accountRequest(request, async (userId) => {
    const head = await loadAccountWorkspace(userId);
    // Receipt retention runs once per workspace load, outside any Save transaction.
    await pruneAccountOperations(userId).catch(() => 0);
    return accountJson(head);
  });
}
