import { Copy, Pencil, Trash2 } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";

import { CareerWorkspace } from "@/components/career/career-workspace";
import {
  type QuickAction,
  QuickActionsContextMenu,
  QuickActionsMenu,
} from "@/components/ui/quick-actions";
import { CareerController } from "@/stores/career/controller";

const controllers: CareerController[] = [];
const initialUrl = window.location.href;
const initialState = window.history.state;

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
      reject(new Error("Quick actions test database still owned."));
  });
  window.history.replaceState(initialState, "", initialUrl);
});

/** Menu items and separators of the open menu, in DOM order. */
function menuStructure() {
  const menu = document.querySelector('[role="menu"]')!;
  return [
    ...menu.querySelectorAll('[role="menuitem"], [role="separator"]'),
  ].map((node) =>
    node.getAttribute("role") === "separator"
      ? "---"
      : node.textContent!.trim(),
  );
}

function Row({ actions }: { actions: QuickAction[] }) {
  return (
    <QuickActionsContextMenu actions={actions}>
      <div>
        <span>Row</span>
        <QuickActionsMenu
          actions={actions}
          trigger={<button type="button" aria-label="Actions for Row" />}
        />
      </div>
    </QuickActionsContextMenu>
  );
}

describe("Quick actions", () => {
  it("shows the same items from the … button and right-click, with negative actions last after a divider", async () => {
    const remove = vi.fn();
    const actions: QuickAction[] = [
      // Declared first, still rendered last.
      {
        key: "delete",
        label: "Delete row",
        icon: Trash2,
        destructive: true,
        onSelect: remove,
      },
      { key: "edit", label: "Edit", icon: Pencil, onSelect: () => {} },
      { key: "copy", label: "Duplicate", icon: Copy, onSelect: () => {} },
    ];
    await render(<Row actions={actions} />);
    const expected = ["Edit", "Duplicate", "---", "Delete row"];

    await page.getByRole("button", { name: "Actions for Row" }).click();
    await expect.element(page.getByRole("menu")).toBeVisible();
    expect(menuStructure()).toEqual(expected);
    await expect
      .element(page.getByRole("menuitem", { name: "Delete row" }))
      .toHaveAttribute("data-variant", "destructive");
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument();

    await page.getByText("Row", { exact: true }).click({ button: "right" });
    await expect.element(page.getByRole("menu")).toBeVisible();
    expect(menuStructure()).toEqual(expected);
    await page.getByRole("menuitem", { name: "Delete row" }).click();
    expect(remove).toHaveBeenCalledOnce();
  });

  it("omits the divider without negative actions and explains disabled items", async () => {
    await render(
      <Row
        actions={[
          { key: "edit", label: "Edit", icon: Pencil, onSelect: () => {} },
          {
            key: "copy",
            label: "Duplicate",
            icon: Copy,
            disabled: true,
            hint: "Limit reached.",
            onSelect: () => {},
          },
        ]}
      />,
    );
    await page.getByText("Row", { exact: true }).click({ button: "right" });
    await expect.element(page.getByRole("menu")).toBeVisible();
    expect(menuStructure()).toEqual(["Edit", "DuplicateLimit reached."]);
    await expect
      .element(page.getByRole("menuitem", { name: /Duplicate/ }))
      .toHaveAttribute("aria-disabled", "true");
  });

  it("archives and restores a career section from its sidebar context menu", async () => {
    const controller = new CareerController();
    controllers.push(controller);
    await controller.initialize();
    const section = controller.getSnapshot().head!.document.sections[0];
    const name = section.name || section.kind;
    await page.viewport(1280, 900);
    window.history.replaceState({ versoIndex: 0 }, "", "?scope=overview");
    await render(<CareerWorkspace controller={controller} />);
    const navigation = page.getByRole("navigation", {
      name: "Workspace navigation",
    });
    const row = navigation.getByRole("button", { name, exact: true });

    // Measure before opening: the menu makes the rest of the page inert.
    const rowWidth = row
      .element()
      .closest("[data-quick-actions-row]")!
      .getBoundingClientRect().width;
    await row.click({ button: "right" });
    // The menu is never wider than the row that owns it, and items never wrap.
    await expect.element(page.getByRole("menu")).toBeVisible();
    const menuWidth =
      document.querySelector<HTMLElement>('[role="menu"]')!.offsetWidth;
    expect(menuWidth).toBeLessThanOrEqual(rowWidth);
    for (const item of document.querySelectorAll<HTMLElement>(
      '[role="menuitem"]',
    ))
      expect(item.offsetHeight).toBe(32);
    await page.getByRole("menuitem", { name: "Archive section" }).click();
    await expect
      .poll(
        () =>
          controller
            .getSnapshot()
            .head!.document.sections.find((item) => item.id === section.id)
            ?.archived,
      )
      .toBe(true);
    await expect
      .element(navigation.getByText("Archived", { exact: true }))
      .toBeVisible();

    await navigation
      .getByRole("button", { name: `${name} Archived`, exact: true })
      .click({ button: "right" });
    await page.getByRole("menuitem", { name: "Restore section" }).click();
    await expect
      .poll(
        () =>
          controller
            .getSnapshot()
            .head!.document.sections.find((item) => item.id === section.id)
            ?.archived,
      )
      .toBe(false);
  });
});
