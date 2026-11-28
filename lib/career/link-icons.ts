import type { CareerLink } from "@/types-and-constants/career";
import type { LinkBrandId, LinkIconId } from "@/types-and-constants/link-icons";

/** Registrable domains whose host or intended subdomains identify a brand. */
const BRAND_DOMAINS: readonly [string, LinkBrandId][] = [
  ["behance.net", "behance"],
  ["dribbble.com", "dribbble"],
  ["github.com", "github"],
  ["gitlab.com", "gitlab"],
  ["instagram.com", "instagram"],
  ["linkedin.com", "linkedin"],
  ["medium.com", "medium"],
  ["tiktok.com", "tiktok"],
  ["x.com", "x-twitter"],
  ["twitter.com", "x-twitter"],
  ["youtube.com", "youtube"],
  ["youtu.be", "youtube"],
];

/** Google Scholar is served from scholar.google.<tld> and scholar.google.com.<cc>. */
const SCHOLAR_HOST = /^scholar\.google\.(?:[a-z]{2,3}|com?\.[a-z]{2})$/;

/** Detect a recognized platform from a link's hostname.
 * @param url Stored link destination; may be empty or malformed.
 * @returns {LinkIconId} The brand whose domain (or a subdomain of it) hosts the URL, otherwise "website".
 * @example detectLinkIcon("https://www.linkedin.com/in/alex") // "linkedin"
 * @example detectLinkIcon("https://github.com.example.net") // "website"
 */
export function detectLinkIcon(url: string): LinkIconId {
  let host: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
      return "website";
    host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return "website";
  }
  if (SCHOLAR_HOST.test(host)) return "google-scholar";
  for (const [domain, brand] of BRAND_DOMAINS)
    if (host === domain || host.endsWith("." + domain)) return brand;
  return "website";
}

/** Resolve the icon a link displays: an explicit choice, else automatic detection.
 * @param link Stored link with an optional explicit icon.
 * @returns {LinkIconId} Explicit override or detected icon.
 * @example resolveLinkIcon({ url: "https://x.com/a", icon: undefined }) // "x-twitter"
 */
export function resolveLinkIcon(link: Pick<CareerLink, "url" | "icon">) {
  return link.icon ?? detectLinkIcon(link.url);
}

/** Normalize a destination for duplicate detection without hiding meaningful
 * differences: only scheme/host case, default ports, and an empty root path are
 * ignored. Paths, trailing slashes beyond the root, queries, and fragments count.
 * @param url Stored URL.
 * @returns {string} Comparison key, or the trimmed input when it cannot be parsed.
 * @example destinationKey("HTTPS://Example.com:443") // "https://example.com/"
 */
export function destinationKey(url: string): string {
  try {
    const parsed = new URL(url.trim());
    return parsed.href;
  } catch {
    return url.trim();
  }
}

/** Check whether two links lead to the same destination.
 * @param first Stored URL.
 * @param second Stored URL.
 * @returns {boolean} True when both are nonempty and normalize identically.
 * @example sameDestination("https://a.dev/x", "https://A.dev/x") // true
 */
export function sameDestination(first: string, second: string): boolean {
  return (
    !!first.trim() &&
    !!second.trim() &&
    destinationKey(first) === destinationKey(second)
  );
}
