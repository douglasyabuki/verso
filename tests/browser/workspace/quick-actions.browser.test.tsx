import { Copy, Pencil, Trash2 } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";

import { CareerWorkspace } from "@/components/career/career-workspace";
import {
  type QuickAction,
  QuickActionsContextMenu,
  QuickActionsMenu,
} from "@/components/ui/quick-actions";
import { createResume } from "@/lib/career/resumes";
import { CareerController } from "@/stores/career/controller";

const controllers: CareerController[] = [];
const initialUrl = window.location.href;
const initialState = window.history.state;

afterEach(async () => {
  for (const controller of controllers)
    await expect.poll(() => controller.getSnapshot().saving).toBe(false);
  await cleanup();
  for (const controller of controllers) {
    await controller.flushRecovery();
    await controller.dispose();
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

  it("requires two saved resumes for collection and individual Compare actions", async () => {
    const controller = new CareerController();
    controllers.push(controller);
    await controller.initialize();
    const document = controller.getSnapshot().head!.document;
    const first = { ...createResume(document, "en-US"), name: "First resume" };
    const second = {
      ...createResume(document, "en-US"),
      name: "Second resume",
    };
    expect(await controller.command(`resume/${first.id}`, first)).toBe(true);
    await page.viewport(1280, 900);
    window.history.replaceState({ versoIndex: 0 }, "", "?scope=resumes");
    await render(<CareerWorkspace controller={controller} />);

    const navigation = page.getByRole("navigation", {
      name: "Workspace navigation",
    });
    const main = page.getByRole("main");
    const resumes = navigation.getByRole("button", {
      name: "Resumes",
      exact: true,
    });
    const resume = navigation.getByRole("button", { name: /^First resume/ });
    const compareButton = main.getByRole("button", {
      name: "Compare resumes",
      exact: true,
    });
    const compareItem = page.getByRole("menuitem", { name: /Compare resumes/ });
    await expect.element(compareButton).toBeDisabled();
    await resumes.click({ button: "right" });
    await expect.element(compareItem).toBeDisabled();
    await expect
      .element(compareItem)
      .toHaveTextContent(/Create at least two resumes to compare\./);
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument();

    const contextualCompare = page.getByRole("menuitem", { name: /^Compare/ });
    const assertUnavailable = async () => {
      await expect.element(contextualCompare).toBeDisabled();
      await expect
        .element(contextualCompare)
        .toHaveTextContent(/Create at least two resumes to compare\./);
      await userEvent.keyboard("{Escape}");
      await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
    };
    const actions = { name: "Actions for First resume", exact: true };
    await navigation.getByRole("button", actions).click();
    await assertUnavailable();
    await resume.click({ button: "right" });
    await assertUnavailable();
    await main.getByRole("button", actions).click();
    await assertUnavailable();
    await resume.click();
    await main.getByRole("button", actions).click();
    await assertUnavailable();

    expect(await controller.command(`resume/${second.id}`, second)).toBe(true);
    await resumes.click();
    await expect.element(compareButton).toBeEnabled();
    await resumes.click({ button: "right" });
    await compareItem.click();
    await expect
      .element(page.getByRole("heading", { name: "Compare resumes", level: 1 }))
      .toBeVisible();
    await expect
      .element(page.getByRole("combobox", { name: "Left resume" }))
      .toHaveTextContent("First resume (en-US)");
    await expect
      .element(page.getByRole("combobox", { name: "Right resume" }))
      .toHaveTextContent("Second resume (en-US)");
  });

  it("opens a guarded entry draft from both section menus and returns to Editor on mobile", async () => {
    const controller = new CareerController();
    controllers.push(controller);
    await controller.initialize();
    const document = controller.getSnapshot().head!.document;
    const section = document.sections[0];
    const resume = createResume(document, "en-US");
    expect(await controller.command(`resume/${resume.id}`, resume)).toBe(true);
    await page.viewport(1280, 900);
    window.history.replaceState({ versoIndex: 0 }, "", "?scope=summary");
    await render(<CareerWorkspace controller={controller} />);

    const summary = page.getByRole("textbox", { name: "Summary" });
    await summary.fill("Unsaved summary");
    const name = section.name || section.kind;
    const createEntry = page.getByRole("menuitem", { name: "Create entry" });
    const guard = page.getByRole("dialog", { name: "Unsaved form" });
    await page
      .getByRole("navigation", { name: "Workspace navigation" })
      .getByRole("button", { name: `Actions for ${name}` })
      .click();
    await createEntry.click();
    await guard.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect.element(summary).toHaveTextContent("Unsaved summary");
    expect(controller.getSnapshot().draft?.scope).toBe("summary");

    await page.viewport(390, 844);
    await page.getByRole("tab", { name: "PDF preview", exact: true }).click();
    await page.getByRole("button", { name: "Expand sidebar" }).click();
    const sidebar = page.getByRole("dialog", { name: "Verso workspace" });
    await sidebar.getByRole("button", { name, exact: true }).click({
      button: "right",
    });
    await createEntry.click();
    await guard.getByRole("button", { name: "Discard", exact: true }).click();
    await expect.element(sidebar).not.toBeInTheDocument();
    await expect
      .element(page.getByRole("tab", { name: "Editor", exact: true }))
      .toHaveAttribute("aria-selected", "true");
    const editor = page.getByRole("region", { name: "Editing form" });
    await editor
      .getByRole("textbox", { name: "Internal name" })
      .fill("New role");
    expect(controller.getSnapshot().draft?.scope).toMatch(
      new RegExp(`^new-entry/${section.id}/`),
    );
    expect(controller.getSnapshot().head!.document.sections[0].entries).toEqual(
      [],
    );
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(() =>
        controller
          .getSnapshot()
          .head!.document.sections[0].entries.map((entry) => entry.name),
      )
      .toEqual(["New role"]);
  });
});
