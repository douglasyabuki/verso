import {
  devicePreferencesSchema,
  readDevicePreferences,
} from "@/lib/career/device-preferences";
import { layoutDefaults, sameLayout } from "@/lib/career/layout";
import {
  applyScope,
  careerDocumentSchema,
  createCareerDocument,
  readScope,
  resumeLayoutSchema,
  validateDocument,
} from "@/lib/career/model";
import { destinationScope, settingsPanel } from "@/lib/career/navigation";
import { createResume } from "@/lib/career/resumes";
import {
  type CareerHead,
  type CareerStorage,
  openCareerStorage,
  sameScope,
  type SaveRequest,
} from "@/stores/career/persistence";
import type { CareerDocument, CareerDraft } from "@/types-and-constants/career";
import {
  devicePreferenceDefaults,
  type DevicePreferences,
} from "@/types-and-constants/settings";

export type CareerDraftTarget = "form" | "order";

export type CareerControllerOptions = {
  completedOperationDays?: number;
  completedOperationCount?: number;
};

type Step = { scope: string; before: unknown; after: unknown; bytes: number };
export type CareerState = {
  preferences: DevicePreferences;
  preferenceStatus: string;
  ready: boolean;
  head: CareerHead | null;
  draft: CareerDraft | null;
  orderDraft: CareerDraft | null;
  orderError: string;
  orderRecoveryStatus: string;
  recovery: CareerDraft[];
  error: string;
  status: string;
  recoveryStatus: string;
  saving: boolean;
  durable: boolean;
  undoCount: number;
  redoCount: number;
  historyBoundary: boolean;
};

/** Own one tab's committed content, independent form/order drafts, recovery scheduling, and bounded workspace history.
 * @example const controller = new CareerController(); await controller.initialize(); controller.dispose()
 */
export class CareerController {
  private state: CareerState = {
    preferences: { ...devicePreferenceDefaults },
    preferenceStatus: "",
    ready: false,
    head: null,
    draft: null,
    orderDraft: null,
    orderError: "",
    orderRecoveryStatus: "",
    recovery: [],
    error: "",
    status: "Opening saved workspace…",
    recoveryStatus: "",
    saving: false,
    durable: false,
    undoCount: 0,
    redoCount: 0,
    historyBoundary: false,
  };
  private listeners = new Set<() => void>();
  private storage: CareerStorage | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private maxTimer: ReturnType<typeof setTimeout> | undefined;
  private channel: BroadcastChannel | null = null;
  private undo: Step[] = [];
  private redo: Step[] = [];
  private committedIds = new Set<string>();
  private pristineDraftIds = new Set<string>();
  private disposed = false;
  private lifecycle = 0;
  private session = false;
  private writeChain: Promise<void> = Promise.resolve();
  private pendingHistory: {
    direction: "undo" | "redo";
    step: Step;
    request: SaveRequest;
  } | null = null;

  /** Configure completed receipt retention without limiting unresolved work.
   * @param options Nonnegative retention days/count, defaulting to 30/1,000.
   * @example new CareerController({ completedOperationCount: 500 })
   */
  constructor(private readonly options: CareerControllerOptions = {}) {
    for (const value of [
      options.completedOperationDays,
      options.completedOperationCount,
    ]) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0))
        throw new Error("Receipt retention must be finite and nonnegative.");
    }
  }

  private preferenceVersion = 0;
  private preferencesLoaded = false;
  private preferenceWrites: Promise<void> = Promise.resolve();

  /** Apply immediate browser preferences, serializing durable writes without workspace history.
   * @param patch Valid preference changes, or no changes to retry persistence.
   * @returns Completion; failures retain current-tab values with retry feedback.
   * @example await controller.changePreferences({ compilationTimeoutMs: 45000 })
   */
  async changePreferences(
    patch: Partial<DevicePreferences> = {},
  ): Promise<void> {
    const preferences = devicePreferencesSchema.parse({
      ...this.state.preferences,
      ...patch,
    });
    const version = ++this.preferenceVersion;
    this.publish({
      preferences,
      preferenceStatus: "Saving browser preferences...",
    });
    this.preferenceWrites = this.preferenceWrites
      .catch(() => {})
      .then(async () => {
        try {
          if (!this.storage) throw new Error("Browser storage is unavailable.");
          await this.storage.writeDevicePreferences({
            version: 1,
            values: preferences,
          });
          this.preferencesLoaded = true;
          if (!this.disposed && version === this.preferenceVersion)
            this.publish({ preferenceStatus: "Browser preferences saved." });
        } catch (error) {
          if (!this.disposed && version === this.preferenceVersion)
            this.publish({
              preferenceStatus: `Preferences apply in this tab only. Retry saving. ${String(error)}`,
            });
        }
      });
    await this.preferenceWrites;
  }

  /** Run noncritical cleanup without disabling editing or tab notifications.
   * @returns Maintenance completion; errors are exposed and retried on next load/save.
   * @example await this.maintain()
   */
  private async maintain(): Promise<void> {
    try {
      await this.storage?.retryDraftCleanup();
      if (this.preferencesLoaded)
        await this.storage?.pruneCompleted(
          this.options.completedOperationDays ??
            this.state.preferences.completedOperationDays,
          this.options.completedOperationCount ??
            this.state.preferences.completedOperationCount,
        );
    } catch (error) {
      this.publish({
        error: `Storage maintenance needs retry. ${String(error)}`,
      });
    }
  }

  /** Merge durable drafts with interrupted receipt requests without hiding newer edits.
   * @returns Unresolved versions for recovery discovery; no automatic restoration or commit.
   * @example const recovery = await this.readRecovery()
   */
  private async readRecovery(): Promise<CareerDraft[]> {
    if (!this.storage) return [];
    const drafts = await this.storage.drafts();
    for (const draft of await this.storage.uncertainDrafts()) {
      if (!drafts.some((item) => item.draftId === draft.draftId))
        drafts.push(draft);
    }
    return drafts;
  }

  /** Read the stable snapshot for useSyncExternalStore.
   * @returns {CareerState} Current immutable published state.
   * @example controller.getSnapshot()
   */
  getSnapshot = (): CareerState => this.state;

  /** Subscribe to controller state changes.
   * @param listener Callback invoked after publication.
   * @returns Cleanup function removing the subscription.
   * @example const unsubscribe = controller.subscribe(render)
   */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Publish changed fields and current history bounds.
   * @param patch State changes.
   * @returns {void} No value.
   * @example this.publish({ error: "Save failed" })
   */
  private publish(patch: Partial<CareerState>): void {
    if (this.disposed) return;
    this.state = {
      ...this.state,
      ...patch,
      undoCount: this.undo.length,
      redoCount: this.redo.length,
    };
    this.listeners.forEach((listener) => listener());
  }

  /** Select one independent editing lane without copying its state.
   * @param target Form or section entry-order draft.
   * @returns Current draft, or null for an unopened lane.
   * @example this.draftFor("order")
   */
  private draftFor(target: CareerDraftTarget): CareerDraft | null {
    return target === "order" ? this.state.orderDraft : this.state.draft;
  }

  /** Publish lane-local draft diagnostics alongside shared committed/history state.
   * @param target Editing lane whose draft/error/recovery fields are updated.
   * @param patch State changes; committed head and saving status remain shared.
   * @returns No value; the other lane is preserved.
   * @example this.publishFor("order", { error: "Order Save failed" })
   */
  private publishFor(
    target: CareerDraftTarget,
    patch: Partial<CareerState>,
  ): void {
    if (target === "form") {
      this.publish(patch);
      return;
    }
    const { draft, error, recoveryStatus, ...shared } = patch;
    this.publish({
      ...shared,
      ...("draft" in patch ? { orderDraft: draft } : {}),
      ...("error" in patch ? { orderError: error } : {}),
      ...("recoveryStatus" in patch
        ? { orderRecoveryStatus: recoveryStatus }
        : {}),
    });
  }

  /** Detect unsaved changes in either independently saved lane.
   * @returns True when a form or order differs from its own baseline.
   * @example controller.hasUnsavedChanges()
   */
  hasUnsavedChanges(): boolean {
    return this.isDirty("form") || this.isDirty("order");
  }

  /** Identify drafts that must resolve before a destination or workspace action.
   * @param next Destination scope; omitted for history/replacement/workspace-wide actions.
   * @returns Form then order targets; same-section entry navigation retains order. Data retains all drafts; device panels retain ordinary editor drafts but guard departure from Settings workspace forms.
   * @example controller.navigationTargets(`entry/${entry.id}`)
   */
  navigationTargets(next?: string): CareerDraftTarget[] {
    const targets: CareerDraftTarget[] = [];
    // Recovery/export is a safe utility destination, not a draft resolution.
    const panel = next ? settingsPanel(next) : null;
    const settingsForm = ["languages", "defaults"].includes(
      this.state.draft?.scope ?? "",
    );
    if (
      next === "backups" ||
      panel === "data" ||
      (panel && !["languages", "defaults"].includes(panel) && !settingsForm)
    )
      return targets;
    if (next) next = destinationScope(next) ?? next;
    const sameSelection =
      next?.startsWith("resume-content/") &&
      this.state.draft?.scope ===
        next.replace(/^resume-content\//, "selection/");
    if (this.state.draft && this.state.draft.scope !== next && !sameSelection)
      targets.push("form");
    const order = this.state.orderDraft;
    if (order) {
      const sectionId = order.scope.split("/")[1];
      const section = this.state.head?.document.sections.find(
        (item) => item.id === sectionId,
      );
      const retainsOrder =
        next === `list/${sectionId}` ||
        next === order.scope ||
        Boolean(
          next &&
          section?.entries.some((entry) => next === `entry/${entry.id}`),
        );
      if (!retainsOrder) targets.push("order");
    }
    return targets;
  }

  /** Open durable guest state and discover unresolved recovery without restoring it automatically.
   * @returns {Promise<void>} Readiness; storage failures retain an explicitly unsaved memory workspace.
   * @example await controller.initialize()
   */
  async initialize(): Promise<void> {
    if (this.storage && !this.disposed) return;
    this.disposed = false;
    const lifecycle = ++this.lifecycle;
    try {
      const storage = await openCareerStorage();
      if (this.disposed || lifecycle !== this.lifecycle) {
        storage.close();
        return;
      }
      this.storage = storage;
      this.preferencesLoaded = false;
      const head = await storage.load(createCareerDocument());
      if (this.disposed || lifecycle !== this.lifecycle) {
        storage.close();
        return;
      }
      // Install coordination before fallible maintenance.
      this.channel?.close();
      this.channel = new BroadcastChannel("verso-local");
      this.channel.onmessage = () => {
        void this.refresh();
      };
      try {
        this.publish({
          preferences: readDevicePreferences(
            await storage.readDevicePreferences(),
          ),
        });
        this.preferencesLoaded = true;
      } catch (error) {
        this.publish({
          preferenceStatus: `Device preferences could not be loaded. Defaults are active. ${String(error)}`,
        });
      }
      await this.maintain();
      const recovery = await this.readRecovery();
      if (this.disposed || lifecycle !== this.lifecycle) {
        storage.close();
        return;
      }
      this.publish({
        ready: true,
        head,
        recovery,
        durable: true,
        status: `Saved locally · revision ${head.revision}`,
      });
    } catch (error) {
      if (this.disposed || lifecycle !== this.lifecycle) return;
      if (!this.state.head)
        this.publish({
          ready: true,
          head: {
            key: "guest",
            workspaceId: crypto.randomUUID(),
            revision: 0,
            generation: 0,
            document: createCareerDocument(),
          },
          status: String(error).includes("unsupported layout format")
            ? "Not saved: unsupported development workspace"
            : "Not saved · browser storage unavailable",
          error: String(error),
          durable: false,
        });
      else this.publish({ error: String(error) });
    }
  }

  /** Recheck authoritative committed state on tab notifications or focus without replacing a local draft.
   * @returns {Promise<void>} Updated head; same-scope differences remain recoverable and visible.
   * @example await controller.refresh()
   */
  async refresh(): Promise<void> {
    if (!this.storage || this.session || this.state.saving) return;
    try {
      const head = await this.storage.load();
      if (
        this.disposed ||
        (this.state.head &&
          (head.generation < this.state.head.generation ||
            (head.generation === this.state.head.generation &&
              head.revision < this.state.head.revision)))
      )
        return;
      if (head.generation !== this.state.head?.generation) {
        this.undo = [];
        this.redo = [];
        this.pendingHistory = null;
      }
      this.publish({ head, recovery: await this.readRecovery() });
      for (const target of ["form", "order"] as const) {
        const draft = this.draftFor(target);
        if (
          draft &&
          (head.generation !== draft.generation ||
            !sameScope(readScope(head.document, draft.scope), draft.baseline))
        ) {
          this.publishFor(target, {
            error:
              target === "order"
                ? "Saved entry order changed. Your pending order is retained. Export recovery from Data & backups, or cancel this order and start again."
                : "Committed content changed. Your draft is retained; Compare and Reconcile before Save.",
          });
        }
      }
    } catch (error) {
      this.publish({ error: String(error) });
    }
  }

  /** Start a clean editing scope; callers must resolve an existing dirty scope first.
   * @param scope Existing scope path.
   * @param target Independent form or section entry-order lane (default form).
   * @returns {void} Opens an uncommitted draft without history or committed writes.
   * @example controller.open("profile")
   */
  open(scope: string, target: CareerDraftTarget = "form"): void {
    const head = this.state.head;
    if (!head || this.draftFor(target)) return;
    if (target === "order" && !scope.startsWith("entries/")) {
      this.publishFor(target, {
        error: "Entry-order drafts require an entries scope.",
      });
      return;
    }
    const baseline = structuredClone(readScope(head.document, scope));
    if (baseline === undefined) {
      this.publishFor(target, {
        error: "Record not found. Return to Career details.",
      });
      return;
    }
    const draftId = crypto.randomUUID();
    this.pristineDraftIds.add(draftId);
    this.publishFor(target, {
      draft: {
        draftId,
        draftVersion: 1,
        workspaceId: head.workspaceId,
        scope,
        baseline,
        baselineRevision: head.revision,
        generation: head.generation,
        values: structuredClone(baseline),
      },
      error: "",
      recoveryStatus: "No unsaved changes",
    });
  }

  /** Update only form values and schedule separate recovery; never mutate committed content or history.
   * @param values New draft values, including temporarily malformed input.
   * @param target Draft to update; the other lane is unchanged (default form).
   * @returns {void} Published uncommitted draft.
   * @example controller.change({ ...draft.values, name: "Engineer" })
   */
  change(values: unknown, target: CareerDraftTarget = "form"): void {
    const draft = this.draftFor(target);
    if (!draft) return;
    if (
      draft.scope.startsWith("resume-layout/") &&
      values &&
      typeof values === "object" &&
      !("defaults" in values) &&
      resumeLayoutSchema.safeParse(draft.baseline).success
    )
      values = { ...values, defaults: layoutDefaults(draft.baseline) };
    this.pristineDraftIds.delete(draft.draftId);
    this.publishFor(target, {
      draft: {
        ...draft,
        draftVersion: draft.draftVersion + 1,
        values: structuredClone(values),
        operationId: undefined,
        fingerprint: undefined,
      },
      recoveryStatus: "Recovery pending · workspace not saved",
      error: "",
    });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flushRecovery();
    }, 500);
    this.maxTimer ??= setTimeout(() => {
      void this.flushRecovery();
    }, 2000);
  }

  /** Detect unsaved scope changes.
   * @param target Draft to compare with its own baseline (default form).
   * @returns {boolean} True when current values differ from the committed baseline.
   * @example controller.isDirty()
   */
  isDirty(target: CareerDraftTarget = "form"): boolean {
    const draft = this.draftFor(target);
    if (draft?.scope.startsWith("resume-layout/"))
      return !sameLayout(draft.values, draft.baseline);
    return Boolean(draft && !sameScope(draft.values, draft.baseline));
  }

  /** Flush the captured draft version serially; announce recovery failures without false save status.
   * @returns {Promise<void>} Recovery attempt completion; failures remain visible with values in memory.
   * @example await controller.flushRecovery()
   */
  async flushRecovery(): Promise<void> {
    clearTimeout(this.timer);
    clearTimeout(this.maxTimer);
    this.timer = undefined;
    this.maxTimer = undefined;
    const captured = (["form", "order"] as const).flatMap((target) => {
      const draft = this.draftFor(target);
      return draft && this.isDirty(target) ? [{ target, draft }] : [];
    });
    const write = async () => {
      for (const { target, draft } of captured) {
        // A queued flush must not resurrect a draft resolved before its turn.
        if (this.draftFor(target)?.draftId !== draft.draftId) continue;
        try {
          if (!this.storage)
            throw new Error(
              "Browser storage unavailable. Newer edits have no durable recovery; export recovery and keep this tab open.",
            );
          await this.storage.writeDraft(draft);
          const current = this.draftFor(target);
          if (
            current?.draftVersion === draft.draftVersion &&
            current.draftId === draft.draftId
          )
            this.publishFor(target, {
              recoveryStatus: `Recovery stored \u00b7 draft ${draft.draftVersion} \u00b7 workspace not saved`,
            });
        } catch (error) {
          this.publishFor(target, {
            error: String(error),
            recoveryStatus:
              "Recovery failed \u00b7 newer edits exist only in this tab. Export recovery.",
          });
        }
      }
    };
    this.writeChain = this.writeChain.then(write);
    await this.writeChain;
  }

  /** Cancel/Discard one form and conditionally remove its exact recovery version.
   * @param target Only this lane is discarded (default form).
   * @returns {Promise<void>} Completed discard, or rejection retaining the draft when cleanup fails.
   * @example await controller.cancel()
   */
  async cancel(target: CareerDraftTarget = "form"): Promise<void> {
    const draft = this.draftFor(target);
    if (!draft || this.state.saving) return;
    // A locally opened, never-edited form has no recovery write to resolve.
    // Avoid toggling the entire list's saving state and writing cleanup intents
    // while navigating between pristine entry forms.
    if (this.pristineDraftIds.delete(draft.draftId)) {
      this.publishFor(target, { draft: null, error: "", recoveryStatus: "" });
      return;
    }
    clearTimeout(this.timer);
    clearTimeout(this.maxTimer);
    this.timer = undefined;
    this.maxTimer = undefined;
    this.publish({ saving: true });
    const cleanup = this.writeChain.then(async () => {
      try {
        if (this.storage)
          await this.storage.discardDraft(
            draft.draftId,
            draft.draftVersion,
            draft.operationId,
          );
        const current = this.draftFor(target);
        if (
          current?.draftId !== draft.draftId ||
          current.draftVersion !== draft.draftVersion
        )
          throw new Error(
            "Newer edits were retained. Review them before discarding again.",
          );
        this.publishFor(target, {
          draft: null,
          error: "",
          recoveryStatus: "",
          recovery: this.state.recovery.filter(
            (item) => item.draftId !== draft.draftId,
          ),
        });
      } catch (error) {
        this.publishFor(target, {
          error: `Discard cleanup failed; draft retained. ${String(error)}`,
        });
        throw error;
      } finally {
        this.publish({ saving: false });
        if (this.hasUnsavedChanges())
          this.timer = setTimeout(() => {
            void this.flushRecovery();
          }, 500);
      }
    });
    // Future recovery writes must run after cleanup, including when cleanup fails.
    this.writeChain = cleanup.catch(() => {});
    await cleanup;
  }

  /** Save one scope as one atomic history step, retrying the same immutable operation after an uncertain response.
   * @param memory Explicit session-only choice when durable commit is unavailable.
   * @param target Only this lane is saved; the other draft/baseline is retained (default form).
   * @returns {Promise<boolean>} True only after confirmed local completion (or explicit memory-only commit).
   * @example await controller.save()
   */
  async save(
    memory = false,
    target: CareerDraftTarget = "form",
  ): Promise<boolean> {
    const draft = this.draftFor(target);
    const head = this.state.head;
    if (!draft || !head || this.state.saving) return false;
    if (!this.isDirty(target)) {
      await this.cancel(target);
      return true;
    }
    this.publishFor(target, { saving: true, error: "" });
    try {
      // A prepared request may already have committed (notably resume creation).
      // Its receipt must be checked before trying to apply that creation again.
      if (!draft.operationId)
        applyScope(head.document, draft.scope, draft.values);
      const operationId = draft.operationId ?? crypto.randomUUID();
      const fingerprint =
        draft.fingerprint ??
        JSON.stringify([
          draft.workspaceId,
          draft.generation,
          draft.scope,
          draft.baseline,
          draft.values,
          draft.draftId,
          draft.draftVersion,
        ]);
      const captured = { ...draft, operationId, fingerprint };
      this.publishFor(target, { draft: captured });
      const request: SaveRequest = {
        id: operationId,
        workspaceId: draft.workspaceId,
        generation: draft.generation,
        scope: draft.scope,
        baseline: draft.baseline,
        values: draft.values,
        draftId: draft.draftId,
        draftVersion: draft.draftVersion,
        fingerprint,
        baselineRevision: draft.baselineRevision,
      };
      let next: CareerHead;
      if (memory) {
        if (
          head.generation !== draft.generation ||
          !sameScope(readScope(head.document, draft.scope), draft.baseline)
        )
          throw new Error(
            "Resolve changed content before a session-only Save.",
          );
        next = {
          ...head,
          revision: head.revision + 1,
          document: applyScope(head.document, draft.scope, draft.values),
        };
        this.session = true;
      } else {
        if (!this.storage || this.session)
          throw new Error(
            "Durable Save unavailable. Export recovery or explicitly choose Save in this tab only.",
          );
        await this.flushRecovery();
        await this.storage.writeDraft(captured);
        await this.storage.prepare(request, !draft.operationId);
        next = await this.storage.commit(operationId);
        try {
          await this.storage.acknowledge(operationId);
        } catch (error) {
          this.publish({
            error: `Save confirmed; receipt cleanup needs retry. ${String(error)}`,
          });
        }
      }
      if (!this.committedIds.has(operationId)) {
        let scope = draft.scope;
        let before = structuredClone(draft.baseline);
        if (scope.startsWith("resume-layout/"))
          before = { ...(before as object), defaults: layoutDefaults(before) };
        const after = structuredClone(
          draft.scope.startsWith("starter-create/") ||
            draft.scope.startsWith("resume-layout/")
            ? readScope(next.document, draft.scope)
            : draft.values,
        );
        if (scope.startsWith("new-entry/")) {
          scope = `entry/${scope.split("/")[2]}`;
          before = { ...(after as object), archived: true };
        } else if (scope.startsWith("new-section/")) {
          scope = `section/${scope.split("/")[1]}`;
          before = { ...(after as object), archived: true };
        } else if (
          scope === "languages" &&
          Array.isArray(before) &&
          Array.isArray(after)
        )
          before = [
            ...before,
            ...after
              .filter(
                (item) =>
                  !(before as { tag: string }[]).some(
                    (old) => old.tag === item.tag,
                  ),
              )
              .map((item) => ({ ...item, active: false })),
          ];
        else if (
          (scope === "profile" || scope.startsWith("entry/")) &&
          before &&
          after &&
          typeof before === "object" &&
          typeof after === "object"
        ) {
          for (const key of ["links", "achievements"] as const) {
            const oldItems = (before as Record<string, unknown>)[key];
            const newItems = (after as Record<string, unknown>)[key];
            if (Array.isArray(oldItems) && Array.isArray(newItems))
              (before as Record<string, unknown>)[key] = [
                ...oldItems,
                ...newItems
                  .filter((item) => !oldItems.some((old) => old.id === item.id))
                  .map((item) => ({ ...item, archived: true })),
              ];
          }
        }
        this.addStep({
          scope,
          before,
          after,
          bytes: new TextEncoder().encode(JSON.stringify([before, after]))
            .byteLength,
        });
        this.committedIds.add(operationId);
      }
      const current = this.draftFor(target);
      const newer =
        current &&
        current.draftId === draft.draftId &&
        current.draftVersion !== draft.draftVersion;
      this.publishFor(target, {
        head: next,
        draft: newer
          ? {
              ...current,
              baseline: structuredClone(draft.values),
              baselineRevision: next.revision,
              generation: next.generation,
              operationId: undefined,
              fingerprint: undefined,
            }
          : null,
        status: memory
          ? "Saved in this tab only · durable workspace unchanged"
          : `Saved locally · revision ${next.revision}`,
        recoveryStatus: "",
        recovery: this.state.recovery.filter(
          (item) => item.draftId !== draft.draftId,
        ),
      });
      if (newer) await this.flushRecovery();
      this.channel?.postMessage("saved");
      await this.maintain();
      return true;
    } catch (error) {
      this.publishFor(target, {
        error:
          target === "order"
            ? `Order Save not confirmed. Your pending order is retained. Export recovery from Data & backups, or cancel this order and start again. ${String(error)}`
            : String(error),
        status: "Save not confirmed · draft retained",
      });
      return false;
    } finally {
      this.publishFor(target, { saving: false });
    }
  }

  /** Bound history by serialized scope patch bytes and count, visibly exposing dropped steps.
   * @param step Successful committed patch.
   * @returns {void} No value; oversized Saves remain valid without retained undo.
   * @example this.addStep(step)
   */
  private addStep(step: Step): void {
    this.redo = [];
    if (step.bytes > 32 * 1024 * 1024) {
      this.undo = [];
      this.publish({ historyBoundary: true });
      return;
    }
    this.undo.push(step);
    while (
      this.undo.length > 100 ||
      this.undo.reduce((sum, item) => sum + item.bytes, 0) > 32 * 1024 * 1024
    ) {
      this.undo.shift();
      this.publish({ historyBoundary: true });
    }
  }

  /** Execute a distinct committed command using the same scope-safe Save boundary.
   * @param scope Affected scope.
   * @param values Proposed complete scope values.
   * @param reviewed Optional reviewed baseline; reject changes since the user's review before opening the immutable command.
   * @returns {Promise<boolean>} Confirmed commit outcome; failures leave an editable draft.
   * @example await controller.command(`entry/${id}`, archivedEntry)
   */
  async command(
    scope: string,
    values: unknown,
    reviewed?: unknown,
  ): Promise<boolean> {
    if (this.state.draft) return false;
    if (
      reviewed !== undefined &&
      this.state.head &&
      !sameScope(readScope(this.state.head.document, scope), reviewed)
    ) {
      this.publish({
        error: "This record changed. Review it again before continuing.",
      });
      return false;
    }
    this.open(scope);
    this.change(values);
    return this.save();
  }

  /** Undo/redo only committed scopes; dirty forms must be resolved first and invoked again separately.
   * @param direction History direction.
   * @returns {Promise<boolean>} True after one confirmed history operation; false on dirty/conflicting/failed state.
   * @example await controller.history("undo")
   */
  async history(direction: "undo" | "redo"): Promise<boolean> {
    if (this.state.draft || this.state.orderDraft) {
      this.publish({
        error:
          "Resolve pending forms with Cancel, Discard, or Save, then invoke history separately. Undo after Save undoes that Save.",
      });
      return false;
    }
    const source = direction === "undo" ? this.undo : this.redo;
    const step = source.at(-1);
    const head = this.state.head;
    if (!step || !head || this.state.saving) return false;
    const baseline = direction === "undo" ? step.after : step.before;
    const values = direction === "undo" ? step.before : step.after;
    this.publish({ saving: true });
    try {
      const retry = this.pendingHistory;
      if (retry && (retry.direction !== direction || retry.step !== step))
        throw new Error(
          "Resolve the interrupted history operation by retrying the same Undo/Redo first.",
        );
      if (!retry && !sameScope(readScope(head.document, step.scope), baseline))
        throw new Error(
          "History scope changed. Review current content; history cannot overwrite it.",
        );
      const id = retry?.request.id ?? crypto.randomUUID();
      const request = retry?.request ?? {
        id,
        workspaceId: head.workspaceId,
        generation: head.generation,
        scope: step.scope,
        baseline,
        values,
        draftId: id,
        draftVersion: 1,
        baselineRevision: head.revision,
        fingerprint: JSON.stringify([
          head.workspaceId,
          head.generation,
          step.scope,
          baseline,
          values,
          id,
          1,
        ]),
      };
      let next: CareerHead;
      if (this.session)
        next = {
          ...head,
          revision: head.revision + 1,
          document: applyScope(head.document, step.scope, values),
        };
      else {
        if (!this.storage) throw new Error("Storage unavailable.");
        this.pendingHistory = { direction, step, request };
        await this.storage.writeDraft({
          draftId: request.draftId!,
          draftVersion: 1,
          workspaceId: request.workspaceId,
          generation: request.generation,
          baselineRevision: request.baselineRevision ?? head.revision,
          scope: request.scope,
          baseline: request.baseline,
          values: request.values,
          operationId: request.id,
          fingerprint: request.fingerprint,
        });
        await this.storage.prepare(request, !retry);
        next = await this.storage.commit(request.id);
        try {
          await this.storage.acknowledge(request.id);
        } catch (error) {
          this.publish({
            error: `History confirmed; receipt cleanup needs retry. ${String(error)}`,
          });
        }
      }
      this.pendingHistory = null;
      source.pop();
      (direction === "undo" ? this.redo : this.undo).push(step);
      this.publish({
        head: next,
        error: "",
        status: this.session
          ? "Saved in this tab only"
          : `Saved locally · revision ${next.revision}`,
      });
      this.channel?.postMessage("saved");
      await this.maintain();
      return true;
    } catch (error) {
      this.publish({ error: String(error) });
      return false;
    } finally {
      this.publish({ saving: false });
    }
  }

  /** Restore an explicit recovery record as an uncommitted draft, retaining both versions on conflict.
   * @param draft Selected durable/imported draft.
   * @returns {void} Opens recovery without a history step or committed mutation.
   * @example controller.restore(draft)
   */
  restore(draft: CareerDraft): void {
    const target = draft.scope.startsWith("entries/") ? "order" : "form";
    if (this.draftFor(target)) return;
    this.publishFor(target, {
      draft: structuredClone(draft),
      error:
        target === "order"
          ? "Recovered entry order. Review the pending order before Save."
          : "Recovered draft \u00b7 not saved. Compare current content before reconciliation.",
      recoveryStatus: "Recovered uncommitted draft",
    });
  }

  /** Explicitly accept current committed baseline while keeping recovered values for further editing.
   * @param target Conflicted lane to reconcile (default form).
   * @returns {boolean} False for missing targets, requiring restore-as-new or export.
   * @example controller.reconcile()
   */
  reconcile(target: CareerDraftTarget = "form"): boolean {
    const draft = this.draftFor(target);
    const head = this.state.head;
    if (!draft || !head) return false;
    const baseline = readScope(head.document, draft.scope);
    if (
      baseline === undefined ||
      (baseline &&
        draft.baseline &&
        typeof baseline === "object" &&
        typeof draft.baseline === "object" &&
        "id" in baseline &&
        "id" in draft.baseline &&
        baseline.id !== draft.baseline.id)
    ) {
      this.publishFor(target, {
        error:
          "Original record missing. Use Restore as new or Export recovery.",
      });
      return false;
    }
    this.publishFor(target, {
      draft: {
        ...draft,
        workspaceId: head.workspaceId,
        baseline: structuredClone(baseline),
        baselineRevision: head.revision,
        generation: head.generation,
        operationId: undefined,
        fingerprint: undefined,
        draftVersion: draft.draftVersion + 1,
      },
      error: "Reconciled draft · review and Save to commit.",
    });
    void this.flushRecovery();
    return true;
  }

  /** Rehome a missing recovered entry explicitly as a new draft with fresh identities.
   * @param sectionId User-chosen existing destination section.
   * @param entry Explicitly regenerated entry values.
   * @returns {void} Uncommitted entries draft; original recovery remains until explicit resolution.
   * @example controller.restoreAsNew(section.id, duplicateEntry(recoveredEntry))
   */
  restoreAsNew(sectionId: string, entry: unknown): void {
    const { head, draft } = this.state;
    if (!head || !draft) return;
    if (
      !entry ||
      typeof entry !== "object" ||
      !("id" in entry) ||
      typeof entry.id !== "string"
    )
      return;
    const scope = `new-entry/${sectionId}/${entry.id}`;
    const baseline = readScope(head.document, scope);
    if (baseline !== null) return;
    this.publish({
      draft: {
        ...draft,
        scope,
        workspaceId: head.workspaceId,
        baseline,
        values: entry,
        baselineRevision: head.revision,
        generation: head.generation,
        operationId: undefined,
        fingerprint: undefined,
        draftVersion: draft.draftVersion + 1,
      },
      error: "Restored as new · review and Save to commit.",
    });
    void this.flushRecovery();
  }

  /** Restore a missing resume scope as a fresh, explicitly reviewed creation draft.
   * @param language Active language selected by the user; missing facts/wording are never translated.
   * @returns {Promise<boolean>} True when a validated creation draft opens; original recovery remains available.
   * @example await controller.restoreResumeAsNew("pt-BR")
   */
  async restoreResumeAsNew(language: string): Promise<boolean> {
    const { head, draft } = this.state;
    if (!head || !draft || !draft.scope.startsWith("resume")) return false;
    try {
      const created = createResume(head.document, language);
      const kind = draft.scope.split("/")[0];
      const schema = careerDocumentSchema.shape.resumes.element;
      const resume =
        kind === "resume"
          ? { ...schema.parse(draft.values), id: created.id, language }
          : kind === "resume-content"
            ? {
                ...created,
                ...schema
                  .pick({
                    selection: true,
                    profileSelection: true,
                    summaryIncluded: true,
                  })
                  .parse(draft.values),
              }
            : kind === "resume-layout"
              ? {
                  ...created,
                  layout: {
                    ...schema.shape.layout.parse(draft.values),
                    defaults:
                      schema.shape.layout.parse(draft.values).defaults ??
                      layoutDefaults(draft.baseline),
                  },
                }
              : kind === "resume-wording"
                ? {
                    ...created,
                    overrides: schema.shape.overrides.parse(draft.values),
                  }
                : {
                    ...created,
                    ...schema
                      .pick({ name: true, color: true })
                      .parse(draft.values),
                  };
      applyScope(head.document, `resume/${created.id}`, resume);
      await this.flushRecovery();
      if (this.state.draft !== draft) return false;
      this.publish({
        recovery: this.state.recovery.some(
          (item) => item.draftId === draft.draftId,
        )
          ? this.state.recovery
          : [...this.state.recovery, structuredClone(draft)],
        draft: {
          ...draft,
          draftId: crypto.randomUUID(),
          draftVersion: 1,
          workspaceId: head.workspaceId,
          generation: head.generation,
          baselineRevision: head.revision,
          scope: `resume/${created.id}`,
          baseline: null,
          values: resume,
          operationId: undefined,
          fingerprint: undefined,
        },
        error:
          "Restored as a new resume draft. Review and Save; original recovery is retained separately.",
      });
      void this.flushRecovery();
      return true;
    } catch (error) {
      this.publish({
        error: `Cannot restore this resume yet. Retain or export recovery and reconcile its references. ${String(error)}`,
      });
      return false;
    }
  }

  /** Replace/rollback using an already-reviewed revision, preserving recovery and resetting committed history.
   * @param reviewed Destination head reviewed by the user.
   * @param incoming Validated incoming content, or undefined for rollback.
   * @returns {Promise<boolean>} True after atomic durable adoption, false without mutation on failure.
   * @example await controller.replace(reviewed, incoming)
   */
  async replace(
    reviewed: CareerHead,
    incoming?: CareerDocument,
  ): Promise<boolean> {
    if (
      !this.storage ||
      this.session ||
      this.state.saving ||
      this.state.draft ||
      this.state.orderDraft
    )
      return false;
    this.publish({ saving: true });
    try {
      if (incoming) validateDocument(incoming);
      const head = await this.storage.replace(reviewed, incoming);
      this.undo = [];
      this.redo = [];
      this.pendingHistory = null;
      this.publish({
        head,
        error: "",
        status: `Saved locally · revision ${head.revision}`,
        recovery: await this.readRecovery(),
      });
      this.channel?.postMessage("replaced");
      return true;
    } catch (error) {
      this.publish({ error: String(error) });
      return false;
    } finally {
      this.publish({ saving: false });
    }
  }

  /** Read one previous workspace for review/export before adoption.
   * @returns Previous committed head, or undefined when unavailable.
   * @example await controller.previous()
   */
  async previous(): Promise<CareerHead | undefined> {
    return this.storage?.previous();
  }

  /** Import validated recovery as unresolved work, never as commit receipts or committed content.
   * @param drafts Imported structurally validated records.
   * @returns {Promise<void>} Completed separate recovery writes; source remains usable after failures.
   * @example await controller.importRecovery(envelope.drafts)
   */
  async importRecovery(drafts: CareerDraft[]): Promise<void> {
    if (!this.storage)
      throw new Error(
        "Recovery storage unavailable. Keep the source file available.",
      );
    const imported = drafts.map((draft) => ({
      ...draft,
      draftId: crypto.randomUUID(),
      operationId: undefined,
      fingerprint: undefined,
    }));
    let completed = 0;
    try {
      for (const draft of imported) {
        await this.storage.writeDraft(draft);
        completed++;
      }
      this.publish({
        status: "Recovery imported · no workspace changes committed",
      });
    } catch (error) {
      throw new Error(
        `Imported ${completed} of ${imported.length} recovery drafts. Keep the source file; no workspace changes were committed. ${String(error)}`,
      );
    } finally {
      this.publish({ recovery: await this.readRecovery() });
    }
  }

  /** Preserve latest recovery best-effort and release this tab's timers/channel/database/listeners.
   * @returns {void} No value; page-close recovery cannot be guaranteed.
   * @example controller.dispose()
   */
  dispose(): void {
    const storage = this.storage;
    void this.flushRecovery().finally(() => storage?.close());
    this.disposed = true;
    this.lifecycle++;
    clearTimeout(this.timer);
    clearTimeout(this.maxTimer);
    this.channel?.close();
    this.listeners.clear();
  }
}
