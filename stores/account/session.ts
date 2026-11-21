import { createAuthClient } from "better-auth/client";

import { safeReturnPath } from "@/lib/account/return-path";
import {
  ACCOUNT_DELETION,
  ACCOUNT_DELETION_HEADER,
  ACCOUNT_ROUTES,
  ACCOUNT_SESSION_HEADER,
  type AccountErrorCode,
} from "@/types-and-constants/account";

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

/** Sign-in method linked to the signed-in user. */
export type LinkedAccount = { id: string; providerId: string };

/** Failure of an account deletion step; nothing was deleted. */
export type DeletionFailure = {
  ok: false;
  code: AccountErrorCode | "offline";
  message: string;
};

type Client = ReturnType<typeof createAuthClient>;

const offlineDeletion: DeletionFailure = {
  ok: false,
  code: "offline",
  message:
    "Verso could not reach your account. Check your connection and try again.",
};

/** Remove provider error parameters from a same-origin path.
 * @param path Relative path and query.
 * @returns {string} Path and query without `error` and `error_description`.
 * @example withoutAuthErrors("/sign-in?error=access_denied") // "/sign-in"
 */
function withoutAuthErrors(path: string): string {
  const url = new URL(path, "https://verso.invalid");
  url.searchParams.delete("error");
  url.searchParams.delete("error_description");
  return `${url.pathname}${url.search}`;
}

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

  /** Discover configured providers and prepare sign-in without reading the session.
   * Used by the sign-in and sign-up pages, which never mount a workspace.
   * @returns {Promise<AccountProviders | null>} Provider flags, or null when they could not be loaded.
   * @example const providers = await store.prepareSignIn()
   */
  async prepareSignIn(): Promise<AccountProviders | null> {
    try {
      const response = await this.fetcher(ACCOUNT_ROUTES.options, {
        cache: "no-store",
      });
      if (!response.ok) return null;
      this.providers = (await response.json()) as AccountProviders;
    } catch {
      return null;
    }
    if (this.providers.github || this.providers.google)
      this.client ??= createAuthClient();
    return this.providers;
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

  /** Start provider sign-in or sign-up, returning to a validated workspace path.
   * @param provider Configured provider.
   * @param returnPath Intended workspace path and query.
   * @param options `signUp` creates an account when none exists; `errorPath` (same-origin) receives provider errors and defaults to the return path.
   * @returns Error text, or null while the browser navigates to the provider.
   * @example await store.signIn("github", "/app/resumes", { errorPath: "/sign-in" })
   */
  async signIn(
    provider: keyof AccountProviders,
    returnPath: string,
    options: { signUp?: boolean; errorPath?: string } = {},
  ): Promise<string | null> {
    if (!this.client) return "Sign-in is not available.";
    const callbackURL = withoutAuthErrors(safeReturnPath(returnPath));
    const errorCallbackURL =
      options.errorPath?.startsWith("/") && !options.errorPath.startsWith("//")
        ? withoutAuthErrors(options.errorPath)
        : callbackURL;
    const result = await this.client.signIn
      .social({
        provider,
        callbackURL,
        errorCallbackURL,
        ...(options.signUp ? { requestSignUp: true } : {}),
      })
      .catch(() => null);
    if (!result || result.error)
      return "Sign-in could not start. Check your connection and try again.";
    return null;
  }

  /** List the sign-in methods linked to the signed-in user.
   * @returns Linked accounts, or a failure whose `reauthenticate` is true when the session is no longer valid.
   * @example const result = await store.listAccounts()
   */
  async listAccounts(): Promise<
    | { ok: true; accounts: LinkedAccount[] }
    | { ok: false; reauthenticate: boolean }
  > {
    if (!this.client) return { ok: false, reauthenticate: false };
    const result = await this.client.listAccounts().catch(() => null);
    if (!result || result.error || !result.data)
      return { ok: false, reauthenticate: result?.error?.status === 401 };
    return {
      ok: true,
      accounts: result.data.map((account) => ({
        id: account.id,
        providerId: account.providerId,
      })),
    };
  }

  /** Link another provider to the signed-in user.
   * @param provider Configured provider not yet linked.
   * @param callbackPath Workspace path to return to after linking.
   * @param errorPath Workspace path to return to on failure.
   * @returns Error text, or null while the browser navigates to the provider.
   * @example await store.connect("google", "/app/settings/account?connection=success", "/app/settings/account?connection=error")
   */
  async connect(
    provider: keyof AccountProviders,
    callbackPath: string,
    errorPath: string,
  ): Promise<string | null> {
    if (!this.client) return "Connecting accounts is not available.";
    const result = await this.client
      .linkSocial({
        provider,
        callbackURL: safeReturnPath(callbackPath),
        errorCallbackURL: safeReturnPath(errorPath),
      })
      .catch(() => null);
    if (!result || result.error)
      return result?.error?.status === 401 || result?.error?.status === 403
        ? "Sign in again before connecting another account."
        : "The connection could not start. Check your connection and try again.";
    return null;
  }

  /** Unlink one provider from the signed-in user. The server always keeps the last method.
   * @param accountId Linked account ID from `listAccounts`.
   * @returns Null on success; otherwise error text, with `reauthenticate` when a fresh sign-in is required.
   * @example await store.disconnect(account.id)
   */
  async disconnect(
    accountId: string,
  ): Promise<{ error: string; reauthenticate: boolean } | null> {
    if (!this.client)
      return { error: "Accounts are not available.", reauthenticate: false };
    const result = await this.client
      .unlinkAccount({ accountId })
      .catch(() => null);
    if (result && !result.error) return null;
    const code = result?.error?.code;
    if (result?.error?.status === 401 || code === "SESSION_NOT_FRESH")
      return {
        error: "For your security, sign in again before disconnecting.",
        reauthenticate: true,
      };
    if (code === "FAILED_TO_UNLINK_LAST_ACCOUNT")
      return {
        error: "Keep at least one sign-in method connected.",
        reauthenticate: false,
      };
    return {
      error: "The account could not be disconnected. Please retry.",
      reauthenticate: false,
    };
  }

  /** Send one account deletion request bound to the mounted session.
   * @param init Method, optional JSON body, and optional capability.
   * @returns Parsed JSON body on success, or a typed failure (`offline` when the outcome is unknown).
   * @example await this.deletionRequest({ method: "POST", body: { intent: "prepare" } })
   */
  private async deletionRequest(init: {
    method: "POST" | "DELETE" | "PATCH";
    body?: unknown;
    capability?: string;
  }): Promise<{ ok: true; data: Record<string, unknown> } | DeletionFailure> {
    const state = this.state;
    const headers: Record<string, string> = {};
    if (state.kind === "authenticated" || state.kind === "expired")
      headers[ACCOUNT_SESSION_HEADER] = state.sessionId;
    if (init.capability) headers[ACCOUNT_DELETION_HEADER] = init.capability;
    if (init.body !== undefined) headers["content-type"] = "application/json";
    let response: Response;
    try {
      response = await this.fetcher(ACCOUNT_ROUTES.account, {
        method: init.method,
        credentials: "same-origin",
        cache: "no-store",
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch {
      return offlineDeletion;
    }
    const payload = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!payload) return offlineDeletion;
    if (response.ok) return { ok: true, data: payload };
    return {
      ok: false,
      code:
        typeof payload.code === "string"
          ? (payload.code as AccountErrorCode)
          : "unavailable",
      message:
        typeof payload.message === "string"
          ? payload.message
          : "The account could not be deleted.",
    };
  }

  /** Prepare a deletion attempt; the server requires a recent sign-in.
   * @returns The signed capability, or a failure (`reauthenticate` asks for a fresh sign-in).
   * @example const prepared = await store.prepareDeletion()
   */
  async prepareDeletion(): Promise<
    { ok: true; capability: string } | DeletionFailure
  > {
    const result = await this.deletionRequest({
      method: "POST",
      body: { intent: "prepare" },
    });
    if (!result.ok) return result;
    return typeof result.data.capability === "string"
      ? { ok: true, capability: result.data.capability }
      : offlineDeletion;
  }

  /** Permanently delete the account. An unknown outcome is settled with the capability, never replayed.
   * On success the store publishes `guest`, which unmounts the account workspace.
   * @param capability Capability from `prepareDeletion`.
   * @returns `{ ok: true }` once the account no longer exists, or a failure that left it intact.
   * @example await store.deleteAccount(capability)
   */
  async deleteAccount(
    capability: string,
  ): Promise<{ ok: true } | DeletionFailure> {
    const result = await this.deletionRequest({
      method: "DELETE",
      body: { confirmation: ACCOUNT_DELETION.confirmation },
      capability,
    });
    // A lost response or a vanished session may mean the delete already committed.
    if (
      !result.ok &&
      result.code !== "offline" &&
      result.code !== "unauthorized"
    )
      return result;
    if (!result.ok) {
      const settled = await this.deletionRequest({
        method: "PATCH",
        capability,
      });
      if (!settled.ok) return settled;
      if (settled.data.deleted !== true)
        return {
          ok: false,
          code: "deletion_cancelled",
          message:
            "The connection dropped before deletion finished. Nothing was deleted; you can try again.",
        };
    }
    this.epoch++;
    this.publish({ kind: "guest", providers: this.providers });
    return { ok: true };
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
