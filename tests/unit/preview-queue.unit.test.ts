import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PreviewCoordinator,
  type PreviewJob,
} from "@/stores/output/preview-coordinator";
import { devicePreferenceDefaults } from "@/types-and-constants/settings";

type Pending = {
  source: string;
  resolve: () => void;
  reject: (error: Error) => void;
};

/** Fake compiler pair factory recording instances, jobs, and closes. */
function harness() {
  const pending: Pending[] = [];
  const compilers: { closed: boolean; settings: unknown }[] = [];
  const urls: string[] = [];
  const revoked: string[] = [];
  const coordinator = new PreviewCoordinator({
    automaticDelayMs: 800,
    createCompiler: (settings) => {
      const record = { closed: false, settings };
      compilers.push(record);
      return {
        compile: (request: { source: string }) =>
          new Promise((resolve, reject) => {
            pending.push({
              source: request.source,
              resolve: () => resolve({ bytes: new Uint8Array([37]) } as never),
              reject,
            });
          }),
        close: () => {
          record.closed = true;
          for (const job of pending.splice(0))
            job.reject(new Error("Compiler closed"));
        },
      };
    },
    createUrl: () => {
      const url = `blob:${urls.length}`;
      urls.push(url);
      return url;
    },
    revokeUrl: (url) => revoked.push(url),
  });
  return { coordinator, pending, compilers, urls, revoked };
}

function job(
  fingerprint: string,
  resumeId = "resume",
  generation = 1,
): PreviewJob {
  return {
    tag: { generation, resumeId, fingerprint },
    source: `source-${resumeId}-${fingerprint}`,
    revision: 1,
    resumeName: "Application",
    language: "en-US",
    targetPages: 1,
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.useRealTimers();
});

describe("preview coordinator bounds", () => {
  it("runs one active job, replaces the single queued job, and compiles the latest committed target", async () => {
    const { coordinator, pending, compilers, urls, revoked } = harness();
    coordinator.setTarget(job("a"));
    coordinator.refresh();
    coordinator.refresh();
    expect(pending).toHaveLength(1);
    expect(coordinator.getSnapshot().queued).toBeNull();
    coordinator.setTarget(job("b"));
    coordinator.refresh();
    coordinator.setTarget(job("c"));
    coordinator.refresh();
    expect(pending).toHaveLength(1);
    expect(coordinator.getSnapshot().queued).toContain('"c"');
    pending.shift()!.resolve();
    await settle();
    // The superseded result never creates a URL; the queue runs the latest target.
    expect(urls).toEqual([]);
    expect(pending.map((item) => item.source)).toEqual(["source-resume-c"]);
    pending.shift()!.resolve();
    await settle();
    expect(urls).toEqual(["blob:0"]);
    expect(coordinator.getSnapshot().output?.tag.fingerprint).toBe("c");
    expect(compilers).toHaveLength(1);
    coordinator.setTarget(job("d"));
    coordinator.refresh();
    pending.shift()!.resolve();
    await settle();
    expect(revoked).toEqual(["blob:0"]);
    coordinator.dispose();
    expect(revoked).toEqual(["blob:0", "blob:1"]);
    expect(compilers.every((item) => item.closed)).toBe(true);
    expect(coordinator.hasCompiler).toBe(false);
  });

  it("retains the last PDF on failure and reports timeout details without creating URLs", async () => {
    const { coordinator, pending, urls, revoked } = harness();
    coordinator.setTarget(job("a"));
    coordinator.refresh();
    pending.shift()!.resolve();
    await settle();
    coordinator.setTarget(job("b"));
    coordinator.refresh();
    const failure = Object.assign(new Error("Compilation timed out"), {
      timedOut: true,
      log: "! log line",
    });
    pending.shift()!.reject(failure);
    await settle();
    const state = coordinator.getSnapshot();
    expect(state.output?.tag.fingerprint).toBe("a");
    expect(state.status).toMatchObject({
      kind: "failed",
      timedOut: true,
      log: "! log line",
    });
    expect(urls).toHaveLength(1);
    expect(revoked).toEqual([]);
  });

  it("closes the compiler and drops queued work on generation change, rejecting late results", async () => {
    const { coordinator, pending, compilers, urls } = harness();
    coordinator.setTarget(job("a"));
    coordinator.refresh();
    coordinator.setTarget(job("b"));
    coordinator.refresh();
    coordinator.setTarget(job("b", "resume", 2));
    await settle();
    expect(compilers[0].closed).toBe(true);
    expect(pending).toHaveLength(0);
    expect(coordinator.getSnapshot()).toMatchObject({
      active: null,
      queued: null,
      status: { kind: "idle" },
    });
    expect(urls).toEqual([]);
  });

  it("applies timeout preferences to the next compiler instance without interrupting active work", async () => {
    const { coordinator, pending, compilers } = harness();
    coordinator.setTarget(job("a"));
    coordinator.refresh();
    coordinator.setPreferences({
      ...devicePreferenceDefaults,
      compilationTimeoutMs: 45_000,
    });
    expect(compilers[0].closed).toBe(false);
    pending.shift()!.resolve();
    await settle();
    coordinator.setTarget(job("b"));
    coordinator.refresh();
    expect(compilers).toHaveLength(2);
    expect(compilers[0].closed).toBe(true);
    expect(compilers[1].settings).toMatchObject({
      compilationTimeoutMs: 45_000,
    });
  });
});

describe("automatic preview refresh", () => {
  it("drops automatic work for the previous resume before hiding without scheduling the newly selected resume", async () => {
    vi.useFakeTimers();
    const { coordinator, pending } = harness();
    coordinator.setPreferences({
      ...devicePreferenceDefaults,
      automaticRefresh: true,
    });
    coordinator.setVisible(true);
    coordinator.setTarget(job("a"));
    coordinator.refresh();
    coordinator.setTarget(job("b"));
    await vi.advanceTimersByTimeAsync(800);
    expect(coordinator.getSnapshot().queued).not.toBeNull();
    coordinator.setTarget(job("other", "other"));
    coordinator.setVisible(false);
    expect(coordinator.getSnapshot()).toMatchObject({
      queued: null,
      automaticPending: false,
    });
    pending.shift()!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    coordinator.setVisible(true);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(pending).toHaveLength(0);
    coordinator.dispose();
  });

  it("refreshes a selected resume that becomes ready after a committed Save, including an initially blocked resume", async () => {
    vi.useFakeTimers();
    const { coordinator, pending } = harness();
    coordinator.setPreferences({
      ...devicePreferenceDefaults,
      automaticRefresh: true,
    });
    coordinator.setVisible(true);
    const identity = { generation: 1, resumeId: "resume" };
    coordinator.setTarget(null, identity);
    coordinator.setTarget(job("ready"));
    await vi.advanceTimersByTimeAsync(800);
    expect(pending.map((item) => item.source)).toEqual(["source-resume-ready"]);
    pending.shift()!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    coordinator.setTarget(null, identity);
    expect(coordinator.hasTimer).toBe(false);
    coordinator.setTarget(job("ready-again"));
    await vi.advanceTimersByTimeAsync(800);
    expect(pending.map((item) => item.source)).toEqual([
      "source-resume-ready-again",
    ]);
    coordinator.dispose();
    await vi.advanceTimersByTimeAsync(0);
  });

  it("defers an already queued automatic refresh while hidden and resumes it when visible", async () => {
    vi.useFakeTimers();
    const { coordinator, pending } = harness();
    coordinator.setPreferences({
      ...devicePreferenceDefaults,
      automaticRefresh: true,
    });
    coordinator.setVisible(true);
    coordinator.setTarget(job("a"));
    coordinator.refresh();
    coordinator.setTarget(job("b"));
    await vi.advanceTimersByTimeAsync(800);
    expect(coordinator.getSnapshot().queued).not.toBeNull();
    coordinator.setVisible(false);
    expect(coordinator.getSnapshot()).toMatchObject({
      queued: null,
      automaticPending: true,
    });
    pending.shift()!.resolve();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(pending).toHaveLength(0);
    coordinator.setTarget(job("c"));
    coordinator.setVisible(true);
    await vi.advanceTimersByTimeAsync(800);
    expect(pending.map((item) => item.source)).toEqual(["source-resume-c"]);
    coordinator.dispose();
    await vi.advanceTimersByTimeAsync(0);
  });

  it("drops queued automatic work when disabled but preserves an explicit queued refresh while hidden", async () => {
    vi.useFakeTimers();
    const { coordinator, pending } = harness();
    coordinator.setPreferences({
      ...devicePreferenceDefaults,
      automaticRefresh: true,
    });
    coordinator.setVisible(true);
    coordinator.setTarget(job("a"));
    coordinator.refresh();
    coordinator.setTarget(job("b"));
    await vi.advanceTimersByTimeAsync(800);
    coordinator.setPreferences(devicePreferenceDefaults);
    expect(coordinator.getSnapshot()).toMatchObject({
      queued: null,
      automaticPending: false,
    });
    coordinator.refresh();
    coordinator.setVisible(false);
    pending.shift()!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(pending.map((item) => item.source)).toEqual(["source-resume-b"]);
    coordinator.dispose();
    await vi.advanceTimersByTimeAsync(0);
  });

  it("is off by default and never compiles on committed changes", async () => {
    vi.useFakeTimers();
    const { coordinator, pending } = harness();
    coordinator.setVisible(true);
    coordinator.setTarget(job("a"));
    coordinator.setTarget(job("b"));
    await vi.advanceTimersByTimeAsync(5_000);
    expect(pending).toHaveLength(0);
    expect(coordinator.hasTimer).toBe(false);
  });

  it("debounces committed output changes, waits while hidden, and ignores resume switches and unchanged output", async () => {
    vi.useFakeTimers();
    const { coordinator, pending } = harness();
    coordinator.setPreferences({
      ...devicePreferenceDefaults,
      automaticRefresh: true,
    });
    coordinator.setTarget(job("a"));
    coordinator.setVisible(true);
    coordinator.setTarget(job("a"));
    coordinator.setTarget(job("a", "other"));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(pending).toHaveLength(0);
    coordinator.setTarget(job("b", "other"));
    await vi.advanceTimersByTimeAsync(400);
    coordinator.setTarget(job("c", "other"));
    await vi.advanceTimersByTimeAsync(799);
    expect(pending).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(pending.map((item) => item.source)).toEqual(["source-other-c"]);
    pending.shift()!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    coordinator.setVisible(false);
    coordinator.setTarget(job("d", "other"));
    await vi.advanceTimersByTimeAsync(5_000);
    expect(pending).toHaveLength(0);
    expect(coordinator.getSnapshot().automaticPending).toBe(true);
    expect(coordinator.hasTimer).toBe(false);
    coordinator.setVisible(true);
    await vi.advanceTimersByTimeAsync(800);
    expect(pending.map((item) => item.source)).toEqual(["source-other-d"]);
    expect(coordinator.getSnapshot().automaticPending).toBe(false);
  });

  it("cancels pending automatic work when disabled or disposed", async () => {
    vi.useFakeTimers();
    const { coordinator, pending } = harness();
    const enabled = { ...devicePreferenceDefaults, automaticRefresh: true };
    coordinator.setPreferences(enabled);
    coordinator.setVisible(true);
    coordinator.setTarget(job("a"));
    coordinator.setTarget(job("b"));
    expect(coordinator.hasTimer).toBe(true);
    coordinator.setPreferences(devicePreferenceDefaults);
    expect(coordinator.hasTimer).toBe(false);
    coordinator.setPreferences(enabled);
    coordinator.setTarget(job("c"));
    expect(coordinator.hasTimer).toBe(true);
    coordinator.dispose();
    expect(coordinator.hasTimer).toBe(false);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(pending).toHaveLength(0);
  });
});
