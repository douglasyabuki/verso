"use client";

import { useEffect, useRef } from "react";

import type { CommittedPreview } from "@/hooks/output/use-committed-preview";
import type { Releases } from "@/hooks/releases/use-releases";
import {
  automaticReleaseKey,
  shouldReleaseAutomatically,
} from "@/lib/releases/automatic";

/** Options for {@link useAutomaticRelease}. */
export type AutomaticReleaseOptions = {
  preview: CommittedPreview;
  releases: Releases | null;
  /** True only while the workspace commits to account storage. */
  accountMode: boolean;
};

/** Publish the current committed preview when its link opted into automatic release.
 * Runs only for server-acknowledged committed output (never drafts or typing), at
 * most once per output per tab, and under a per-owner Web Lock so tabs do not race;
 * the server also skips output identical to the latest release. Pair it with
 * `useCommittedPreview`'s `automaticResumeIds` so a confirmed Save compiles a PDF
 * to publish. Failures stay visible in the release store and are never replayed blindly.
 * @param options Committed preview, mounted release store, and storage mode.
 * @returns No value.
 * @example useAutomaticRelease({ preview, releases, accountMode })
 */
export function useAutomaticRelease({
  preview,
  releases,
  accountMode,
}: AutomaticReleaseOptions): void {
  const attempted = useRef(new Set<string>());
  const output = preview.state.output;
  const current = output && output.key === preview.key ? output : null;
  const link = releases?.state.list?.links.find(
    (item) => item.resumeId === current?.tag.resumeId,
  );
  const head = preview.head;
  useEffect(() => {
    if (!releases || !current || !link || !head) return;
    if (
      !shouldReleaseAutomatically({
        accountMode,
        link,
        output: current.tag,
        generation: head.generation,
        attempted: attempted.current,
      })
    )
      return;
    attempted.current.add(automaticReleaseKey(link.id, current.tag));
    const send = () =>
      releases.store
        .release({
          output: current,
          workspaceId: head.workspaceId,
          advance: true,
          automatic: true,
        })
        .catch(() => {});
    if (typeof navigator !== "undefined" && navigator.locks)
      void navigator.locks.request(
        `verso-release-${releases.store.userId}`,
        send,
      );
    else void send();
  }, [accountMode, current, head, link, releases]);
}
