"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { ReleaseControl } from "@/components/career/release-dialog";
import type { Releases } from "@/hooks/releases/use-releases";
import {
  automaticReleaseKey,
  shouldReleaseAutomatically,
} from "@/lib/releases/automatic";
import type { LivePreview } from "@/stores/output/live-preview";

/** Keep review and acknowledged-save publication alive across pane visibility changes. */
export function LivePdfRelease({
  coordinator,
  releases,
  workspaceId,
}: {
  coordinator: LivePreview;
  releases: Releases | null;
  workspaceId: string;
}) {
  const state = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getSnapshot,
  );
  const attempted = useRef(new Set<string>());
  const output = state.automaticRelease;
  const link = releases?.state.list?.links.find(
    (item) => item.resumeId === output?.tag.resumeId,
  );
  useEffect(() => {
    if (
      !releases ||
      !output ||
      !link ||
      !shouldReleaseAutomatically({
        accountMode: true,
        link,
        output: output.tag,
        generation: output.tag.generation,
        attempted: attempted.current,
      })
    )
      return;
    const send = () => {
      if (coordinator.currentSaved() !== output) return;
      const key = automaticReleaseKey(link.id, output.tag);
      if (attempted.current.has(key)) return;
      attempted.current.add(key);
      return releases.store
        .release({ output, workspaceId, advance: true, automatic: true })
        .catch(() => {});
    };
    if (navigator.locks)
      void navigator.locks.request(
        `verso-release-${releases.store.userId}`,
        send,
      );
    else void send();
  }, [coordinator, releases, workspaceId, output, link]);
  return (
    <ReleaseControl
      releases={releases}
      output={state.saved}
      workspaceId={workspaceId}
      requested={state.review}
    />
  );
}
