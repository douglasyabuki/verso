import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";

import { SidebarSelection } from "@/components/ui/sidebar-selection";

afterEach(async () => {
  await cleanup();
});

function SelectionFixture({ custom }: { custom: boolean }) {
  const [active, setActive] = useState(0);
  return (
    <SidebarSelection
      activeItemSelector={custom ? "[data-pdf-view][data-active]" : undefined}
      style={{ width: 160 }}
    >
      {["First view", "Second view"].map((label, index) => (
        <button
          key={label}
          data-sidebar={custom ? undefined : "menu-button"}
          data-pdf-view={custom ? "" : undefined}
          data-active={active === index ? "" : undefined}
          onClick={() => setActive(index)}
          style={{ display: "block", height: 40, width: "100%" }}
        >
          {label}
        </button>
      ))}
    </SidebarSelection>
  );
}

it.each([false, true])(
  "tracks selection and resize with custom selector = %s",
  async (custom) => {
    const screen = await render(<SelectionFixture custom={custom} />);
    const surface = () =>
      document.querySelector<HTMLElement>(
        '[data-slot="sidebar-selection-surface"]',
      )!;
    const aligned = (button: Element) => {
      const bounds = surface().getBoundingClientRect();
      const target = button.getBoundingClientRect();
      return (
        !surface().hidden &&
        Math.abs(bounds.top - target.top) < 1 &&
        Math.abs(bounds.width - target.width) < 1
      );
    };
    await expect
      .poll(() =>
        aligned(page.getByRole("button", { name: "First view" }).element()),
      )
      .toBe(true);
    await page.getByRole("button", { name: "Second view" }).click();
    const selected = page
      .getByRole("button", { name: "Second view" })
      .element();
    await expect.poll(() => aligned(selected)).toBe(true);
    selected.style.width = "100px";
    await expect.poll(() => aligned(selected)).toBe(true);
    await screen.unmount();
  },
);
