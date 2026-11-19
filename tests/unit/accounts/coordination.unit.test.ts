import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authErrorMessage } from "@/lib/account/auth-feedback";
import {
  automaticReleaseKey,
  shouldReleaseAutomatically,
} from "@/lib/releases/automatic";
import { AccountSessionStore } from "@/stores/account/session";
import { AccountSync } from "@/stores/career/account-sync";
import { type PreviewOutput } from "@/stores/output/preview-coordinator";
import { ReleaseStore } from "@/stores/releases/release-store";
import {
  type PublicLinkSummary,
  type ReleaseList,
} from "@/types-and-constants/releases";

const client = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ data: null, error: null })),
  signIn: { social: vi.fn(async () => ({ data: {}, error: null })) },
}));

vi.mock("better-auth/client", () => ({ createAuthClient: () => client }));

afterEach(() => vi.clearAllMocks());

it("retries OAuth without carrying stale callback errors into the next return URL", async () => {
  const fetcher = vi.fn(async () =>
    Response.json({ google: true, github: true }),
  );
  const store = new AccountSessionStore(fetcher);
  await store.start();
  await store.signIn(
    "google",
    "/app/settings/account?error=account_not_linked&error_description=private",
  );
  expect(client.signIn.social).toHaveBeenCalledWith({
    provider: "google",
    callbackURL: "/app/settings/account",
    errorCallbackURL: "/app/settings/account",
  });
});

it("keeps an untrusted OAuth return path inside the app", async () => {
  const store = new AccountSessionStore(async () =>
    Response.json({ google: true, github: true }),
  );
  await store.start();
  await store.signIn("google", "//external.example/path");
  expect(client.signIn.social).toHaveBeenCalledWith({
    provider: "google",
    callbackURL: "/app",
    errorCallbackURL: "/app",
  });
});

it("requests sign-up explicitly and returns provider errors to the auth page", async () => {
  const store = new AccountSessionStore(async () =>
    Response.json({ google: true, github: true }),
  );
  await store.prepareSignIn();
  await store.signIn("github", "/app/resumes/r1", {
    signUp: true,
    errorPath: "/sign-up?next=%2Fapp%2Fresumes%2Fr1&error=signup_disabled",
  });
  expect(client.signIn.social).toHaveBeenCalledWith({
    provider: "github",
    callbackURL: "/app/resumes/r1",
    errorCallbackURL: "/sign-up?next=%2Fapp%2Fresumes%2Fr1",
    requestSignUp: true,
  });
  expect(client.getSession).not.toHaveBeenCalled();
});

it("maps callback failures to safe recovery instructions", () => {
  expect(authErrorMessage(null)).toBe("");
  expect(authErrorMessage("email_not_found")).toContain(
    "Add and verify an email",
  );
  expect(authErrorMessage("email_not_verified")).toContain("Verify your email");
  expect(authErrorMessage("access_denied")).toContain("canceled or denied");
  expect(authErrorMessage("signup_disabled")).toContain(
    "No Verso account uses this sign-in yet",
  );
  expect(authErrorMessage("private-provider-response")).toBe(
    "Sign-in was not completed. Please try again.",
  );
});

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

describe("account sync bounds", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-16T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

const output = { resumeId: "resume", generation: 2, fingerprint: "f2" };

function link(patch: Partial<PublicLinkSummary> = {}): PublicLinkSummary {
  return {
    id: "link",
    token: "t",
    resumeId: "resume",
    resumeName: "Application",
    autoRelease: true,
    latestReleaseId: "r1",
    createdAt: "2026-11-16T00:00:00.000Z",
    releases: [
      {
        id: "r1",
        number: 1,
        resumeId: "resume",
        revision: 1,
        generation: 2,
        fingerprint: "f1",
        locale: "en-US",
        templateId: "yabuki-reference@1.0.3",
        runtimeId: "x",
        settingsSha256: "s",
        sourceSha256: "s",
        pdfSha256: "p",
        bytes: 1,
        fileName: "a.pdf",
        revokedAt: null,
        createdAt: "2026-11-16T00:00:00.000Z",
      },
    ],
    ...patch,
  };
}

it("releases automatically only for opted-in account links with new committed output, once per output", () => {
  const base = {
    accountMode: true,
    link: link(),
    output,
    generation: 2,
    attempted: new Set<string>(),
  };
  expect(shouldReleaseAutomatically(base)).toBe(true);
  expect(shouldReleaseAutomatically({ ...base, accountMode: false })).toBe(
    false,
  );
  expect(
    shouldReleaseAutomatically({ ...base, link: link({ autoRelease: false }) }),
  ).toBe(false);
  expect(shouldReleaseAutomatically({ ...base, link: undefined })).toBe(false);
  expect(shouldReleaseAutomatically({ ...base, output: undefined })).toBe(
    false,
  );
  expect(
    shouldReleaseAutomatically({
      ...base,
      output: { ...output, resumeId: "other" },
    }),
  ).toBe(false);
  expect(shouldReleaseAutomatically({ ...base, generation: 3 })).toBe(false);
  expect(
    shouldReleaseAutomatically({
      ...base,
      output: { ...output, fingerprint: "f1" },
    }),
  ).toBe(false);
  expect(
    shouldReleaseAutomatically({
      ...base,
      attempted: new Set([automaticReleaseKey("link", output)]),
    }),
  ).toBe(false);
});

const list: ReleaseList = { links: [], usage: { links: 0, bytes: 0 } };

function previewOutput(): PreviewOutput {
  return {
    tag: { generation: 0, resumeId: "resume", fingerprint: "f" },
    revision: 4,
    resumeName: "Application",
    language: "en-US",
    targetPages: 1,
    url: "blob:x",
    key: "k",
    bytes: new TextEncoder().encode("%PDF-1.7 %%EOF"),
    template: "yabuki-reference@1.0.3",
  };
}

it("retries an unanswered release with the same operation ID and prepares a new one after success", async () => {
  const sent: { operationId: string; session: string | null }[] = [];
  let fail = true;
  const store = new ReleaseStore(
    { userId: "u", sessionId: "s1" },
    {
      createId: (() => {
        let next = 0;
        return () => `op-${(next += 1)}`;
      })(),
      fetch: async (_path, init) => {
        const form = init?.body as FormData;
        sent.push({
          operationId: JSON.parse(String(form.get("metadata"))).operationId,
          session: new Headers(init?.headers).get("X-Verso-Session"),
        });
        if (fail) throw new TypeError("network");
        return Response.json({
          list,
          linkId: "l",
          releaseId: "r",
          replayed: false,
          unchanged: false,
        });
      },
    },
  );
  const input = {
    output: previewOutput(),
    workspaceId: "w",
    advance: true,
    automatic: false,
  };
  await expect(store.release(input)).rejects.toMatchObject({ code: "offline" });
  expect(store.getSnapshot()).toMatchObject({ uncertain: true });
  fail = false;
  await store.release(input);
  await store.release(input);
  expect(sent).toEqual([
    { operationId: "op-1", session: "s1" },
    { operationId: "op-1", session: "s1" },
    { operationId: "op-2", session: "s1" },
  ]);
  expect(store.getSnapshot()).toMatchObject({
    uncertain: false,
    error: null,
    list,
  });
});

it("reports rejected releases with the server message and signals invalid sessions", async () => {
  let invalid = 0;
  const store = new ReleaseStore(
    { userId: "u", sessionId: "s1" },
    {
      onSessionInvalid: () => (invalid += 1),
      fetch: async () =>
        Response.json(
          { code: "session_mismatch", message: "Reload to continue." },
          { status: 403 },
        ),
    },
  );
  await expect(store.load()).rejects.toMatchObject({
    code: "session_mismatch",
  });
  expect(invalid).toBe(1);
  expect(store.getSnapshot().error).toBe("Reload to continue.");
});
