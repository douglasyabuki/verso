import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";

import { CareerWorkspace } from "@/components/career/career-workspace";
import type {
  AccountSession,
  AccountSessionStore,
} from "@/stores/account/session";
import { CareerController } from "@/stores/career/controller";

const controllers: CareerController[] = [];
const initialUrl = window.location.href;
const initialState = window.history.state;
const providers = { github: true, google: true };
const user = { id: "u1", name: "Ada Lovelace", email: "ada@example.test" };

/** Create an isolated tracked guest-storage controller. */
async function owner() {
  const controller = new CareerController();
  controllers.push(controller);
  await controller.initialize();
  return controller;
}

/** Fake session store exposing only the commands the UI calls. */
function fakeStore() {
  return {
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
  };
}

async function mount(session?: AccountSession, store = fakeStore()) {
  await page.viewport(1280, 800);
  window.history.replaceState({ versoIndex: 0 }, "", "?scope=overview");
  const controller = await owner();
  await render(
    <CareerWorkspace
      controller={controller}
      account={
        session
          ? { session, store: store as unknown as AccountSessionStore }
          : undefined
      }
    />,
  );
  return { controller, store };
}

const settings = () =>
  page.getByRole("dialog", { name: "Settings", exact: true });

const scope = () => new URL(window.location.href).searchParams.get("scope");

afterEach(async () => {
  await cleanup();
  for (const controller of controllers) {
    await controller.flushRecovery();
    controller.dispose();
  }
  controllers.length = 0;
  vi.restoreAllMocks();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("verso-local");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Account menu test database still owned."));
  });
  window.history.replaceState(initialState, "", initialUrl);
});

describe("Account menu and utility rail", () => {
  it("offers guests Settings, Sign in, and Sign up, which open Settings › Account with provider buttons", async () => {
    await mount({ kind: "guest", providers });
    const rail = page.getByRole("navigation", { name: "Workspace utilities" });
    await expect
      .element(rail.getByRole("button", { name: "Data & backups" }))
      .not.toBeInTheDocument();
    await rail.getByRole("button", { name: "Account menu" }).click();
    await expect
      .element(page.getByRole("menuitem", { name: "Settings", exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByRole("menuitem", { name: "Sign in", exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByRole("menuitem", { name: "Sign out" }))
      .not.toBeInTheDocument();
    await page.getByRole("menuitem", { name: "Sign up", exact: true }).click();
    await expect.element(settings()).toBeVisible();
    expect(scope()).toBe("settings/account");
    const panels = settings().getByRole("navigation", {
      name: "Settings panels",
    });
    expect(panels.getByRole("button").first().element().textContent).toBe(
      "Account",
    );
    const github = settings().getByRole("button", {
      name: "Continue with GitHub",
    });
    await expect.element(github).toBeVisible();
    expect(github.element().querySelector("svg")).not.toBeNull();
    await expect
      .element(settings().getByRole("button", { name: "Continue with Google" }))
      .toBeVisible();
  });

  it("opens Settings › Appearance from the rail Appearance button", async () => {
    await mount({ kind: "guest", providers });
    await page
      .getByRole("navigation", { name: "Workspace utilities" })
      .getByRole("button", { name: "Appearance", exact: true })
      .click();
    await expect
      .element(
        settings().getByRole("heading", { name: "Appearance", exact: true }),
      )
      .toBeVisible();
    expect(scope()).toBe("settings/appearance");
  });

  it("shows the signed-in identity and signs out from the menu without unconfirmed work", async () => {
    const { store } = await mount({
      kind: "authenticated",
      providers,
      user,
      sessionId: "s1",
    });
    await page.getByRole("button", { name: "Account menu" }).click();
    await expect.element(page.getByText(user.email)).toBeVisible();
    await expect
      .element(page.getByRole("menuitem", { name: "Sign in", exact: true }))
      .not.toBeInTheDocument();
    await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
    await expect.poll(() => store.signOut.mock.calls.length).toBe(1);
  });

  it("offers only Settings when accounts are not enabled", async () => {
    await mount();
    await page.getByRole("button", { name: "Account menu" }).click();
    await expect
      .element(page.getByRole("menuitem", { name: "Settings", exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByRole("menuitem", { name: "Sign in", exact: true }))
      .not.toBeInTheDocument();
    await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
    await expect
      .element(
        settings().getByText("Accounts are not enabled on this deployment."),
      )
      .toBeVisible();
  });
});
