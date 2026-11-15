import {
  accountJson,
  accountRequest,
  readAccountBody,
  saveRequestSchema,
} from "@/lib/account/api";
import { commitAccountSave } from "@/lib/account/workspace-repository";

/** Commit one prepared scope Save; retries with the same ID replay its receipt. */
export async function POST(request: Request): Promise<Response> {
  return accountRequest(request, async (userId) =>
    accountJson(
      await commitAccountSave(
        userId,
        await readAccountBody(request, saveRequestSchema),
      ),
    ),
  );
}
