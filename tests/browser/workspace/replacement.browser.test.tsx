import { afterEach, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";

import { CareerWorkspace } from "@/components/career/career-workspace";
import { createCareerDocument, createEntry } from "@/lib/career/model";
import { createResume } from "@/lib/career/resumes";
import type { CareerController } from "@/stores/career/controller";
import { CareerStorage } from "@/stores/career/persistence";
import {
  controllerOwner,
  setupCareerTests,
  storage,
  summaryDraft,
} from "@/tests/support/browser/career";
import type { CareerDocument, CareerDraft } from "@/types-and-constants/career";

setupCareerTests();
afterEach(() => vi.restoreAllMocks());

function workspaceWithResume(name: string) {
  const document = createCareerDocument();
  document.resumes.push({ ...createResume(document, "en-US"), name });
  return document;
}

async function openData(controller: CareerController) {
  window.history.replaceState(
    { versoIndex: 0, versoBackground: "overview" },
    "",
    "?scope=settings/data",
  );
  await render(<CareerWorkspace controller={controller} />);
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect
    .element(settings.getByRole("region", { name: "Restore" }))
    .toBeVisible();
  return settings;
}

async function importWorkspace(incoming: CareerDocument) {
  const contents = JSON.stringify({
    format: "verso.workspace",
    schemaVersion: 2,
    workspaceId: "external-test-workspace",
    exportedAt: "2026-11-23T10:00:00.000Z",
    document: incoming,
  });
  const input = document.querySelector<HTMLInputElement>(
    "#workspace-import-file",
  )!;
  await page
    .elementLocator(input)
    .upload(
      new File([contents], "workspace.json", { type: "application/json" }),
    );
  const review = page.getByRole("dialog", {
    name: "Review workspace replacement",
  });
  await expect.element(review).toBeVisible();
  return review;
}

it("keeps both imports available on fresh Data and offers a retry if the previous-workspace read fails", async () => {
  const previous = vi.spyOn(CareerStorage.prototype, "previous");
  previous.mockRejectedValueOnce(new Error("Storage temporarily unavailable"));
  const controller = await controllerOwner();
  const settings = await openData(controller);
  await expect
    .element(settings.getByRole("alert"))
    .toHaveTextContent(/temporarily unavailable/);
  await settings
    .getByRole("button", { name: "Retry previous workspace check" })
    .click();
  await expect.poll(() => previous.mock.calls.length).toBe(2);
  await expect.element(settings.getByRole("alert")).not.toBeInTheDocument();
  await expect
    .element(
      settings.getByRole("button", { name: "Restore previous workspace" }),
    )
    .not.toBeInTheDocument();
  await expect
    .element(settings.getByRole("button", { name: "Export unsaved drafts" }))
    .not.toBeInTheDocument();
  await expect
    .element(settings.getByRole("button", { name: "Import workspace backup" }))
    .toBeVisible();
  await expect
    .element(settings.getByRole("button", { name: "Import unsaved drafts" }))
    .toBeVisible();
});

it("keeps replacement gated after export failure and unlocks it when the older backup download starts", async () => {
  const writer = await storage();
  const older = workspaceWithResume("Older retained resume");
  const current = workspaceWithResume("Current resume");
  const outgoing = await writer.replace(
    await writer.load(createCareerDocument()),
    older,
  );
  await writer.replace(outgoing, current);
  const controller = await controllerOwner();
  await openData(controller);
  const incoming = workspaceWithResume("Incoming resume");
  const review = await importWorkspace(incoming);
  await expect.element(review).toHaveTextContent(/Current resume/);
  await expect.element(review).toHaveTextContent(/Incoming resume/);
  await expect.element(review).toHaveTextContent(/5 sections · 1 resume/);
  const confirm = review.getByRole("button", {
    name: "Replace workspace",
    exact: true,
  });
  const download = review.getByRole("button", {
    name: "Download previous workspace",
  });
  await expect.element(confirm).toBeDisabled();

  const createUrl = vi
    .spyOn(URL, "createObjectURL")
    .mockImplementationOnce(() => {
      throw new Error("Download unavailable");
    })
    .mockReturnValue("blob:test-workspace");
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await download.click();
  await expect
    .element(review.getByRole("alert"))
    .toHaveTextContent(/Download unavailable/);
  await expect.element(confirm).toBeDisabled();
  expect((await writer.load()).document).toEqual(current);
  expect((await writer.previous())?.document).toEqual(older);

  await download.click();
  await expect.element(confirm).toBeEnabled();
  const exported = createUrl.mock.calls[1][0] as Blob;
  expect(JSON.parse(await exported.text())).toMatchObject({ document: older });
  await confirm.click();
  await expect.element(review).not.toBeInTheDocument();
  expect((await writer.load()).document).toEqual(incoming);
  expect((await writer.previous())?.document).toEqual(current);
});

it("allows explicitly continuing without a download and rejects a stale review", async () => {
  const writer = await storage();
  const current = await writer.replace(
    await writer.load(createCareerDocument()),
    workspaceWithResume("Current"),
  );
  const controller = await controllerOwner();
  await openData(controller);
  const review = await importWorkspace(workspaceWithResume("Prepared"));
  const confirm = review.getByRole("button", {
    name: "Replace workspace",
    exact: true,
  });
  await expect.element(confirm).toBeDisabled();
  await review
    .getByRole("button", { name: "Continue without downloading" })
    .click();
  await expect.element(confirm).toBeEnabled();

  const concurrent = await writer.replace(
    current,
    workspaceWithResume("Saved elsewhere"),
  );
  await confirm.click();
  await expect
    .element(review.getByRole("alert"))
    .toHaveTextContent(/changed since this review/);
  await expect.element(confirm).toBeDisabled();
  expect(await writer.load()).toEqual(concurrent);
  expect(await writer.previous()).toEqual(current);
  await review.getByRole("button", { name: "Cancel", exact: true }).click();

  await importWorkspace(workspaceWithResume("Confirmed replacement"));
  await expect.element(confirm).toBeDisabled();
  await review
    .getByRole("button", { name: "Continue without downloading" })
    .click();
  await confirm.click();
  await expect.element(review).not.toBeInTheDocument();
  expect((await writer.load()).document.resumes[0].name).toBe(
    "Confirmed replacement",
  );
  expect(await writer.previous()).toEqual(concurrent);
});

it("acknowledges the replacement even if reading recovery afterward fails", async () => {
  const controller = await controllerOwner();
  const writer = await storage();
  const first = await writer.load();
  const settings = await openData(controller);
  const incoming = workspaceWithResume("Acknowledged replacement");
  const review = await importWorkspace(incoming);
  vi.spyOn(CareerStorage.prototype, "drafts").mockRejectedValueOnce(
    new Error("Recovery read failed"),
  );
  await review
    .getByRole("button", { name: "Replace workspace", exact: true })
    .click();
  await expect.element(review).not.toBeInTheDocument();
  await expect
    .element(
      settings.getByRole("button", { name: "Undo workspace replacement" }),
    )
    .toBeVisible();
  await expect
    .element(settings.getByRole("alert"))
    .toHaveTextContent(/Unsaved drafts could not be refreshed/);
  expect((await writer.load()).document).toEqual(incoming);
  expect(await writer.previous()).toEqual(first);
});

it("exports stored drafts and the latest active form and order exactly once", async () => {
  const writer = await storage();
  const initial = createCareerDocument();
  const section = initial.sections[0];
  const first = createEntry("experience");
  const second = createEntry("experience");
  section.entries.push(first, second);
  const head = await writer.replace(
    await writer.load(createCareerDocument()),
    initial,
  );
  const stored = summaryDraft(head, "Stored recovery");
  const edited = summaryDraft(head, "Previous active version");
  await writer.writeDraft(stored);
  await writer.writeDraft(edited);
  const controller = await controllerOwner();
  controller.restore(edited);
  controller.change({
    ...head.document.summary,
    wording: { "en-US": "Latest active version" },
  });
  controller.open(`entries/${section.id}`, "order");
  controller.change([second.id, first.id], "order");
  const settings = await openData(controller);

  const blobs: Blob[] = [];
  vi.spyOn(URL, "createObjectURL").mockImplementation((value) => {
    if (value instanceof Blob) blobs.push(value);
    return "blob:test-recovery";
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await settings.getByRole("button", { name: "Export unsaved drafts" }).click();
  const exported = await Promise.all(
    blobs.map(async (blob) => JSON.parse(await blob.text())),
  );
  const drafts: CareerDraft[] = exported
    .filter((file) => file.format === "verso.recovery")
    .flatMap((file) => file.drafts);
  expect(drafts).toHaveLength(3);
  expect(drafts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        draftId: stored.draftId,
        values: stored.values,
      }),
      expect.objectContaining({
        draftId: edited.draftId,
        values: {
          ...head.document.summary,
          wording: { "en-US": "Latest active version" },
        },
      }),
      expect.objectContaining({
        scope: `entries/${section.id}`,
        values: [second.id, first.id],
      }),
    ]),
  );
  expect(await writer.load()).toEqual(head);
});
