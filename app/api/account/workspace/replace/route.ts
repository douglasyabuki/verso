import {
  accountJson,
  accountRequest,
  readAccountBody,
  replaceRequestSchema,
} from "@/lib/account/api";
import { replaceAccountWorkspace } from "@/lib/account/workspace-repository";

/** Atomically replace, import into, or roll back the reviewed workspace revision. */
export async function POST(request: Request): Promise<Response> {
  return accountRequest(request, async (userId) =>
    accountJson(
      await replaceAccountWorkspace(
        userId,
        await readAccountBody(request, replaceRequestSchema),
      ),
    ),
  );
}
