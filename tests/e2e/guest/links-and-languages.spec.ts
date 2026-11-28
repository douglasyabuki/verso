import { readFile, writeFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import {
  installHarness,
  installPdfInspector,
} from "@/tests/support/e2e/career-harness";
import type { CareerDocument } from "@/types-and-constants/career";

const expectations = {
  "example-resume-en-US": {
    text: [
      "English",
      "Advanced",
      "TOEFL iBT",
      "110/120",
      "Portuguese",
      "Native",
      "Live demo",
      "Verify credential",
    ],
  },
  "example-resume-pt-BR": {
    text: [
      "Inglês",
      "Avançado",
      "TOEFL iBT",
      "110/120",
      "Português",
      "Nativo",
      "Demonstração",
      "Verificar credencial",
    ],
  },
} as const;

for (const [resumeId, expected] of Object.entries(expectations))
  test(`renders sample links, icons, and language evidence in ${resumeId}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    const sample = JSON.parse(
      await readFile("public/examples/alex-morgan.schema-2.json", "utf8"),
    ) as { document: CareerDocument };
    await page.goto("/app");
    await expect(
      page.getByRole("heading", {
        name: "Career details · Overview",
        exact: true,
      }),
    ).toBeVisible();
    await installHarness(page);
    await page.evaluate(async (document) => {
      const storage = await window.careerHarness.openCareerStorage();
      try {
        await storage.replace(await storage.load(), document);
      } finally {
        storage.close();
      }
    }, sample.document);
    await page.goto(`/app/resume-overview/${resumeId}`);

    const downloaded = page.waitForEvent("download", { timeout: 150_000 });
    await page
      .getByRole("button", { name: "Download saved PDF", exact: true })
      .click();
    const bytes = await readFile((await (await downloaded).path())!);
    // Kept in test-results for owner visual/PDF review.
    await writeFile(testInfo.outputPath(`${resumeId}.pdf`), bytes);
    await installPdfInspector(page);
    const pdf = await page.evaluate(
      (base64) => window.careerPdf.inspectPdf(base64),
      bytes.toString("base64"),
    );
    const text = pdf.pages.map((item) => item.text).join(" ");
    const urls = pdf.pages.flatMap((item) => item.urls);
    for (const value of expected.text) expect(text).toContain(value);
    // Internal names stay in the editor.
    expect(text).not.toContain("Demo link for product roles");
    expect(text).not.toContain("Writing tool pitch");
    // Profile links stay clickable, and a Website/link pair to the same
    // destination prints once.
    expect(urls).toEqual(
      expect.arrayContaining([
        "https://github.com/alex-morgan-example",
        "https://www.linkedin.com/in/alex-morgan-example",
      ]),
    );
    expect(
      urls.filter((url) => url === "https://example.com/project"),
    ).toHaveLength(1);
    expect(
      urls.filter((url) => url === "https://example.com/credential"),
    ).toHaveLength(1);
    for (const font of pdf.pages.flatMap((item) => item.fonts))
      expect(font.missingFile).toBe(false);

    // Page images for visual review of icons and layout.
    const pages = page
      .getByRole("region", { name: "Resume PDF output" })
      .getByRole("region", { name: "PDF document pages" });
    await expect(pages).toBeVisible({ timeout: 60_000 });
    await pages.screenshot({ path: testInfo.outputPath(`${resumeId}.png`) });
  });
