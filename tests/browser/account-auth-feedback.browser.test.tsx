import { afterEach, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";

import { AccountPanel } from "@/components/account/account-panel";
import { useAccountActions } from "@/hooks/account/use-account-actions";
import type { AccountSessionStore } from "@/stores/account/session";

const initialUrl = window.location.href;
const initialState = window.history.state;

afterEach(async () => {
  await cleanup();
  window.history.replaceState(initialState, "", initialUrl);
});

it("shows a safe OAuth callback failure in Account and clears it when retrying", async () => {
  window.history.replaceState(
    null,
    "",
    "/?scope=settings%2Faccount&error=account_not_linked&error_description=private-provider-response",
  );
  const signIn = vi.fn(async () => "Sign-in could not start.");
  const store = { signIn } as unknown as AccountSessionStore;

  function Account() {
    const actions = useAccountActions({
      store,
      unconfirmed: 0,
      resolveDrafts: (action) => action(),
    });
    return (
      <AccountPanel
        session={{ kind: "guest", providers: { google: true, github: true } }}
        actions={actions}
      />
    );
  }

  await render(<Account />);
  await expect
    .element(page.getByRole("alert"))
    .toHaveTextContent(/Verify your email with your provider/);
  await expect
    .element(page.getByRole("alert"))
    .not.toHaveTextContent(/private-provider-response/);
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect
    .element(page.getByRole("alert"))
    .toHaveTextContent(/Sign-in could not start/);
  expect(signIn).toHaveBeenCalledWith(
    "google",
    expect.stringContaining("scope="),
  );
});
