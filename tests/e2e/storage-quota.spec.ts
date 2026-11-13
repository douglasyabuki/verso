import { expect, test } from "@playwright/test";

import { installHarness } from "./career-harness";

test("real quota failures abort Save and replacement without partial changes or recovery loss", async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await installHarness(page);
  const initial = await page.evaluate(async () => {
    const storage = await window.careerHarness.openCareerStorage();
    try {
      const initialHead = await storage.load();
      const baseline = structuredClone(initialHead.document);
      for (let i = 0; i < 200; i++)
        baseline.languages.push({
          tag: `en-x-${i.toString().padStart(4, "0")}`,
          active: false,
        });
      const head = await storage.replace(initialHead, baseline);
      const draft = {
        draftId: "quota-draft",
        draftVersion: 1,
        workspaceId: head.workspaceId,
        generation: head.generation,
        baselineRevision: head.revision,
        scope: "summary",
        baseline: head.document.summary,
        values: {
          ...head.document.summary,
          wording: { "en-US": "Retain this recovery" },
        },
      };
      await storage.writeDraft(draft);
      const values = {
        ...head.document.summary,
        wording: Object.fromEntries(
          Array.from({ length: 200 }, (_, i) => [
            `en-x-${i.toString().padStart(4, "0")}`,
            btoa(
              String.fromCharCode(
                ...crypto.getRandomValues(new Uint8Array(15_000)),
              ),
            ),
          ]),
        ),
      };
      // Prepare before restricting quota so the failing transaction is the commit.
      const request = {
        id: "quota-operation",
        workspaceId: head.workspaceId,
        generation: head.generation,
        scope: "summary",
        baseline: head.document.summary,
        values,
        draftId: draft.draftId,
        draftVersion: draft.draftVersion,
        fingerprint: "",
      };
      // Add the wording languages to a separate incoming document for replacement.
      const incoming = structuredClone(head.document);
      incoming.summary = values;
      // Use incompressible payloads larger than Chromium's quota reservation
      // granularity; small writes can consume an already-reserved allocation.
      request.fingerprint = JSON.stringify([
        request.workspaceId,
        request.generation,
        request.scope,
        request.baseline,
        request.values,
        request.draftId,
        request.draftVersion,
      ]);
      await storage.prepare(request);
      return {
        head,
        draft,
        incoming,
        previous: (await storage.previous()) ?? null,
      };
    } finally {
      storage.close();
    }
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Storage.overrideQuotaForOrigin", {
    origin: new URL(page.url()).origin,
    quotaSize: 1,
  });
  const quota = await cdp.send("Storage.getUsageAndQuota", {
    origin: new URL(page.url()).origin,
  });
  expect(quota.overrideActive).toBe(true);
  expect(quota.quota).toBe(1);
  // Chromium caches bucket space for 30 seconds. Let that real-browser cache
  // expire; otherwise the prepared connection can still spend its old allotment.
  // https://github.com/chromium/chromium/blob/main/content/browser/indexed_db/instance/bucket_context.h
  await new Promise((resolve) => setTimeout(resolve, 31_000));
  try {
    const result = await page.evaluate(async ({ head, incoming }) => {
      const storage = await window.careerHarness.openCareerStorage();
      try {
        const failures: string[] = [];
        for (const action of [
          () => storage.commit("quota-operation"),
          () => storage.replace(head, incoming),
        ]) {
          try {
            await action();
            failures.push("unexpected success");
          } catch (error) {
            failures.push((error as Error).name);
          }
        }
        return {
          failures,
          head: await storage.load(),
          drafts: await storage.drafts(),
          previous: (await storage.previous()) ?? null,
        };
      } finally {
        storage.close();
      }
    }, initial);
    expect(result.failures).toEqual([
      "QuotaExceededError",
      "QuotaExceededError",
    ]);
    expect(result.head).toEqual(initial.head);
    expect(result.drafts).toEqual([initial.draft]);
    expect(result.previous).toEqual(initial.previous);
  } finally {
    await cdp.send("Storage.overrideQuotaForOrigin", {
      origin: new URL(page.url()).origin,
    });
    await cdp.detach();
  }
  const retried = await page.evaluate(async () => {
    const storage = await window.careerHarness.openCareerStorage();
    try {
      const head = await storage.commit("quota-operation");
      return { revision: head.revision, drafts: await storage.drafts() };
    } finally {
      storage.close();
    }
  });
  expect(retried).toEqual({ revision: initial.head.revision + 1, drafts: [] });
});
