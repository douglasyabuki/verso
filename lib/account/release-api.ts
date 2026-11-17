import "server-only";

import { z } from "zod";

import { AccountStoreError } from "@/lib/account/workspace-repository";
import type {
  LinkAction,
  ReleaseAction,
  ReleaseRequestMetadata,
} from "@/types-and-constants/releases";
import { RELEASE_LIMITS } from "@/types-and-constants/releases";

/** Upload bodies carry one PDF plus small multipart metadata. */
const MAX_UPLOAD_BYTES = RELEASE_LIMITS.pdfBytes + 64 * 1024;

const opaqueId = z.string().min(1).max(200);
const count = z.number().int().nonnegative();

/** Strict release metadata schema; unknown fields are rejected. */
export const releaseMetadataSchema: z.ZodType<ReleaseRequestMetadata> =
  z.strictObject({
    operationId: z.uuid(),
    resumeId: opaqueId,
    workspaceId: opaqueId,
    revision: count,
    generation: count,
    fingerprint: z.string().min(1).max(200),
    templateId: z.string().min(1).max(200),
    advance: z.boolean(),
    automatic: z.boolean(),
  });

/** Strict link action schema. */
export const linkActionSchema: z.ZodType<LinkAction> = z.discriminatedUnion(
  "action",
  [
    z.strictObject({ action: z.literal("set-latest"), releaseId: z.uuid() }),
    z.strictObject({ action: z.literal("auto-release"), enabled: z.boolean() }),
  ],
);

/** Strict release action schema. */
export const releaseActionSchema: z.ZodType<ReleaseAction> = z.strictObject({
  action: z.enum(["revoke", "restore"]),
});

/** Validate a path identity before it reaches the database.
 * @param value Route parameter.
 * @returns {string} The UUID; throws `invalid` otherwise.
 * @example const linkId = routeId((await context.params).linkId)
 */
export function routeId(value: string): string {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success)
    throw new AccountStoreError("invalid", "The request is malformed.");
  return parsed.data;
}

/** Read one bounded multipart release upload: a strict JSON `metadata` field and a `pdf` file.
 * @param request Incoming request.
 * @returns Parsed metadata and PDF bytes; throws typed errors for oversized or malformed input.
 * @example const { metadata, pdf } = await readReleaseUpload(request)
 */
export async function readReleaseUpload(
  request: Request,
): Promise<{ metadata: ReleaseRequestMetadata; pdf: Uint8Array }> {
  const tooLarge = () =>
    new AccountStoreError(
      "payload_too_large",
      "This PDF is larger than the 4 MiB release limit.",
    );
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES) throw tooLarge();
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_UPLOAD_BYTES) throw tooLarge();
  let form: FormData;
  try {
    form = await new Response(body, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    throw new AccountStoreError("invalid", "The request is malformed.");
  }
  const keys = [...new Set(form.keys())].sort();
  const metadata = form.get("metadata");
  const pdf = form.get("pdf");
  if (
    keys.join(",") !== "metadata,pdf" ||
    typeof metadata !== "string" ||
    !(pdf instanceof Blob)
  )
    throw new AccountStoreError("invalid", "The request is malformed.");
  return {
    metadata: releaseMetadataSchema.parse(JSON.parse(metadata)),
    pdf: new Uint8Array(await pdf.arrayBuffer()),
  };
}
