import { afterEach, expect, it, vi } from "vitest";

import { createCareerDocument } from "@/lib/career/model";
import type {
  PreviewRequest,
  PreviewWorkerInput,
  PreviewWorkerOutput,
} from "@/lib/career/preview-protocol";
import { createResume } from "@/lib/career/resumes";
import { CareerController } from "@/stores/career/controller";
import type { CareerHead } from "@/stores/career/persistence";
import { LivePreview } from "@/stores/output/live-preview";

class PreviewWorker {
  static instance: PreviewWorker;
  onmessage: ((event: { data: PreviewWorkerOutput }) => void) | null = null;
  jobs: PreviewRequest[] = [];
  stopped: number[] = [];

  constructor() {
    PreviewWorker.instance = this;
  }

  postMessage(message: PreviewWorkerInput) {
    if (message.kind === "run") this.jobs.push(message.request);
    else if (message.kind === "supersede") this.stopped.push(message.id);
    else queueMicrotask(() => this.reply({ kind: "ack", id: message.id }));
  }

  reply(message: PreviewWorkerOutput) {
    this.onmessage?.({ data: message });
  }

  terminate() {}
}

function setup() {
  vi.stubGlobal("Worker", PreviewWorker);
  vi.useFakeTimers();
  const document = createCareerDocument();
  const name = document.profile.fields[0];
  name.wording["en-US"] = "Saved";
  const resume = createResume(document, "en-US");
  document.resumes = [resume];
  const head: CareerHead = {
    workspaceId: "owner",
    generation: 1,
    revision: 1,
    document,
  };
  const controller = new CareerController();
  const state = { ...controller.getSnapshot(), head };
  vi.spyOn(controller, "getSnapshot").mockReturnValue(state);
  const preview = new LivePreview();
  preview.configure(resume.id, true, false, controller);
  return { preview, state, name, resume };
}

function finish(
  worker: PreviewWorker,
  request: PreviewRequest,
  fingerprint: string,
) {
  worker.reply({
    kind: "ready",
    result: {
      id: request.id,
      fingerprint,
      targetPages: 2,
      template: "yabuki-reference@1.0.3",
      bytes: new Uint8Array([37, 80, 68, 70]),
    },
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("joins the one saved request, follows a newer head, and cancels delivery on resume switch", async () => {
  const { preview, state, resume } = setup();
  const download = vi.fn();
  const publish = vi.fn();
  try {
    preview.requestSaved("download", download);
    preview.requestSaved("download", download);
    preview.requestSaved("publish", publish);
    await vi.waitFor(() => expect(PreviewWorker.instance.jobs).toHaveLength(1));
    const worker = PreviewWorker.instance;
    const [first] = worker.jobs;
    const head = { ...state.head, revision: 2 };
    preview.observe({ ...state, head }, false);
    expect(worker.stopped).toEqual([first.id]);
    finish(worker, first, "stale");
    await vi.waitFor(() => expect(worker.jobs).toHaveLength(2));
    expect(download).not.toHaveBeenCalled();
    finish(worker, worker.jobs[1], "saved-head");
    await vi.waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(publish).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "saved", revision: 2 }),
    );
    const other = { ...resume, id: "another" };
    const next = {
      ...head,
      revision: 3,
      document: { ...head.document, resumes: [resume, other] },
    };
    preview.observe({ ...state, head: next }, false);
    preview.requestSaved("download", download);
    await vi.waitFor(() => expect(worker.jobs).toHaveLength(3));
    preview.observe(
      {
        ...state,
        head: {
          ...next,
          revision: 4,
          document: { ...next.document, resumes: [other] },
        },
      },
      false,
    );
    finish(worker, worker.jobs[2], "wrong-resume");
    await vi.advanceTimersByTimeAsync(1);
    expect(download).toHaveBeenCalledTimes(1);
    expect(preview.getSnapshot().actions).toEqual([]);
  } finally {
    preview.dispose();
  }
});

it("preempts an automatic draft for a saved action and rejects staging after a newer edit", async () => {
  const { preview, state, resume, name } = setup();
  const draft = {
    workspaceId: state.head.workspaceId,
    generation: 1,
    baselineRevision: 1,
    draftId: "wording",
    draftVersion: 2,
    scope: `resume-wording/${resume.id}`,
    baseline: resume.overrides,
    values: { [name.id]: "First" },
  };
  const download = vi.fn();
  try {
    preview.setVisible(true);
    preview.interaction(true, false);
    preview.observe({ ...state, draft }, true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(preview.getSnapshot().phase).toBe("pending");
    preview.interaction(false, false);
    await vi.waitFor(() => expect(PreviewWorker.instance.jobs).toHaveLength(1));
    const worker = PreviewWorker.instance;
    const [draftJob] = worker.jobs;
    expect(draftJob.draft?.version).toBe(2);
    preview.requestSaved("download", download);
    expect(worker.stopped).toEqual([draftJob.id]);
    worker.reply({ kind: "obsolete", id: draftJob.id });
    await vi.waitFor(() => expect(worker.jobs).toHaveLength(2));
    expect(worker.jobs[1].draft).toBeNull();
    finish(worker, worker.jobs[1], "saved");
    await vi.waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(worker.jobs).toHaveLength(3));
    finish(worker, worker.jobs[2], "draft");
    await vi.waitFor(() =>
      expect(preview.getSnapshot().candidate?.kind).toBe("draft"),
    );
    const discardedCandidate = preview.getSnapshot().candidate!;
    preview.observe({ ...state, draft, saving: true }, true);
    expect(preview.promote(discardedCandidate)).toBe(false);
    preview.observe({ ...state, draft, saving: false }, true);
    await vi.waitFor(() => expect(worker.jobs).toHaveLength(4));
    expect(worker.jobs[3].draft?.version).toBe(2);
    finish(worker, worker.jobs[3], "draft");
    await vi.waitFor(() =>
      expect(preview.getSnapshot().candidate?.kind).toBe("draft"),
    );
    const candidate = preview.getSnapshot().candidate!;
    preview.observe(
      {
        ...state,
        draft: { ...draft, draftVersion: 3, values: { [name.id]: "Newer" } },
      },
      true,
    );
    expect(preview.promote(candidate)).toBe(false);
    expect(preview.getSnapshot().saved?.tag.fingerprint).toBe("saved");
  } finally {
    preview.dispose();
  }
});
