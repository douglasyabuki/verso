import { type CommittedHead, sameScope } from "@/lib/career/commit";
import { readScope } from "@/lib/career/model";
import type { CareerDraft } from "@/types-and-constants/career";

/** Both retained versions of one conflicted scope. */
export type DraftConflict = {
  scope: string;
  /** Committed values now saved for the scope (undefined when the record is missing). */
  saved: unknown;
  /** Values the draft would commit. */
  draft: unknown;
  /** Committed revision of the saved values. */
  revision: number;
  /** True when a replacement or rollback started a new generation since the draft opened. */
  replaced: boolean;
};

/** Detect whether committed content moved underneath a draft's scope baseline.
 * Only the draft's own scope is compared, so unrelated changes never conflict.
 * Derived on demand; nothing extra is persisted, so reload recomputes it from recovery.
 * @param head Current committed head.
 * @param draft Open or recovered draft.
 * @returns Both versions when the baseline no longer matches, otherwise null.
 * @example draftConflict(head, draft)?.saved
 */
export function draftConflict(
  head: CommittedHead,
  draft: CareerDraft,
): DraftConflict | null {
  const saved = readScope(head.document, draft.scope);
  const replaced = head.generation !== draft.generation;
  if (!replaced && sameScope(saved, draft.baseline)) return null;
  return {
    scope: draft.scope,
    saved,
    draft: draft.values,
    revision: head.revision,
    replaced,
  };
}
