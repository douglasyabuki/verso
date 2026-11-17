import { createAuthClient } from "better-auth/client";

import { ACCOUNT_ROUTES } from "@/types-and-constants/account";

/** Providers configured on this deployment. */
export type AccountProviders = { github: boolean; google: boolean };

/** Minimal signed-in identity exposed to the client. */
export type AccountUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

/** Client account state. `expired` keeps the signed-in owner mounted so drafts and
 * pending Saves stay visible until the user signs in again. */
export type AccountSession =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "guest"; providers: AccountProviders }
  | {
      kind: "authenticated";
      providers: AccountProviders;
      user: AccountUser;
      sessionId: string;
    }
  | {
      kind: "expired";
      providers: AccountProviders;
      user: AccountUser;
      sessionId: string;
    }
  | { kind: "error"; message: string };

/** Return the owner key that scopes workspace state, storage, and in-flight work.
 * @param session Current account session.
 * @returns `guest`, `account:<userId>:<sessionId>`, or null while unresolved.
 * @example ownerKey(session) // "account:u1:s1"
 */
export function ownerKey(session: AccountSession): string | null {
  if (session.kind === "authenticated" || session.kind === "expired")
    return `account:${session.user.id}:${session.sessionId}`;
  if (session.kind === "guest" || session.kind === "unavailable")
    return "guest";
  return null;
}

/** Keep a sign-in return path same-origin and inside the app.
 * @param path Candidate path including query.
 * @returns {string} A safe relative path; anything else becomes "/".
 * @example safeReturnPath("/?scope=resumes") // "/?scope=resumes"
 */
export function safeReturnPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\"))
    return "/";
  try {
    const url = new URL(path, "https://verso.invalid");
    return url.origin === "https://verso.invalid"
      ? `${url.pathname}${url.search}`
      : "/";
  } catch {
    return "/";
  }
}

type Client = ReturnType<typeof createAuthClient>;

/** Observable account session for the client. Server checks remain authoritative;
 * this store only decides which owner's workspace is mounted.
 * @example const store = new AccountSessionStore(); await store.start()
 */
export class AccountSessionStore {
  private state: AccountSession = { kind: "loading" };

  private listeners = new Set<() => void>();

  private client: Client | null = null;

  private providers: AccountProviders = { github: false, google: false };

  private epoch = 0;

  constructor(
    private readonly fetcher: typeof fetch = fetch.bind(globalThis),
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): AccountSession => this.state;

  private publish(state: AccountSession): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }

  /** Discover configured providers, then the current session. Guest-only deployments
   * resolve to `unavailable` without contacting the auth service.
   * @returns Completion; failures publish `error` (the guest workspace stays usable).
   * @example await store.start()
   */
  async start(): Promise<void> {
    const epoch = ++this.epoch;
    try {
      const response = await this.fetcher(ACCOUNT_ROUTES.options, {
        cache: "no-store",
      });
      this.providers = response.ok
        ? ((await response.json()) as AccountProviders)
        : { github: false, google: false };
    } catch {
      this.providers = { github: false, google: false };
    }
    if (epoch !== this.epoch) return;
    if (!this.providers.github && !this.providers.google) {
      this.publish({ kind: "unavailable" });
      return;
    }
    this.client ??= createAuthClient();
    await this.refresh();
  }

  /** Re-read the session; a different user or session remounts the workspace.
   * @returns Completion; an expired state stays until the user signs in again.
   * @example await store.refresh()
   */
  async refresh(): Promise<void> {
    if (!this.client) return;
    const epoch = ++this.epoch;
    const result = await this.client.getSession().catch(() => null);
    if (epoch !== this.epoch) return;
    if (!result || result.error) {
      // Unknown session: never fall back to the guest workspace for a possibly
      // signed-in user, and keep an already mounted owner as it is.
      if (this.state.kind === "loading")
        this.publish({
          kind: "error",
          message: "Could not check your sign-in. Reload to try again.",
        });
      return;
    }
    const data = result.data;
    if (!data) {
      if (this.state.kind === "authenticated" || this.state.kind === "expired")
        this.publish({ ...this.state, kind: "expired" });
      else this.publish({ kind: "guest", providers: this.providers });
      return;
    }
    const current = this.state;
    if (
      current.kind === "authenticated" &&
      current.user.id === data.user.id &&
      current.sessionId === data.session.id
    )
      return;
    this.publish({
      kind: "authenticated",
      providers: this.providers,
      sessionId: data.session.id,
      user: {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        image: data.user.image,
      },
    });
  }

  /** Mark the mounted account session invalid after a server rejection, keeping its workspace mounted.
   * @returns {void} No value.
   * @example store.invalidate()
   */
  invalidate(): void {
    if (this.state.kind === "authenticated")
      this.publish({ ...this.state, kind: "expired" });
  }

  /** Start provider sign-in, returning to a validated same-origin path.
   * @param provider Configured provider.
   * @param returnPath Current path and query.
   * @returns Completion; the browser navigates to the provider on success.
   * @example await store.signIn("github", location.pathname + location.search)
   */
  async signIn(
    provider: keyof AccountProviders,
    returnPath: string,
  ): Promise<string | null> {
    if (!this.client) return "Sign-in is not available.";
    const destination = new URL(
      safeReturnPath(returnPath),
      "https://verso.invalid",
    );
    destination.searchParams.delete("error");
    destination.searchParams.delete("error_description");
    const callbackURL = `${destination.pathname}${destination.search}`;
    const result = await this.client.signIn
      .social({ provider, callbackURL, errorCallbackURL: callbackURL })
      .catch(() => null);
    if (!result || result.error)
      return "Sign-in could not start. Check your connection and try again.";
    return null;
  }

  /** Sign out; the caller resolves drafts and pending work first.
   * @returns Error text, or null on success (the store then shows guest).
   * @example await store.signOut()
   */
  async signOut(): Promise<string | null> {
    if (!this.client) return null;
    const result = await this.client.signOut().catch(() => null);
    if (!result || result.error)
      return "Sign-out failed. Check your connection and try again.";
    this.epoch++;
    this.publish({ kind: "guest", providers: this.providers });
    return null;
  }
}
