import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, expect, it } from "vitest";

import {
  createRelease,
  deleteRelease,
  listReleases,
  readPublicPdf,
  revokeLink,
  updateLink,
  updateRelease,
} from "@/lib/account/release-repository";
import {
  createUser,
  startTestDatabase,
  type TestDatabase,
} from "@/tests/support/db/database";
import {
  pdf,
  readyDocument,
  releaseMetadata,
  seedWorkspace,
} from "@/tests/support/db/releases";
import { RELEASE_LIMITS } from "@/types-and-constants/releases";

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase();
});

afterAll(async () => {
  await database?.close();
});

async function owner() {
  const user = await createUser(database.prisma, randomUUID());
  return { user, head: await seedWorkspace(database, user) };
}

it("stores an immutable release, creates one link, and serves latest and pinned bytes", async () => {
  const { user, head } = await owner();
  const bytes = pdf("first");
  const result = await createRelease(user, releaseMetadata(head), bytes);
  expect(result).toMatchObject({ replayed: false, unchanged: false });
  const [link] = result.list.links;
  expect(link.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(link.latestReleaseId).toBe(result.releaseId);
  expect(link.releases[0]).toMatchObject({
    number: 1,
    locale: "en-US",
    templateId: "yabuki-reference@1.0.3",
    fileName: "ana-souza-en-us-v1.pdf",
    bytes: bytes.byteLength,
    revokedAt: null,
  });
  expect(link.releases[0].runtimeId).toContain("XeTeX");
  expect(link.releases[0].settingsSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(result.list.usage).toEqual({ links: 1, bytes: bytes.byteLength });
  expect((await readPublicPdf(link.token))?.pdf).toEqual(bytes);
  expect((await readPublicPdf(link.token, 1))?.pdf).toEqual(bytes);
  expect(await readPublicPdf(link.token, 2)).toBeNull();
});

it("replays a retried release once and rejects a reused ID with different content", async () => {
  const { user, head } = await owner();
  const metadata = releaseMetadata(head);
  const first = await createRelease(user, metadata, pdf("a"));
  const retry = await createRelease(user, metadata, pdf("a"));
  expect(retry).toMatchObject({ replayed: true, releaseId: first.releaseId });
  expect(retry.list.links[0].releases).toHaveLength(1);
  await expect(createRelease(user, metadata, pdf("b"))).rejects.toMatchObject({
    code: "operation_mismatch",
  });
});

it("rejects stale, replaced, unready, foreign-template, and non-PDF releases without writing", async () => {
  const { user, head } = await owner();
  const changed = readyDocument("Ana Changed");
  await seedWorkspace(database, user, changed, 2);
  const current = {
    ...head,
    workspaceId: (await database.prisma.accountWorkspace.findUniqueOrThrow({
      where: { userId: user },
    }))!.workspaceId,
    revision: 2,
    document: changed,
  };
  await expect(
    createRelease(
      user,
      releaseMetadata(current, {
        fingerprint: releaseMetadata(head).fingerprint,
      }),
      pdf(),
    ),
  ).rejects.toMatchObject({ code: "conflict" });
  await expect(
    createRelease(user, releaseMetadata(head), pdf()),
  ).rejects.toMatchObject({ code: "replaced" });
  await expect(
    createRelease(user, releaseMetadata(current, { generation: 1 }), pdf()),
  ).rejects.toMatchObject({ code: "replaced" });
  await expect(
    createRelease(user, releaseMetadata(current, { revision: 3 }), pdf()),
  ).rejects.toMatchObject({ code: "invalid" });
  await expect(
    createRelease(
      user,
      releaseMetadata(current, { templateId: "other@1.0.0" }),
      pdf(),
    ),
  ).rejects.toMatchObject({ code: "invalid" });
  await expect(
    createRelease(
      user,
      releaseMetadata(current),
      new TextEncoder().encode("<html>not a pdf</html>"),
    ),
  ).rejects.toMatchObject({ code: "invalid" });
  const oversized = new Uint8Array(RELEASE_LIMITS.pdfBytes + 1);
  await expect(
    createRelease(user, releaseMetadata(current), oversized),
  ).rejects.toMatchObject({ code: "payload_too_large" });
  const unready = readyDocument("");
  await seedWorkspace(database, user, unready, 3);
  const row = await database.prisma.accountWorkspace.findUniqueOrThrow({
    where: { userId: user },
  });
  await expect(
    createRelease(
      user,
      {
        ...releaseMetadata(current),
        workspaceId: row.workspaceId,
        revision: 3,
      },
      pdf(),
    ),
  ).rejects.toMatchObject({ code: "conflict" });
  await expect(
    createRelease(
      user,
      {
        ...releaseMetadata(current),
        workspaceId: row.workspaceId,
        resumeId: "gone",
      },
      pdf(),
    ),
  ).rejects.toMatchObject({ code: "not_found" });
  expect(await listReleases(user)).toEqual({
    links: [],
    usage: { links: 0, bytes: 0 },
  });
});

it("accepts a later revision whose output is unchanged and keeps pinned URLs while latest advances", async () => {
  const { user, head } = await owner();
  const first = await createRelease(user, releaseMetadata(head), pdf("one"));
  const token = first.list.links[0].token;
  await database.prisma.accountWorkspace.update({
    where: { userId: user },
    data: { revision: 5 },
  });
  const second = await createRelease(
    user,
    releaseMetadata({ ...head, revision: 5 }),
    pdf("two"),
  );
  expect(second.list.links[0].releases.map((item) => item.number)).toEqual([
    2, 1,
  ]);
  expect((await readPublicPdf(token))?.pdf).toEqual(pdf("two"));
  expect((await readPublicPdf(token, 1))?.pdf).toEqual(pdf("one"));
  const held = await createRelease(
    user,
    releaseMetadata({ ...head, revision: 5 }, { advance: false }),
    pdf("three"),
  );
  expect(held.list.links[0].latestReleaseId).toBe(second.releaseId);
  expect((await readPublicPdf(token))?.pdf).toEqual(pdf("two"));
  expect((await readPublicPdf(token, 3))?.pdf).toEqual(pdf("three"));
});

it("skips an automatic release whose output already matches latest", async () => {
  const { user, head } = await owner();
  const first = await createRelease(user, releaseMetadata(head), pdf("one"));
  const automatic = await createRelease(
    user,
    releaseMetadata(head, { automatic: true }),
    pdf("recompiled"),
  );
  expect(automatic).toMatchObject({
    unchanged: true,
    releaseId: first.releaseId,
  });
  expect(automatic.list.links[0].releases).toHaveLength(1);
});

it("rolls back latest, guards revoking or deleting latest, restores, deletes, and revokes links", async () => {
  const { user, head } = await owner();
  const one = await createRelease(user, releaseMetadata(head), pdf("one"));
  const two = await createRelease(user, releaseMetadata(head), pdf("two"));
  const link = two.list.links[0];
  await expect(
    updateRelease(user, two.releaseId, { action: "revoke" }),
  ).rejects.toMatchObject({ code: "conflict" });
  await expect(deleteRelease(user, two.releaseId)).rejects.toMatchObject({
    code: "conflict",
  });
  const rolled = await updateLink(user, link.id, {
    action: "set-latest",
    releaseId: one.releaseId,
  });
  expect(rolled.links[0].latestReleaseId).toBe(one.releaseId);
  expect((await readPublicPdf(link.token))?.pdf).toEqual(pdf("one"));
  await updateRelease(user, two.releaseId, { action: "revoke" });
  expect(await readPublicPdf(link.token, 2)).toBeNull();
  await expect(
    updateLink(user, link.id, {
      action: "set-latest",
      releaseId: two.releaseId,
    }),
  ).rejects.toMatchObject({ code: "conflict" });
  await updateRelease(user, two.releaseId, { action: "restore" });
  expect((await readPublicPdf(link.token, 2))?.pdf).toEqual(pdf("two"));
  const deleted = await deleteRelease(user, two.releaseId);
  expect(deleted.links[0].releases.map((item) => item.number)).toEqual([1]);
  expect(await readPublicPdf(link.token, 2)).toBeNull();
  const toggled = await updateLink(user, link.id, {
    action: "auto-release",
    enabled: true,
  });
  expect(toggled.links[0].autoRelease).toBe(true);
  expect(await revokeLink(user, link.id)).toEqual({
    links: [],
    usage: { links: 0, bytes: 0 },
  });
  expect(await readPublicPdf(link.token)).toBeNull();
  expect(await readPublicPdf(link.token, 1)).toBeNull();
  const fresh = await createRelease(user, releaseMetadata(head), pdf("new"));
  expect(fresh.list.links[0].token).not.toBe(link.token);
  expect(fresh.list.links[0].releases[0].number).toBe(1);
});

it("isolates owners: another account cannot list, change, or delete releases", async () => {
  const a = await owner();
  const b = await owner();
  const release = await createRelease(a.user, releaseMetadata(a.head), pdf());
  const link = release.list.links[0];
  expect((await listReleases(b.user)).links).toEqual([]);
  await expect(
    updateLink(b.user, link.id, { action: "auto-release", enabled: true }),
  ).rejects.toMatchObject({ code: "not_found" });
  await expect(revokeLink(b.user, link.id)).rejects.toMatchObject({
    code: "not_found",
  });
  await expect(
    updateRelease(b.user, release.releaseId, { action: "restore" }),
  ).rejects.toMatchObject({ code: "not_found" });
  await expect(deleteRelease(b.user, release.releaseId)).rejects.toMatchObject({
    code: "not_found",
  });
  const otherLink = await createRelease(b.user, releaseMetadata(b.head), pdf());
  await expect(
    updateLink(a.user, link.id, {
      action: "set-latest",
      releaseId: otherLink.releaseId,
    }),
  ).rejects.toMatchObject({ code: "not_found" });
  expect((await listReleases(a.user)).links[0].releases).toHaveLength(1);
});

it("refuses releases beyond each quota without pruning", async () => {
  const { user, head } = await owner();
  const first = await createRelease(user, releaseMetadata(head), pdf("0"));
  await database.prisma.publicRelease.createMany({
    data: Array.from(
      { length: RELEASE_LIMITS.releasesPerLink - 1 },
      (_, i) => ({
        id: randomUUID(),
        linkId: first.linkId,
        userId: user,
        number: i + 2,
        operationId: randomUUID(),
        requestHash: "seed",
        resumeId: "resume",
        workspaceId: head.workspaceId,
        revision: 1,
        generation: 0,
        fingerprint: "seed",
        sourceSha256: "seed",
        locale: "en-US",
        templateId: "yabuki-reference@1.0.3",
        runtimeId: "seed",
        settingsSha256: "seed",
        pdfSha256: "seed",
        bytes: 1,
        fileName: "seed.pdf",
        pdf: new Uint8Array([1]),
      }),
    ),
  });
  await expect(
    createRelease(user, releaseMetadata(head), pdf("over")),
  ).rejects.toMatchObject({ code: "quota_exceeded" });

  const linksOwner = await owner();
  await database.prisma.publicLink.createMany({
    data: Array.from({ length: RELEASE_LIMITS.links }, (_, i) => ({
      id: randomUUID(),
      userId: linksOwner.user,
      token: randomUUID(),
      resumeId: `other-${i}`,
      resumeName: "Other",
    })),
  });
  await expect(
    createRelease(linksOwner.user, releaseMetadata(linksOwner.head), pdf()),
  ).rejects.toMatchObject({ code: "quota_exceeded" });

  const bytesOwner = await owner();
  const seeded = await createRelease(
    bytesOwner.user,
    releaseMetadata(bytesOwner.head),
    pdf(),
  );
  await database.prisma.publicRelease.update({
    where: { id: seeded.releaseId },
    data: { bytes: RELEASE_LIMITS.accountBytes },
  });
  await expect(
    createRelease(bytesOwner.user, releaseMetadata(bytesOwner.head), pdf("x")),
  ).rejects.toMatchObject({ code: "quota_exceeded" });
  expect((await listReleases(bytesOwner.user)).links[0].releases).toHaveLength(
    1,
  );
});

it("keeps the old latest and stores nothing when the release insert fails", async () => {
  const { user, head } = await owner();
  const first = await createRelease(user, releaseMetadata(head), pdf("kept"));
  await database.db.exec(`
    CREATE OR REPLACE FUNCTION fail_release() RETURNS trigger AS $$
    BEGIN
      IF NEW."fileName" LIKE '%-v2.pdf' THEN
        RAISE EXCEPTION 'injected release failure';
      END IF;
      RETURN NEW;
    END $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS fail_release ON public_release;
    CREATE TRIGGER fail_release BEFORE INSERT ON public_release
      FOR EACH ROW EXECUTE FUNCTION fail_release();
  `);
  try {
    await expect(
      createRelease(user, releaseMetadata(head), pdf("lost")),
    ).rejects.toThrow();
  } finally {
    await database.db.exec(
      "DROP TRIGGER IF EXISTS fail_release ON public_release;",
    );
  }
  const list = await listReleases(user);
  expect(list.links[0].latestReleaseId).toBe(first.releaseId);
  expect(list.links[0].releases).toHaveLength(1);
  expect((await readPublicPdf(list.links[0].token))?.pdf).toEqual(pdf("kept"));
  const next = await createRelease(user, releaseMetadata(head), pdf("next"));
  expect(next.list.links[0].releases[0].number).toBe(2);
});
