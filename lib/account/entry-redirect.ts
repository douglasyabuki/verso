import { safeReturnPath } from "@/lib/account/return-path";
import { destinationUrl, parseDestination } from "@/lib/career/navigation";

/** Decide where an entry-page request should go before rendering, without any database read.
 * @param url Requested URL (`/`, `/sign-in`, or `/sign-up`).
 * @param hasSessionCookie Whether a session cookie is present; this is an optimistic hint, not authentication.
 * @returns {{ location: string; permanent: boolean } | null} Redirect target with `permanent` for legacy workspace links, or null to render the page.
 * @example entryRedirect(new URL("https://verso.test/"), true) // { location: "/app", permanent: false }
 */
export function entryRedirect(
  url: URL,
  hasSessionCookie: boolean,
): { location: string; permanent: boolean } | null {
  if (url.pathname === "/") {
    const legacy = url.searchParams.get("scope");
    if (legacy !== null) {
      const target = destinationUrl(url, parseDestination(legacy));
      return {
        location: `${target.pathname}${target.search}`,
        permanent: true,
      };
    }
    return hasSessionCookie ? { location: "/app", permanent: false } : null;
  }
  if (
    hasSessionCookie &&
    (url.pathname === "/sign-in" || url.pathname === "/sign-up")
  )
    return {
      location: safeReturnPath(url.searchParams.get("next")),
      permanent: false,
    };
  return null;
}
