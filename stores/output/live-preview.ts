import { draftConflict } from "@/lib/career/conflict";
import type { PreviewResumeScope } from "@/lib/career/model";
import {
  previewCheckpoint,
  projectPreview,
  resumePreviewScope,
} from "@/lib/career/preview-projection";
import type {
  PreviewRequest,
  PreviewWorkerInput,
  PreviewWorkerOutput,
  PreviewWorkerResult,
} from "@/lib/career/preview-protocol";
import type { CareerController, CareerState } from "@/stores/career/controller";
import type { CareerHead } from "@/stores/career/persistence";
import type { PreviewOutput } from "@/stores/output/preview-coordinator";
import type {
  CareerDraft,
  CareerResume,
  ResumeOutputIssue,
} from "@/types-and-constants/career";

export type SavedPreview = PreviewOutput & { kind: "saved" };
export type DraftPreview = Omit<PreviewOutput, "revision" | "trigger"> & {
  kind: "draft";
};
export type ResumePreview = SavedPreview | DraftPreview;
export type SavedPdfAction = "download" | "publish";
type Lane = "saved" | "draft";
type Phase = "idle" | "pending" | "updating" | "blocked" | "failed" | "paused";
type Failure = { message: string; log: string };
type Target = {
  head: CareerHead;
  resume: CareerResume;
  draft: CareerDraft | null;
  scope: PreviewResumeScope | null;
};
type Job = {
  id: number;
  target: Target;
  lane: Lane;
  manual: boolean;
  obsolete: boolean;
  inspect: boolean;
};
type Snapshot = {
  candidate: ResumePreview | null;
  displayed: ResumePreview | null;
  saved: SavedPreview | null;
  automaticRelease: SavedPreview | null;
  draft: boolean;
  matchesSaved: boolean;
  phase: Phase;
  issues: ResumeOutputIssue[];
  failure: Failure | null;
  savedFailure: Failure | null;
  actions: readonly SavedPdfAction[];
  downloadUrl: string | null;
  review: { output: SavedPreview; workspaceId: string } | null;
};

const empty: Snapshot = {
  candidate: null,
  displayed: null,
  saved: null,
  automaticRelease: null,
  draft: false,
  matchesSaved: false,
  phase: "idle",
  issues: [],
  failure: null,
  savedFailure: null,
  actions: [],
  review: null,
  downloadUrl: null,
};

/** Track one active resume's two PDF lanes and guard every asynchronous handoff.
 * @example const preview = new LivePreview(); preview.observe(controller.getSnapshot())
 */
export class LivePreview {
  private state = empty;
  private listeners = new Set<() => void>();
  private issueListeners = new Set<() => void>();
  private worker: Worker | null = null;
  private pieces = new Map<string, string>();
  private nextId = 0;
  private workerError: ((reason: Error) => void) | null = null;
  private active: Job | null = null;
  private target: Target | null = null;
  private selected = "";
  private editor = false;
  private automaticSaved = false;
  private visible = false;
  private text = false;
  private gesture = false;
  private sorting = false;
  private saving = false;
  private conflict = false;
  private savedHead: CareerHead | null = null;
  private draftVersion: CareerDraft | null = null;
  private candidateJob: Job | null = null;
  private acknowledgedHead: CareerHead | null = null;
  private readySaved: SavedPreview | null = null;
  private readyDraft: DraftPreview | null = null;
  private urls = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private savedIntent = false;
  private inspectSaved = false;
  private draftIntent: "manual" | "automatic" | null = null;
  private actions = new Map<SavedPdfAction, (output: SavedPreview) => void>();

  /** Subscribe to the pane or action status. @example preview.subscribe(render) */
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Read one immutable pane snapshot. @example preview.getSnapshot().phase */
  getSnapshot = () => this.state;

  /** Subscribe to issue changes independently of compile status. @example preview.subscribeIssues(render) */
  subscribeIssues = (listener: () => void) => {
    this.issueListeners.add(listener);
    return () => {
      this.issueListeners.delete(listener);
    };
  };

  /** Read issues for the current preview target. @example preview.getIssues() */
  getIssues = () => this.state.issues;

  /** Connect synchronously to the authoritative controller. @example preview.connect(controller) */
  connect(controller: CareerController) {
    const sync = () =>
      this.observe(
        controller.getSnapshot(),
        controller.hasPreviewDraft(controller.getSnapshot().draft),
      );
    sync();
    return controller.subscribe(sync);
  }

  /** Set destination policy without copying or subscribing React to PDF status.
   * @example preview.configure(id, true, false, controller)
   */
  configure(
    resumeId: string,
    editor: boolean,
    automaticSaved: boolean,
    controller: CareerController,
  ) {
    const opened = editor && !this.editor;
    this.selected = resumeId;
    this.editor = editor;
    this.automaticSaved = automaticSaved;
    const state = controller.getSnapshot();
    this.observe(state, controller.hasPreviewDraft(state.draft));
    if (
      opened &&
      !this.target?.draft &&
      this.target &&
      this.savedHead !== this.target.head
    ) {
      this.savedIntent = true;
      this.schedule();
    }
  }

  /** Invalidate immediately using committed and form identity. @example preview.observe(state, true) */
  observe(state: CareerState, hasDraft: boolean) {
    const head = state.head;
    const resume =
      head?.document.resumes.find((item) => item.id === this.selected) ??
      head?.document.resumes[0];
    const previous = this.target;
    const scope =
      this.editor && resume && state.draft
        ? resumePreviewScope(state.draft, resume.id)
        : null;
    // Same-version objects are also republished when an immutable Save is prepared.
    const draft = scope && hasDraft && state.draft ? state.draft : null;
    const sameIdentity =
      previous &&
      head &&
      resume &&
      previous.head.workspaceId === head.workspaceId &&
      previous.head.generation === head.generation &&
      previous.resume.id === resume.id;
    const headChanged = previous?.head !== head;
    const draftChanged =
      previous?.draft?.draftId !== draft?.draftId ||
      previous?.draft?.draftVersion !== draft?.draftVersion ||
      previous?.draft?.baseline !== draft?.baseline;
    const savingChanged = this.saving !== state.saving;
    if (!headChanged && !draftChanged && !savingChanged && sameIdentity) return;
    if (!sameIdentity && previous) this.resetIdentity();
    this.target = head && resume ? { head, resume, draft, scope } : null;
    this.saving = state.saving;
    if (
      draft &&
      head &&
      (headChanged ||
        previous?.draft?.baseline !== draft.baseline ||
        previous?.draft?.draftId !== draft.draftId ||
        savingChanged)
    )
      this.conflict = Boolean(draftConflict(head, draft));
    else if (!draft) this.conflict = false;
    if (
      sameIdentity &&
      headChanged &&
      head &&
      state.storageMode === "account" &&
      (state.saveStatus.kind === "saved" ||
        state.saveStatus.kind === "cleanup-retry") &&
      state.saveStatus.revision === head.revision
    ) {
      this.acknowledgedHead = head;
    }
    if (headChanged || !sameIdentity) {
      this.savedHead = null;
      this.publish({ saved: null, automaticRelease: null, savedFailure: null });
      this.savedIntent = Boolean(
        this.target &&
        (this.actions.size ||
          this.editor ||
          (sameIdentity && this.automaticSaved)),
      );
      this.inspectSaved = Boolean(this.target && !this.savedIntent);
    }
    if (draftChanged || headChanged) {
      this.draftVersion = null;
      this.draftIntent = draft ? "automatic" : null;
      if (
        this.state.draft !== Boolean(draft) ||
        this.state.issues.length ||
        this.state.failure ||
        this.state.matchesSaved
      )
        this.publish({
          draft: Boolean(draft),
          issues: empty.issues,
          failure: null,
          matchesSaved: false,
        });
    }
    if (
      savingChanged &&
      state.saving &&
      draft &&
      (this.active?.lane === "draft" || this.candidateJob?.lane === "draft")
    ) {
      // An unsuccessful Save or an unconfirmed Cancel may leave this exact form open.
      this.draftVersion = null;
      this.draftIntent = "automatic";
    }
    if (this.active && !this.isCurrent(this.active)) this.supersede();
    if (this.candidateJob && !this.isCurrent(this.candidateJob))
      this.dropCandidate();
    if (!draft && previous?.draft && sameIdentity && this.target) {
      if (this.savedHead === this.target.head && this.readySaved)
        this.offer(this.readySaved, null);
      else this.savedIntent = true;
    }
    if (this.target) {
      const phase = this.conflict
        ? "paused"
        : this.active && !this.active.obsolete
          ? "updating"
          : this.draftIntent || this.savedIntent
            ? "pending"
            : this.state.phase;
      if (phase !== this.state.phase) this.publish({ phase });
    }
    this.deliver();
    this.schedule();
  }

  /** Defer automatic jobs while hidden; mobile entry can explicitly request the draft.
   * @example preview.setVisible(true)
   */
  setVisible(visible: boolean) {
    this.visible = visible;
    if (
      !visible &&
      this.active &&
      !this.active.manual &&
      !this.active.obsolete &&
      !this.actions.size
    ) {
      if (this.active.lane === "draft") this.draftIntent = "automatic";
      else if (this.active.inspect) this.inspectSaved = true;
      else this.savedIntent = true;
      this.supersede();
      if (!this.active.inspect) this.publish({ phase: "pending" });
    }
    this.schedule();
  }

  /** Suspend automatic draft dispatch while editing text or holding a gesture.
   * @example preview.interaction(true, false)
   */
  interaction(text: boolean, gesture: boolean) {
    if (text === this.text && gesture === this.gesture) return;
    this.text = text;
    this.gesture = gesture;
    if (
      (text || gesture) &&
      this.active?.lane === "draft" &&
      !this.active.manual
    ) {
      this.draftIntent = "automatic";
      this.supersede();
      this.publish({ phase: "pending" });
    }
    this.schedule();
  }

  /** Defer automatic output while a sortable gesture is open.
   * @example preview.setSorting(true)
   */
  setSorting = (sorting: boolean) => {
    const wasSorting = this.sorting;
    this.sorting = sorting;
    if (wasSorting === sorting) return;
    if (sorting && this.active?.lane === "draft" && !this.active.manual) {
      this.draftIntent = "automatic";
      this.supersede();
      this.publish({ phase: "pending" });
    }
    this.schedule();
  };

  /** Update the latest eligible version immediately. @example preview.update() */
  update = () => {
    if (!this.target || this.saving) return;
    if (this.target.draft) {
      if (this.conflict) return;
      if (this.active?.lane === "draft" && this.isCurrent(this.active)) {
        this.active.manual = true;
        return;
      }
      if (
        this.draftVersion?.draftId === this.target.draft.draftId &&
        this.draftVersion.draftVersion === this.target.draft.draftVersion &&
        !this.state.failure
      )
        return;
      this.draftIntent = "manual";
    } else {
      if (this.savedHead === this.target.head && this.readySaved) {
        this.offer(this.readySaved, null);
        return;
      }
      if (
        this.active?.lane === "saved" &&
        !this.active.inspect &&
        this.isCurrent(this.active)
      )
        return;
      this.savedIntent = true;
    }
    this.schedule(true);
  };

  /** Request saved bytes once, following new heads for the same resume until delivery.
   * @example preview.requestSaved("download", download)
   */
  requestSaved(
    action: SavedPdfAction,
    deliver: (output: SavedPreview) => void,
  ) {
    if (!this.target || this.actions.has(action)) return;
    this.actions.set(action, deliver);
    this.publish({ actions: [...this.actions.keys()], savedFailure: null });
    if (this.deliver()) return;
    if (
      this.active?.lane === "saved" &&
      !this.active.inspect &&
      this.isCurrent(this.active)
    )
      return;
    this.savedIntent = true;
    if (this.active?.lane === "draft" && !this.active.obsolete) {
      this.draftIntent = this.active.manual ? "manual" : "automatic";
      this.supersede();
    }
    this.schedule(true);
  }

  /** Prepare or open review for the currently saved bytes. @example preview.publishSaved() */
  publishSaved = () => {
    this.requestSaved("publish", (output) => {
      if (this.target)
        this.publish({
          review: { output, workspaceId: this.target.head.workspaceId },
        });
    });
  };

  /** Return only the saved PDF verified for the currently observed head. @example preview.currentSaved() */
  currentSaved = () =>
    !this.saving && this.target?.head === this.savedHead
      ? this.readySaved
      : null;

  /** Verify a rendered candidate before replacing the readable version.
   * @example preview.promote(candidate)
   */
  promote(candidate: ResumePreview) {
    if (
      this.state.candidate !== candidate ||
      (this.candidateJob && !this.isCurrent(this.candidateJob))
    )
      return false;
    this.candidateJob = null;
    this.publish({
      displayed: candidate,
      candidate: null,
      phase: this.draftIntent ? "pending" : "idle",
    });
    return true;
  }

  /** Preserve the readable document when the candidate viewer fails. @example preview.viewerFailed(candidate, reason) */
  viewerFailed(candidate: ResumePreview, message: string) {
    if (this.state.candidate !== candidate) return;
    this.draftVersion = null;
    this.dropCandidate();
    this.publish({ phase: "failed", failure: { message, log: "" } });
  }

  /** Release this workspace's resources. @example preview.dispose() */
  dispose() {
    this.resetIdentity();
    this.target = null;
    this.visible = false;
  }

  private publish(patch: Partial<Snapshot>) {
    const previous = this.state;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
    if (
      previous.issues !== this.state.issues ||
      previous.draft !== this.state.draft
    )
      for (const listener of this.issueListeners) listener();
    this.collectUrls();
  }

  private collectUrls() {
    const retained = [
      this.readySaved,
      this.readyDraft,
      this.state.displayed,
      this.state.candidate,
      this.state.review?.output,
    ];
    for (const url of this.urls)
      if (!retained.some((item) => item?.url === url)) {
        URL.revokeObjectURL(url);
        this.urls.delete(url);
      }
  }

  private resetIdentity() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.active = null;
    this.worker?.terminate();
    this.worker = null;
    this.workerError?.(new Error("Preview closed"));
    this.pieces.clear();
    this.readySaved = null;
    this.readyDraft = null;
    this.savedHead = null;
    this.acknowledgedHead = null;
    this.candidateJob = null;
    this.draftVersion = null;
    this.savedIntent = false;
    this.inspectSaved = false;
    this.draftIntent = null;
    this.actions.clear();
    this.publish(empty);
  }

  private supersede() {
    if (!this.active || this.active.obsolete) return;
    this.active.obsolete = true;
    this.worker?.postMessage({
      kind: "supersede",
      id: this.active.id,
    } satisfies PreviewWorkerInput);
    this.workerError?.(new DOMException("Preview superseded", "AbortError"));
  }

  private isCurrent(job: Job) {
    const target = this.target;
    if (
      !target ||
      job.obsolete ||
      target.head !== job.target.head ||
      target.resume.id !== job.target.resume.id
    )
      return false;
    if (job.lane === "saved") return true;
    const draft = target.draft;
    return (
      !this.saving &&
      !this.conflict &&
      draft?.draftId === job.target.draft?.draftId &&
      draft?.draftVersion === job.target.draft?.draftVersion &&
      draft?.baseline === job.target.draft?.baseline
    );
  }

  private schedule(immediate = false) {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (!this.target || this.active || this.saving) return;
    const priority = this.actions.size > 0;
    const draft = this.draftIntent;
    const manual = draft === "manual";
    const draftEligible =
      draft &&
      !this.conflict &&
      (manual ||
        (this.visible && !this.text && !this.gesture && !this.sorting));
    const savedEligible =
      (this.savedIntent || this.inspectSaved) &&
      (priority ||
        immediate ||
        (this.visible && !this.text && !this.gesture && !this.sorting));
    const lane =
      priority && savedEligible
        ? "saved"
        : draftEligible
          ? "draft"
          : savedEligible
            ? "saved"
            : null;
    if (!lane) return;
    if (immediate || priority || manual)
      void this.run(lane, Boolean(immediate || manual || priority));
    else
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.run(lane, false);
      }, 300);
  }

  private deliver() {
    const saved = this.currentSaved();
    if (!saved) return false;
    const actions = [...this.actions.entries()];
    if (actions.length) {
      this.actions.clear();
      this.publish({
        actions: [],
        savedFailure: null,
        ...(actions.some(([kind]) => kind === "download")
          ? { downloadUrl: saved.url }
          : {}),
      });
      for (const [, deliver] of actions)
        if (this.currentSaved() === saved) deliver(saved);
    }
    return true;
  }

  private offer(output: ResumePreview, job: Job | null) {
    this.candidateJob = job;
    if (this.state.displayed?.url === output.url) {
      this.candidateJob = null;
      this.publish({
        displayed: output,
        candidate: null,
        phase: "idle",
        failure: null,
      });
    } else
      this.publish({ candidate: output, phase: "updating", failure: null });
  }

  private dropCandidate() {
    this.candidateJob = null;
    this.publish({ candidate: null });
  }

  private async run(lane: Lane, manual: boolean) {
    const target = this.target;
    if (!target || this.active || this.saving) return;
    const inspect = lane === "saved" && !this.savedIntent;
    const job = {
      id: ++this.nextId,
      target,
      lane,
      manual,
      inspect,
      obsolete: false,
    };
    this.active = job;
    if (lane === "draft") this.draftIntent = null;
    else {
      this.savedIntent = false;
      this.inspectSaved = false;
    }
    const forPane = () => lane === "draft" || !this.target?.draft;
    if (forPane() && !inspect)
      this.publish({ phase: "updating", failure: null, issues: empty.issues });
    try {
      const checkpoint = previewCheckpoint(() => this.isCurrent(job));
      const draft = lane === "draft" ? target.draft : null;
      const scope = draft ? target.scope : null;
      const pieces = await projectPreview(
        target.head.document,
        target.resume,
        draft,
        scope,
        checkpoint,
      );
      await checkpoint();
      const message = await this.runWorker(
        pieces,
        {
          id: job.id,
          resumeId: target.resume.id,
          revision: target.head.revision,
          inspect,
          draft:
            draft && scope
              ? { id: draft.draftId, version: draft.draftVersion, scope }
              : null,
          reuse: {
            saved: this.readySaved?.tag.fingerprint,
            draft: this.readyDraft?.tag.fingerprint,
          },
        },
        checkpoint,
      );
      if (!this.isCurrent(job)) return;
      if (message.kind === "ready") this.accept(job, message.result);
      else if (message.kind === "inspected" && forPane())
        this.publish({ phase: "idle", issues: empty.issues });
      else if (message.kind === "blocked") {
        if (forPane())
          this.publish({ phase: "blocked", issues: message.issues });
        if (lane === "saved")
          this.failSaved({
            message: message.issues.map((issue) => issue.message).join(" "),
            log: "",
          });
      } else if (message.kind === "failed") throw message;
    } catch (error) {
      if (this.isCurrent(job)) {
        const failure = {
          message: String((error as Failure).message ?? error),
          log: (error as Failure).log ?? "",
        };
        if (forPane()) this.publish({ phase: "failed", failure });
        if (lane === "saved") this.failSaved(failure);
      }
    } finally {
      if (this.active === job) {
        this.active = null;
        this.schedule();
      }
    }
  }

  private failSaved(failure: Failure) {
    if (this.actions.size) {
      this.actions.clear();
      this.publish({ savedFailure: failure, actions: [] });
    }
  }

  private accept(job: Job, result: PreviewWorkerResult) {
    const { head, resume, draft } = job.target;
    const prior =
      result.reuse === "saved"
        ? this.readySaved
        : result.reuse === "draft"
          ? this.readyDraft
          : null;
    const tag = {
      generation: head.generation,
      resumeId: resume.id,
      fingerprint: result.fingerprint,
    };
    const bytes = prior?.bytes ?? result.bytes!;
    const url =
      prior?.url ??
      URL.createObjectURL(
        new Blob([bytes as Uint8Array<ArrayBuffer>], {
          type: "application/pdf",
        }),
      );
    this.urls.add(url);
    const base = {
      tag,
      bytes,
      url,
      key: JSON.stringify([tag.generation, tag.resumeId, tag.fingerprint]),
      targetPages: result.targetPages,
      template: result.template,
      language: resume.language,
      resumeName: resume.name,
    };
    if (job.lane === "draft") {
      this.draftVersion = draft;
      if (prior?.kind === "saved") {
        this.publish({ matchesSaved: true });
        this.offer({ ...prior, targetPages: result.targetPages }, job);
      } else {
        this.readyDraft = { ...base, kind: "draft" };
        this.offer(this.readyDraft, job);
      }
    } else {
      const authorized = this.acknowledgedHead === head && this.automaticSaved;
      this.readySaved = {
        ...base,
        kind: "saved",
        revision: prior?.kind === "saved" ? prior.revision : head.revision,
        trigger: authorized ? "committed-change" : "editor-open",
      };
      this.savedHead = head;
      this.publish({
        saved: this.readySaved,
        automaticRelease: authorized ? this.readySaved : null,
      });
      this.deliver();
      if (!this.target?.draft) this.offer(this.readySaved, job);
    }
  }

  private async runWorker(
    pieces: Map<string, string>,
    request: PreviewRequest,
    checkpoint: () => Promise<void>,
  ) {
    const worker = (this.worker ??= new Worker(
      new URL("../../lib/career/preview.worker.ts", import.meta.url),
      { type: "module" },
    ));
    const receive = (input: PreviewWorkerInput, compiling = false) =>
      new Promise<PreviewWorkerOutput>((resolve, reject) => {
        const finish = () => {
          clearTimeout(timer);
          worker.onmessage = null;
          worker.onerror = null;
          worker.onmessageerror = null;
          this.workerError = null;
        };
        const fail = (error: Error, crashed = false) => {
          finish();
          if (crashed && this.worker === worker) {
            worker.terminate();
            this.worker = null;
            this.pieces.clear();
          }
          reject(error);
        };
        const timer = setTimeout(
          () => fail(new Error("Preview worker timed out"), true),
          compiling ? 155_000 : 10_000,
        );
        this.workerError = (error) => {
          if (!compiling || error.name !== "AbortError") fail(error);
        };
        worker.onmessage = ({ data }: MessageEvent<PreviewWorkerOutput>) => {
          const id = data.kind === "ready" ? data.result.id : data.id;
          if (id !== request.id) return;
          finish();
          resolve(data);
        };
        worker.onerror = (event) =>
          fail(new Error(event.message || "Preview worker crashed"), true);
        worker.onmessageerror = () =>
          fail(
            new Error("Preview worker returned an unreadable response"),
            true,
          );
        try {
          worker.postMessage(input);
        } catch (error) {
          fail(error as Error, true);
        }
      });
    await receive({ kind: "begin", id: request.id });
    let batch: Extract<PreviewWorkerInput, { kind: "pieces" }>["pieces"] = [];
    let size = 0;
    const flush = async () => {
      await checkpoint();
      await receive({ kind: "pieces", id: request.id, pieces: batch });
      batch = [];
      size = 0;
    };
    for (const key of this.pieces.keys())
      if (!pieces.has(key)) {
        batch.push([key, null]);
        if (batch.length >= 128) await flush();
      }
    for (const [key, value] of pieces)
      if (this.pieces.get(key) !== value) {
        for (let offset = 0; offset < value.length; offset += 16_384) {
          const chunk = value.slice(offset, offset + 16_384);
          batch.push([key, chunk, offset > 0]);
          size += chunk.length;
          if (batch.length >= 128 || size >= 16_384) await flush();
        }
      }
    if (batch.length) await flush();
    await checkpoint();
    const result = receive({ kind: "run", request }, true);
    this.pieces = pieces;
    return result;
  }
}
