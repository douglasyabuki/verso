import { expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { ThemeSelector } from "@/components/theme-selector";

it("switches appearance without fading controls, then restores interaction transitions", async () => {
  const root = document.documentElement;
  const originalClass = root.className;
  const originalPreference = root.dataset.themePreference;
  const originalStorage = localStorage.getItem("verso-theme");
  root.classList.remove("dark");
  root.dataset.themePreference = "light";
  const screen = await render(
    <>
      <ThemeSelector />
      <input aria-label="Theme sample" className="form-control" />
      <div
        data-theme-reference
        style={{ backgroundColor: "var(--field-surface)" }}
      />
    </>,
  );
  const sample = screen
    .getByRole("textbox", { name: "Theme sample" })
    .element();
  const reference = document.querySelector("[data-theme-reference]")!;
  const observations: { actual: string; expected: string }[] = [];
  const observe = () => {
    observations.push({
      actual: getComputedStyle(sample).backgroundColor,
      expected: getComputedStyle(reference).backgroundColor,
    });
  };
  document.addEventListener("click", observe);
  try {
    for (const theme of ["Dark", "Light", "Dark", "Light"]) {
      await screen
        .getByRole("button", { name: `${theme} theme`, exact: true })
        .click();
      expect(root.classList.contains("dark")).toBe(theme === "Dark");
      const observation = observations.at(-1)!;
      expect(observation.actual).toBe(observation.expected);
      expect(localStorage.getItem("verso-theme")).toBe(theme.toLowerCase());
    }
    await expect
      .poll(() => getComputedStyle(sample).transitionDuration)
      .toBe("0.15s, 0.15s, 0.15s");
  } finally {
    document.removeEventListener("click", observe);
    await screen.unmount();
    root.className = originalClass;
    if (originalPreference === undefined) delete root.dataset.themePreference;
    else root.dataset.themePreference = originalPreference;
    if (originalStorage === null) localStorage.removeItem("verso-theme");
    else localStorage.setItem("verso-theme", originalStorage);
  }
});

it("keeps a theme active after storage failure and offers an explicit retry", async () => {
  const root = document.documentElement;
  const originalClass = root.className;
  const originalPreference = root.dataset.themePreference;
  const originalStorage = localStorage.getItem("verso-theme");
  root.classList.remove("dark");
  root.dataset.themePreference = "light";
  const persist = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementationOnce(() => {
      throw new Error("Storage unavailable");
    });
  const screen = await render(<ThemeSelector />);
  try {
    await screen
      .getByRole("button", { name: "Dark theme", exact: true })
      .click();
    expect(root.classList.contains("dark")).toBe(true);
    await expect
      .element(screen.getByRole("status"))
      .toHaveTextContent(/tab only/);
    await screen.getByRole("button", { name: "Retry saving theme" }).click();
    await expect.element(screen.getByRole("status")).not.toBeInTheDocument();
    expect(localStorage.getItem("verso-theme")).toBe("dark");
  } finally {
    await screen.unmount();
    persist.mockRestore();
    root.className = originalClass;
    if (originalPreference === undefined) delete root.dataset.themePreference;
    else root.dataset.themePreference = originalPreference;
    if (originalStorage === null) localStorage.removeItem("verso-theme");
    else localStorage.setItem("verso-theme", originalStorage);
  }
});
