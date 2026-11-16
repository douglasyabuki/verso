import { toNextJsHandler } from "better-auth/next-js";

import { accountsEnabled, getAuth } from "@/lib/account/auth";

/** Delegate one auth request, failing closed when accounts are not configured. */
async function handle(request: Request): Promise<Response> {
  if (!accountsEnabled())
    return Response.json(
      { code: "unavailable", message: "Accounts are not enabled." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  try {
    const handler = toNextJsHandler(getAuth());
    const response =
      request.method === "GET"
        ? await handler.GET(request)
        : await handler.POST(request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return Response.json(
      { code: "unavailable", message: "Sign-in is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = handle;

export const POST = handle;
