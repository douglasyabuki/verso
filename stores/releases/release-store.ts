import type { PreviewOutput } from "@/stores/output/preview-coordinator";
import {
  ACCOUNT_SESSION_HEADER,
  type AccountErrorCode,
} from "@/types-and-constants/account";
import {
  type CreateReleaseResponse,
  type LinkAction,
  RELEASE_ROUTES,
  type ReleaseAction,
  type ReleaseList,
  type ReleaseRequestMetadata,
} from "@/types-and-constants/releases";

/** Observable release state for one signed-in owner. */
export type ReleaseStoreState = {
  list: ReleaseList | null;
  loading: boolean;
  /** Key of the action in flight (`release`, a link ID, or a release ID), if any. */
  busy: string | null;
  /** Last failure, cleared by the next successful request. */
  error: string | null;
  /** True after the last release attempt ended without a server answer; retry reuses its operation ID. */
  uncertain: boolean;
};

/** Typed release request failure. */
export class ReleaseError extends Error {
  constructor(
    readonly code: AccountErrorCode | "offline",
    message: string,
  ) {
    super(message);
    this.name = "ReleaseError";
  }
}

/** Input for one release upload, taken from the current committed preview. */
export type ReleaseInput = {
  output: PreviewOutput;
  workspaceId: string;
  advance: boolean;
  automatic: boolean;
};

export type ReleaseStoreOptions = {
  fetch?: typeof fetch;
  onSessionInvalid?: () => void;
  createId?: () => string;
};

const OFFLINE =
  "Account storage did not answer. Nothing is published until a release is confirmed; retry to check again.";

/** Client store for one owner's public links and releases. Requests carry the
 * session-binding header; each release is prepared once with a stable operation ID
 * that retries reuse, so an interrupted upload never publishes twice. Prepared
 * requests live in memory only: after a reload, the refreshed list shows whether an
 * interrupted release landed.
 * @param identity Session-derived owner and session ID.
 * @param options Optional fetch/ID factories for tests and a session-invalid callback.
 * @example const store = new ReleaseStore({ userId, sessionId }); await store.load();
 */
export class ReleaseStore {
  private state: ReleaseStoreState = {
    list: null,
    loading: false,
    busy: null,
    error: null,
    uncertain: false,
  };
  private listeners = new Set<() => void>();
  private abort = new AbortController();
  private prepared = new Map<string, string>();
  private readonly fetcher: typeof fetch;
  private readonly createId: () => string;

  constructor(
    private readonly identity: { userId: string; sessionId: string },
    private readonly options: ReleaseStoreOptions = {},
  ) {
    this.fetcher = options.fetch ?? ((...args) => fetch(...args));
    this.createId = options.createId ?? (() => crypto.randomUUID());
  }

  /** Owner this store belongs to. */
  get userId() {
    return this.identity.userId;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  private publish(patch: Partial<ReleaseStoreState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private async request<T>(
    path: string,
    init: { method?: string; body?: BodyInit; json?: unknown } = {},
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher(path, {
        method: init.method ?? "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal: this.abort.signal,
        headers: {
          [ACCOUNT_SESSION_HEADER]: this.identity.sessionId,
          ...(init.json === undefined
            ? {}
            : { "content-type": "application/json" }),
        },
        body: init.json === undefined ? init.body : JSON.stringify(init.json),
      });
    } catch {
      throw new ReleaseError("offline", OFFLINE);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ReleaseError("offline", OFFLINE);
    }
    if (response.ok) return payload as T;
    const { code, message } = (payload ?? {}) as {
      code?: AccountErrorCode;
      message?: string;
    };
    if (code === "unauthorized" || code === "session_mismatch")
      this.options.onSessionInvalid?.();
    throw new ReleaseError(
      code ?? "offline",
      code === "unavailable" || !code
        ? OFFLINE
        : (message ?? "Release request rejected."),
    );
  }

  private async run<T>(
    busy: string,
    work: () => Promise<T>,
    adopt: (result: T) => ReleaseList,
  ): Promise<T> {
    this.publish({ busy, error: null });
    try {
      const result = await work();
      this.publish({ list: adopt(result), busy: null, error: null });
      return result;
    } catch (error) {
      if (this.abort.signal.aborted) throw error;
      this.publish({ busy: null, error: (error as Error).message });
      throw error;
    }
  }

  /** Load links, release history, and usage (one request).
   * @returns {Promise<ReleaseList>} Current list.
   * @example await store.load()
   */
  async load(): Promise<ReleaseList> {
    this.publish({ loading: true, error: null });
    try {
      const list = await this.request<ReleaseList>(RELEASE_ROUTES.releases);
      this.publish({ list, loading: false });
      return list;
    } catch (error) {
      if (!this.abort.signal.aborted)
        this.publish({ loading: false, error: (error as Error).message });
      throw error;
    }
  }

  /** Upload one reviewed committed PDF. Retries of the same output and options reuse the operation ID.
   * @param input Current committed preview output and release options.
   * @returns {Promise<CreateReleaseResponse>} Stored, replayed, or unchanged release.
   * @example await store.release({ output, workspaceId, advance: true, automatic: false })
   */
  async release(input: ReleaseInput): Promise<CreateReleaseResponse> {
    const { output } = input;
    const preparedKey = JSON.stringify([
      output.key,
      output.revision,
      input.advance,
      input.automatic,
    ]);
    let operationId = this.prepared.get(preparedKey);
    if (!operationId) {
      operationId = this.createId();
      this.prepared.set(preparedKey, operationId);
    }
    const metadata: ReleaseRequestMetadata = {
      operationId,
      resumeId: output.tag.resumeId,
      workspaceId: input.workspaceId,
      revision: output.revision,
      generation: output.tag.generation,
      fingerprint: output.tag.fingerprint,
      templateId: output.template,
      advance: input.advance,
      automatic: input.automatic,
    };
    const form = new FormData();
    form.set("metadata", JSON.stringify(metadata));
    form.set(
      "pdf",
      new Blob([Uint8Array.from(output.bytes)], { type: "application/pdf" }),
      "release.pdf",
    );
    try {
      const result = await this.run(
        "release",
        () =>
          this.request<CreateReleaseResponse>(RELEASE_ROUTES.releases, {
            method: "POST",
            body: form,
          }),
        (response) => response.list,
      );
      this.prepared.delete(preparedKey);
      this.publish({ uncertain: false });
      return result;
    } catch (error) {
      const uncertain =
        error instanceof ReleaseError && error.code === "offline";
      if (!uncertain) this.prepared.delete(preparedKey);
      this.publish({ uncertain });
      throw error;
    }
  }

  /** Apply a link action (move latest or toggle automatic release).
   * @param linkId Link identity.
   * @param action Validated action.
   * @returns {Promise<ReleaseList>} Updated list.
   * @example await store.updateLink(link.id, { action: "set-latest", releaseId })
   */
  updateLink(linkId: string, action: LinkAction): Promise<ReleaseList> {
    return this.run(
      linkId,
      () =>
        this.request<ReleaseList>(RELEASE_ROUTES.link(linkId), {
          method: "PATCH",
          json: action,
        }),
      (list) => list,
    );
  }

  /** Revoke a link, deleting it with its releases.
   * @param linkId Link identity.
   * @returns {Promise<ReleaseList>} Updated list.
   * @example await store.revokeLink(link.id)
   */
  revokeLink(linkId: string): Promise<ReleaseList> {
    return this.run(
      linkId,
      () =>
        this.request<ReleaseList>(RELEASE_ROUTES.link(linkId), {
          method: "DELETE",
        }),
      (list) => list,
    );
  }

  /** Revoke or restore one release.
   * @param releaseId Release identity.
   * @param action Validated action.
   * @returns {Promise<ReleaseList>} Updated list.
   * @example await store.updateRelease(release.id, { action: "revoke" })
   */
  updateRelease(
    releaseId: string,
    action: ReleaseAction,
  ): Promise<ReleaseList> {
    return this.run(
      releaseId,
      () =>
        this.request<ReleaseList>(RELEASE_ROUTES.release(releaseId), {
          method: "PATCH",
          json: action,
        }),
      (list) => list,
    );
  }

  /** Permanently delete one release.
   * @param releaseId Release identity.
   * @returns {Promise<ReleaseList>} Updated list.
   * @example await store.deleteRelease(release.id)
   */
  deleteRelease(releaseId: string): Promise<ReleaseList> {
    return this.run(
      releaseId,
      () =>
        this.request<ReleaseList>(RELEASE_ROUTES.release(releaseId), {
          method: "DELETE",
        }),
      (list) => list,
    );
  }

  /** Forget prepared uploads and reload the list after the workspace's data was deleted.
   * Every link and release was deleted with it; a prepared upload would be rejected anyway.
   * @returns {Promise<void>} Completion of the reload; failures are kept in `error`.
   * @example await store.reset()
   */
  async reset(): Promise<void> {
    this.prepared.clear();
    this.publish({ uncertain: false, error: null });
    await this.load().catch(() => {});
  }

  /** Abort in-flight requests and drop listeners when the owner changes. */
  dispose() {
    this.abort.abort();
    this.listeners.clear();
  }
}
