import { expect, it } from "vitest";

import {
  automaticReleaseKey,
  shouldReleaseAutomatically,
} from "@/lib/releases/automatic";
import { releaseFileName } from "@/lib/releases/file-name";
import type { PreviewOutput } from "@/stores/output/preview-coordinator";
import { ReleaseStore } from "@/stores/releases/release-store";
import type {
  PublicLinkSummary,
  ReleaseList,
} from "@/types-and-constants/releases";

it("builds safe release file names from the rendered full name", () => {
  expect(releaseFileName("Ana São & Silva", "pt-BR", 3)).toBe(
    "ana-sao-silva-pt-br-v3.pdf",
  );
  expect(releaseFileName("  ", "en-US", 1)).toBe("resume-en-us-v1.pdf");
  expect(releaseFileName('"; rm -rf / <x>', "en-US", 2)).toBe(
    "rm-rf-x-en-us-v2.pdf",
  );
  expect(releaseFileName("a".repeat(200), "en-US", 1)).toBe(
    `${"a".repeat(60)}-en-us-v1.pdf`,
  );
});

const output = { resumeId: "resume", generation: 2, fingerprint: "f2" };

function link(patch: Partial<PublicLinkSummary> = {}): PublicLinkSummary {
  return {
    id: "link",
    token: "t",
    resumeId: "resume",
    resumeName: "Application",
    autoRelease: true,
    latestReleaseId: "r1",
    createdAt: "2026-11-16T00:00:00.000Z",
    releases: [
      {
        id: "r1",
        number: 1,
        resumeId: "resume",
        revision: 1,
        generation: 2,
        fingerprint: "f1",
        locale: "en-US",
        templateId: "yabuki-reference@1.0.3",
        runtimeId: "x",
        settingsSha256: "s",
        sourceSha256: "s",
        pdfSha256: "p",
        bytes: 1,
        fileName: "a.pdf",
        revokedAt: null,
        createdAt: "2026-11-16T00:00:00.000Z",
      },
    ],
    ...patch,
  };
}

it("releases automatically only for opted-in account links with new committed output, once per output", () => {
  const base = {
    accountMode: true,
    link: link(),
    output,
    generation: 2,
    attempted: new Set<string>(),
  };
  expect(shouldReleaseAutomatically(base)).toBe(true);
  expect(shouldReleaseAutomatically({ ...base, accountMode: false })).toBe(
    false,
  );
  expect(
    shouldReleaseAutomatically({ ...base, link: link({ autoRelease: false }) }),
  ).toBe(false);
  expect(shouldReleaseAutomatically({ ...base, link: undefined })).toBe(false);
  expect(shouldReleaseAutomatically({ ...base, output: undefined })).toBe(
    false,
  );
  expect(
    shouldReleaseAutomatically({
      ...base,
      output: { ...output, resumeId: "other" },
    }),
  ).toBe(false);
  expect(shouldReleaseAutomatically({ ...base, generation: 3 })).toBe(false);
  expect(
    shouldReleaseAutomatically({
      ...base,
      output: { ...output, fingerprint: "f1" },
    }),
  ).toBe(false);
  expect(
    shouldReleaseAutomatically({
      ...base,
      attempted: new Set([automaticReleaseKey("link", output)]),
    }),
  ).toBe(false);
});

const list: ReleaseList = { links: [], usage: { links: 0, bytes: 0 } };

function previewOutput(): PreviewOutput {
  return {
    tag: { generation: 0, resumeId: "resume", fingerprint: "f" },
    revision: 4,
    resumeName: "Application",
    language: "en-US",
    targetPages: 1,
    url: "blob:x",
    key: "k",
    bytes: new TextEncoder().encode("%PDF-1.7 %%EOF"),
    template: "yabuki-reference@1.0.3",
  };
}

it("retries an unanswered release with the same operation ID and prepares a new one after success", async () => {
  const sent: { operationId: string; session: string | null }[] = [];
  let fail = true;
  const store = new ReleaseStore(
    { userId: "u", sessionId: "s1" },
    {
      createId: (() => {
        let next = 0;
        return () => `op-${(next += 1)}`;
      })(),
      fetch: async (_path, init) => {
        const form = init?.body as FormData;
        sent.push({
          operationId: JSON.parse(String(form.get("metadata"))).operationId,
          session: new Headers(init?.headers).get("X-Verso-Session"),
        });
        if (fail) throw new TypeError("network");
        return Response.json({
          list,
          linkId: "l",
          releaseId: "r",
          replayed: false,
          unchanged: false,
        });
      },
    },
  );
  const input = {
    output: previewOutput(),
    workspaceId: "w",
    advance: true,
    automatic: false,
  };
  await expect(store.release(input)).rejects.toMatchObject({ code: "offline" });
  expect(store.getSnapshot()).toMatchObject({ uncertain: true });
  fail = false;
  await store.release(input);
  await store.release(input);
  expect(sent).toEqual([
    { operationId: "op-1", session: "s1" },
    { operationId: "op-1", session: "s1" },
    { operationId: "op-2", session: "s1" },
  ]);
  expect(store.getSnapshot()).toMatchObject({
    uncertain: false,
    error: null,
    list,
  });
});

it("reports rejected releases with the server message and signals invalid sessions", async () => {
  let invalid = 0;
  const store = new ReleaseStore(
    { userId: "u", sessionId: "s1" },
    {
      onSessionInvalid: () => (invalid += 1),
      fetch: async () =>
        Response.json(
          { code: "session_mismatch", message: "Reload to continue." },
          { status: 403 },
        ),
    },
  );
  await expect(store.load()).rejects.toMatchObject({
    code: "session_mismatch",
  });
  expect(invalid).toBe(1);
  expect(store.getSnapshot().error).toBe("Reload to continue.");
});
