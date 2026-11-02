import { reconcileProfileSelection } from "@/lib/content/profile";
import { createEmptyDocument } from "@/lib/resume/factories";
import { reconcileVariantWording } from "@/lib/wording/wording";
import { parseBackup, serializeBackup } from "@/lib/workspace/backup";
import { semanticallyEqual } from "@/lib/workspace/semantic";
import {
  canCoordinate,
  commitWorkspace,
  fingerprint,
  loadWorkspace,
  subscribeWorkspace,
} from "@/stores/workspace/persistence";
import { type ResumeDocument } from "@/types-and-constants/resume";
import type {
  EditGroup,
  OperationKind,
  StorageReview,
  WorkspaceEdit,
  WorkspaceNotice,
  WorkspaceSnapshot,
  WorkspaceState,
} from "@/types-and-constants/workspace";

/** Own the guest workspace lifecycle independently of presentation.
 * State is tab-scoped; all durable mutations pass through commitWorkspace.
 * @example const controller = new WorkspaceController(); controller.start();
 */
export class WorkspaceController {
  private state: WorkspaceState = {
    textHistoryEpoch: 0,
    workspaceEpoch: 0,
    document: createEmptyDocument(),
    backupFingerprint: null,
    ready: false,
    sessionOnly: false,
    saving: false,
    replacing: false,
    canUndo: false,
    canRedo: false,
    error: null,
    notice: null,
    backupFailure: null,
    conflict: null,
    pending: null,
    recovery: null,
    currentFingerprint: null,
    savedIdentity: null,
  };
  private listeners = new Set<() => void>();
  private review: StorageReview | null = null;
  private generation = 0;
  private documentGeneration = 0;
  private backupGeneration = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private past: ResumeDocument[] = [];
  private future: ResumeDocument[] = [];
  private editGroup: (EditGroup & { at: number }) | null = null;
  private textHistoryEpoch = 0;
  private workspaceEpoch = 0;
  private noticeId = 0;

  private editorDraftGuard: (() => boolean) | null = null;

  /** Register the mounted editor's local draft boundary.
   * @param guard Validate and commit outgoing drafts; false keeps the context.
   * @returns Cleanup that cannot unregister a newer editor.
   * @example return controller.registerEditorDraftGuard(commitDrafts);
   */
  registerEditorDraftGuard = (guard: () => boolean) => {
    this.editorDraftGuard = guard;
    return () => {
      if (this.editorDraftGuard === guard) this.editorDraftGuard = null;
    };
  };

  /** Validate local drafts before changing editor context.
   * @returns False when an invalid draft blocks navigation.
   * @example if (!controller.commitEditorDrafts()) return;
   */
  commitEditorDrafts = () => this.editorDraftGuard?.() ?? true;

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
      textHistoryEpoch: this.textHistoryEpoch,
      workspaceEpoch: this.workspaceEpoch,
      ...(changed ? { currentFingerprint: null } : {}),
    };
    this.state.canUndo =
      this.past.length > 0 && !this.state.pending && !this.state.replacing;
    this.state.canRedo =
      this.future.length > 0 && !this.state.pending && !this.state.replacing;
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error("Workspace subscriber failed", error);
      }
    });
    if (changed) void this.identify();
    if (
      patch.pending?.review?.snapshot &&
      !patch.pending.review.documentFingerprint
    )
      this.identifyReview(patch.pending);
  }

  /** Enrich only the still-current reviewed dialog with exact browser backup freshness.
   * @param pending Immutable operation whose browser record was reviewed.
   * @returns Resolves without mutation if the operation changed while hashing.
   * @example void this.identifyReview(pending);
   */
  private async identifyReview(
    pending: NonNullable<WorkspaceState["pending"]>,
  ) {
    const review = pending.review;
    if (!review?.snapshot) return;
    try {
      const documentFingerprint = await fingerprint(review.snapshot.document);
      if (this.state.pending !== pending) return;
      this.patch({
        pending: { ...pending, review: { ...review, documentFingerprint } },
      });
    } catch {
      /* Unknown freshness cannot authorize writes or label a backup current. */
    }
  }

  /** Refresh backup comparison without letting a late digest label newer edits.
   * @returns Resolves after the current fingerprint has been calculated.
   * @example void this.identify();
   */
  private async identify() {
    const document = this.state.document;
    try {
      const currentFingerprint = await fingerprint(document);
      if (this.state.document !== document) return;
      this.patch({ currentFingerprint });
    } catch {
      /* Unknown freshness is never reported as a current backup. */
    }
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
              ? "This browser cannot safely save changes across tabs. Changes are kept only in this tab and can be lost when you close it. Download a backup to keep your work."
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
          this.documentGeneration++;
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
      this.state.saving ||
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
   * @param update Draft mutation. @param group Explicit field input boundary, omitted for discrete actions.
   * @example controller.edit(draft => { draft.profile.name = "Alex"; });
   */
  edit: WorkspaceEdit = (update, group) => {
    if (!this.state.ready || this.state.pending || this.state.replacing) return;
    const document = structuredClone(this.state.document);
    update(document);
    reconcileProfileSelection(document);
    reconcileVariantWording(this.state.document, document);
    if (serializeBackup(document) === serializeBackup(this.state.document))
      return;
    const now = performance.now();
    const grouped =
      group &&
      group.kind !== "isolated" &&
      group.key === this.editGroup?.key &&
      group.kind === this.editGroup.kind &&
      (group.kind === "composition" || now - this.editGroup.at < 1000);
    if (!grouped) {
      this.past.push(this.state.document);
      if (this.past.length > 100) this.past.shift();
    }
    this.future = [];
    this.editGroup =
      group && group.kind !== "isolated" ? { ...group, at: now } : null;
    this.applyDocument(document);
  };

  /** End consecutive field input without adding a history step.
   * @example controller.endEditGroup();
   */
  endEditGroup = () => {
    this.editGroup = null;
  };

  /** Restore the previous content as a new revision; blocked during replacements.
   * @example controller.undo();
   */
  undo = () => {
    const previous = this.state.document;
    this.restoreHistory(this.past, this.future);
    if (this.state.document !== previous) this.notify("Action undone");
  };

  /** Restore undone content as a new revision; blocked during replacements.
   * @example controller.redo();
   */
  redo = () => {
    this.restoreHistory(this.future, this.past);
  };

  /** Move one document between history stacks without restoring persistence metadata.
   * @param source Steps to restore. @param destination Steps for the opposite command.
   * @example this.restoreHistory(this.past, this.future);
   */
  private restoreHistory(
    source: ResumeDocument[],
    destination: ResumeDocument[],
  ) {
    if (!this.state.ready || this.state.pending || this.state.replacing) return;
    this.endEditGroup();
    const document = source.pop();
    if (!document) return;
    destination.push(this.state.document);
    this.textHistoryEpoch++;
    this.applyDocument(structuredClone(document));
  }

  /** Publish content with a fresh revision through ordinary save controls.
   * @param document Isolated content to publish. @example this.applyDocument(draft);
   */
  private applyDocument(document: ResumeDocument) {
    document.revision = this.state.document.revision + 1;
    this.generation++;
    this.documentGeneration++;
    this.patch({ document });
    this.schedule();
  }

  /** Clear history only after a workspace replacement succeeds.
   * @example this.resetHistory();
   */
  private resetHistory() {
    this.workspaceEpoch++;
    this.textHistoryEpoch++;
    this.past = [];
    this.future = [];
    this.endEditGroup();
  }

  /** Commit a pending ordinary save. Page-hidden callers get best-effort behavior.
   * @returns Resolves after the attempted write; blocked saves remain untouched.
   * @example void controller.flush();
   */
  flush = async () => {
    clearTimeout(this.timer);
    const document = this.state.document;
    await this.identify();
    if (this.state.document !== document) {
      this.schedule();
      return;
    }
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
    const pending = replace ? this.state.pending : null;
    const clear = pending?.kind === "clear";
    const backupOrigin = pending?.backupOrigin;
    const changesTab =
      replace &&
      pending?.writeTarget !== "browser" &&
      pending?.writeTarget !== "none";
    // Prepare the entire replacement before the durable boundary.
    const prepared = {
      document: parseBackup(serializeBackup(snapshot.document)),
      backupFingerprint: snapshot.backupFingerprint,
    };
    const previous = this.snapshot();
    const recovery = clear
      ? null
      : changesTab &&
          !semanticallyEqual(previous.document, prepared.document) &&
          this.meaningful(previous.document)
        ? previous
        : this.state.recovery;
    const generation = ++this.generation;
    if (replace) this.backupGeneration++;
    this.patch({ saving: true, replacing: replace });
    const result = await commitWorkspace(
      review?.raw ?? null,
      pending?.writeTarget === "tab" || pending?.writeTarget === "none"
        ? undefined
        : prepared,
      () => generation === this.generation,
    );
    if (
      result.status === "success" ||
      result.status === "committed-unverified" ||
      result.status === "committed-conflict"
    ) {
      this.review = result.review;
      if (changesTab) this.resetHistory();
      const unverified = result.status === "committed-unverified";
      const conflict = result.status === "committed-conflict";
      this.patch({
        saving: false,
        replacing: false,
        ...(changesTab ? { ...prepared, recovery } : {}),
        savedIdentity: this.identity(prepared),
        ...(replace ? { pending: null, sessionOnly: false } : {}),
        error: unverified
          ? clear
            ? "Workspace cleared; browser status unavailable. The clear was saved, but its current browser status could not be verified. Browser saving is paused."
            : "The workspace was saved, but browser status could not be verified. Browser saving is paused."
          : conflict
            ? clear
              ? "Workspace cleared, but browser data changed again. Review the saved browser version before continuing."
              : "Browser data changed again. Review the saved browser version before continuing."
            : null,
        conflict: conflict ? result.review : null,
        backupFailure: null,
        ...(clear ? { notice: null } : {}),
      });
      if (clear && unverified)
        this.notify(
          "Workspace cleared; browser status unavailable",
          "The clear was saved, but its current browser status could not be verified. Browser saving is paused.",
        );
      else if (clear && conflict)
        this.notify(
          "Workspace cleared, but browser data changed again",
          "Review the saved browser version before continuing.",
        );
      else if (clear) this.operationSucceeded("clear", false);
      else if (backupOrigin === "matching-import")
        this.notify(
          "Backup matches your workspace",
          "No workspace content was changed.",
        );
      else if (pending) this.operationSucceeded(pending.kind, false);
    } else if (result.status === "conflict") {
      this.patch({
        saving: false,
        replacing: false,
        conflict: result.review,
        error:
          "Another tab changed browser storage. Review the saved browser version before trying again.",
      });
    } else if (result.status === "failure") {
      this.patch({
        saving: false,
        replacing: false,
        error: backupOrigin
          ? backupOrigin === "export"
            ? "Backup record could not be saved. Your backup download was started, but this browser could not record it. Keep the downloaded file."
            : "Backup match could not be recorded. The selected backup matches your workspace, but this browser could not save its backup record. Your workspace content was not changed."
          : clear
            ? `Workspace could not be cleared. Nothing was cleared by this action. Your work${this.state.recovery ? " and recovery copy are" : " is"} still available.`
            : pending?.kind === "import"
              ? "Backup could not be restored. The backup was validated, but could not be saved. Your current workspace has been kept."
              : result.error,
      });
    } else this.patch({ saving: false, replacing: false });
    if (!replace && result.status === "success" && this.isUnsaved())
      this.schedule();
  }

  /** Read the current portable payload. @returns Content and exact backup baseline. @example controller.snapshot() */
  snapshot = (): WorkspaceSnapshot => ({
    document: this.state.document,
    backupFingerprint: this.state.backupFingerprint,
  });

  /** Identify asynchronous work by workspace generation. @returns Current generation. @example const ticket = controller.getGeneration(); */
  getGeneration = () => this.documentGeneration;

  /** Detect any nondefault editable data. @param document Workspace. @returns Whether clearing removes meaning. @example controller.meaningful(doc) */
  meaningful = (document: ResumeDocument) =>
    !semanticallyEqual(document, createEmptyDocument());

  /** Determine removability within the clear's actual scope. @returns Whether tab or durable data can be removed. @example controller.canClearData() */
  canClearData = (sessionOnly = this.state.sessionOnly) => {
    const stored = this.state.conflict ?? this.review;
    return (
      this.meaningful(this.state.document) ||
      !!this.state.backupFingerprint ||
      !!this.state.recovery ||
      this.past.length > 0 ||
      this.future.length > 0 ||
      (!sessionOnly &&
        (!!stored?.error ||
          !!stored?.snapshot?.backupFingerprint ||
          (!!stored?.snapshot && this.meaningful(stored.snapshot.document))))
    );
  };

  /** Publish a typed presentation outcome without depending on toast UI. @param title Outcome heading. @param description Detail. @param action Guarded history action. @example controller.notify("Action undone") */
  notify = (
    title: string,
    description?: string,
    action?: WorkspaceNotice["action"],
  ) => {
    this.patch({
      notice: {
        id: ++this.noticeId,
        generation: this.documentGeneration,
        workspaceEpoch: this.workspaceEpoch,
        title,
        description,
        action,
        document: this.state.document,
      },
    });
  };

  /** Execute a notification action only while its identity remains current. @param notice Presented outcome. @example controller.runNoticeAction(notice) */
  runNoticeAction = (notice: WorkspaceNotice) => {
    if (
      notice.generation !== this.documentGeneration ||
      notice.workspaceEpoch !== this.workspaceEpoch ||
      notice.document !== this.state.document ||
      this.state.pending ||
      this.state.replacing
    )
      return;
    if (notice.action === "undo" && this.state.canUndo) this.undo();
  };

  /** Translate committed operations to presentation outcomes. @param kind Explicit operation. @param sessionOnly Whether no durable write occurred. @example this.operationSucceeded("clear", true) */
  private operationSucceeded(kind: OperationKind, sessionOnly: boolean) {
    if (kind === "clear") {
      this.notify(
        sessionOnly
          ? "Workspace cleared in this tab"
          : "Workspace data cleared",
        sessionOnly
          ? "The version saved in this browser is unchanged."
          : "Your workspace has been reset. This cannot be undone.",
      );
      return;
    }
    const title = {
      import: "Backup restored",
      example: "Fictional example loaded",
      recovery: "Previous work restored",
      "load-saved": "Saved browser version loaded",
      "resume-saving": "Browser saving started",
      overwrite: "Browser saving started",
      session: "Continuing in this tab",
    }[kind];
    this.notify(
      title,
      sessionOnly ? "Changes are kept only in this tab." : undefined,
    );
  }

  /** Mark an initiated JSON download as the portable backup baseline.
   * @param document Exact downloaded snapshot. @returns Resolves after its fingerprint is queued for saving.
   * @example await controller.markBackup(snapshot);
   */
  markBackup = async (
    document: WorkspaceSnapshot["document"],
    origin: "export" | "matching-import" = "export",
  ) => {
    const generation = this.documentGeneration;
    const ticket = ++this.backupGeneration;
    let backupFingerprint: string;
    try {
      backupFingerprint = await fingerprint(document);
    } catch {
      if (
        document === this.state.document &&
        generation === this.documentGeneration &&
        ticket === this.backupGeneration &&
        !this.state.pending
      ) {
        this.patch({
          backupFailure: { origin, document, generation },
          error:
            origin === "export"
              ? "Backup record could not be saved. Your backup download was started, but this browser could not record it. Keep the downloaded file."
              : "Backup match could not be recorded. The selected backup matches your workspace, but this browser could not save its backup record. Your workspace content was not changed.",
        });
      }
      return;
    }
    if (
      generation !== this.documentGeneration ||
      ticket !== this.backupGeneration ||
      document !== this.state.document ||
      this.state.pending ||
      this.state.replacing
    )
      return;
    if (this.state.saving) {
      await new Promise<void>((resolve) => {
        const unsubscribe = this.subscribe(() => {
          if (!this.state.saving) {
            unsubscribe();
            resolve();
          }
        });
      });
      if (
        document !== this.state.document ||
        generation !== this.documentGeneration ||
        ticket !== this.backupGeneration ||
        this.state.pending
      )
        return;
    }
    this.patch({ backupFingerprint });
    if (this.state.sessionOnly) {
      this.notify(
        origin === "matching-import"
          ? "Backup matches your workspace"
          : "Backup recorded in this tab",
        "No workspace content was changed. Its backup baseline exists only in this tab and will not persist after closing it.",
      );
      return;
    }
    const epoch = this.state.workspaceEpoch;
    await this.flush();
    if (
      this.state.document !== document ||
      this.state.workspaceEpoch !== epoch ||
      this.state.pending
    )
      return;
    if (this.state.error || this.state.conflict) {
      this.patch({
        backupFailure: {
          origin,
          document,
          generation: this.documentGeneration,
        },
        error:
          origin === "export"
            ? "Backup record could not be saved. Your backup download was started, but this browser could not record it. Keep the downloaded file."
            : "Backup match could not be recorded. The selected backup matches your workspace, but this browser could not save its backup record. Your workspace content was not changed.",
      });
    } else if (origin === "matching-import")
      this.notify(
        "Backup matches your workspace",
        "No workspace content was changed.",
      );
  };

  /** Retry a failed baseline without authorizing unreviewed bytes or newer content. @example controller.retryRecording() */
  retryRecording = async () => {
    const failure = this.state.backupFailure;
    if (
      !failure ||
      failure.document !== this.state.document ||
      failure.generation !== this.documentGeneration ||
      this.state.pending ||
      this.state.saving
    )
      return;
    if (this.state.conflict) {
      this.reviewOverwrite();
      return;
    }
    this.patch({ error: null });
    await this.markBackup(failure.document, failure.origin);
  };

  /** Stage a replacement against the version already reviewed in this tab.
   * @param kind Explicit operation kind. @param snapshot Validated candidate and backup baseline.
   * @example controller.requestReplacement("example", example);
   */
  requestReplacement = (
    kind: "import" | "example" | "recovery",
    snapshot: WorkspaceSnapshot,
  ) => {
    this.stageWorkspaceChange(kind, snapshot);
  };

  /** Request confirmation before clearing career details, resumes, settings, and the backup baseline.
   * Storage remains unchanged until confirmation; successful clearing permanently discards history and recovery.
   * @example controller.requestClearData();
   */
  requestClearData = () => {
    if (!this.canClearData()) return;
    this.stageWorkspaceChange("clear", {
      document: createEmptyDocument(),
      backupFingerprint: null,
    });
  };

  /** Stage an explicit operation against reviewed bytes. @param kind Operation. @param snapshot Validated candidate. @example this.stageWorkspaceChange("clear", empty) */
  private stageWorkspaceChange(
    kind: OperationKind,
    snapshot: WorkspaceSnapshot,
  ) {
    if (this.state.saving || this.state.pending || !this.commitEditorDrafts())
      return;
    this.endEditGroup();
    this.generation++;
    this.documentGeneration++;
    clearTimeout(this.timer);
    this.patch({
      pending: {
        kind,
        writeTarget: this.state.sessionOnly ? "tab" : "both",
        snapshot,
        review: this.review,
        sessionOnly: this.state.sessionOnly,
      },
    });
  }

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
    if (
      !pending ||
      this.state.saving ||
      (!pending.sessionOnly &&
        this.state.conflict &&
        this.state.conflict.raw !== pending.review?.raw)
    )
      return;
    if (pending.kind === "clear" && !this.canClearData(pending.sessionOnly))
      return;
    if (pending.sessionOnly) {
      this.generation++;
      this.documentGeneration++;
      this.backupGeneration++;
      if (
        pending.kind === "clear" ||
        !semanticallyEqual(this.state.document, pending.snapshot.document)
      )
        this.resetHistory();
      this.patch({
        ...pending.snapshot,
        recovery:
          pending.kind === "clear"
            ? null
            : !semanticallyEqual(
                  this.state.document,
                  pending.snapshot.document,
                ) && this.meaningful(this.state.document)
              ? this.snapshot()
              : this.state.recovery,
        pending: null,
        sessionOnly: true,
        conflict: null,
        error: null,
        savedIdentity: null,
        backupFailure: null,
        notice: null,
      });
      this.operationSucceeded(pending.kind, true);
    } else {
      await this.write(pending.snapshot, pending.review, true);
    }
  };

  /** Explicitly choose a session-only replacement; confirmation is still required.
   * @example controller.useInThisTab();
   */
  useInThisTab = () => {
    if (this.state.saving) return;
    this.endEditGroup();
    const pending = this.state.pending;
    this.generation++;
    this.documentGeneration++;
    clearTimeout(this.timer);
    this.patch({
      pending: {
        backupOrigin: pending?.backupOrigin,
        kind:
          pending?.writeTarget === "browser"
            ? "session"
            : (pending?.kind ?? "session"),
        writeTarget: pending ? "tab" : "none",
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
    this.endEditGroup();
    try {
      if (!canCoordinate())
        throw new Error(
          "This browser cannot safely save changes across tabs. Continue in this tab only and download a backup to keep your work.",
        );
      const review = loadWorkspace();
      if (this.state.pending?.kind === "load-saved" && !review.snapshot) {
        this.patch({
          conflict: review,
          error:
            "The saved browser version cannot be loaded. Choose another workspace or continue in this tab.",
        });
        return;
      }
      this.generation++;
      this.documentGeneration++;
      clearTimeout(this.timer);
      this.patch({
        pending: {
          backupOrigin: this.state.pending
            ? this.state.pending.backupOrigin
            : this.state.backupFailure?.origin,
          kind:
            this.state.pending?.kind ??
            (this.state.sessionOnly ? "resume-saving" : "overwrite"),
          writeTarget: this.state.pending
            ? this.state.pending.sessionOnly &&
              this.state.pending.kind !== "load-saved"
              ? "both"
              : this.state.pending.writeTarget
            : "browser",
          snapshot:
            this.state.pending?.kind === "load-saved" && review.snapshot
              ? review.snapshot
              : (this.state.pending?.snapshot ?? {
                  document: this.state.document,
                  backupFingerprint: this.state.backupFingerprint,
                }),
          review,
          sessionOnly: false,
        },
      });
    } catch (error) {
      this.patch({
        error:
          error instanceof Error
            ? error.message
            : "Could not read the version saved in this browser. Download a backup to keep your current work.",
      });
    }
  };

  /** Load a reviewed conflict only if its stored token still matches under the lock.
   * @returns Resolves after loading or reporting another conflict.
   * @example void controller.loadReviewed();
   */
  loadReviewed = () => {
    const review = this.state.conflict;
    if (!review?.snapshot || this.state.saving || this.state.pending) return;
    this.stageWorkspaceChange("load-saved", review.snapshot);
    const pending = this.getSnapshot().pending;
    if (pending)
      this.patch({
        pending: {
          ...pending,
          review,
          writeTarget: "tab",
          sessionOnly: this.state.sessionOnly,
        },
      });
  };
}
