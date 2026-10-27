import { z } from "zod";

import { parseBackup, serializeBackup } from "@/lib/resume/backup";
import { type ResumeDocument } from "@/types-and-constants/resume";
import type {
  CommitResult,
  StorageReview,
  WorkspaceSnapshot,
} from "@/types-and-constants/workspace";

export const workspaceKey = "verso.workspace.v1";
const lockName = "verso.workspace.v1.commit";
const recordSchema = z.strictObject({
  version: z.literal(1),
  token: z.string().min(1),
  savedAt: z.string(),
  document: z.unknown(),
  backupFingerprint: z.string().nullable(),
});

/** Read stored data without changing it, preserving malformed bytes for conditional replacement.
 * @returns Reviewed bytes and validated content, or a diagnostic; throws if storage cannot be read.
 * @example const review = loadWorkspace();
 */
export function loadWorkspace(): StorageReview {
  const raw = localStorage.getItem(workspaceKey);
  if (raw === null) return { raw, snapshot: null, savedAt: null, error: null };
  try {
    const record = recordSchema.parse(JSON.parse(raw));
    const document = parseBackup(JSON.stringify(record.document));
    return {
      raw,
      snapshot: { document, backupFingerprint: record.backupFingerprint },
      savedAt: record.savedAt,
      error: null,
    };
  } catch {
    return {
      raw,
      snapshot: null,
      savedAt: null,
      error:
        "Your saved work could not be opened in this version of Verso. It has not been changed. Restore a compatible backup or download a backup of your current work.",
    };
  }
}

/** Report whether browser writes can be safely coordinated.
 * @returns False when Web Locks are unavailable; reading storage may still be possible.
 * @example if (!canCoordinate()) showSessionNotice();
 */
export function canCoordinate(): boolean {
  return typeof navigator !== "undefined" && !!navigator.locks;
}

/** Conditionally write or recheck a reviewed version under the shared workspace lock.
 * @param expected Exact reviewed bytes, including any opaque record token.
 * @param snapshot Content to commit; omit to recheck a load resolution without writing.
 * @param current Guard preventing superseded operations from committing after waiting for the lock.
 * @returns Success, a fresh conflict review, cancellation, or an actionable failure.
 * @example await commitWorkspace(review.raw, snapshot);
 */
export async function commitWorkspace(
  expected: string | null,
  snapshot?: WorkspaceSnapshot,
  current: () => boolean = () => true,
): Promise<CommitResult> {
  if (!canCoordinate())
    return {
      status: "failure",
      error:
        "This browser cannot safely save changes across tabs. Use this tab only and download a backup before closing it.",
    };
  try {
    return await navigator.locks.request(lockName, () => {
      if (!current()) return { status: "cancelled" } as const;
      const review = loadWorkspace();
      if (review.raw !== expected)
        return { status: "conflict", review } as const;
      if (!snapshot) return { status: "success", review } as const;
      // Validate before writing; failed validation never destroys stored bytes.
      const document = parseBackup(serializeBackup(snapshot.document));
      const raw = JSON.stringify({
        version: 1,
        token: crypto.randomUUID(),
        savedAt: new Date().toISOString(),
        document,
        backupFingerprint: snapshot.backupFingerprint,
      });
      localStorage.setItem(workspaceKey, raw);
      const written = loadWorkspace();
      if (written.raw !== raw)
        return { status: "conflict", review: written } as const;
      return { status: "success", review: written } as const;
    });
  } catch (error) {
    return {
      status: "failure",
      error: `Browser save failed: ${error instanceof Error ? error.message : "storage unavailable"}. Download a backup to keep your work.`,
    };
  }
}

/** Observe workspace changes from other tabs, including storage clearing.
 * @param notify Callback that rereads the current version.
 * @returns Listener cleanup.
 * @example const unsubscribe = subscribeWorkspace(refresh);
 */
export function subscribeWorkspace(notify: () => void): () => void {
  const listener = (event: StorageEvent) => {
    if (event.key === workspaceKey || event.key === null) notify();
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

/** Fingerprint exact portable JSON, independently of storage tokens and timestamps.
 * @param document Current editable source.
 * @returns SHA-256 identity, or exact JSON identity in insecure session-only contexts.
 * @example const baseline = await fingerprint(document);
 */
export async function fingerprint(document: ResumeDocument): Promise<string> {
  const json = serializeBackup(document);
  if (!globalThis.crypto?.subtle) return `json:${json}`;
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(json),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
