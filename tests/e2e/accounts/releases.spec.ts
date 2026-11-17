import { randomUUID } from "node:crypto";

import {
  expect,
  type Page,
  request as playwrightRequest,
  test,
} from "@playwright/test";

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
    const pdf = page.getByRole("region", { name: "Committed resume output" });
    await pdf.getByRole("button", { name: "Refresh preview" }).click();
    await expect(pdf.getByText(/· Current$/)).toBeVisible({ timeout: 150_000 });
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

  test("releases reviewed PDFs, keeps pinned links, rolls back, revokes, and releases automatically", async ({
    page,
  }) => {
    test.setTimeout(420_000);
    const { userId } = await signIn(page.context());
    const resumeId = await seedReadyWorkspace(userId);
    await page.goto(`/?scope=resume-overview/${resumeId}`);
    // First open on a freshly started server can exceed the default timeout.
    await expect(status(page, /^Saved to account · revision 1$/)).toBeVisible({
      timeout: 15_000,
    });
    const pdf = await compile(page);

    await pdf.getByRole("button", { name: "Release…" }).click();
    const dialog = page.getByRole("dialog", {
      name: "Release this PDF publicly",
    });
    await expect(dialog).toContainText("A new unlisted link is created");
    await dialog.getByRole("button", { name: "Release", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "PDF released" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();
    const latest = await latestUrl(userId);

    const anonymous = await playwrightRequest.newContext({
      baseURL: accountsTestEnv.BETTER_AUTH_URL,
    });
    const first = await anonymous.get(latest);
    expect(first.status()).toBe(200);
    expect(first.headers()["content-type"]).toBe("application/pdf");
    expect(first.headers()["cache-control"]).toBe("no-store");
    expect(first.headers()["content-disposition"]).toContain(
      "ana-public-en-us-v1.pdf",
    );
    const firstBytes = await first.body();
    expect(firstBytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    // A committed change produces release 2; the pinned URL keeps release 1.
    await editFullName(page, "Ana Released");
    await saveButton(page).click();
    await expect(status(page, /^Saved to account · revision 2$/)).toBeVisible();
    await page.goto(`/?scope=resume-overview/${resumeId}`);
    await compile(page);
    await pdf.getByRole("button", { name: "Release…" }).click();
    await page
      .getByRole("dialog", { name: "Release this PDF publicly" })
      .getByRole("button", { name: "Release", exact: true })
      .click();
    await page.getByRole("button", { name: "Done" }).click();
    expect((await anonymous.get(`${latest}/1`)).status()).toBe(200);
    expect(
      Buffer.compare(
        await (await anonymous.get(`${latest}/1`)).body(),
        firstBytes,
      ),
    ).toBe(0);
    const second = await anonymous.get(latest);
    expect(second.headers()["content-disposition"]).toContain(
      "ana-released-en-us-v2.pdf",
    );

    // Roll back from Settings › Public PDFs; latest serves release 1 again.
    await page.goto("/?scope=settings/releases");
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

    // Automatic release: a confirmed Save that changes the PDF publishes release 3.
    await panel
      .getByRole("checkbox", { name: "Release automatically after Save" })
      .click();
    await expect(
      panel.getByRole("checkbox", { name: "Release automatically after Save" }),
    ).toBeChecked();
    // Customize the full name in this resume's Wording view so its preview stays visible.
    await page.goto(`/?scope=resume-wording/${resumeId}`);
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
    await expect.poll(() => releaseCount(userId), { timeout: 150_000 }).toBe(3);
    await expect
      .poll(
        async () =>
          (await anonymous.get(latest)).headers()["content-disposition"],
      )
      .toContain("ana-automatic-en-us-v3.pdf");

    // Revoking the link stops every URL immediately.
    await page.goto("/?scope=settings/releases");
    await panel.getByRole("button", { name: "Revoke link" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Revoke link" })
      .click();
    await expect(page.getByText("No public releases yet.")).toBeVisible();
    expect((await anonymous.get(latest)).status()).toBe(404);
    expect((await anonymous.get(`${latest}/1`)).status()).toBe(404);
    expect(await releaseCount(userId)).toBe(0);
    await anonymous.dispose();
  });
});
