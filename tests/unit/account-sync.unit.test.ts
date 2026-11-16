import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountSync } from "@/stores/career/account-sync";

const timing = { eventMinMs: 60_000, intervalMs: 300_000, idleMs: 900_000 };

function setup(options: { visible?: boolean; locks?: null } = {}) {
  const state = { visible: options.visible ?? true };
  const check = vi.fn(async () => true);
  const announce = vi.fn();
  const sync = new AccountSync({
    check,
    announce,
    lockName: "verso-account-test-sync",
    isVisible: () => state.visible,
    now: () => Date.now(),
    locks: options.locks ?? null,
    timing,
  });
  return { sync, check, announce, state };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-16T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("account sync bounds", () => {
  it("coalesces event checks within the shared minimum spacing", async () => {
    const { sync, check, announce } = setup();
    sync.start();
    expect(await sync.request("focus")).toBe(true);
    expect(await sync.request("visible")).toBe(false);
    expect(await sync.request("online")).toBe(false);
    expect(check).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(Date.now());

    vi.setSystemTime(Date.now() + timing.eventMinMs);
    expect(await sync.request("focus")).toBe(true);
    expect(check).toHaveBeenCalledTimes(2);
    sync.stop();
  });

  it("respects checks announced by another tab", async () => {
    const { sync, check } = setup();
    sync.start(Date.now());
    vi.setSystemTime(Date.now() + 30_000);
    sync.observe(Date.now());
    vi.setSystemTime(Date.now() + 45_000);
    expect(await sync.request("focus")).toBe(false);
    expect(check).not.toHaveBeenCalled();
    sync.stop();
  });

  it("checks periodically while visible and active, and pauses when idle", async () => {
    const { sync, check } = setup();
    sync.start(Date.now());
    await vi.advanceTimersByTimeAsync(timing.intervalMs);
    expect(check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(timing.intervalMs);
    expect(check).toHaveBeenCalledTimes(2);

    // No input for the idle period: periodic checks stop.
    await vi.advanceTimersByTimeAsync(timing.idleMs * 3);
    const idleChecks = check.mock.calls.length;
    await vi.advanceTimersByTimeAsync(timing.intervalMs * 4);
    expect(check).toHaveBeenCalledTimes(idleChecks);
    expect(idleChecks).toBeLessThanOrEqual(
      Math.ceil(timing.idleMs / timing.intervalMs) + 1,
    );

    // Returning input checks immediately, then periodic checks resume.
    sync.activity();
    await vi.advanceTimersByTimeAsync(0);
    expect(check).toHaveBeenCalledTimes(idleChecks + 1);
    await vi.advanceTimersByTimeAsync(timing.intervalMs);
    expect(check).toHaveBeenCalledTimes(idleChecks + 2);
    sync.stop();
  });

  it("sends no requests while hidden", async () => {
    const { sync, check, state } = setup({ visible: false });
    sync.start();
    expect(await sync.request("focus")).toBe(false);
    await vi.advanceTimersByTimeAsync(timing.intervalMs * 3);
    expect(check).not.toHaveBeenCalled();

    state.visible = true;
    expect(await sync.request("visible")).toBe(true);
    sync.stop();
  });

  it("stops checking for an invalid session until resumed", async () => {
    const { sync, check } = setup();
    sync.start(Date.now());
    sync.pause();
    vi.setSystemTime(Date.now() + timing.intervalMs);
    expect(await sync.request("focus")).toBe(false);
    await vi.advanceTimersByTimeAsync(timing.intervalMs * 2);
    expect(check).not.toHaveBeenCalled();

    sync.resume();
    expect(await sync.request("focus")).toBe(true);
    sync.stop();
  });

  it("does not advance freshness when the check fails", async () => {
    const { sync, check } = setup();
    check.mockResolvedValueOnce(false);
    sync.start();
    expect(await sync.request("online")).toBe(false);
    expect(await sync.request("online")).toBe(true);
    expect(check).toHaveBeenCalledTimes(2);
    sync.stop();
  });

  it("skips a check while another tab holds the browser-wide check lock", async () => {
    const check = vi.fn(async () => true);
    const sync = new AccountSync({
      check,
      announce: vi.fn(),
      lockName: "held",
      isVisible: () => true,
      locks: {
        request: (async (
          _name: string,
          _options: LockOptions,
          callback: (lock: Lock | null) => Promise<unknown>,
        ) => callback(null)) as unknown as LockManager["request"],
      },
      timing,
    });
    sync.start();
    expect(await sync.request("focus")).toBe(false);
    expect(check).not.toHaveBeenCalled();
    sync.stop();
  });
});
