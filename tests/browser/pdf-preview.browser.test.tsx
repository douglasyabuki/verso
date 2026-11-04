import "pdfjs-dist/web/pdf_viewer.css";

import { afterEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";

import PdfPreview from "@/components/output/pdf-preview";
import { previewPdf } from "@/tests/fixtures/pdf";

const urls: string[] = [];
function source(title = "Viewer fixture") {
  const url = URL.createObjectURL(
    new Blob([previewPdf(title).buffer], { type: "application/pdf" }),
  );
  urls.push(url);
  return { url, key: title, fileName: `${title}.pdf` };
}
afterEach(async () => {
  await cleanup();
  urls.splice(0).forEach((url) => URL.revokeObjectURL(url));
  vi.restoreAllMocks();
});

it("navigates a real PDF using pages, thumbnails and its embedded outline", async () => {
  await page.viewport(1440, 900);
  await render(
    <div style={{ height: 700, display: "flex" }}>
      <PdfPreview document={source()} />
    </div>,
  );
  await expect
    .element(page.getByRole("button", { name: "PDF navigation", exact: true }))
    .toBeEnabled();
  await expect
    .element(
      page
        .getByRole("region", { name: "PDF document pages" })
        .getByText("First page search needle"),
    )
    .toBeVisible();
  await page
    .getByRole("button", { name: "PDF navigation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Go to PDF page 2", exact: true })
    .click();
  await expect
    .element(page.getByRole("spinbutton", { name: "PDF page number" }))
    .toHaveValue(2);
  await page
    .getByRole("tab", { name: "Document outline", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Final bookmark", exact: true })
    .click();
  await expect
    .element(page.getByRole("spinbutton", { name: "PDF page number" }))
    .toHaveValue(3);
  await page.getByRole("spinbutton", { name: "PDF page number" }).fill("1");
  await userEvent.keyboard("{Enter}");
  await expect
    .element(page.getByRole("spinbutton", { name: "PDF page number" }))
    .toHaveValue(1);
  await expect
    .element(page.getByRole("link", { name: "https://example.com/" }))
    .toHaveAttribute("rel", "noopener noreferrer");
});

it("searches all pages, restores focus, and leaves native browser Find shortcuts untouched", async () => {
  await render(
    <div style={{ height: 700, display: "flex" }}>
      <PdfPreview document={source()} />
    </div>,
  );
  await expect
    .element(page.getByRole("button", { name: "Search PDF", exact: true }))
    .toBeEnabled();
  const region = page
    .getByRole("region", { name: "PDF document pages" })
    .element();
  const shortcut = new KeyboardEvent("keydown", {
    key: "f",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  region.dispatchEvent(shortcut);
  expect(shortcut.defaultPrevented).toBe(false);
  expect(
    page.getByRole("textbox", { name: "Search PDF text" }).elements(),
  ).toHaveLength(0);
  await page.getByRole("button", { name: "Search PDF", exact: true }).click();
  await expect
    .element(page.getByRole("textbox", { name: "Search PDF text" }))
    .toHaveFocus();
  await page.getByRole("textbox", { name: "Search PDF text" }).fill("needle");
  await expect
    .element(page.getByRole("status").filter({ hasText: "1 / 2" }))
    .toBeVisible();
  await page
    .getByRole("button", { name: "Next PDF match", exact: true })
    .click();
  await expect
    .element(page.getByRole("status").filter({ hasText: "2 / 2" }))
    .toBeVisible();
  await page
    .getByRole("button", { name: "Close PDF search", exact: true })
    .click();
  await expect
    .element(page.getByRole("button", { name: "Search PDF", exact: true }))
    .toHaveFocus();
  await expect
    .poll(() => document.querySelectorAll(".highlight").length)
    .toBe(0);
});

it("fits on resize, synchronizes percentage zoom, and reads the current document's properties", async () => {
  const initial = source();
  const screen = await render(
    <div style={{ height: 700, width: 900, display: "flex" }}>
      <PdfPreview document={initial} />
    </div>,
  );
  await expect
    .element(page.getByRole("button", { name: "Search PDF", exact: true }))
    .toBeEnabled();
  await page.getByRole("combobox", { name: "PDF zoom" }).click();
  await page.getByRole("option", { name: "Fit page", exact: true }).click();
  const height = () =>
    document.querySelector(".pdfViewer .page")!.getBoundingClientRect().height;
  const before = height();
  await screen.rerender(
    <div style={{ height: 450, width: 900, display: "flex" }}>
      <PdfPreview document={initial} />
    </div>,
  );
  await expect.poll(height).toBeLessThan(before);
  await page.getByRole("combobox", { name: "PDF zoom" }).click();
  await page.getByRole("option", { name: "125%", exact: true }).click();
  await expect
    .element(page.getByRole("status").filter({ hasText: "PDF zoom 125%" }))
    .toBeVisible();
  await page.getByRole("button", { name: "PDF actions", exact: true }).click();
  await expect
    .element(page.getByRole("menuitem", { name: "Download PDF", exact: true }))
    .toHaveAttribute("download", "Viewer fixture.pdf");
  await page
    .getByRole("menuitem", { name: "Document properties", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Document properties" });
  await expect
    .element(dialog.getByText("Verso fixture author", { exact: true }))
    .toBeVisible();
  await expect
    .element(
      dialog.getByText("209.9 \u00d7 297.0 mm (page 1)", { exact: true }),
    )
    .toBeVisible();
  await expect
    .element(dialog.getByText("Unavailable", { exact: true }).first())
    .toBeVisible();
});

it("replaces document identity and terminates owned workers on replacement and unmount", async () => {
  const terminate = vi.spyOn(Worker.prototype, "terminate");
  const screen = await render(
    <div style={{ height: 700, display: "flex" }}>
      <PdfPreview document={source("Original")} />
    </div>,
  );
  await expect
    .element(page.getByRole("button", { name: "Search PDF", exact: true }))
    .toBeEnabled();
  await page.getByRole("button", { name: "Search PDF", exact: true }).click();
  await page.getByRole("textbox", { name: "Search PDF text" }).fill("needle");
  await screen.rerender(
    <div style={{ height: 700, display: "flex" }}>
      <PdfPreview document={source("Replacement")} />
    </div>,
  );
  await expect
    .element(page.getByRole("button", { name: "Search PDF", exact: true }))
    .toBeEnabled();
  expect(
    page.getByRole("textbox", { name: "Search PDF text" }).elements(),
  ).toHaveLength(0);
  await expect
    .poll(() => terminate.mock.calls.length)
    .toBeGreaterThanOrEqual(1);
  await screen.unmount();
  await expect
    .poll(() => terminate.mock.calls.length)
    .toBeGreaterThanOrEqual(2);
});
