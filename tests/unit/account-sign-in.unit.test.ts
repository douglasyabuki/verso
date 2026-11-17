import { afterEach, expect, it, vi } from "vitest";

import { authErrorMessage } from "@/lib/account/auth-feedback";
import { AccountSessionStore } from "@/stores/account/session";

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
    "/?scope=settings%2Faccount&error=account_not_linked&error_description=private",
  );
  expect(client.signIn.social).toHaveBeenCalledWith({
    provider: "google",
    callbackURL: "/?scope=settings%2Faccount",
    errorCallbackURL: "/?scope=settings%2Faccount",
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
    callbackURL: "/",
    errorCallbackURL: "/",
  });
});

it("maps callback failures to safe recovery instructions", () => {
  expect(authErrorMessage(null)).toBe("");
  expect(authErrorMessage("email_not_found")).toContain(
    "Add and verify an email",
  );
  expect(authErrorMessage("email_not_verified")).toContain("Verify your email");
  expect(authErrorMessage("access_denied")).toContain("canceled or denied");
  expect(authErrorMessage("private-provider-response")).toBe(
    "Sign-in was not completed. Please try again.",
  );
});
