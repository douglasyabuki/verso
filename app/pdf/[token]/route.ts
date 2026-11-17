import { connection } from "next/server";

import { servePublicPdf } from "@/lib/account/public-pdf";

/** Serve a link's latest public release; it changes only through explicit owner actions or opted-in automatic release. */
export async function GET(
  _request: Request,
  context: RouteContext<"/pdf/[token]">,
): Promise<Response> {
  await connection();
  const { token } = await context.params;
  return servePublicPdf(token);
}
