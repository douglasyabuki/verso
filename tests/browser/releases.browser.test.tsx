import { type ReactNode, useSyncExternalStore } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";

import { ReleasesPanel } from "@/components/account/releases-panel";
import { ReleaseControl } from "@/components/career/release-dialog";
import type { Releases } from "@/hooks/releases/use-releases";
import type { PreviewOutput } from "@/stores/output/preview-coordinator";
import { ReleaseStore } from "@/stores/releases/release-store";
import type {
  PublicLinkSummary,
  ReleaseList,
  ReleaseSummary,
} from "@/types-and-constants/releases";

afterEach(async () => {
  await cleanup();
});

const token = "T".repeat(43);

function release(number: number, patch: Partial<ReleaseSummary> = {}) {
  return {
    id: `00000000-0000-4000-8000-00000000000${number}`,
    number,
    resumeId: "resume",
    revision: number,
    generation: 0,
    fingerprint: `f${number}`,
    locale: "en-US",
    templateId: "yabuki-reference@1.0.3",
    runtimeId: "runtime",
    settingsSha256: "s",
    sourceSha256: "s",
    pdfSha256: "p",
    bytes: 1024,
    fileName: `ana-v${number}.pdf`,
    revokedAt: null,
    createdAt: "2026-11-16T10:00:00.000Z",
    ...patch,
  } satisfies ReleaseSummary;
}

function linkWith(releases: ReleaseSummary[], latest: string | null) {
  return {
    id: "10000000-0000-4000-8000-000000000000",
    token,
    resumeId: "resume",
    resumeName: "Application",
    autoRelease: false,
    latestReleaseId: latest,
    createdAt: "2026-11-16T10:00:00.000Z",
    releases,
  } satisfies PublicLinkSummary;
}

type Call = { method: string; path: string; body?: unknown };

/** Real ReleaseStore over a scripted server that records requests. */
async function mounted(initial: ReleaseList) {
  const calls: Call[] = [];
  let current = initial;
  const store = new ReleaseStore(
    { userId: "u", sessionId: "s" },
    {
      createId: () => "20000000-0000-4000-8000-000000000000",
      fetch: async (input, init) => {
        const path = String(input);
        const method = init?.method ?? "GET";
        const body =
          init?.body instanceof FormData
            ? JSON.parse(String(init.body.get("metadata")))
            : init?.body
              ? JSON.parse(String(init.body))
              : undefined;
        calls.push({ method, path, body });
        if (method === "POST") {
          const next = release(2);
          current = {
            links: [linkWith([next, ...initial.links[0].releases], next.id)],
            usage: { links: 1, bytes: 2048 },
          };
          return Response.json({
            list: current,
            linkId: current.links[0].id,
            releaseId: next.id,
            replayed: false,
            unchanged: false,
          });
        }
        return Response.json(current);
      },
    },
  );
  await store.load();
  calls.length = 0;
  const releases = (): Releases => ({ store, state: store.getSnapshot() });
  return { store, calls, releases };
}

/** Re-render children from the store like the workspace's release hook. */
function Live({
  store,
  children,
}: {
  store: ReleaseStore;
  children: (releases: Releases) => ReactNode;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return children({ store, state });
}

const output: PreviewOutput = {
  tag: { generation: 0, resumeId: "resume", fingerprint: "f2" },
  revision: 2,
  resumeName: "Application",
  language: "en-US",
  targetPages: 1,
  url: "blob:x",
  key: "k",
  bytes: new TextEncoder().encode("%PDF-1.7\n%%EOF"),
  template: "yabuki-reference@1.0.3",
};

describe("release dialog", () => {
  it("reviews what becomes public and uploads only after Release", async () => {
    const { calls, store } = await mounted({
      links: [linkWith([release(1)], release(1).id)],
      usage: { links: 1, bytes: 1024 },
    });
    await render(
      <Live store={store}>
        {(releases) => (
          <ReleaseControl releases={releases} output={output} workspaceId="w" />
        )}
      </Live>,
    );
    await page.getByRole("button", { name: "Release…" }).click();
    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveTextContent("Unlisted is not private");
    await expect.element(dialog).toHaveTextContent("Existing link · 1 release");
    await expect
      .element(
        page.getByRole("checkbox", { name: "Make this the latest version" }),
      )
      .toBeChecked();
    await page.getByRole("button", { name: "Cancel" }).click();
    expect(calls).toEqual([]);

    await page.getByRole("button", { name: "Release…" }).click();
    await page
      .getByRole("checkbox", { name: "Make this the latest version" })
      .click();
    await page.getByRole("button", { name: "Release", exact: true }).click();
    await expect
      .element(page.getByRole("dialog"))
      .toHaveTextContent("PDF released");
    await expect
      .element(page.getByRole("button", { name: "Copy link to release 2" }))
      .toBeVisible();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      method: "POST",
      path: "/api/account/releases",
      body: {
        resumeId: "resume",
        workspaceId: "w",
        revision: 2,
        generation: 0,
        fingerprint: "f2",
        templateId: "yabuki-reference@1.0.3",
        advance: false,
        automatic: false,
      },
    });
  });

  it("disables release without a current preview and hides it for guests", async () => {
    const { releases } = await mounted({
      links: [],
      usage: { links: 0, bytes: 0 },
    });
    await render(
      <ReleaseControl releases={releases()} output={null} workspaceId="w" />,
    );
    await expect
      .element(page.getByRole("button", { name: "Release…" }))
      .toBeDisabled();
    await cleanup();
    await render(
      <ReleaseControl releases={null} output={output} workspaceId="w" />,
    );
    expect(page.getByRole("button", { name: "Release…" }).query()).toBeNull();
  });
});

describe("public PDFs panel", () => {
  async function renderPanel() {
    const list = {
      links: [
        linkWith(
          [
            release(3),
            release(2, { revokedAt: "2026-11-16T11:00:00.000Z" }),
            release(1),
          ],
          release(3).id,
        ),
      ],
      usage: { links: 1, bytes: 3072 },
    };
    const mount = await mounted(list);
    await render(
      <Live store={mount.store}>
        {(releases) => (
          <ReleasesPanel releases={releases} session={undefined} resumes={[]} />
        )}
      </Live>,
    );
    return mount;
  }

  it("lists history with latest and revoked states, orphaned resumes, and usage", async () => {
    await renderPanel();
    const link = page.getByRole("region", {
      name: "Public link for Deleted resume (Application)",
    });
    await expect.element(link).toHaveTextContent(`/pdf/${token}`);
    await expect
      .element(page.getByLabelText("Release storage usage"))
      .toHaveTextContent("1 of 10 links");
    const latest = page.getByRole("listitem", { name: "Release 3" });
    await expect.element(latest).toHaveTextContent("Latest");
    expect(latest.getByRole("button", { name: "Delete" }).query()).toBeNull();
    expect(latest.getByRole("button", { name: "Revoke" }).query()).toBeNull();
    const revoked = page.getByRole("listitem", { name: "Release 2" });
    await expect.element(revoked).toHaveTextContent("Revoked");
    await expect
      .element(revoked.getByRole("button", { name: "Restore" }))
      .toBeVisible();
    expect(
      revoked.getByRole("button", { name: "Make latest" }).query(),
    ).toBeNull();
    const older = page.getByRole("listitem", { name: "Release 1" });
    const labels = [...older.element().querySelectorAll("button")].map(
      (button) => button.textContent,
    );
    expect(labels.at(-1)).toBe("Delete");
  });

  it("rolls back, toggles automatic release, and confirms irreversible actions", async () => {
    const { calls } = await renderPanel();
    await page
      .getByRole("listitem", { name: "Release 1" })
      .getByRole("button", { name: "Make latest" })
      .click();
    await page
      .getByRole("checkbox", { name: "Release automatically after Save" })
      .click();
    await page
      .getByRole("listitem", { name: "Release 1" })
      .getByRole("button", { name: "Delete" })
      .click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await page
      .getByRole("region", { name: /Public link for/ })
      .getByRole("button", { name: "Revoke link" })
      .click();
    await expect
      .element(page.getByRole("alertdialog"))
      .toHaveTextContent("every numbered link stop working");
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Revoke link" })
      .click();
    await expect.poll(() => calls.length).toBe(3);
    expect(calls).toEqual([
      {
        method: "PATCH",
        path: "/api/account/releases/links/10000000-0000-4000-8000-000000000000",
        body: { action: "set-latest", releaseId: release(1).id },
      },
      {
        method: "PATCH",
        path: "/api/account/releases/links/10000000-0000-4000-8000-000000000000",
        body: { action: "auto-release", enabled: true },
      },
      {
        method: "DELETE",
        path: "/api/account/releases/links/10000000-0000-4000-8000-000000000000",
        body: undefined,
      },
    ]);
  });

  it("explains sign-in for guests without loading anything", async () => {
    await render(
      <ReleasesPanel
        releases={null}
        session={{ kind: "guest", providers: { github: true, google: false } }}
        resumes={[]}
      />,
    );
    await expect
      .element(page.getByText(/Guest workspaces are never published/))
      .toBeVisible();
  });
});
