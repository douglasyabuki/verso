import { connection } from "next/server";

import { servePublicPdf } from "@/lib/account/public-pdf";

/** Serve one pinned public release; its bytes never change while it exists and is not revoked. */
export async function GET(
  _request: Request,
  context: RouteContext<"/pdf/[token]/[number]">,
): Promise<Response> {
  await connection();
  const { token, number } = await context.params;
  return servePublicPdf(token, number);
}
