import { BrowserCompiler } from "@/tools/compiler-proof/compiler.mjs";
import {
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

/** The one retained successful PDF owned by the coordinator. */
export type PreviewOutput = Omit<PreviewJob, "source"> & {
  url: string;
  key: string;
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
  /** True while a committed output change waits for automatic refresh. */
  automaticPending: boolean;
};

type CompilerLike = Pick<BrowserCompiler, "compile" | "close">;

export type PreviewCoordinatorOptions = {
  /** Creates one compiler instance (worker pair); replaced only after close. */
  createCompiler?: (options: {
    initializationTimeoutMs: number;
    compilationTimeoutMs: number;
    onState: (state: string) => void;
  }) => CompilerLike;
  createUrl?: (bytes: Uint8Array) => string;
  revokeUrl?: (url: string) => void;
  /** Automatic-refresh debounce after a committed output change. */
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
  private compilerSettings = "";
  private preferences: DevicePreferences = devicePreferenceDefaults;
  private target: PreviewJob | null = null;
  private targetIdentity: Pick<PreviewTag, "generation" | "resumeId"> | null =
    null;
  private queuedJob: PreviewJob | null = null;
  private queuedAutomatic = false;
  private running = false;
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

  /** Apply device preferences. Timeout changes reach the next compiler
   * instance without interrupting active work; disabling automatic refresh
   * cancels a pending automatic request. */
  setPreferences(preferences: DevicePreferences) {
    this.preferences = preferences;
    if (!preferences.automaticRefresh) {
      this.clearTimer();
      if (this.queuedAutomatic) {
        this.queuedJob = null;
        this.queuedAutomatic = false;
        this.publish({ queued: null });
      }
      this.publish({ automaticPending: false });
    } else this.scheduleAutomatic();
  }

  /** Report whether the preview is visible (pane shown, tab active, document visible).
   * Hidden previews keep their PDF and in-flight job but defer automatic refresh. */
  setVisible(visible: boolean) {
    if (this.visible === visible) return;
    this.visible = visible;
    if (visible) this.scheduleAutomatic();
    else {
      this.clearTimer();
      if (this.queuedAutomatic) {
        this.queuedJob = null;
        this.queuedAutomatic = false;
        this.publish({ queued: null, automaticPending: true });
      }
    }
  }

  /** Replace the committed output target. A generation change closes the
   * compiler and drops queued work; a fingerprint change for the same resume
   * and generation is an output-affecting committed change. Pass identity even
   * when readiness blocks output, so becoming ready after a Save refreshes.
   * @param job Ready committed output, or null when blocked.
   * @param identity Selected resume and generation, including while blocked.
   * @returns No value; updates the target and any pending automatic refresh.
   * @example preview.setTarget(null, { generation: 1, resumeId: "resume" });
   */
  setTarget(
    job: PreviewJob | null,
    identity: Pick<PreviewTag, "generation" | "resumeId"> | null = job?.tag ??
      null,
  ) {
    const previous = this.target;
    const previousIdentity = this.targetIdentity;
    this.target = job;
    this.targetIdentity = identity;
    if (
      previousIdentity &&
      identity &&
      previousIdentity.generation !== identity.generation
    ) {
      this.closeCompiler();
      this.queuedJob = null;
      this.queuedAutomatic = false;
      this.publish({ queued: null });
    }
    const sameTarget =
      previousIdentity !== null &&
      identity !== null &&
      previousIdentity.generation === identity.generation &&
      previousIdentity.resumeId === identity.resumeId;
    if ((!sameTarget || !job) && this.queuedJob) {
      this.queuedJob = null;
      this.queuedAutomatic = false;
      this.publish({ queued: null });
    }
    const changed =
      sameTarget &&
      job !== null &&
      previous?.tag.fingerprint !== job.tag.fingerprint;
    if (changed && this.preferences.automaticRefresh) {
      this.publish({ automaticPending: true });
      this.scheduleAutomatic();
    } else if ((!sameTarget || !job) && this.state.automaticPending) {
      this.clearTimer();
      this.publish({ automaticPending: false });
    }
  }

  /** Request a compile of the current target. A running job is never
   * interrupted; the request replaces any queued job instead. */
  refresh() {
    this.requestRefresh(false);
  }

  /** Start or queue a refresh without losing whether it was automatic.
   * @param automatic Whether hidden previews and preference changes may defer or cancel this request.
   * @returns No value; starts work or replaces the single queued request.
   * @example this.requestRefresh(true);
   */
  private requestRefresh(automatic: boolean) {
    const job = this.target;
    if (!job) return;
    this.clearTimer();
    if (this.state.automaticPending) this.publish({ automaticPending: false });
    const key = previewKey(job.tag);
    if (this.running) {
      if (this.state.active === key) {
        this.queuedJob = null;
        this.queuedAutomatic = false;
        this.publish({ queued: null });
        return;
      }
      this.queuedJob = job;
      this.queuedAutomatic = automatic;
      this.publish({ queued: key });
      return;
    }
    void this.run(job);
  }

  /** Close the compiler, cancel timers/queue, revoke the retained URL and reset
   * state. The instance stays usable, so React Strict Mode remounts are safe. */
  dispose() {
    this.lifecycle += 1;
    this.clearTimer();
    this.closeCompiler();
    this.queuedJob = null;
    this.queuedAutomatic = false;
    this.target = null;
    this.targetIdentity = null;
    this.running = false;
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

  private scheduleAutomatic() {
    if (
      !this.state.automaticPending ||
      !this.preferences.automaticRefresh ||
      !this.visible ||
      !this.target
    )
      return;
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.requestRefresh(true);
    }, this.automaticDelayMs);
  }

  private clearTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private closeCompiler() {
    this.compiler?.close();
    this.compiler = null;
  }

  private async run(job: PreviewJob) {
    const lifecycle = this.lifecycle;
    const key = previewKey(job.tag);
    this.running = true;
    const settings = JSON.stringify([
      this.preferences.initializationTimeoutMs,
      this.preferences.compilationTimeoutMs,
    ]);
    if (this.compiler && this.compilerSettings !== settings)
      this.closeCompiler();
    this.compilerSettings = settings;
    this.publish({
      active: key,
      status: { kind: this.compiler ? "generating" : "preparing" },
    });
    const compiler = (this.compiler ??= this.createCompiler({
      initializationTimeoutMs: this.preferences.initializationTimeoutMs,
      compilationTimeoutMs: this.preferences.compilationTimeoutMs,
      onState: (state) => {
        if (
          this.lifecycle === lifecycle &&
          this.state.active === key &&
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
      if (key === previewKey(this.target?.tag)) {
        const previous = this.state.output;
        next.output = {
          tag: job.tag,
          revision: job.revision,
          resumeName: job.resumeName,
          language: job.language,
          targetPages: job.targetPages,
          key,
          url: this.createUrl(result.bytes),
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
    this.running = false;
    const queued = this.queuedJob;
    const automatic = this.queuedAutomatic;
    this.queuedJob = null;
    this.queuedAutomatic = false;
    this.publish({ ...next, active: null, queued: null });
    const latest = this.target;
    // The queued request runs against the latest committed target for the
    // same resume and generation; stale queued sources are never compiled.
    if (
      queued &&
      latest &&
      latest.tag.resumeId === queued.tag.resumeId &&
      latest.tag.generation === queued.tag.generation
    ) {
      if (automatic && (!this.visible || !this.preferences.automaticRefresh)) {
        this.publish({ automaticPending: this.preferences.automaticRefresh });
      } else void this.run(latest);
    }
  }

  private publish(patch: Partial<PreviewState>) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}
