import {
  applyCommitted,
  commitScopeRequest,
  scopeFingerprint,
} from "@/lib/career/commit";
import { draftConflict } from "@/lib/career/conflict";
import {
  devicePreferencesSchema,
  readDevicePreferences,
  writeDevicePreferences,
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
  AccountSync,
  type AccountSyncReason,
} from "@/stores/career/account-sync";
import type {
  CareerBackend,
  WorkspaceIdentity,
  WorkspaceResetOutcome,
} from "@/stores/career/backend";
import {
  type CareerHead,
  CareerStorageError,
  openCareerStorage,
  sameScope,
  saveFailureReason,
  type SaveRequest,
} from "@/stores/career/persistence";
import type { CareerDocument, CareerDraft } from "@/types-and-constants/career";
import {
  describeSaveStatus,
  type SaveFailureReason,
  type SaveStatus,
  type StorageMode,
} from "@/types-and-constants/career-status";
import {
  devicePreferenceDefaults,
  type DevicePreferences,
} from "@/types-and-constants/settings";

export type CareerDraftTarget = "form" | "order";

type WorkspaceReplacementResult =
  { ok: true } | { ok: false; reason: SaveFailureReason; message: string };

export type CareerControllerOptions = {
  /** Open this owner's storage; defaults to the guest IndexedDB backend. */
  openBackend?: () => Promise<CareerBackend>;
  /** Owner kind of `openBackend`, used for status wording if it fails to open. */
  owner?: "guest" | "account";
};

type Step = { scope: string; before: unknown; after: unknown; bytes: number };

/** Cross-tab notification for one owner's tabs. Messages are hints; storage and
 * server checks stay authoritative. `at` lets account tabs share freshness. */
type TabMessage =
  | {
      type: "saved" | "checked";
      at: number;
      revision: number;
      generation: number;
    }
  | { type: "replaced" | "reset" | "recovery" };

/** Account deletion work this tab still has to resolve or finish. */
export type WorkspaceDeletionStatus =
  /** The reviewed workspace still exists and the attempt could still commit, or the server did not answer. */
  | {
      kind: "pending";
      reason: "unconfirmed" | "offline";
      operationId: string;
    }
  /** The server deleted the workspace; this browser's local copy still needs clearing. */
  | { kind: "cleanup-pending"; operationId: string };

/** Outcome of a workspace data deletion command, for the confirmation dialog. */
export type WorkspaceDeletionResult =
  | {
      ok: true;
      by: "this-request" | "another-request" | "unknown";
      cleanup: "complete" | "pending";
    }
  | {
      ok: false;
      reason: SaveFailureReason | "pending" | "cancelled";
      message: string;
    };

/** Where a refresh reads committed state: this browser (cached account head or
 * guest IndexedDB, no network) or a conditional server check (accounts). */
export type RefreshSource = "local" | "remote";

/** Hex SHA-256 of text, matching the server's receipt request hash.
 * @param text Request fingerprint.
 * @returns {Promise<string>} Lowercase hex digest.
 * @example await sha256(draft.fingerprint)
 */
async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
export type DiscardResult =
  | { kind: "discarded"; draftId: string; draftVersion: number }
  | { kind: "refused" }
  | { kind: "unconfirmed"; message: string };

export type RecoveryDiscardResult = "discarded" | "changed" | "unconfirmed";

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
  recoveryCleanupPending: boolean;
  error: string;
  /** Toolbar text derived from saveStatus; kept for display only. */
  status: string;
  /** Typed committed-workspace Save status, separate from recovery/preview/backup. */
  saveStatus: SaveStatus;
  /** Where Saves commit for this tab. */
  storageMode: StorageMode;
  /** Commits made in this tab's memory only since entering session mode. */
  sessionCommits: number;
  recoveryStatus: string;
  saving: boolean;
  durable: boolean;
  undoCount: number;
  redoCount: number;
  historyBoundary: boolean;
  /** Unresolved account deletion or pending local cleanup; null when none. */
  workspaceDeletion: WorkspaceDeletionStatus | null;
  /** Set when this tab adopted a fresh workspace after deletion here or elsewhere. */
  workspaceReset: {
    source: "here" | "elsewhere";
    at: number;
    workspaceId: string;
  } | null;
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
    recoveryCleanupPending: false,
    error: "",
    status: describeSaveStatus({ kind: "opening" }),
    saveStatus: { kind: "opening" },
    storageMode: "unavailable",
    sessionCommits: 0,
    recoveryStatus: "",
    saving: false,
    durable: false,
    undoCount: 0,
    redoCount: 0,
    historyBoundary: false,
    workspaceDeletion: null,
    workspaceReset: null,
  };
  private listeners = new Set<() => void>();
  /** Incremented when this tab adopts a fresh workspace; queued recovery writes from before are dropped. */
  private workspaceEpoch = 0;
  /** True while a deletion is sent or resolved; recovery writes wait and resume on failure. */
  private deletionInFlight = false;
  private storage: CareerBackend | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private maxTimer: ReturnType<typeof setTimeout> | undefined;
  private channel: BroadcastChannel | null = null;
  private undo: Step[] = [];
  private redo: Step[] = [];
  private committedIds = new Set<string>();
  private pristineDraftIds = new Set<string>();
  private pendingRecovery: Partial<Record<CareerDraftTarget, CareerDraft>> = {};
  private recoveryRead = 0;
  private disposed = false;
  private closing: Promise<void> | null = null;
  private lifecycle = 0;
  private session = false;
  private refreshPending = false;
  private accountSync: AccountSync | null = null;
  private writeChain: Promise<void> = Promise.resolve();
  private recoveryRemovals = new Set<Promise<boolean>>();
  private pendingHistory: {
    direction: "undo" | "redo";
    step: Step;
    request: SaveRequest;
  } | null = null;

  /** Owner kind for status wording before (or without) an open backend. */
  private get owner(): "guest" | "account" {
    return this.options.owner ?? "guest";
  }

  constructor(private readonly options: CareerControllerOptions = {}) {}

  private preferenceVersion = 0;
  private preferencesLoaded = false;
  private preferenceWrites: Promise<void> = Promise.resolve();

  /** Apply immediate browser preferences, serializing durable writes without workspace history.
   * @param patch Valid preference changes, or no changes to retry persistence.
   * @returns Completion; failures retain current-tab values with retry feedback.
   * @example await controller.changePreferences({ automaticRefresh: true })
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
          await this.storage.writeDevicePreferences(
            writeDevicePreferences(preferences),
          );
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
    if (!(await this.retryRecoveryCleanup())) return;
    try {
      if (this.preferencesLoaded) await this.storage?.pruneCompleted();
    } catch (error) {
      this.publish({
        error: `Storage maintenance needs retry. ${String(error)}`,
      });
    }
  }

  /** Retry only previously confirmed, version-specific recovery removals.
   * @returns True when all pending intents are cleaned up.
   * @example await controller.retryRecoveryCleanup()
   */
  async retryRecoveryCleanup(): Promise<boolean> {
    try {
      await this.storage?.retryDraftCleanup();
      this.publish({ recoveryCleanupPending: false });
      return true;
    } catch {
      this.publish({ recoveryCleanupPending: true });
      return false;
    }
  }

  /** Observe a confirmed discard's physical cleanup through disposal.
   * @param finished True after removal, false when the durable intent needs retry.
   * @returns No value.
   * @example this.watchRecoveryCleanup(removal.finished)
   */
  private watchRecoveryCleanup(finished: Promise<boolean>): void {
    this.recoveryRemovals.add(finished);
    void finished.then((removed) => {
      this.recoveryRemovals.delete(finished);
      if (!removed) this.publish({ recoveryCleanupPending: true });
    });
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

  /** Report whether a form has stored or edited values without comparing its payload.
   * @param draft Open form version.
   * @returns True once the form has been edited or restored.
   * @example controller.hasPreviewDraft(state.draft)
   */
  hasPreviewDraft = (draft: CareerDraft | null) =>
    Boolean(draft && !this.pristineDraftIds.has(draft.draftId));

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
      ...(patch.saveStatus && !("status" in patch)
        ? {
            status: describeSaveStatus(
              patch.saveStatus,
              this.storage?.kind ?? this.owner,
            ),
          }
        : {}),
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
      if (this.closing) {
        await this.closing;
        if (this.disposed || lifecycle !== this.lifecycle) return;
        this.closing = null;
      }
      const storage: CareerBackend = await (
        this.options.openBackend ?? openCareerStorage
      )();
      if (this.disposed || lifecycle !== this.lifecycle) {
        storage.close();
        return;
      }
      this.storage = storage;
      this.preferencesLoaded = false;
      let head: CareerHead;
      let offlineStart = false;
      try {
        head = await storage.load(createCareerDocument());
      } catch (error) {
        // An unreachable account server opens the last server-confirmed head cached
        // on this device, disclosed as possibly stale; Saves wait for reconnection.
        const cached =
          saveFailureReason(error) === "offline"
            ? await storage.cachedHead?.()
            : undefined;
        if (!cached) throw error;
        head = cached;
        offlineStart = true;
      }
      if (this.disposed || lifecycle !== this.lifecycle) {
        storage.close();
        return;
      }
      // Install coordination before fallible maintenance.
      this.channel?.close();
      this.channel = new BroadcastChannel(storage.channelName);
      this.channel.onmessage = (event: MessageEvent<unknown>) =>
        this.receive(event.data);
      this.accountSync?.stop();
      this.accountSync =
        storage.kind === "account" && storage.check
          ? new AccountSync({
              lockName: `${storage.channelName}-sync`,
              check: () => this.refresh("remote"),
              announce: (at) => this.announce("checked", at),
            })
          : null;
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
        storageMode: storage.kind === "account" ? "account" : "durable",
        saveStatus: offlineStart
          ? { kind: "offline-cached", revision: head.revision }
          : { kind: "saved", revision: head.revision },
      });
      this.accountSync?.start(offlineStart ? undefined : Date.now());
      if (!offlineStart) {
        await this.resolvePendingDeletions();
        await this.reconcilePending();
      }
    } catch (error) {
      if (this.disposed || lifecycle !== this.lifecycle) return;
      if (!this.state.head) {
        // Never pair the memory fallback head with an open durable store.
        this.storage?.close();
        this.storage = null;
        this.channel?.close();
        this.channel = null;
        this.accountSync?.stop();
        this.accountSync = null;
        this.publish({
          ready: true,
          head: {
            key: "guest",
            workspaceId: crypto.randomUUID(),
            revision: 0,
            generation: 0,
            document: createCareerDocument(),
          },
          saveStatus: {
            kind: "unavailable",
            reason: String(error).includes("unsupported layout format")
              ? "unsupported"
              : this.owner === "account"
                ? "account"
                : "storage",
          },
          storageMode: "unavailable",
          error: String(error),
          durable: false,
        });
      } else this.publish({ error: String(error) });
    }
  }

  /** Handle one cross-tab notification; any notice of newer state triggers a local refresh.
   * @param data Message payload from another tab of the same owner.
   * @returns {void} No value.
   */
  private receive(data: unknown): void {
    const message = data as Partial<TabMessage> | null;
    if (message?.type === "recovery") {
      void this.reloadRecovery();
      return;
    }
    if (
      message &&
      (message.type === "saved" || message.type === "checked") &&
      typeof message.at === "number"
    ) {
      this.accountSync?.observe(message.at);
      const head = this.state.head;
      if (
        head &&
        head.revision === message.revision &&
        head.generation === message.generation
      )
        return;
    }
    void this.refresh("local");
  }

  /** Notify this owner's other tabs; saved/checked notices also share account freshness.
   * @param type Notification kind.
   * @param at Completion time for saved/checked notices.
   * @returns {void} No value.
   */
  private announce(type: TabMessage["type"], at = Date.now()): void {
    const head = this.state.head;
    const message: TabMessage =
      type === "recovery"
        ? { type }
        : type === "replaced" || type === "reset" || !head
          ? { type: type === "reset" ? "reset" : "replaced" }
          : { type, at, revision: head.revision, generation: head.generation };
    try {
      this.channel?.postMessage(message);
    } catch {}
  }

  /** Request a cost-bounded freshness check for a focus, visibility, reconnect, or input event.
   * Guests reread local IndexedDB on focus/visibility (no network). Accounts apply the shared
   * sync bounds; a reconnect also resolves pending account Saves through operation status.
   * @param reason Trigger.
   * @returns {Promise<void>} Completion; never throws.
   * @example void controller.sync("focus")
   */
  async sync(reason: AccountSyncReason): Promise<void> {
    if (!this.accountSync) {
      if (reason === "focus" || reason === "visible") await this.refresh();
      return;
    }
    if (reason === "focus" || reason === "visible") await this.reloadRecovery();
    await this.accountSync.request(reason);
    if (reason === "online") await this.reconcilePending();
  }

  /** Record owner input so idle tabs pause periodic account checks and resume on return.
   * @returns {void} No value.
   * @example controller.activity()
   */
  activity(): void {
    this.accountSync?.activity();
  }

  /** Read committed state for a refresh without transferring unchanged account documents.
   * @param source Local cache/IndexedDB, or a conditional server check.
   * @returns Newer or current head, or null when the account head is unchanged.
   */
  private async readHead(source: RefreshSource): Promise<CareerHead | null> {
    const storage = this.storage!;
    const known = this.state.head;
    if (!storage.check || !known) return storage.load();
    if (source === "local") {
      const cached = await storage.cachedHead?.();
      // A server-confirmed fresh workspace cached by another tab after deletion.
      if (
        cached &&
        cached.workspaceId !== known.workspaceId &&
        cached.generation > known.generation
      )
        return cached;
      if (cached && cached.workspaceId === known.workspaceId) {
        if (
          cached.generation === known.generation &&
          cached.revision === known.revision
        )
          return null;
        if (
          cached.generation > known.generation ||
          (cached.generation === known.generation &&
            cached.revision > known.revision)
        )
          return cached;
      }
    }
    const result = await storage.check(known);
    return result === "unchanged" ? null : result;
  }

  /** Recheck committed state on tab notifications, focus, or account sync without replacing a local draft.
   * @param source "local" reads this browser only (cached account head, or guest IndexedDB);
   * "remote" performs a conditional account check. Guests always read IndexedDB.
   * @returns {Promise<boolean>} True when committed state was read; same-scope differences remain recoverable and visible.
   * @example await controller.refresh()
   */
  async refresh(source: RefreshSource = "remote"): Promise<boolean> {
    if (!this.storage || this.session) return false;
    if (this.state.saving) {
      // Apply other-tab notifications after the local Save settles.
      this.refreshPending = true;
      return false;
    }
    this.refreshPending = false;
    try {
      const head = await this.readHead(source);
      if (this.disposed) return false;
      await this.reloadRecovery();
      if (this.disposed) return false;
      if (!head) {
        if (this.state.saveStatus.kind === "offline-cached" && this.state.head)
          this.publish({
            saveStatus: { kind: "saved", revision: this.state.head.revision },
          });
        return true;
      }
      // Only deletion changes the workspace ID: this tab's drafts, history, and
      // pending work belong to deleted data and must not reach the fresh workspace.
      if (
        this.state.head &&
        head.workspaceId !== this.state.head.workspaceId &&
        head.generation > this.state.head.generation
      ) {
        await this.adoptFreshWorkspace(head, "elsewhere");
        return true;
      }
      if (
        this.state.head &&
        (head.generation < this.state.head.generation ||
          (head.generation === this.state.head.generation &&
            head.revision < this.state.head.revision))
      )
        return true;
      const advanced =
        !this.state.head ||
        head.generation !== this.state.head.generation ||
        head.revision !== this.state.head.revision;
      if (head.generation !== this.state.head?.generation) {
        this.undo = [];
        this.redo = [];
        this.pendingHistory = null;
        this.committedIds.clear();
      }
      this.publish({
        head,
        ...(advanced
          ? {
              saveStatus: { kind: "remote-update", revision: head.revision },
              historyBoundary:
                head.generation === this.state.head?.generation &&
                this.state.historyBoundary,
            }
          : this.state.saveStatus.kind === "offline-cached"
            ? { saveStatus: { kind: "saved", revision: head.revision } }
            : {}),
      });
      for (const target of ["form", "order"] as const) {
        const draft = this.draftFor(target);
        if (draft && draftConflict(head, draft)) {
          this.publishFor(target, {
            error:
              target === "order"
                ? "Saved entry order changed. Your pending order is retained until you choose which order to keep."
                : "Committed content changed. Your draft is retained until you choose which version to keep.",
          });
        }
      }
      return true;
    } catch (error) {
      const reason = saveFailureReason(error);
      if (reason === "session") this.accountSync?.pause();
      // Background account checks stay quiet offline; Saves report their own status.
      if (reason !== "offline" && reason !== "session")
        this.publish({ error: String(error) });
      return false;
    }
  }

  /** Resolve pending account Saves after reconnecting or opening, without resending them.
   * Each draft carrying a prepared operation ID is looked up once: a receipt matching its
   * request hash is recorded and acknowledged, removing that exact draft version; an unknown
   * outcome stays pending for an explicit Retry save. No request is sent when nothing is pending.
   * @returns {Promise<number>} Number of Saves the server confirmed.
   * @example await controller.reconcilePending()
   */
  async reconcilePending(): Promise<number> {
    const storage = this.storage;
    if (
      !storage?.operationStatus ||
      !storage.resolveCommitted ||
      this.session ||
      this.state.saving
    )
      return 0;
    const pending = new Map<string, CareerDraft>();
    for (const draft of [
      this.state.draft,
      this.state.orderDraft,
      ...this.state.recovery,
    ])
      if (draft?.operationId && draft.fingerprint)
        pending.set(draft.operationId, draft);
    let resolved = 0;
    for (const draft of pending.values()) {
      const operationId = draft.operationId!;
      let status;
      try {
        status = await storage.operationStatus(operationId);
      } catch {
        return resolved;
      }
      if (
        this.disposed ||
        status.status !== "committed" ||
        status.kind !== "save" ||
        status.requestHash !== (await sha256(draft.fingerprint!))
      )
        continue;
      try {
        await storage.resolveCommitted(operationId, status.result);
      } catch {
        continue;
      }
      resolved++;
      for (const target of ["form", "order"] as const) {
        const lane = this.draftFor(target);
        if (
          lane?.operationId === operationId &&
          lane.draftVersion === draft.draftVersion
        )
          this.publishFor(target, { draft: null, error: "" });
      }
      this.publish({
        recovery: this.state.recovery.filter(
          (item) => item.operationId !== operationId,
        ),
      });
    }
    if (resolved > 0 && (await this.refresh("remote"))) {
      this.accountSync?.observe(Date.now());
      if (this.state.head)
        this.publish({
          saveStatus: { kind: "saved", revision: this.state.head.revision },
        });
    }
    return resolved;
  }

  /** Start a clean editing scope; callers must resolve an existing dirty scope first.
   * @param scope Existing scope path.
   * @param target Independent form or section entry-order lane (default form).
   * @param refreshPristine Reread the saved values after a stored draft was discarded.
   * @returns {void} Opens an uncommitted draft without history or committed writes.
   * @example controller.open("profile")
   */
  open(
    scope: string,
    target: CareerDraftTarget = "form",
    refreshPristine = false,
  ): void {
    const head = this.state.head;
    const current = this.draftFor(target);
    if (
      !head ||
      (current &&
        (!refreshPristine ||
          current.scope !== scope ||
          !this.pristineDraftIds.has(current.draftId)))
    )
      return;
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
    if (current) this.pristineDraftIds.delete(current.draftId);
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
    const changed = {
      ...draft,
      draftVersion: draft.draftVersion + 1,
      values: structuredClone(values),
      operationId: undefined,
      fingerprint: undefined,
    };
    this.pendingRecovery[target] = changed;
    this.publishFor(target, {
      draft: changed,
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
    // A deletion in flight resumes recovery when it fails; edits stay in memory meanwhile.
    if (this.deletionInFlight) return;
    const captured = (["form", "order"] as const).flatMap((target) => {
      const draft = this.draftFor(target);
      const pending = this.pendingRecovery[target];
      return draft &&
        pending?.draftId === draft.draftId &&
        pending.draftVersion === draft.draftVersion
        ? [{ target, draft, pending }]
        : [];
    });
    // The writer's observed workspace fences writes from before a deletion.
    const workspaceId = this.state.head?.workspaceId;
    const epoch = this.workspaceEpoch;
    const write = async () => {
      for (const { target, draft, pending } of captured) {
        // A queued flush must not resurrect a draft resolved before its turn.
        if (
          epoch !== this.workspaceEpoch ||
          this.draftFor(target)?.draftId !== draft.draftId
        )
          continue;
        try {
          if (!this.storage || !workspaceId)
            throw new Error(
              "Browser storage unavailable. Newer edits have no durable recovery; export recovery and keep this tab open.",
            );
          await this.storage.writeDraft(
            { ...draft, updatedAt: new Date().toISOString() },
            workspaceId,
          );
          if (this.pendingRecovery[target] === pending)
            delete this.pendingRecovery[target];
          this.announce("recovery");
          const current = this.draftFor(target);
          if (
            current?.draftVersion === draft.draftVersion &&
            current.draftId === draft.draftId
          )
            this.publishFor(target, {
              recoveryStatus: `Recovery stored \u00b7 draft ${draft.draftVersion} \u00b7 workspace not saved`,
            });
        } catch (error) {
          // Another tab deleted this workspace's data: adopt the fresh workspace.
          if (saveFailureReason(error) === "replaced") {
            void this.refresh("local");
            continue;
          }
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

  /** Resolve the exact open draft, then clean up its recovery independently.
   * @param target Only this lane is discarded (default form).
   * @returns Confirmation for the resolved version, or a retained/refused outcome.
   * @example const result = await controller.cancel()
   */
  async cancel(target: CareerDraftTarget = "form"): Promise<DiscardResult> {
    const draft = this.draftFor(target);
    if (!draft || this.state.saving) return { kind: "refused" };
    const { draftId, draftVersion } = draft;
    const resolved = { kind: "discarded", draftId, draftVersion } as const;
    const close = () => {
      const current = this.draftFor(target);
      if (current?.draftId !== draftId || current.draftVersion !== draftVersion)
        return false;
      delete this.pendingRecovery[target];
      this.recoveryRead++;
      this.publishFor(target, {
        draft: null,
        error: "",
        recoveryStatus: "",
        recovery: this.state.recovery.filter(
          (item) =>
            item.draftId !== draftId || item.draftVersion > draftVersion,
        ),
      });
      return true;
    };
    if (this.pristineDraftIds.delete(draftId)) {
      close();
      return resolved;
    }
    clearTimeout(this.timer);
    clearTimeout(this.maxTimer);
    this.timer = undefined;
    this.maxTimer = undefined;
    this.publish({ saving: true });
    const confirmation = this.writeChain.then(
      async (): Promise<DiscardResult> => {
        try {
          const cleanup = this.storage
            ? await this.storage.confirmDraftDiscard(
                draftId,
                draftVersion,
                draft.operationId,
              )
            : null;
          if (cleanup) {
            this.watchRecoveryCleanup(cleanup.finished);
            this.announce("recovery");
          }
          if (close()) return resolved;
          this.publishFor(target, {
            error:
              "Newer edits were retained. Review them before discarding again.",
          });
          return { kind: "refused" };
        } catch (error) {
          const message = `Discard unconfirmed; draft retained. ${String(error)}`;
          this.publishFor(target, { error: message });
          return { kind: "unconfirmed", message };
        } finally {
          this.publish({ saving: false });
          clearTimeout(this.timer);
          this.timer = undefined;
          if (this.hasUnsavedChanges() && !this.disposed)
            this.timer = setTimeout(() => {
              void this.flushRecovery();
            }, 500);
        }
      },
    );
    this.writeChain = confirmation.then(() => {});
    return confirmation;
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
      return (await this.cancel(target)).kind === "discarded";
    }
    this.publishFor(target, {
      saving: true,
      error: "",
      saveStatus: { kind: "saving" },
    });
    let cleanupPending = false;
    try {
      // A prepared request may already have committed (notably resume creation).
      // Its receipt must be checked before trying to apply that creation again.
      if (!draft.operationId)
        applyScope(head.document, draft.scope, draft.values);
      const operationId = draft.operationId ?? crypto.randomUUID();
      const fingerprint = draft.fingerprint ?? scopeFingerprint(draft);
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
        const decision = commitScopeRequest(head, request);
        if (!decision.ok)
          throw new Error(
            "Resolve changed content before a session-only Save.",
          );
        next = decision.head;
        this.session = true;
      } else {
        if (!this.storage || this.session)
          throw new CareerStorageError(
            "storage",
            "Durable Save unavailable. Export recovery or explicitly choose Save in this tab only.",
          );
        await this.flushRecovery();
        await this.storage.writeDraft(
          { ...captured, updatedAt: new Date().toISOString() },
          head.workspaceId,
        );
        await this.storage.prepare(
          request,
          !draft.operationId,
          head.workspaceId,
        );
        next = await this.storage.commit(operationId);
        try {
          await this.storage.acknowledge(operationId);
        } catch {
          // The commit is confirmed; the receipt stays protected and is
          // acknowledged on the next load. Report it as informational status.
          cleanupPending = true;
        }
      }
      if (!this.committedIds.has(operationId)) {
        let scope = draft.scope;
        let before = structuredClone(draft.baseline);
        if (scope.startsWith("resume-layout/"))
          before = { ...(before as object), defaults: layoutDefaults(before) };
        const after = structuredClone(
          draft.scope.startsWith("starter-create/") ||
            draft.scope.startsWith("language-evidence/") ||
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
          for (const key of ["links", "achievements", "evidence"] as const) {
            const newItems = (after as Record<string, unknown>)[key];
            // Evidence is optional; an absent baseline list means no attachments.
            const oldItems =
              (before as Record<string, unknown>)[key] ??
              (key === "evidence" && Array.isArray(newItems) ? [] : undefined);
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
        // Retries only need recent identities; keep the set bounded.
        while (this.committedIds.size > 1000)
          this.committedIds.delete(this.committedIds.values().next().value!);
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
        saveStatus: memory
          ? { kind: "session", revision: next.revision }
          : cleanupPending
            ? { kind: "cleanup-retry", revision: next.revision }
            : { kind: "saved", revision: next.revision },
        ...(memory
          ? {
              storageMode: this.storage
                ? ("session" as const)
                : ("unavailable" as const),
              sessionCommits: this.state.sessionCommits + 1,
            }
          : {}),
        recoveryStatus: "",
        recovery: this.state.recovery.filter(
          (item) => item.draftId !== draft.draftId,
        ),
      });
      if (newer) await this.flushRecovery();
      if (!memory) {
        this.announce("saved");
        // An acknowledged Save proves the session and returns the current head.
        this.accountSync?.resume();
        this.accountSync?.observe(Date.now());
      }
      await this.maintain();
      return true;
    } catch (error) {
      const reason = saveFailureReason(error);
      // A rejected scope means newer committed content exists: read it once so both
      // versions can be compared. An invalid session pauses sync until sign-in.
      if (reason === "conflict" || reason === "replaced")
        this.refreshPending = true;
      if (reason === "session") this.accountSync?.pause();
      this.publishFor(target, {
        error:
          target === "order"
            ? `Order Save not confirmed. Your pending order is retained. Export recovery from Settings › Data, or cancel this order and start again. ${String(error)}`
            : String(error),
        saveStatus: { kind: "failed", reason },
      });
      return false;
    } finally {
      this.publishFor(target, { saving: false });
      if (this.refreshPending) void this.refresh();
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
    let bytes = this.undo.reduce((sum, item) => sum + item.bytes, 0);
    while (this.undo.length > 100 || bytes > 32 * 1024 * 1024) {
      bytes -= this.undo.shift()!.bytes;
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
    this.publish({ saving: true, saveStatus: { kind: "saving" } });
    let cleanupPending = false;
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
        fingerprint: scopeFingerprint({
          workspaceId: head.workspaceId,
          generation: head.generation,
          scope: step.scope,
          baseline,
          values,
          draftId: id,
          draftVersion: 1,
        }),
      };
      let next: CareerHead;
      if (this.session) next = applyCommitted(head, step.scope, values);
      else {
        if (!this.storage) throw new Error("Storage unavailable.");
        this.pendingHistory = { direction, step, request };
        await this.storage.writeDraft(
          {
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
          },
          head.workspaceId,
        );
        await this.storage.prepare(request, !retry, head.workspaceId);
        next = await this.storage.commit(request.id);
        try {
          await this.storage.acknowledge(request.id);
        } catch {
          cleanupPending = true;
        }
      }
      this.pendingHistory = null;
      source.pop();
      (direction === "undo" ? this.redo : this.undo).push(step);
      this.publish({
        head: next,
        error: "",
        saveStatus: this.session
          ? { kind: "session", revision: next.revision }
          : cleanupPending
            ? { kind: "cleanup-retry", revision: next.revision }
            : { kind: "saved", revision: next.revision },
        ...(this.session
          ? { sessionCommits: this.state.sessionCommits + 1 }
          : {}),
      });
      if (!this.session) this.announce("saved");
      await this.maintain();
      return true;
    } catch (error) {
      this.publish({
        error: String(error),
        saveStatus: { kind: "failed", reason: saveFailureReason(error) },
      });
      return false;
    } finally {
      this.publish({ saving: false });
      if (this.refreshPending) void this.refresh();
    }
  }

  /** Restore an explicit recovery record as an uncommitted draft, retaining both versions on conflict.
   * @param draft Selected durable/imported draft.
   * @param replacePristine Allow a recovery dialog to replace the untouched editor for this scope.
   * @returns True when recovery opens without a history step or committed mutation.
   * @example controller.restore(draft)
   */
  restore(draft: CareerDraft, replacePristine = false): boolean {
    const target = draft.scope.startsWith("entries/") ? "order" : "form";
    const current = this.draftFor(target);
    if (this.state.saving) return false;
    if (
      current &&
      (!replacePristine ||
        (current.scope !== draft.scope &&
          !(
            current.scope.startsWith("resume-content/") &&
            draft.scope ===
              current.scope.replace(/^resume-content\//, "selection/")
          )) ||
        !this.pristineDraftIds.delete(current.draftId))
    )
      return false;
    this.publishFor(target, {
      draft: structuredClone(draft),
      error: "",
      recoveryStatus: "Recovered uncommitted draft",
    });
    return true;
  }

  /** Explicitly discard one listed recovery record without opening it.
   * @param draft Unresolved recovery entry chosen from the recovery list.
   * @returns Durable confirmation, a changed version to review again, or an unconfirmed intent.
   * @example await controller.discardRecovery(state.recovery[0])
   */
  async discardRecovery(draft: CareerDraft): Promise<RecoveryDiscardResult> {
    const storage = this.storage;
    if (
      !storage ||
      this.state.saving ||
      this.state.draft?.draftId === draft.draftId ||
      this.state.orderDraft?.draftId === draft.draftId
    )
      return "unconfirmed";
    this.publish({ saving: true });
    const confirmation = this.writeChain.then(
      async (): Promise<RecoveryDiscardResult> => {
        try {
          const cleanup = await storage.confirmDraftDiscard(
            draft.draftId,
            draft.draftVersion,
            draft.operationId,
            draft,
          );
          this.watchRecoveryCleanup(cleanup.finished);
        } catch (error) {
          if (saveFailureReason(error) === "conflict")
            return (await this.reloadRecovery()) ? "changed" : "unconfirmed";
          return "unconfirmed";
        }
        this.recoveryRead++;
        this.publish({
          recovery: this.state.recovery.filter(
            (item) =>
              item.draftId !== draft.draftId ||
              item.draftVersion > draft.draftVersion,
          ),
        });
        this.announce("recovery");
        return "discarded";
      },
    );
    this.writeChain = confirmation.then(() => {});
    try {
      return await confirmation;
    } finally {
      this.publish({ saving: false });
      if (this.refreshPending) void this.refresh();
    }
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
    const changed = {
      ...draft,
      workspaceId: head.workspaceId,
      baseline: structuredClone(baseline),
      baselineRevision: head.revision,
      generation: head.generation,
      operationId: undefined,
      fingerprint: undefined,
      draftVersion: draft.draftVersion + 1,
    };
    this.pendingRecovery[target] = changed;
    this.publishFor(target, {
      draft: changed,
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
    const changed = {
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
    };
    this.pendingRecovery.form = changed;
    this.publish({
      draft: changed,
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
      const changed: CareerDraft = {
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
      };
      this.pendingRecovery.form = changed;
      this.publish({
        recovery: this.state.recovery.some(
          (item) => item.draftId === draft.draftId,
        )
          ? this.state.recovery
          : [...this.state.recovery, structuredClone(draft)],
        draft: changed,
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
   * @param kind Whether incoming content is from a file or the browser's guest workspace.
   * @returns Acknowledged adoption or a failure for this review to display.
   * @example await controller.replace(reviewed, incoming)
   */
  async replace(
    reviewed: CareerHead,
    incoming?: CareerDocument,
    kind: "replace" | "import" = "replace",
  ): Promise<WorkspaceReplacementResult> {
    if (
      !this.storage ||
      this.session ||
      this.state.saving ||
      this.state.draft ||
      this.state.orderDraft
    )
      return {
        ok: false,
        reason: "invalid",
        message:
          "Finish any open edits and make sure durable saving is available before continuing.",
      };
    this.publish({ saving: true });
    try {
      if (incoming) validateDocument(incoming);
      const head = await this.storage.replace(reviewed, incoming, kind);
      const recovery = await this.readRecovery().catch(() => undefined);
      this.undo = [];
      this.redo = [];
      this.pendingHistory = null;
      this.committedIds.clear();
      this.publish({
        head,
        error: recovery
          ? ""
          : "Workspace saved. Unsaved drafts could not be refreshed. Reload to check them.",
        historyBoundary: false,
        saveStatus: { kind: "saved", revision: head.revision },
        ...(recovery ? { recovery } : {}),
      });
      this.announce("replaced");
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        reason: saveFailureReason(error),
        message: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.publish({ saving: false });
      if (this.refreshPending) void this.refresh();
    }
  }

  /** Permanently delete the reviewed workspace's data and adopt a fresh workspace.
   * Deletes committed content, the previous workspace, history, open and stored drafts,
   * recovery, and receipts (and, for accounts, public PDFs). Open drafts are allowed: they
   * are part of what the user confirmed deleting. Nothing is discarded until storage
   * confirms the deletion; on failure the drafts stay open and recovery resumes.
   * @param reviewed Workspace identity and revision shown in the confirmation.
   * @returns Deleted outcome, or a failure the dialog shows: `conflict` (the workspace changed since review; state is refreshed), `pending` (account outcome unresolved), or another Save failure reason.
   * @example await controller.deleteWorkspaceData(state.head)
   */
  async deleteWorkspaceData(
    reviewed: WorkspaceIdentity,
  ): Promise<WorkspaceDeletionResult> {
    const storage = this.storage;
    if (
      !storage ||
      this.session ||
      !this.state.durable ||
      this.state.workspaceDeletion?.kind === "pending"
    )
      return {
        ok: false,
        reason: "invalid",
        message: this.state.workspaceDeletion
          ? "Resolve the earlier deletion attempt first."
          : "Durable saving must be available before deleting workspace data.",
      };
    return this.runDeletion(() => storage.resetWorkspace(reviewed));
  }

  /** Re-read stored recovery, including drafts other tabs stored, without restoring any.
   * @returns The stored drafts, or null when a read fails and the current list is kept.
   * @example await controller.reloadRecovery()
   */
  async reloadRecovery(): Promise<CareerDraft[] | null> {
    const read = ++this.recoveryRead;
    const recovery = await this.readRecovery().catch(() => undefined);
    if (recovery && read === this.recoveryRead && !this.disposed)
      this.publish({ recovery });
    return recovery ?? null;
  }

  /** Account only: resolve an unconfirmed deletion attempt from server state and its receipt.
   * Also retries this browser's cleanup after a confirmed deletion. Never resends the attempt.
   * @param operationId Attempt from `workspaceDeletion`.
   * @returns Outcome as for `deleteWorkspaceData`.
   * @example await controller.resolveWorkspaceDeletion(id)
   */
  async resolveWorkspaceDeletion(
    operationId: string,
  ): Promise<WorkspaceDeletionResult> {
    const storage = this.storage;
    if (!storage?.resolveReset)
      return { ok: false, reason: "invalid", message: "Nothing to resolve." };
    return this.runDeletion(() => storage.resolveReset!(operationId));
  }

  /** Account only: resend the same deletion attempt (same operation ID and reviewed identity).
   * @param operationId Attempt from `workspaceDeletion`.
   * @returns Outcome as for `deleteWorkspaceData`; a changed workspace rejects without deleting.
   * @example await controller.retryWorkspaceDeletion(id)
   */
  async retryWorkspaceDeletion(
    operationId: string,
  ): Promise<WorkspaceDeletionResult> {
    const storage = this.storage;
    if (!storage?.retryReset)
      return { ok: false, reason: "invalid", message: "Nothing to retry." };
    return this.runDeletion(() => storage.retryReset!(operationId));
  }

  /** Account only: keep the workspace by cancelling the attempt on the server.
   * Serialized with the attempt under the owner lock; if the attempt already committed,
   * the deletion is reported and adopted instead.
   * @param operationId Attempt from `workspaceDeletion`.
   * @returns `cancelled`, a deleted outcome, or `pending` when the server did not answer.
   * @example await controller.cancelWorkspaceDeletion(id)
   */
  async cancelWorkspaceDeletion(
    operationId: string,
  ): Promise<WorkspaceDeletionResult> {
    const storage = this.storage;
    if (!storage?.cancelReset)
      return { ok: false, reason: "invalid", message: "Nothing to cancel." };
    return this.runDeletion(() => storage.cancelReset!(operationId));
  }

  /** Run one deletion step with Saves blocked, then apply its outcome.
   * @param work Storage call producing the outcome.
   * @returns Dialog result; drafts and recovery resume whenever nothing was deleted.
   * @example await this.runDeletion(() => storage.resetWorkspace(reviewed))
   */
  private async runDeletion(
    work: () => Promise<WorkspaceResetOutcome>,
  ): Promise<WorkspaceDeletionResult> {
    if (this.state.saving || this.deletionInFlight)
      return {
        ok: false,
        reason: "invalid",
        message: "Wait for the current Save to finish, then try again.",
      };
    this.publish({ saving: true });
    try {
      // Store the latest typing first, so a failed deletion keeps it after reload.
      await this.flushRecovery();
      this.deletionInFlight = true;
      const outcome = await work();
      if (outcome.status === "deleted") {
        await this.adoptFreshWorkspace(outcome.head, "here");
        this.publish({
          workspaceDeletion:
            outcome.cleanup === "pending" && outcome.operationId
              ? { kind: "cleanup-pending", operationId: outcome.operationId }
              : null,
        });
        this.announce("reset");
        return { ok: true, by: outcome.by, cleanup: outcome.cleanup };
      }
      if (outcome.status === "pending") {
        this.publish({
          workspaceDeletion: {
            kind: "pending",
            reason: outcome.reason,
            operationId: outcome.operationId,
          },
        });
        return {
          ok: false,
          reason: "pending",
          message:
            outcome.reason === "offline"
              ? "Verso could not reach your account, so it cannot tell yet whether your workspace was deleted."
              : "Your account has not confirmed the deletion. Your workspace and public PDF links are unchanged for now, but the request could still complete.",
        };
      }
      this.publish({ workspaceDeletion: null });
      if (outcome.reason === "changed") this.refreshPending = true;
      return outcome.reason === "cancelled"
        ? {
            ok: false,
            reason: "cancelled",
            message:
              "Deletion cancelled. Your workspace and public PDF links are unchanged.",
          }
        : {
            ok: false,
            reason: "conflict",
            message:
              "Your workspace changed since you reviewed it. Nothing was deleted.",
          };
    } catch (error) {
      const reason = saveFailureReason(error);
      if (reason === "conflict" || reason === "replaced")
        this.refreshPending = true;
      if (reason === "session") this.accountSync?.pause();
      return {
        ok: false,
        reason,
        message: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.deletionInFlight = false;
      this.publish({ saving: false });
      // Nothing was deleted: drafts still belong to the active workspace.
      if (this.hasUnsavedChanges() && !this.disposed) void this.flushRecovery();
      if (this.refreshPending) void this.refresh();
    }
  }

  /** Adopt a fresh workspace after this workspace's data was deleted here or elsewhere.
   * Open drafts, queued recovery writes, history, and pending refreshes belong to the deleted
   * data and are dropped without writing discard intents (storage no longer holds them).
   * @param head Fresh committed head with a new workspace ID.
   * @param source Whether this tab or another tab/device deleted the data.
   * @returns Completion after recovery is re-read for the fresh workspace.
   * @example await this.adoptFreshWorkspace(head, "elsewhere")
   */
  private async adoptFreshWorkspace(
    head: CareerHead,
    source: "here" | "elsewhere",
  ): Promise<void> {
    clearTimeout(this.timer);
    clearTimeout(this.maxTimer);
    this.timer = undefined;
    this.maxTimer = undefined;
    this.workspaceEpoch++;
    this.undo = [];
    this.redo = [];
    this.pendingHistory = null;
    this.committedIds.clear();
    this.pristineDraftIds.clear();
    this.pendingRecovery = {};
    this.recoveryRead++;
    this.refreshPending = false;
    this.publish({
      head,
      draft: null,
      orderDraft: null,
      error: "",
      orderError: "",
      recoveryStatus: "",
      orderRecoveryStatus: "",
      recovery: [],
      historyBoundary: false,
      saveStatus: { kind: "saved", revision: head.revision },
      workspaceReset: { source, at: Date.now(), workspaceId: head.workspaceId },
      ...(source === "elsewhere" ? { workspaceDeletion: null } : {}),
    });
    const recovery = await this.readRecovery().catch(() => undefined);
    if (recovery && this.state.head?.workspaceId === head.workspaceId)
      this.publish({ recovery });
  }

  /** Account only: resolve deletion attempts left by an interrupted response or another tab.
   * @returns Completion; unresolved attempts stay pending with their actions.
   * @example await this.resolvePendingDeletions()
   */
  private async resolvePendingDeletions(): Promise<void> {
    const markers = await this.storage?.pendingResets?.().catch(() => []);
    for (const marker of markers ?? []) {
      const result = await this.resolveWorkspaceDeletion(marker.operationId);
      if (!result.ok && result.reason === "pending") return;
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
    const workspaceId = this.state.head?.workspaceId;
    if (!this.storage || !workspaceId)
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
        await this.storage.writeDraft(draft, workspaceId);
        completed++;
      }
      this.publish({
        recoveryStatus: "Recovery imported · no workspace changes committed",
      });
    } catch (error) {
      throw new Error(
        `Imported ${completed} of ${imported.length} recovery drafts. Keep the source file; no workspace changes were committed. ${String(error)}`,
      );
    } finally {
      await this.reloadRecovery();
      if (completed) this.announce("recovery");
    }
  }

  /** Preserve latest recovery best-effort and release this tab's timers/channel/database/listeners.
   * @returns Completion of best-effort recovery and closing the connection.
   * @example controller.dispose()
   */
  dispose(): Promise<void> {
    if (this.disposed && this.closing) return this.closing;
    const storage = this.storage;
    const closing = this.flushRecovery()
      .then(() => Promise.all(this.recoveryRemovals))
      .finally(() => storage?.close())
      .then(() => {});
    this.disposed = true;
    this.lifecycle++;
    clearTimeout(this.timer);
    clearTimeout(this.maxTimer);
    this.timer = undefined;
    this.maxTimer = undefined;
    this.channel?.close();
    this.channel = null;
    this.accountSync?.stop();
    this.accountSync = null;
    this.listeners.clear();
    this.closing = closing;
    return closing;
  }

  /** Read the durable workspace for review before leaving session mode.
   * @returns Current durable head, or undefined when durable storage is unavailable.
   * @example const durable = await controller.durableHead()
   */
  async durableHead(): Promise<CareerHead | undefined> {
    if (!this.storage) return undefined;
    return this.storage.load();
  }

  /** Leave explicit session-only mode after review, restoring durable Saves.
   * `keep-durable` discards this tab's session commits and shows the durable
   * workspace. `replace-durable` adopts this tab's workspace through the atomic
   * reviewed replacement path, preserving the outgoing durable workspace as the
   * one previous workspace. Drafts must be resolved first; recovery is retained.
   * @param choice Which committed workspace to keep.
   * @param reviewed Durable head the user reviewed; a newer durable revision rejects replacement.
   * @returns True after durable Saves are available again; false when blocked or failed.
   * @example await controller.leaveSessionMode("keep-durable", reviewed)
   */
  async leaveSessionMode(
    choice: "keep-durable" | "replace-durable",
    reviewed: CareerHead,
  ): Promise<boolean> {
    const head = this.state.head;
    if (
      !this.storage ||
      !this.session ||
      !head ||
      this.state.saving ||
      this.state.draft ||
      this.state.orderDraft
    )
      return false;
    this.publish({ saving: true });
    try {
      const next =
        choice === "replace-durable"
          ? await this.storage.replace(
              reviewed,
              validateDocument(structuredClone(head.document)),
            )
          : await this.storage.load();
      if (
        choice === "keep-durable" &&
        (next.generation !== reviewed.generation ||
          next.revision !== reviewed.revision)
      )
        throw new CareerStorageError(
          "conflict",
          "Workspace changed since review. Review the current workspace again.",
        );
      const recovery = await this.readRecovery().catch(() => undefined);
      this.session = false;
      this.undo = [];
      this.redo = [];
      this.pendingHistory = null;
      this.committedIds.clear();
      this.publish({
        head: next,
        error: recovery
          ? ""
          : "Durable saving resumed. Unsaved drafts could not be refreshed. Reload to check them.",
        historyBoundary: false,
        storageMode: this.storage.kind === "account" ? "account" : "durable",
        sessionCommits: 0,
        saveStatus: { kind: "saved", revision: next.revision },
        ...(recovery ? { recovery } : {}),
      });
      if (choice === "replace-durable") this.announce("replaced");
      return true;
    } catch (error) {
      this.publish({ error: String(error) });
      return false;
    } finally {
      this.publish({ saving: false });
      if (this.refreshPending) void this.refresh();
    }
  }
}
