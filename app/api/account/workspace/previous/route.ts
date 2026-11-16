import { accountJson, accountRequest } from "@/lib/account/api";
import { loadPreviousAccountWorkspace } from "@/lib/account/workspace-repository";

/** Return the one previous workspace, or null when none is retained. */
export async function GET(request: Request): Promise<Response> {
  return accountRequest(request, async (userId) =>
    accountJson((await loadPreviousAccountWorkspace(userId)) ?? null),
  );
}
