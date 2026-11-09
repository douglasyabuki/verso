"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { renderCareerOutput } from "@/lib/career/output";
import { assessResumeOutput } from "@/lib/career/readiness";
import type { CareerHead } from "@/stores/career/persistence";
import {
  PreviewCoordinator,
  type PreviewJob,
  previewKey,
  type PreviewState,
} from "@/stores/output/preview-coordinator";
import type { CareerResume } from "@/types-and-constants/career";
import {
  devicePreferenceDefaults,
  type DevicePreferences,
} from "@/types-and-constants/settings";

export type CommittedPreviewOptions = {
  head: CareerHead | null;
  preferences?: DevicePreferences;
  activeResumeId?: string;
};

export type CommittedPreview = {
  coordinator: PreviewCoordinator;
  state: PreviewState;
  head: CareerHead | null;
  active: CareerResume | undefined;
  /** Committed TeX for the active resume, or empty when output is blocked. */
  source: string;
  sourceError: string;
  /** Key of the committed target; compare with output.key for staleness. */
  key: string;
  automaticRefresh: boolean;
  selectResume: (id: string) => void;
  refresh: () => void;
};

/** Own one workspace preview coordinator and keep it pointed at committed output.
 * Mount this above views that may hide the preview so the last PDF and any
 * in-flight compile survive hide/show and breakpoint changes. Visibility is
 * reported separately by the rendered view; document visibility is tracked here.
 * @param options Committed head, device preferences, and the destination's resume, if any.
 * @returns Coordinator snapshot, derived committed target, and refresh/select commands.
 * @example const preview = useCommittedPreview({ head: state.head, preferences: state.preferences });
 */
export function useCommittedPreview({
  head,
  preferences = devicePreferenceDefaults,
  activeResumeId,
}: CommittedPreviewOptions): CommittedPreview {
  const [coordinator] = useState(() => new PreviewCoordinator());
  const [resumeId, setResumeId] = useState("");
  const state = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getSnapshot,
  );
  const active =
    head?.document.resumes.find(
      (resume) => resume.id === (activeResumeId ?? resumeId),
    ) ?? head?.document.resumes[0];
  const { job, source, sourceError } = useMemo((): {
    job: PreviewJob | null;
    source: string;
    sourceError: string;
  } => {
    if (!head || !active || !assessResumeOutput(head.document, active.id).ready)
      return { job: null, source: "", sourceError: "" };
    try {
      const output = renderCareerOutput(
        head.document,
        active.id,
        head.revision,
      );
      return {
        source: output.source,
        sourceError: "",
        job: {
          tag: {
            generation: head.generation,
            resumeId: active.id,
            fingerprint: output.fingerprint,
          },
          source: output.source,
          revision: head.revision,
          resumeName: active.name,
          language: active.language,
          targetPages: active.layout.targetPages,
        },
      };
    } catch (error) {
      return { job: null, source: "", sourceError: String(error) };
    }
  }, [head, active]);
  useEffect(() => {
    coordinator.setTarget(
      job,
      head && active
        ? { generation: head.generation, resumeId: active.id }
        : null,
    );
  }, [coordinator, job, head, active]);
  useEffect(() => {
    coordinator.setPreferences(preferences);
  }, [coordinator, preferences]);
  useEffect(() => () => coordinator.dispose(), [coordinator]);
  return {
    coordinator,
    state,
    head,
    active,
    source,
    sourceError,
    key: job ? previewKey(job.tag) : "",
    automaticRefresh: Boolean(preferences.automaticRefresh),
    selectResume: setResumeId,
    refresh: () => coordinator.refresh(),
  };
}
