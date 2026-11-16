import { ACCOUNT_SYNC } from "@/types-and-constants/account";

/** What asked for a freshness check. Events share `eventMinMs`; the timer uses `intervalMs`. */
export type AccountSyncReason =
  "focus" | "visible" | "online" | "input" | "interval";

/** Options for {@link AccountSync}. */
export type AccountSyncOptions = {
  /** Run one conditional check; resolve true when the server answered. */
  check: () => Promise<boolean>;
  /** Tell this owner's other tabs that a check (or acknowledged Save) completed at `at`. */
  announce: (at: number) => void;
  /** Web Locks name shared by this owner's tabs, so only one check is in flight per browser. */
  lockName: string;
  /** Visibility source; defaults to `document.visibilityState`. */
  isVisible?: () => boolean;
  /** Clock source for tests. */
  now?: () => number;
  /** Lock manager; defaults to `navigator.locks`, and `null` disables cross-tab locking. */
  locks?: Pick<LockManager, "request"> | null;
  /** Timing overrides for tests; production uses `ACCOUNT_SYNC`. */
  timing?: Partial<SyncTiming>;
};

type SyncTiming = { eventMinMs: number; intervalMs: number; idleMs: number };

/** Cost-bounded remote freshness for one signed-in owner in one tab.
 * Focus, visibility, reconnect, and input-after-idle request a check at most once per
 * `eventMinMs`; a visible, active tab also checks every `intervalMs`. Tabs share the last
 * check time, and a Web Lock keeps one check in flight per browser. Hidden or idle tabs,
 * and paused (expired-session) owners, send no requests. Checks are hints: server
 * scope checks on Save remain authoritative.
 * @example const sync = new AccountSync({ check, announce, lockName }); sync.start()
 */
export class AccountSync {
  private lastCheckAt = Number.NEGATIVE_INFINITY;

  private lastInputAt: number;

  private timer: ReturnType<typeof setTimeout> | undefined;

  private running = false;

  private stopped = true;

  private paused = false;

  private readonly timing: SyncTiming;

  constructor(private readonly options: AccountSyncOptions) {
    this.timing = { ...ACCOUNT_SYNC, ...options.timing };
    this.lastInputAt = this.now();
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  private visible(): boolean {
    if (this.options.isVisible) return this.options.isVisible();
    return (
      typeof document === "undefined" || document.visibilityState === "visible"
    );
  }

  private locks(): Pick<LockManager, "request"> | null {
    if (this.options.locks !== undefined) return this.options.locks;
    return typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks
      : null;
  }

  /** Begin scheduling periodic checks.
   * @param checkedAt Time of the head this tab just loaded, if it came from the server.
   * @returns {void} No value.
   * @example sync.start(Date.now())
   */
  start(checkedAt?: number): void {
    this.stopped = false;
    if (checkedAt !== undefined) this.observe(checkedAt);
    else this.schedule();
  }

  /** Stop all checks permanently (owner disposed).
   * @returns {void} No value.
   * @example sync.stop()
   */
  stop(): void {
    this.stopped = true;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** Suspend checks while the session is invalid; requests would only fail.
   * @returns {void} No value.
   * @example sync.pause()
   */
  pause(): void {
    this.paused = true;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** Resume after the session is confirmed again (for example, an acknowledged Save).
   * @returns {void} No value.
   * @example sync.resume()
   */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.schedule();
  }

  /** Whether checks are suspended for an invalid session. */
  get isPaused(): boolean {
    return this.paused;
  }

  /** Record a check or acknowledged Save completed here or in another tab; never moves backward.
   * @param at Completion time.
   * @returns {void} No value.
   * @example sync.observe(message.at)
   */
  observe(at: number): void {
    if (at > this.lastCheckAt) this.lastCheckAt = at;
    this.schedule();
  }

  /** Record owner input; input after an idle period requests an immediate check.
   * @returns {void} No value.
   * @example sync.activity()
   */
  activity(): void {
    const now = this.now();
    const wasIdle = now - this.lastInputAt >= this.timing.idleMs;
    this.lastInputAt = now;
    if (wasIdle) void this.request("input");
    else if (!this.timer) this.schedule();
  }

  /** Request a check, skipped when hidden, paused, in flight, or within the shared bound.
   * @param reason Trigger; `interval` uses `intervalMs`, events use `eventMinMs`.
   * @returns {Promise<boolean>} True when a check ran and the server answered.
   * @example await sync.request("focus")
   */
  async request(reason: AccountSyncReason): Promise<boolean> {
    if (this.stopped || this.paused || this.running || !this.visible())
      return false;
    const spacing =
      reason === "interval" ? this.timing.intervalMs : this.timing.eventMinMs;
    if (this.now() - this.lastCheckAt < spacing) {
      this.schedule();
      return false;
    }
    this.running = true;
    let answered = false;
    try {
      const run = async () => {
        // Another tab may have checked while this one waited.
        if (this.now() - this.lastCheckAt < spacing) return;
        answered = await this.options.check();
        if (answered) {
          this.lastCheckAt = this.now();
          this.options.announce(this.lastCheckAt);
        }
      };
      const locks = this.locks();
      if (locks)
        await locks.request(
          this.options.lockName,
          { ifAvailable: true },
          async (lock) => {
            if (lock) await run();
          },
        );
      else await run();
    } catch {
      answered = false;
    } finally {
      this.running = false;
      this.schedule();
    }
    return answered;
  }

  /** Arm the periodic timer for the next due check; idle or hidden tabs leave it disarmed
   * until input or a visibility event requests a check again.
   * @returns {void} No value.
   */
  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.stopped || this.paused) return;
    const now = this.now();
    if (!this.visible() || now - this.lastInputAt >= this.timing.idleMs) return;
    const due = Math.max(
      this.lastCheckAt + this.timing.intervalMs - now,
      1_000,
    );
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (this.now() - this.lastInputAt >= this.timing.idleMs) return;
      void this.request("interval");
    }, due);
  }
}
