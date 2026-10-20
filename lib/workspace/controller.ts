import {
  createEmptyDocument,
  type DocumentUpdate,
  serializeBackup,
} from "@/lib/resume/model";
import {
  canCoordinate,
  commitWorkspace,
  fingerprint,
  loadWorkspace,
  type StorageReview,
  subscribeWorkspace,
  type WorkspaceSnapshot,
} from "@/lib/workspace/storage";

type Replacement = {
  title: string;
  snapshot: WorkspaceSnapshot;
  review: StorageReview | null;
  sessionOnly: boolean;
};

export type WorkspaceState = WorkspaceSnapshot & {
  ready: boolean;
  sessionOnly: boolean;
  saving: boolean;
  error: string | null;
  conflict: StorageReview | null;
  pending: Replacement | null;
  recovery: WorkspaceSnapshot | null;
  currentFingerprint: string | null;
  savedIdentity: string | null;
};

/** Own the guest workspace lifecycle independently of presentation.
 * State is tab-scoped; all durable mutations pass through commitWorkspace.
 * @example const controller = new WorkspaceController(); controller.start();
 */
export class WorkspaceController {
  private state: WorkspaceState = {
    document: createEmptyDocument(),
    backupFingerprint: null,
    ready: false,
    sessionOnly: false,
    saving: false,
    error: null,
    conflict: null,
    pending: null,
    recovery: null,
    currentFingerprint: null,
    savedIdentity: null,
  };
  private listeners = new Set<() => void>();
  private review: StorageReview | null = null;
  private generation = 0;
  private backupGeneration = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** Read the stable observable state. @returns Current immutable state. @example controller.getSnapshot() */
  getSnapshot = () => this.state;

  /** Observe state changes. @param listener Render callback. @returns Unsubscribe. @example controller.subscribe(render) */
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Publish a state transition and refresh its content identity.
   * @param patch Changed fields. @example this.patch({ saving: true });
   */
  private patch(patch: Partial<WorkspaceState>) {
    const changed = patch.document && patch.document !== this.state.document;
    this.state = {
      ...this.state,
      ...patch,
      ...(changed ? { currentFingerprint: null } : {}),
    };
    this.listeners.forEach((listener) => listener());
    if (changed) void this.identify();
  }

  /** Refresh backup comparison without letting a late digest label newer edits.
   * @returns Resolves after the current fingerprint has been calculated.
   * @example void this.identify();
   */
  private async identify() {
    const document = this.state.document;
    const currentFingerprint = await fingerprint(document);
    if (this.state.document === document) this.patch({ currentFingerprint });
  }

  /** Read stored state before editing and install cross-tab observation.
   * @returns Cleanup for timers and observation. @example useEffect(() => controller.start(), [controller]);
   */
  start = () => {
    if (!this.state.ready) {
      try {
        this.review = loadWorkspace();
        const snapshot = this.review.snapshot;
        this.patch({
          ...(snapshot ?? {}),
          ready: true,
          sessionOnly: !canCoordinate(),
          error:
            this.review.error ??
            (!canCoordinate()
              ? "Web Locks are unavailable. Browser saving is disabled."
              : null),
          savedIdentity: snapshot ? this.identity(snapshot) : null,
        });
      } catch {
        this.patch({
          ready: true,
          sessionOnly: true,
          error:
            "Browser storage cannot be read. Existing stored data has not been changed.",
        });
      }
      void this.identify();
    }
    this.schedule();
    const unsubscribe = subscribeWorkspace(() => {
      if (this.state.sessionOnly) return;
      try {
        const next = loadWorkspace();
        if (next.raw !== this.review?.raw) {
          this.generation++;
          this.patch({
            conflict: next,
            error:
              "Another tab changed the stored workspace. Saving is paused; resolve which version to keep.",
          });
        }
      } catch {
        this.patch({ error: "Stored data cannot be read. Saving is paused." });
      }
    });
    return () => {
      clearTimeout(this.timer);
      unsubscribe();
    };
  };

  /** Compare content and backup metadata separately from transient UI state.
   * @param snapshot Workspace payload. @returns Exact save identity. @example this.identity(this.state)
   */
  private identity(snapshot: WorkspaceSnapshot) {
    return JSON.stringify([
      serializeBackup(snapshot.document),
      snapshot.backupFingerprint,
    ]);
  }

  /** Report whether the current payload still needs a browser commit.
   * @returns True for pending changes; blocked saving is reported separately.
   * @example controller.isUnsaved()
   */
  isUnsaved = () => this.identity(this.state) !== this.state.savedIdentity;

  /** Schedule a debounced ordinary save unless resolution is required.
   * @example this.schedule();
   */
  private schedule() {
    clearTimeout(this.timer);
    if (
      this.state.sessionOnly ||
      this.state.error ||
      this.state.conflict ||
      this.state.pending
    )
      return;
    this.timer = setTimeout(() => {
      void this.flush();
    }, 500);
  }

  /** Apply an isolated domain edit and queue local persistence.
   * @param update Draft mutation. @example controller.edit(draft => { draft.profile.name = "Alex"; });
   */
  edit = (update: DocumentUpdate) => {
    if (this.state.saving) return;
    const document = structuredClone(this.state.document);
    update(document);
    document.revision++;
    this.generation++;
    this.patch({ document });
    this.schedule();
  };

  /** Commit a pending ordinary save. Page-hidden callers get best-effort behavior.
   * @returns Resolves after the attempted write; blocked saves remain untouched.
   * @example void controller.flush();
   */
  flush = async () => {
    clearTimeout(this.timer);
    if (
      !this.state.ready ||
      this.state.sessionOnly ||
      this.state.saving ||
      this.state.error ||
      this.state.conflict ||
      this.state.pending ||
      !this.isUnsaved()
    )
      return;
    await this.write(
      {
        document: this.state.document,
        backupFingerprint: this.state.backupFingerprint,
      },
      this.review,
      false,
    );
  };

  /** Execute the only persistent mutation path and publish its outcome.
   * @param snapshot Candidate payload. @param review Approved stored version.
   * @param replace Whether success replaces the tab's workspace and retains recovery.
   * @returns Resolves after publishing success/conflict/failure.
   * @example await this.write(candidate, review, true);
   */
  private async write(
    snapshot: WorkspaceSnapshot,
    review: StorageReview | null,
    replace: boolean,
  ) {
    if (this.state.saving) return;
    const generation = ++this.generation;
    this.patch({ saving: true });
    const result = await commitWorkspace(
      review?.raw ?? null,
      snapshot,
      () => generation === this.generation,
    );
    this.patch({ saving: false });
    if (result.status === "success") {
      this.review = result.review;
      if (replace) this.backupGeneration++;
      const previous = {
        document: this.state.document,
        backupFingerprint: this.state.backupFingerprint,
      };
      this.patch({
        ...(replace ? { ...snapshot, recovery: previous, pending: null } : {}),
        savedIdentity: this.identity(snapshot),
        sessionOnly: false,
        error: null,
        conflict: null,
      });
      if (this.isUnsaved()) this.schedule();
    } else if (result.status === "conflict") {
      this.patch({
        conflict: result.review,
        error:
          "Stored data changed after it was reviewed. Review it again before replacing anything.",
      });
    } else if (result.status === "failure") {
      const backupChanged =
        snapshot.backupFingerprint !==
        (review?.snapshot?.backupFingerprint ?? null);
      this.patch({
        error: backupChanged
          ? `The JSON backup marker could not be saved in this browser. ${result.error}`
          : result.error,
      });
    }
  }

  /** Mark an initiated JSON download as the portable backup baseline.
   * @param document Exact downloaded snapshot. @returns Resolves after its fingerprint is queued for saving.
   * @example await controller.markBackup(snapshot);
   */
  markBackup = async (document: WorkspaceSnapshot["document"]) => {
    const generation = ++this.backupGeneration;
    const backupFingerprint = await fingerprint(document);
    if (generation !== this.backupGeneration) return;
    this.patch({ backupFingerprint });
    this.schedule();
  };

  /** Stage a replacement against the version already reviewed in this tab.
   * @param title Replacement description. @param snapshot Validated candidate and backup baseline.
   * @example controller.requestReplacement("Load example", example);
   */
  requestReplacement = (title: string, snapshot: WorkspaceSnapshot) => {
    if (this.state.saving) return;
    this.generation++;
    clearTimeout(this.timer);
    this.patch({
      pending: {
        title,
        snapshot,
        review: this.review,
        sessionOnly: this.state.sessionOnly,
      },
    });
  };

  /** Dismiss a replacement without changing content or its stored version.
   * @example controller.cancelReplacement();
   */
  cancelReplacement = () => {
    this.patch({ pending: null });
    this.schedule();
  };

  /** Confirm the staged candidate, either conditionally committing or changing only this tab.
   * @returns Resolves after the replacement attempt. @example void controller.confirmReplacement();
   */
  confirmReplacement = async () => {
    const pending = this.state.pending;
    if (!pending || this.state.saving) return;
    if (pending.sessionOnly) {
      this.generation++;
      this.backupGeneration++;
      this.patch({
        ...pending.snapshot,
        recovery: {
          document: this.state.document,
          backupFingerprint: this.state.backupFingerprint,
        },
        pending: null,
        sessionOnly: true,
        conflict: null,
        error: null,
        savedIdentity: null,
      });
    } else {
      await this.write(pending.snapshot, pending.review, true);
    }
  };

  /** Explicitly choose a session-only replacement; confirmation is still required.
   * @example controller.useInThisTab();
   */
  useInThisTab = () => {
    if (this.state.saving) return;
    const pending = this.state.pending;
    this.generation++;
    clearTimeout(this.timer);
    this.patch({
      pending: {
        title: pending?.title ?? "Continue in this tab only",
        snapshot: pending?.snapshot ?? {
          document: this.state.document,
          backupFingerprint: this.state.backupFingerprint,
        },
        review: null,
        sessionOnly: true,
      },
    });
  };

  /** Review storage afresh before explicit overwrite or resuming persistence.
   * @returns Resolves synchronously after staging confirmation or publishing read failure.
   * @example controller.reviewOverwrite();
   */
  reviewOverwrite = () => {
    if (this.state.saving) return;
    try {
      if (!canCoordinate())
        throw new Error(
          "Web Locks are unavailable. Continue in this tab or export JSON.",
        );
      const review = loadWorkspace();
      this.generation++;
      clearTimeout(this.timer);
      this.patch({
        pending: {
          title: "Replace the reviewed stored version",
          snapshot: this.state.pending?.snapshot ?? {
            document: this.state.document,
            backupFingerprint: this.state.backupFingerprint,
          },
          review,
          sessionOnly: false,
        },
      });
    } catch (error) {
      this.patch({
        error:
          error instanceof Error
            ? error.message
            : "Storage could not be reviewed.",
      });
    }
  };

  /** Load a reviewed conflict only if its stored token still matches under the lock.
   * @returns Resolves after loading or reporting another conflict.
   * @example void controller.loadReviewed();
   */
  loadReviewed = async () => {
    const review = this.state.conflict;
    if (!review?.snapshot || this.state.saving) return;
    const generation = ++this.generation;
    clearTimeout(this.timer);
    this.patch({ saving: true });
    const result = await commitWorkspace(
      review.raw,
      undefined,
      () => generation === this.generation,
    );
    this.patch({ saving: false });
    if (result.status === "success") {
      this.review = result.review;
      this.backupGeneration++;
      this.patch({
        ...review.snapshot,
        recovery: {
          document: this.state.document,
          backupFingerprint: this.state.backupFingerprint,
        },
        savedIdentity: this.identity(review.snapshot),
        pending: null,
        sessionOnly: false,
        conflict: null,
        error: null,
      });
    } else if (result.status === "conflict")
      this.patch({
        conflict: result.review,
        error: "Stored data changed again. Review the newer version.",
      });
    else if (result.status === "failure") this.patch({ error: result.error });
  };
}
