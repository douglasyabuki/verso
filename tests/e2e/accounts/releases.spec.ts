import { randomUUID } from "node:crypto";

import { expect, type Page, type Route, test } from "@playwright/test";

import { createCareerDocument } from "@/lib/career/model";
import { createResume } from "@/lib/career/resumes";
import { accountsTestEnv } from "@/playwright.accounts.config";
import {
  database,
  editFullName,
  saveButton,
  setupAccountTests,
  signIn,
  status,
} from "@/tests/support/e2e/accounts";
setupAccountTests();

test.describe("public PDF releases", () => {
  /** Seed a committed account workspace whose only resume is ready for output. */
  async function seedReadyWorkspace(userId: string) {
    const document = createCareerDocument();
    document.profile.fields[0].wording = { "en-US": "Ana Public" };
    const resume = createResume(document, "en-US");
    resume.name = "Public application";
    document.resumes = [resume];
    await database.query(
      `INSERT INTO account_workspace ("userId", "workspaceId", revision, generation, document, "updatedAt")
       VALUES ($1, $2, 1, 0, $3, now())`,
      [userId, randomUUID(), JSON.stringify(document)],
    );
    return resume.id;
  }

  async function compile(page: Page) {
    const pdf = page.getByRole("region", { name: "Resume PDF output" });
    await pdf.getByRole("button", { name: "Update preview" }).click();
    await expect(pdf.getByText(/^Saved PDF \u00b7 Revision \d+$/)).toBeVisible({
      timeout: 150_000,
    });
    return pdf;
  }

  async function latestUrl(userId: string) {
    const result = await database.query<{ token: string }>(
      `SELECT token FROM public_link WHERE "userId" = $1`,
      [userId],
    );
    return `/pdf/${result.rows[0].token}`;
  }

  async function releaseCount(userId: string) {
    const result = await database.query<{ count: string }>(
      `SELECT count(*) FROM public_release WHERE "userId" = $1`,
      [userId],
    );
    return Number(result.rows[0].count);
  }

  async function copyPublishedLink(page: Page, label: string, path: string) {
    const published = page.getByRole("dialog", { name: "PDF published" });
    await expect(published.getByRole("link")).toHaveAttribute("href", path);
    await published.getByRole("button", { name: label, exact: true }).click();
    await expect(
      published.getByRole("button", { name: "Copied" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => sessionStorage.getItem("copied-public-url")),
    ).toBe(new URL(path, accountsTestEnv.BETTER_AUTH_URL).href);
    await published.getByRole("button", { name: "Done" }).click();
  }

  test("publishes latest and pinned PDFs, retries, rolls back, automatically publishes, and revokes", async ({
    page,
    request: anonymous,
  }) => {
    test.setTimeout(420_000);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) =>
            sessionStorage.setItem("copied-public-url", text),
        },
      });
    });
    const { userId } = await signIn(page.context());
    const resumeId = await seedReadyWorkspace(userId);
    await page.goto(`/app/resume-overview/${resumeId}`);
    // First open on a freshly started server can exceed the default timeout.
    await expect(status(page, /^Saved to account · revision 1$/)).toBeVisible({
      timeout: 15_000,
    });
    const publish = page
      .getByRole("region", { name: "Resume PDF output" })
      .getByRole("button", { name: "Publish saved PDF", exact: true });
    await expect(publish).toBeEnabled();
    const dialog = page.getByRole("dialog", { name: "Publish this PDF" });
    const publishLatest = dialog.getByRole("button", {
      name: "Publish PDF",
      exact: true,
    });
    const publishPinned = dialog.getByRole("button", {
      name: "Publish pinned version",
    });

    await publish.click();
    await expect(dialog).toContainText("A new unlisted link is created", {
      timeout: 150_000,
    });
    expect(await releaseCount(userId)).toBe(0);
    await publishPinned.click();
    await expect(
      page.getByRole("dialog", { name: "PDF published" }),
    ).toContainText("No latest version has been selected.");
    const latest = await latestUrl(userId);
    await copyPublishedLink(page, "Copy pinned link", `${latest}/1`);
    await expect(publish).toBeFocused();
    expect((await anonymous.get(latest)).status()).toBe(404);
    const first = await anonymous.get(`${latest}/1`);
    expect(first.status()).toBe(200);
    expect(first.headers()["content-type"]).toBe("application/pdf");
    expect(first.headers()["cache-control"]).toBe("no-store");
    expect(first.headers()["content-disposition"]).toContain(
      "ana-public-en-us-v1.pdf",
    );
    const firstBytes = await first.body();
    expect(firstBytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    await page.goto(`/app/resume-wording/${resumeId}`);
    const wording = page.getByRole("group", {
      name: "Profile \u00b7 Full name",
      exact: true,
    });
    await wording
      .getByRole("button", { name: "Customize", exact: true })
      .click();
    await wording
      .getByRole("textbox", { name: "Profile \u00b7 Full name", exact: true })
      .fill("Unpublished draft wording");
    await page.getByRole("button", { name: "Update preview" }).click();
    await expect(
      page.getByText("Draft PDF \u00b7 Unsaved", { exact: true }),
    ).toBeVisible({ timeout: 150_000 });
    await publish.click();
    const reviewed = dialog.getByRole("link", {
      name: "Open the saved PDF being reviewed",
    });
    await expect(reviewed).toBeVisible({ timeout: 150_000 });
    const reviewedBytes = await reviewed.evaluate(async (link) => {
      const response = await fetch((link as HTMLAnchorElement).href);
      return Array.from(new Uint8Array(await response.arrayBuffer()));
    });
    await publishLatest.click();
    await copyPublishedLink(page, "Copy latest link", latest);
    expect(
      (await (await anonymous.get(latest)).body()).equals(
        Buffer.from(reviewedBytes),
      ),
    ).toBe(true);
    await page
      .getByRole("region", { name: "Editing form" })
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    expect(
      (await anonymous.get(latest)).headers()["content-disposition"],
    ).toContain("ana-public-en-us-v2.pdf");

    // Drop the response after the server stores the pinned version.
    await editFullName(page, "Ana Released");
    await saveButton(page).click();
    await expect(status(page, /^Saved to account · revision 2$/)).toBeVisible();
    await page.goto(`/app/resume-overview/${resumeId}`);
    await compile(page);
    const releasesRoute = "**/api/account/releases";
    const loseResponse = async (route: Route) => {
      if (route.request().method() !== "POST") return route.continue();
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      await route.abort("failed");
    };
    await page.route(releasesRoute, loseResponse);
    await publish.click();
    await publishPinned.click();
    await expect(dialog.getByText("Publication unconfirmed")).toBeVisible();
    expect(await releaseCount(userId)).toBe(3);
    await page.unroute(releasesRoute, loseResponse);
    await dialog.getByRole("button", { name: "Close" }).click();
    await publish.click();
    await dialog.getByRole("button", { name: "Retry publish" }).click();
    await copyPublishedLink(page, "Copy pinned link", `${latest}/3`);
    expect(await releaseCount(userId)).toBe(3);
    expect(
      (await anonymous.get(latest)).headers()["content-disposition"],
    ).toContain("ana-public-en-us-v2.pdf");
    expect(
      (await anonymous.get(`${latest}/3`)).headers()["content-disposition"],
    ).toContain("ana-released-en-us-v3.pdf");

    await publish.click();
    await publishLatest.click();
    await copyPublishedLink(page, "Copy latest link", latest);
    expect((await anonymous.get(`${latest}/1`)).status()).toBe(200);
    expect(
      Buffer.compare(
        await (await anonymous.get(`${latest}/1`)).body(),
        firstBytes,
      ),
    ).toBe(0);
    const current = await anonymous.get(latest);
    expect(current.headers()["content-disposition"]).toContain(
      "ana-released-en-us-v4.pdf",
    );

    // Roll back from Settings › Public PDFs; latest serves release 1 again.
    await page.goto("/app/settings/releases");
    const panel = page.getByRole("region", {
      name: "Public link for Public application",
    });
    await panel
      .getByRole("listitem", { name: "Release 1" })
      .getByRole("button", { name: "Make latest" })
      .click();
    await expect(
      panel.getByRole("listitem", { name: "Release 1" }),
    ).toContainText("Latest");
    expect(
      Buffer.compare(await (await anonymous.get(latest)).body(), firstBytes),
    ).toBe(0);

    // Automatic publishing follows a confirmed Save that changes the PDF.
    await panel
      .getByRole("checkbox", { name: "Release automatically after Save" })
      .click();
    await expect(
      panel.getByRole("checkbox", { name: "Release automatically after Save" }),
    ).toBeChecked();
    // Customize the full name in this resume's Wording view so its preview stays visible.
    await page.goto(`/app/resume-wording/${resumeId}`);
    await expect(publish).toBeEnabled({ timeout: 150_000 });
    await expect(
      page.getByRole("button", { name: "Search PDF", exact: true }),
    ).toBeEnabled({ timeout: 150_000 });
    await page.evaluate(
      (id) => navigator.locks.request(`verso-release-${id}`, () => {}),
      userId,
    );
    expect(await releaseCount(userId)).toBe(4);
    expect(
      (await anonymous.get(latest)).headers()["content-disposition"],
    ).toContain("ana-public-en-us-v1.pdf");
    const nameCard = page.getByRole("group", {
      name: "Profile · Full name",
      exact: true,
    });
    await nameCard
      .getByRole("button", { name: "Customize", exact: true })
      .click();
    await nameCard
      .getByRole("textbox", { name: "Profile · Full name", exact: true })
      .fill("Ana Automatic");
    await saveButton(page).click();
    await expect(status(page, /^Saved to account · revision 3$/)).toBeVisible();
    // The open tab compiles the confirmed Save and publishes it; no reload.
    await expect.poll(() => releaseCount(userId), { timeout: 150_000 }).toBe(5);
    await expect
      .poll(
        async () =>
          (await anonymous.get(latest)).headers()["content-disposition"],
      )
      .toContain("ana-automatic-en-us-v5.pdf");

    // Revoking the link stops every URL immediately.
    await page.goto("/app/settings/releases");
    await panel.getByRole("button", { name: "Revoke link" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Revoke link" })
      .click();
    await expect(page.getByText("No public releases yet.")).toBeVisible();
    expect((await anonymous.get(latest)).status()).toBe(404);
    expect((await anonymous.get(`${latest}/1`)).status()).toBe(404);
    expect(await releaseCount(userId)).toBe(0);
  });
});
