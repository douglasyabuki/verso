import { connection } from "next/server";

import { accountProviders } from "@/lib/account/auth";

/** Report configured providers at request time so deployments read their own env. */
export async function GET(): Promise<Response> {
  await connection();
  return Response.json(accountProviders(), {
    headers: { "Cache-Control": "no-store" },
  });
}
