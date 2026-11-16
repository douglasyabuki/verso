import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";

import { getPrisma } from "@/lib/account/prisma";
import {
  AccountStoreError,
  lockOwner,
  requestHash,
  TRANSACTION,
} from "@/lib/account/workspace-repository";
import { renderCareerOutput, resumeFullName } from "@/lib/career/output";
import type { Prisma } from "@/lib/generated/prisma/client";
import { releaseFileName } from "@/lib/releases/file-name";
import compilerLock from "@/tools/compiler-proof/resources.lock.json";
import type { CareerDocument } from "@/types-and-constants/career";
import type {
  CreateReleaseResponse,
  LinkAction,
  PublicLinkSummary,
  ReleaseAction,
  ReleaseList,
  ReleaseRequestMetadata,
} from "@/types-and-constants/releases";
import { RELEASE_LIMITS } from "@/types-and-constants/releases";

type Transaction = Prisma.TransactionClient;

/** Compiler runtime this deployment ships, from the locked engine and format inputs. */
export const RELEASE_RUNTIME_ID = `${compilerLock.engine.version}; format ${compilerLock.format.sha256.slice(0, 16)}`;

const sha256 = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");

/** Serialize JSON with sorted object keys so equal settings hash equally. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}

const latin1 = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");

/** Check the PDF container markers and size before any database work.
 * @param pdf Uploaded bytes.
 * @returns Completion; throws `payload_too_large` or `invalid`.
 * @example assertPdf(bytes)
 */
export function assertPdf(pdf: Uint8Array): void {
  if (pdf.byteLength > RELEASE_LIMITS.pdfBytes)
    throw new AccountStoreError(
      "payload_too_large",
      "This PDF is larger than the 4 MiB release limit.",
    );
  if (
    pdf.byteLength < 16 ||
    latin1(pdf.subarray(0, 5)) !== "%PDF-" ||
    !latin1(pdf.subarray(Math.max(0, pdf.byteLength - 1024))).includes("%%EOF")
  )
    throw new AccountStoreError("invalid", "The uploaded file is not a PDF.");
}

const releaseSelect = {
  id: true,
  number: true,
  resumeId: true,
  revision: true,
  generation: true,
  fingerprint: true,
  locale: true,
  templateId: true,
  runtimeId: true,
  settingsSha256: true,
  sourceSha256: true,
  pdfSha256: true,
  bytes: true,
  fileName: true,
  revokedAt: true,
  createdAt: true,
} as const;

async function readList(
  db: Transaction | ReturnType<typeof getPrisma>,
  userId: string,
): Promise<ReleaseList> {
  const links = await db.publicLink.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      releases: { select: releaseSelect, orderBy: { number: "desc" } },
    },
  });
  const summaries: PublicLinkSummary[] = links.map((link) => ({
    id: link.id,
    token: link.token,
    resumeId: link.resumeId,
    resumeName: link.resumeName,
    autoRelease: link.autoRelease,
    latestReleaseId: link.latestReleaseId,
    createdAt: link.createdAt.toISOString(),
    releases: link.releases.map((release) => ({
      ...release,
      revokedAt: release.revokedAt?.toISOString() ?? null,
      createdAt: release.createdAt.toISOString(),
    })),
  }));
  return {
    links: summaries,
    usage: {
      links: summaries.length,
      bytes: summaries.reduce(
        (total, link) =>
          total +
          link.releases.reduce((sum, release) => sum + release.bytes, 0),
        0,
      ),
    },
  };
}

/** List the owner's public links, release metadata (never bytes), and quota usage.
 * @param userId Session-derived owner.
 * @returns {Promise<ReleaseList>} One read of links with their releases.
 * @example accountJson(await listReleases(userId))
 */
export async function listReleases(userId: string): Promise<ReleaseList> {
  return readList(getPrisma(), userId);
}

/** Store one reviewed PDF release and optionally advance its link's latest URL.
 * In one transaction under the owner lock: replay a matching receipt, re-render the
 * resume from the committed account workspace and require the same generation and
 * output fingerprint, enforce quotas, create the link on first release, insert the
 * immutable release, and move `latest`. Any failure leaves links and latest unchanged.
 * @param userId Session-derived owner.
 * @param metadata Validated release metadata.
 * @param pdf Compiled PDF bytes.
 * @returns {Promise<CreateReleaseResponse>} Updated list and the stored, replayed, or unchanged release.
 * @example await createRelease(userId, metadata, bytes)
 */
export async function createRelease(
  userId: string,
  metadata: ReleaseRequestMetadata,
  pdf: Uint8Array,
): Promise<CreateReleaseResponse> {
  assertPdf(pdf);
  const pdfSha256 = sha256(pdf);
  const hash = requestHash(canonicalJson({ ...metadata, pdfSha256 }));
  return getPrisma().$transaction(async (tx) => {
    await lockOwner(tx, userId);
    const existing = await tx.publicRelease.findUnique({
      where: {
        userId_operationId: { userId, operationId: metadata.operationId },
      },
      select: { id: true, linkId: true, requestHash: true },
    });
    if (existing) {
      if (existing.requestHash !== hash)
        throw new AccountStoreError(
          "operation_mismatch",
          "This release ID was already used for a different release.",
        );
      return {
        list: await readList(tx, userId),
        linkId: existing.linkId,
        releaseId: existing.id,
        replayed: true,
        unchanged: false,
      };
    }
    const workspace = await tx.accountWorkspace.findUnique({
      where: { userId },
    });
    if (
      !workspace ||
      workspace.workspaceId !== metadata.workspaceId ||
      workspace.generation !== metadata.generation
    )
      throw new AccountStoreError(
        "replaced",
        "Your account workspace was replaced. Refresh the preview and review again.",
      );
    if (metadata.revision > workspace.revision)
      throw new AccountStoreError(
        "invalid",
        "This PDF claims a revision that was never saved.",
      );
    const document = workspace.document as CareerDocument;
    const resume = document.resumes.find(
      (item) => item.id === metadata.resumeId,
    );
    if (!resume)
      throw new AccountStoreError("not_found", "This resume no longer exists.");
    let rendered: { source: string; fingerprint: string };
    try {
      rendered = renderCareerOutput(
        document,
        metadata.resumeId,
        metadata.revision,
      );
    } catch {
      throw new AccountStoreError(
        "conflict",
        "This resume is not ready for output in your saved account workspace.",
      );
    }
    if (rendered.fingerprint !== metadata.fingerprint)
      throw new AccountStoreError(
        "conflict",
        "Your saved resume changed since this PDF was compiled. Refresh the preview and review again.",
      );
    if (metadata.templateId !== resume.template)
      throw new AccountStoreError(
        "invalid",
        "This PDF was compiled with a different template.",
      );
    const sourceSha256 = sha256(
      rendered.source.replace(
        `pdfsubject={Verso revision ${metadata.revision};`,
        "pdfsubject={Verso revision;",
      ),
    );
    let link = await tx.publicLink.findUnique({
      where: { userId_resumeId: { userId, resumeId: metadata.resumeId } },
    });
    if (metadata.automatic && link?.latestReleaseId) {
      const latest = await tx.publicRelease.findUnique({
        where: { id: link.latestReleaseId },
        select: { sourceSha256: true },
      });
      if (latest?.sourceSha256 === sourceSha256)
        return {
          list: await readList(tx, userId),
          linkId: link.id,
          releaseId: link.latestReleaseId,
          replayed: false,
          unchanged: true,
        };
    }
    const usage = await tx.publicRelease.aggregate({
      where: { userId },
      _sum: { bytes: true },
    });
    if ((usage._sum.bytes ?? 0) + pdf.byteLength > RELEASE_LIMITS.accountBytes)
      throw new AccountStoreError(
        "quota_exceeded",
        "Release storage is full (50 MiB). Delete older releases to publish again.",
      );
    if (!link) {
      if (
        (await tx.publicLink.count({ where: { userId } })) >=
        RELEASE_LIMITS.links
      )
        throw new AccountStoreError(
          "quota_exceeded",
          `You can keep at most ${RELEASE_LIMITS.links} public links. Revoke one to publish another resume.`,
        );
      link = await tx.publicLink.create({
        data: {
          id: randomUUID(),
          userId,
          token: randomBytes(32).toString("base64url"),
          resumeId: metadata.resumeId,
          resumeName: resume.name,
        },
      });
    } else if (
      (await tx.publicRelease.count({ where: { linkId: link.id } })) >=
      RELEASE_LIMITS.releasesPerLink
    )
      throw new AccountStoreError(
        "quota_exceeded",
        `This link already keeps ${RELEASE_LIMITS.releasesPerLink} releases. Delete older releases to publish again.`,
      );
    const releaseId = randomUUID();
    await tx.publicRelease.create({
      data: {
        id: releaseId,
        linkId: link.id,
        userId,
        number: link.nextNumber,
        operationId: metadata.operationId,
        requestHash: hash,
        resumeId: metadata.resumeId,
        workspaceId: metadata.workspaceId,
        revision: metadata.revision,
        generation: metadata.generation,
        fingerprint: metadata.fingerprint,
        sourceSha256,
        locale: resume.language,
        templateId: resume.template,
        runtimeId: RELEASE_RUNTIME_ID,
        settingsSha256: sha256(canonicalJson(resume.layout)),
        pdfSha256,
        bytes: pdf.byteLength,
        fileName: releaseFileName(
          resumeFullName(document, resume.id),
          resume.language,
          link.nextNumber,
        ),
        pdf: Uint8Array.from(pdf),
      },
    });
    await tx.publicLink.update({
      where: { id: link.id },
      data: {
        nextNumber: link.nextNumber + 1,
        resumeName: resume.name,
        ...(metadata.advance ? { latestReleaseId: releaseId } : {}),
      },
    });
    return {
      list: await readList(tx, userId),
      linkId: link.id,
      releaseId,
      replayed: false,
      unchanged: false,
    };
  }, TRANSACTION);
}

async function ownedLink(tx: Transaction, userId: string, linkId: string) {
  const link = await tx.publicLink.findFirst({ where: { id: linkId, userId } });
  if (!link)
    throw new AccountStoreError("not_found", "This public link was not found.");
  return link;
}

async function ownedRelease(
  tx: Transaction,
  userId: string,
  releaseId: string,
) {
  const release = await tx.publicRelease.findFirst({
    where: { id: releaseId, userId },
    select: { id: true, linkId: true, revokedAt: true },
  });
  if (!release)
    throw new AccountStoreError("not_found", "This release was not found.");
  return release;
}

const notLatest = (
  link: { latestReleaseId: string | null },
  releaseId: string,
  verb: string,
) => {
  if (link.latestReleaseId === releaseId)
    throw new AccountStoreError(
      "conflict",
      `Make another release latest before you ${verb} this one, or revoke the whole link.`,
    );
};

/** Apply one owner-checked link action: move latest (rollback or advance) or toggle automatic release.
 * @param userId Session-derived owner.
 * @param linkId Link identity.
 * @param action Validated action.
 * @returns {Promise<ReleaseList>} Updated list; latest moves atomically under the owner lock.
 * @example await updateLink(userId, link.id, { action: "set-latest", releaseId })
 */
export async function updateLink(
  userId: string,
  linkId: string,
  action: LinkAction,
): Promise<ReleaseList> {
  return getPrisma().$transaction(async (tx) => {
    await lockOwner(tx, userId);
    const link = await ownedLink(tx, userId, linkId);
    if (action.action === "auto-release") {
      await tx.publicLink.update({
        where: { id: link.id },
        data: { autoRelease: action.enabled },
      });
    } else {
      const release = await ownedRelease(tx, userId, action.releaseId);
      if (release.linkId !== link.id)
        throw new AccountStoreError(
          "invalid",
          "This release belongs to a different link.",
        );
      if (release.revokedAt)
        throw new AccountStoreError(
          "conflict",
          "Restore this release before making it latest.",
        );
      await tx.publicLink.update({
        where: { id: link.id },
        data: { latestReleaseId: release.id },
      });
    }
    return readList(tx, userId);
  }, TRANSACTION);
}

/** Revoke a link: delete it and every release so all of its URLs stop working and storage is freed.
 * @param userId Session-derived owner.
 * @param linkId Link identity.
 * @returns {Promise<ReleaseList>} Updated list.
 * @example await revokeLink(userId, link.id)
 */
export async function revokeLink(
  userId: string,
  linkId: string,
): Promise<ReleaseList> {
  return getPrisma().$transaction(async (tx) => {
    await lockOwner(tx, userId);
    const link = await ownedLink(tx, userId, linkId);
    await tx.publicLink.delete({ where: { id: link.id } });
    return readList(tx, userId);
  }, TRANSACTION);
}

/** Revoke or restore one pinned release. The current latest cannot be revoked.
 * @param userId Session-derived owner.
 * @param releaseId Release identity.
 * @param action Validated action.
 * @returns {Promise<ReleaseList>} Updated list.
 * @example await updateRelease(userId, release.id, { action: "revoke" })
 */
export async function updateRelease(
  userId: string,
  releaseId: string,
  action: ReleaseAction,
): Promise<ReleaseList> {
  return getPrisma().$transaction(async (tx) => {
    await lockOwner(tx, userId);
    const release = await ownedRelease(tx, userId, releaseId);
    if (action.action === "revoke")
      notLatest(
        await ownedLink(tx, userId, release.linkId),
        release.id,
        "revoke",
      );
    await tx.publicRelease.update({
      where: { id: release.id },
      data: { revokedAt: action.action === "revoke" ? new Date() : null },
    });
    return readList(tx, userId);
  }, TRANSACTION);
}

/** Permanently delete one release and its bytes. The current latest cannot be deleted.
 * @param userId Session-derived owner.
 * @param releaseId Release identity.
 * @returns {Promise<ReleaseList>} Updated list.
 * @example await deleteRelease(userId, release.id)
 */
export async function deleteRelease(
  userId: string,
  releaseId: string,
): Promise<ReleaseList> {
  return getPrisma().$transaction(async (tx) => {
    await lockOwner(tx, userId);
    const release = await ownedRelease(tx, userId, releaseId);
    notLatest(
      await ownedLink(tx, userId, release.linkId),
      release.id,
      "delete",
    );
    await tx.publicRelease.delete({ where: { id: release.id } });
    return readList(tx, userId);
  }, TRANSACTION);
}

/** Publicly served release artifact. */
export type PublicPdf = {
  pdf: Uint8Array;
  fileName: string;
  pdfSha256: string;
};

/** Read one public PDF anonymously in a single query.
 * @param token Link token from the URL.
 * @param number Pinned release number, or undefined for the link's latest.
 * @returns PDF and public metadata, or null when unknown, revoked, deleted, or without a latest release.
 * @example await readPublicPdf(token, 3)
 */
export async function readPublicPdf(
  token: string,
  number?: number,
): Promise<PublicPdf | null> {
  type Row = { pdf: Uint8Array; fileName: string; pdfSha256: string };
  const prisma = getPrisma();
  const rows =
    number === undefined
      ? await prisma.$queryRaw<Row[]>`
          SELECT r."pdf", r."fileName", r."pdfSha256"
          FROM "public_link" l
          JOIN "public_release" r ON r."id" = l."latestReleaseId"
          WHERE l."token" = ${token} AND r."revokedAt" IS NULL
          LIMIT 1`
      : await prisma.$queryRaw<Row[]>`
          SELECT r."pdf", r."fileName", r."pdfSha256"
          FROM "public_link" l
          JOIN "public_release" r ON r."linkId" = l."id"
          WHERE l."token" = ${token} AND r."number" = ${number}
            AND r."revokedAt" IS NULL
          LIMIT 1`;
  const row = rows[0];
  return row
    ? {
        pdf: new Uint8Array(row.pdf),
        fileName: row.fileName,
        pdfSha256: row.pdfSha256,
      }
    : null;
}
