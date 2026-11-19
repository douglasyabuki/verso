import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

import { entryRedirect } from "@/lib/account/entry-redirect";

/** Route entry pages optimistically from the session cookie alone, with no database read.
 * The workspace still verifies the session; a stale cookie lands on `/app` once, where the
 * session check clears it. */
export function proxy(request: NextRequest): NextResponse {
  const redirect = entryRedirect(
    new URL(request.url),
    getSessionCookie(request) !== null,
  );
  if (!redirect) return NextResponse.next();
  return NextResponse.redirect(
    new URL(redirect.location, request.url),
    redirect.permanent ? 308 : 307,
  );
}

export const config = { matcher: ["/", "/sign-in", "/sign-up"] };
