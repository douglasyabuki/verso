import { BrowserCompiler } from "@/tools/compiler-proof/compiler.mjs";
import {
  compilerTimeouts,
  devicePreferenceDefaults,
  type DevicePreferences,
} from "@/types-and-constants/settings";

/** Identity that decides whether a compiled PDF still matches committed output. */
export type PreviewTag = {
  generation: number;
  resumeId: string;
  fingerprint: string;
};

/** Committed output ready to compile; never derived from form drafts. */
export type PreviewJob = {
  tag: PreviewTag;
  source: string;
  revision: number;
  resumeName: string;
  language: string;
  targetPages: number;
};

/** The one retained successful PDF owned by the coordinator. `bytes` is the same
 * buffer behind `url`, retained for explicit or automatic release uploads. */
export type PreviewOutput = Omit<PreviewJob, "source"> & {
  url: string;
  key: string;
  bytes: Uint8Array;
  /** Opening the editor alone does not authorize automatic publication. */
  trigger: RefreshTrigger;
  /** Compiler-reported template identity, such as `yabuki-reference@1.0.3`. */
  template: string;
};

export type PreviewStatus =
  | { kind: "idle" }
  | { kind: "preparing" }
  | { kind: "generating" }
  | { kind: "failed"; message: string; timedOut: boolean; log: string };

export type PreviewState = {
  status: PreviewStatus;
  output: PreviewOutput | null;
  /** Key of the compiling job, if any. */
  active: string | null;
  /** Key of the single replaceable queued job, if any. */
  queued: string | null;
  /** True while automatic generation is debouncing or waiting for visibility. */
  automaticPending: boolean;
};

type CompilerLike = Pick<BrowserCompiler, "compile" | "close">;

type RefreshTrigger = "manual" | "committed-change" | "editor-open";
type AutomaticTrigger = Exclude<RefreshTrigger, "manual">;

export type PreviewCoordinatorOptions = {
  /** Creates one compiler instance (worker pair); replaced only after close. */
  createCompiler?: (options: {
    initializationTimeoutMs: number;
    compilationTimeoutMs: number;
    onState: (state: string) => void;
  }) => CompilerLike;
  createUrl?: (bytes: Uint8Array) => string;
  revokeUrl?: (url: string) => void;
  /** Debounce for automatic generation on editor open or after a committed change. */
  automaticDelayMs?: number;
};

/** Stable string identity for a preview tag. */
export function previewKey(tag: PreviewTag | null | undefined) {
  return tag
    ? JSON.stringify([tag.generation, tag.resumeId, tag.fingerprint])
    : "";
}

const idle: PreviewStatus = { kind: "idle" };

/** Owns one workspace's preview compiler, bounded jobs, retained PDF URL, and
 * optional automatic refresh. It never reads drafts: callers pass committed
 * output only. Bounds: one compiler instance per coordinator, one active job,
 * one replaceable queued job, one retained PDF, and one in-flight result.
 * Results whose tag no longer matches the current target are discarded before
 * any URL is created. Failures retain the last successful PDF.
 * @param options Optional factories for tests; defaults use BrowserCompiler and blob URLs.
 * @example const preview = new PreviewCoordinator(); preview.setTarget(job); preview.refresh();
 */
export class PreviewCoordinator {
  private state: PreviewState = {
    status: idle,
    output: null,
    active: null,
    queued: null,
    automaticPending: false,
  };
  private listeners = new Set<() => void>();
  private compiler: CompilerLike | null = null;
  private automaticRefresh = devicePreferenceDefaults.automaticRefresh;
  private keepCurrent = false;
  private target: PreviewJob | null = null;
  private targetIdentity: Pick<PreviewTag, "generation" | "resumeId"> | null =
    null;
  private pendingAutomatic: AutomaticTrigger | null = null;
  private queuedTrigger: RefreshTrigger | null = null;
  private activeTrigger: RefreshTrigger | null = null;
  private visible = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lifecycle = 0;
  private readonly createCompiler: NonNullable<
    PreviewCoordinatorOptions["createCompiler"]
  >;
  private readonly createUrl: (bytes: Uint8Array) => string;
  private readonly revokeUrl: (url: string) => void;
  private readonly automaticDelayMs: number;

  constructor(options: PreviewCoordinatorOptions = {}) {
    this.createCompiler =
      options.createCompiler ??
      ((settings) =>
        new BrowserCompiler({ assetBase: "/compiler/", ...settings }));
    this.createUrl =
      options.createUrl ??
      ((bytes) =>
        URL.createObjectURL(
          new Blob([bytes.slice().buffer], { type: "application/pdf" }),
        ));
    this.revokeUrl = options.revokeUrl ?? ((url) => URL.revokeObjectURL(url));
    this.automaticDelayMs = options.automaticDelayMs ?? 800;
  }

  /** Subscribe to state changes. @returns Unsubscribe function. */
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Current immutable snapshot. */
  getSnapshot = () => this.state;

  /** Whether a compiler instance currently exists (for resource checks). */
  get hasCompiler() {
    return this.compiler !== null;
  }

  /** Whether an automatic-refresh timer is pending (for resource checks). */
  get hasTimer() {
    return this.timer !== null;
  }

  /** Apply the preview preference and cancel work that no longer qualifies. */
  setPreferences(preferences: DevicePreferences) {
    this.automaticRefresh = preferences.automaticRefresh;
    this.cancelIneligibleAutomatic();
  }

  /** Report whether the preview is visible (pane shown, tab active, document visible).
   * Hidden previews keep their PDF and in-flight job but defer automatic refresh. */
  setVisible(visible: boolean) {
    if (this.visible === visible) return;
    this.visible = visible;
    if (visible) this.scheduleAutomatic();
    else {
      this.clearTimer();
      if (this.queuedTrigger && this.queuedTrigger !== "manual") {
        const trigger = this.queuedTrigger;
        this.clearQueue();
        this.deferAutomatic(trigger);
      }
    }
  }

  /** Replace the committed output target. A generation change closes the
   * compiler and drops queued work; a fingerprint change for the same resume
   * and generation is an output-affecting committed change. Pass identity even
   * when readiness blocks output, so becoming ready after a Save refreshes.
   * @param job Ready committed output, or null when blocked.
   * @param identity Selected resume and generation, including while blocked.
   * @param keepCurrent Whether the current editor generates missing or outdated output on open and after a committed change.
   * @returns No value; updates the target and any pending automatic refresh.
   * @example preview.setTarget(null, { generation: 1, resumeId: "resume" });
   */
  setTarget(
    job: PreviewJob | null,
    identity: Pick<PreviewTag, "generation" | "resumeId"> | null = job?.tag ??
      null,
    keepCurrent = false,
  ) {
    const previous = this.target;
    const previousIdentity = this.targetIdentity;
    const enteredEditor = keepCurrent && !this.keepCurrent;
    this.keepCurrent = keepCurrent;
    this.target = job;
    this.targetIdentity = identity;
    if (
      previousIdentity &&
      previousIdentity.generation !== identity?.generation
    ) {
      this.lifecycle += 1;
      this.closeCompiler();
      this.activeTrigger = null;
      this.publish({ active: null, status: idle });
    }
    const sameTarget =
      previousIdentity !== null &&
      identity !== null &&
      previousIdentity.generation === identity.generation &&
      previousIdentity.resumeId === identity.resumeId;
    const key = previewKey(job?.tag);
    const changed = key !== previewKey(previous?.tag);
    const output = this.state.output;
    if (job && output?.key === key && output.targetPages !== job.targetPages)
      this.publish({ output: { ...output, targetPages: job.targetPages } });
    if (!sameTarget || !job || changed) {
      this.clearAutomatic();
      if (!sameTarget || !job || this.queuedTrigger !== "manual")
        this.clearQueue();
      else this.publish({ queued: key });
      if (this.state.status.kind === "failed") this.publish({ status: idle });
    }
    this.cancelIneligibleAutomatic();
    if (!job || this.queuedTrigger === "manual") return;
    if (sameTarget && changed && this.canRunAutomatically("committed-change"))
      this.deferAutomatic("committed-change");
    else if (keepCurrent && (enteredEditor || changed))
      this.deferAutomatic("editor-open");
  }

  /** Request a compile of the current target. A running job is never
   * interrupted; the request replaces any queued job instead. */
  refresh() {
    this.requestRefresh("manual");
  }

  private requestRefresh(trigger: RefreshTrigger) {
    const job = this.target;
    if (!job) return;
    this.clearAutomatic();
    const key = previewKey(job.tag);
    if (trigger !== "manual" && this.state.output?.key === key) {
      if (
        trigger === "committed-change" &&
        this.state.output.trigger === "editor-open"
      ) {
        // The committed change can reuse the PDF that was generated on open.
        this.publish({ output: { ...this.state.output, trigger } });
      }
      return;
    }
    if (this.state.active === key) {
      this.clearQueue();
      if (this.activeTrigger === "editor-open" && trigger !== "editor-open")
        this.activeTrigger = trigger;
    } else if (this.state.active) {
      this.queuedTrigger = trigger;
      this.publish({ queued: key });
    } else void this.run(job, trigger);
  }

  /** Close the compiler, cancel timers/queue, revoke the retained URL and reset
   * state. The instance stays usable, so React Strict Mode remounts are safe. */
  dispose() {
    this.lifecycle += 1;
    this.clearTimer();
    this.closeCompiler();
    this.pendingAutomatic = null;
    this.queuedTrigger = null;
    this.activeTrigger = null;
    this.keepCurrent = false;
    this.target = null;
    this.targetIdentity = null;
    if (this.state.output) this.revokeUrl(this.state.output.url);
    this.state = {
      status: idle,
      output: null,
      active: null,
      queued: null,
      automaticPending: false,
    };
    this.emit();
  }

  private canRunAutomatically(trigger: AutomaticTrigger) {
    return (
      this.keepCurrent ||
      (trigger === "committed-change" && this.automaticRefresh)
    );
  }

  private cancelIneligibleAutomatic() {
    if (
      this.pendingAutomatic &&
      !this.canRunAutomatically(this.pendingAutomatic)
    )
      this.clearAutomatic();
    if (
      this.queuedTrigger &&
      this.queuedTrigger !== "manual" &&
      !this.canRunAutomatically(this.queuedTrigger)
    )
      this.clearQueue();
  }

  private deferAutomatic(trigger: AutomaticTrigger) {
    const key = previewKey(this.target?.tag);
    const current = this.state.output;
    if (
      !key ||
      this.state.status.kind === "failed" ||
      (trigger === "editor-open" &&
        (this.state.active === key ||
          this.state.queued === key ||
          this.pendingAutomatic)) ||
      (current?.key === key &&
        (trigger === "editor-open" || current.trigger !== "editor-open"))
    )
      return;
    this.pendingAutomatic = trigger;
    if (!this.state.automaticPending) this.publish({ automaticPending: true });
    this.scheduleAutomatic();
  }

  private scheduleAutomatic() {
    const trigger = this.pendingAutomatic;
    if (!trigger || !this.visible) return;
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.requestRefresh(trigger);
    }, this.automaticDelayMs);
  }

  private clearAutomatic() {
    this.clearTimer();
    this.pendingAutomatic = null;
    if (this.state.automaticPending) this.publish({ automaticPending: false });
  }

  private clearQueue() {
    if (!this.queuedTrigger) return;
    this.queuedTrigger = null;
    this.publish({ queued: null });
  }

  private clearTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private closeCompiler() {
    this.compiler?.close();
    this.compiler = null;
  }

  private async run(job: PreviewJob, trigger: RefreshTrigger) {
    const lifecycle = this.lifecycle;
    const key = previewKey(job.tag);
    this.activeTrigger = trigger;
    this.publish({
      active: key,
      status: { kind: this.compiler ? "generating" : "preparing" },
    });
    const compiler = (this.compiler ??= this.createCompiler({
      ...compilerTimeouts,
      onState: (state) => {
        if (
          this.lifecycle === lifecycle &&
          this.state.active &&
          (state === "initializing" || state === "compiling")
        )
          this.publish({
            status: {
              kind: state === "initializing" ? "preparing" : "generating",
            },
          });
      },
    }));
    let next: Partial<PreviewState> = { status: idle };
    try {
      const result = await compiler.compile({
        source: job.source,
        snapshotId: key,
        locale: job.language,
      });
      if (this.lifecycle !== lifecycle) return;
      const latest = this.target;
      if (latest && key === previewKey(latest.tag)) {
        const previous = this.state.output;
        next.output = {
          tag: job.tag,
          revision: job.revision,
          resumeName: job.resumeName,
          language: job.language,
          targetPages: latest.targetPages,
          key,
          trigger: this.activeTrigger ?? trigger,
          url: this.createUrl(result.bytes),
          bytes: result.bytes,
          template: `${result.templateId}@${result.templateVersion}`,
        };
        if (previous) this.revokeUrl(previous.url);
      }
    } catch (error) {
      if (this.lifecycle !== lifecycle) return;
      if (key === previewKey(this.target?.tag))
        next = {
          status: {
            kind: "failed",
            message: String(error),
            timedOut: Boolean((error as { timedOut?: unknown }).timedOut),
            log: String((error as { log?: unknown }).log ?? ""),
          },
        };
    }
    const queued = this.queuedTrigger;
    this.activeTrigger = null;
    this.queuedTrigger = null;
    this.publish({ ...next, active: null, queued: null });
    if (queued) this.requestRefresh(queued);
  }

  private publish(patch: Partial<PreviewState>) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}
