import { workspaceBasePath } from "@/lib/career/navigation";

/** Keep a sign-in return path same-origin and inside the workspace.
 * @param path Candidate path including query, usually an untrusted `next` parameter.
 * @returns {string} The path and query when it is a same-origin `/app` URL; otherwise `/app`.
 * @example safeReturnPath("/app/resumes?x=1") // "/app/resumes?x=1"
 */
export function safeReturnPath(path: string | null | undefined): string {
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\")
  )
    return workspaceBasePath;
  try {
    const url = new URL(path, "https://verso.invalid");
    const inside =
      url.pathname === workspaceBasePath ||
      url.pathname.startsWith(`${workspaceBasePath}/`);
    return url.origin === "https://verso.invalid" && inside
      ? `${url.pathname}${url.search}`
      : workspaceBasePath;
  } catch {
    return workspaceBasePath;
  }
}

/** Build the sign-in or sign-up page URL that returns to an intended workspace destination.
 * @param mode Auth page to open.
 * @param next Intended destination; unsafe values fall back to `/app`.
 * @returns {string} `/sign-in` or `/sign-up`, with `next` only when it differs from `/app`.
 * @example authPagePath("sign-in", "/app/resumes") // "/sign-in?next=%2Fapp%2Fresumes"
 */
export function authPagePath(
  mode: "sign-in" | "sign-up",
  next?: string | null,
): string {
  const destination = safeReturnPath(next);
  return destination === workspaceBasePath
    ? `/${mode}`
    : `/${mode}?${new URLSearchParams({ next: destination })}`;
}
