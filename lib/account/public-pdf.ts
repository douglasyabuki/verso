import "server-only";

import { accountsEnabled } from "@/lib/account/auth";
import { readPublicPdf } from "@/lib/account/release-repository";

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

const notFound = () =>
  new Response("Not found.", {
    status: 404,
    headers: { ...HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });

/** Serve one public release anonymously. Unknown, revoked, deleted, and malformed
 * links share one 404 so responses never reveal whether a link exists. Responses are
 * never cached, so advancement, rollback, and revocation apply on the next request.
 * @param token Link token from the URL.
 * @param number Pinned release number text, or undefined for the latest release.
 * @returns {Promise<Response>} Inline PDF with its release file name, or 404.
 * @example return servePublicPdf(token, "3")
 */
export async function servePublicPdf(
  token: string,
  number?: string,
): Promise<Response> {
  if (!accountsEnabled() || !/^[A-Za-z0-9_-]{43}$/.test(token))
    return notFound();
  if (number !== undefined && !/^[1-9]\d{0,8}$/.test(number)) return notFound();
  let release: Awaited<ReturnType<typeof readPublicPdf>>;
  try {
    release = await readPublicPdf(
      token,
      number === undefined ? undefined : Number(number),
    );
  } catch {
    return new Response("Temporarily unavailable.", {
      status: 503,
      headers: { ...HEADERS, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (!release) return notFound();
  return new Response(new Blob([Uint8Array.from(release.pdf)]), {
    headers: {
      ...HEADERS,
      "Content-Type": "application/pdf",
      "Content-Length": String(release.pdf.byteLength),
      "Content-Disposition": `inline; filename="${release.fileName}"; filename*=UTF-8''${encodeURIComponent(release.fileName)}`,
      ETag: `"${release.pdfSha256}"`,
    },
  });
}
