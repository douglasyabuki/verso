import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";

import { ConflictPanel } from "@/components/career/conflict-panel";
import type { DraftConflict } from "@/lib/career/conflict";

afterEach(() => {
  cleanup();
});

const conflict: DraftConflict = {
  scope: "profile",
  saved: { fullName: "Saved on another device" },
  draft: { fullName: "My draft" },
  revision: 4,
  replaced: false,
};

function renderPanel(value: DraftConflict = conflict) {
  const actions = {
    onKeepDraft: vi.fn(),
    onUseSaved: vi.fn(),
    onExport: vi.fn(),
  };
  render(<ConflictPanel conflict={value} {...actions} />);
  return actions;
}

describe("conflict panel", () => {
  it("shows both retained versions side by side", async () => {
    renderPanel();
    const region = page.getByRole("region", { name: "Conflicting versions" });
    await expect.element(region).toHaveTextContent("revision 4");
    await expect.element(region).toHaveTextContent("Saved on another device");
    await expect.element(region).toHaveTextContent("My draft");
  });

  it("keeps the draft or exports without discarding anything", async () => {
    const actions = renderPanel();
    await page.getByRole("button", { name: "Keep my draft" }).click();
    await page.getByRole("button", { name: "Export recovery" }).click();
    expect(actions.onKeepDraft).toHaveBeenCalledOnce();
    expect(actions.onExport).toHaveBeenCalledOnce();
    expect(actions.onUseSaved).not.toHaveBeenCalled();
  });

  it("discards the draft only after explicit confirmation", async () => {
    const actions = renderPanel();
    await page.getByRole("button", { name: "Use saved version" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    expect(actions.onUseSaved).not.toHaveBeenCalled();

    await page.getByRole("button", { name: "Use saved version" }).click();
    await page.getByRole("button", { name: "Discard draft" }).click();
    expect(actions.onUseSaved).toHaveBeenCalledOnce();
  });

  it("places the destructive action last", async () => {
    renderPanel();
    const region = page.getByRole("region", { name: "Conflicting versions" });
    await expect.element(region).toBeVisible();
    const buttons = [...region.element().querySelectorAll("button")].map(
      (element) => element.textContent,
    );
    expect(buttons.at(-1)).toBe("Use saved version");
  });

  it("offers only export or discard when the saved record is missing", async () => {
    renderPanel({ ...conflict, saved: undefined });
    await expect
      .element(
        page.getByText("The saved record no longer exists", { exact: false }),
      )
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Keep my draft" }))
      .not.toBeInTheDocument();
  });
});
