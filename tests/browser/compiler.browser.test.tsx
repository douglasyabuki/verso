import { afterEach, expect, it, vi } from "vitest";

import { BrowserCompiler } from "@/tools/compiler-proof/compiler.mjs";

afterEach(() => {
  vi.restoreAllMocks();
});

it("terminates the real worker pair on timeout and creates a fresh pair on retry", async () => {
  const original = window.Worker;
  const owned = new Set<Worker>();
  let created = 0,
    terminated = 0,
    maximum = 0;
  class TrackedWorker extends original {
    constructor(url: string | URL, options?: WorkerOptions) {
      super(url, options);
      created++;
      owned.add(this);
      maximum = Math.max(maximum, owned.size);
    }
    terminate() {
      if (owned.delete(this)) terminated++;
      super.terminate();
    }
  }
  vi.stubGlobal("Worker", TrackedWorker);
  const compiler = new BrowserCompiler({
    assetBase: "/compiler/",
    compilationTimeoutMs: 100,
  });
  // Browser Mode does not serve compiler assets; exercise the real compiler
  // lifecycle with two owned message workers that deliberately never answer.
  const url = URL.createObjectURL(
    new Blob(["self.onmessage = () => {};"], { type: "text/javascript" }),
  );
  const runtime = compiler as unknown as {
    workers: Worker[];
    ready: boolean;
    initialize: () => Promise<{ initializationMs: number; reused: boolean }>;
  };
  const initialize = vi
    .spyOn(runtime, "initialize")
    .mockImplementation(async () => {
      runtime.workers = [new Worker(url), new Worker(url)];
      runtime.ready = true;
      return { initializationMs: 0, reused: false };
    });
  try {
    const first = compiler.compile({
      source: "trusted",
      snapshotId: "first",
      locale: "en-US",
    });
    await expect(
      compiler.compile({
        source: "trusted",
        snapshotId: "concurrent",
        locale: "en-US",
      }),
    ).rejects.toThrow(/Another compilation/);
    await expect(first).rejects.toThrow(/timed out/);
    expect(owned.size).toBe(0);
    await expect(
      compiler.compile({
        source: "trusted",
        snapshotId: "retry",
        locale: "en-US",
      }),
    ).rejects.toThrow(/timed out/);
    expect(maximum).toBe(2);
    expect(created).toBe(4);
    expect(terminated).toBe(4);
    expect(initialize).toHaveBeenCalledTimes(2);
    expect(owned.size).toBe(0);
  } finally {
    compiler.close();
    URL.revokeObjectURL(url);
    vi.unstubAllGlobals();
  }
});
