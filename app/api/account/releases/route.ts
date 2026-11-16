import { accountJson, accountRequest } from "@/lib/account/api";
import { readReleaseUpload } from "@/lib/account/release-api";
import { createRelease, listReleases } from "@/lib/account/release-repository";

/** List the owner's public links, release metadata, and quota usage. */
export async function GET(request: Request): Promise<Response> {
  return accountRequest(request, async (userId) =>
    accountJson(await listReleases(userId)),
  );
}

/** Store one reviewed PDF release; retries with the same operation ID replay it. */
export async function POST(request: Request): Promise<Response> {
  return accountRequest(request, async (userId) => {
    const { metadata, pdf } = await readReleaseUpload(request);
    return accountJson(await createRelease(userId, metadata, pdf));
  });
}
