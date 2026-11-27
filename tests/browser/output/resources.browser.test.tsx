import "pdfjs-dist/web/pdf_viewer.css";

import { useRef, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";

import {
  CommittedOutput,
  CommittedOutputView,
} from "@/components/career/committed-output";
import PdfPreview, { type StagedPdf } from "@/components/output/pdf-preview";
import { useCommittedPreview } from "@/hooks/output/use-committed-preview";
import type { PdfViewPosition } from "@/hooks/output/use-pdf-document";
import { createCareerDocument } from "@/lib/career/model";
import type { CareerHead } from "@/stores/career/persistence";
import { previewPdf } from "@/tests/fixtures/pdf";

const runtime = vi.hoisted(() => ({
  created: 0,
  closed: 0,
  compile: vi.fn(),
}));
vi.mock("@/tools/compiler-proof/compiler.mjs", () => ({
  BrowserCompiler: class {
    constructor() {
      runtime.created += 1;
    }
    compile = runtime.compile;
    close = () => {
      runtime.closed += 1;
    };
  },
}));
// Use the real PDF.js viewer without Next's dynamic-loader boundary.
vi.mock("@/components/output/lazy-pdf-preview", async () => ({
  default: (await import("@/components/output/pdf-preview")).default,
}));

const OriginalWorker = globalThis.Worker;
const workers = new Set<Worker>();
const urls = { created: [] as string[], revoked: [] as string[] };

beforeEach(() => {
  workers.clear();
  urls.created = [];
  urls.revoked = [];
  runtime.created = 0;
  runtime.closed = 0;
  runtime.compile.mockReset();
  runtime.compile.mockImplementation(async () => ({ bytes: previewPdf() }));
  globalThis.Worker = class extends OriginalWorker {
    constructor(...args: ConstructorParameters<typeof Worker>) {
      super(...args);
      workers.add(this);
    }
    terminate() {
      workers.delete(this);
      super.terminate();
    }
  };
  const create = URL.createObjectURL.bind(URL);
  const revoke = URL.revokeObjectURL.bind(URL);
  vi.spyOn(URL, "createObjectURL").mockImplementation((value) => {
    const url = create(value);
    urls.created.push(url);
    return url;
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => {
    urls.revoked.push(url);
    revoke(url);
  });
});

afterEach(async () => {
  await cleanup();
  await expect.poll(liveWorkers).toBe(0);
  globalThis.Worker = OriginalWorker;
  vi.restoreAllMocks();
});

/** Committed fixture with one ready English resume. */
function head(revision = 1, name = "Application"): CareerHead {
  const document = createCareerDocument();
  document.profile.fields[0].wording = { "en-US": "Ana" };
  document.resumes = [
    {
      id: "resume",
      name,
      language: "en-US",
      template: "yabuki-reference@1.0.3",
      selection: [],
      overrides: {},
      layout: { ...document.defaults },
    },
  ];
  return {
    key: "guest",
    workspaceId: "workspace",
    revision,
    generation: 1,
    document,
  };
}

const liveWorkers = () => workers.size;
const liveUrls = () =>
  urls.created.filter((url) => !urls.revoked.includes(url)).length;

function frame(children: React.ReactNode) {
  return <div style={{ height: 700, display: "flex" }}>{children}</div>;
}

it("keeps the page and zoom on automatic PDF replacement and clamps to a shorter document", async () => {
  await page.viewport(1440, 900);
  function EditorPreview({ value }: { value: CareerHead }) {
    const preview = useCommittedPreview({ head: value, keepCurrent: true });
    return frame(
      <CommittedOutputView
        preview={preview}
        visible
        showSelector={false}
        onIssue={() => {}}
      />,
    );
  }
  const screen = await render(<EditorPreview value={head()} />);
  const zoom = screen.getByRole("textbox", { name: "PDF zoom" });
  const number = screen.getByRole("textbox", { name: "PDF page number" });
  await expect.element(zoom).toBeEnabled();
  await zoom.fill("125");
  await userEvent.keyboard("{Enter}");
  await number.fill("3");
  await userEvent.keyboard("{Enter}");
  await expect.element(number).toHaveValue("3");

  await screen.rerender(
    <EditorPreview value={head(2, "Updated application")} />,
  );
  await expect.element(screen.getByText(/revision 2.*Current/)).toBeVisible();
  await expect.element(zoom).toHaveValue("125%");
  await expect.element(number).toHaveValue("3");

  runtime.compile.mockResolvedValueOnce({ bytes: previewPdf("Shorter", 1) });
  await screen.rerender(
    <EditorPreview value={head(3, "Shorter application")} />,
  );
  await expect.element(screen.getByText(/revision 3.*Current/)).toBeVisible();
  await expect.element(zoom).toHaveValue("125%");
  await expect.element(number).toHaveValue("1");
});

it("returns compiler, PDF.js worker, blob URL, and listener counts to declared bounds across refresh, hide, failure, replacement, and unmount", async () => {
  await page.viewport(1440, 900);
  const added = vi.spyOn(document, "addEventListener");
  const removed = vi.spyOn(document, "removeEventListener");
  // Live listeners: not explicitly removed and not released by an aborted signal.
  const visibility = () =>
    added.mock.calls.filter(
      ([type, listener, options]) =>
        type === "visibilitychange" &&
        !(options as AddEventListenerOptions | undefined)?.signal?.aborted &&
        !removed.mock.calls.some(
          ([other, removedListener]) =>
            other === "visibilitychange" && removedListener === listener,
        ),
    ).length;
  const onIssue = () => {};
  const view = (value: CareerHead, visible = true) =>
    frame(<CommittedOutput head={value} onIssue={onIssue} visible={visible} />);
  const screen = await render(view(head()));
  const refresh = () =>
    screen.getByRole("button", { name: "Refresh preview" }).click();
  const pages = () =>
    page
      .getByRole("region", { name: "PDF document pages" })
      .getByText("First page search needle");

  await refresh();
  await expect.element(pages()).toBeVisible();
  await expect.poll(liveWorkers).toBe(1);
  expect(liveUrls()).toBe(1);

  // Rapid committed changes and refreshes keep one compiler, one retained URL,
  // and one viewer worker after settling.
  for (let revision = 2; revision <= 4; revision += 1) {
    await screen.rerender(view(head(revision, `Application ${revision}`)));
    await refresh();
  }
  await expect
    .element(screen.getByText(/Last successful preview/))
    .toHaveTextContent(/Application 4.*Current/);
  await expect.element(pages()).toBeVisible();
  await expect.poll(liveWorkers).toBe(1);
  expect(liveUrls()).toBe(1);
  expect(runtime.created).toBe(1);

  // Hiding releases the viewer and its worker but keeps the retained PDF.
  const latest = head(4, "Application 4");
  await screen.rerender(view(latest, false));
  await expect.poll(liveWorkers).toBe(0);
  expect(liveUrls()).toBe(1);
  await screen.rerender(view(latest));
  await expect.element(pages()).toBeVisible();
  await expect.poll(liveWorkers).toBe(1);
  expect(runtime.compile).toHaveBeenCalledTimes(4);

  // Failure retains the last PDF and its URL.
  runtime.compile.mockRejectedValueOnce(new Error("Compilation failed"));
  const changed = head(5, "Application 5");
  await screen.rerender(view(changed));
  await refresh();
  await expect
    .element(screen.getByRole("alert"))
    .toHaveTextContent(/Compilation failed/);
  expect(liveUrls()).toBe(1);
  await expect.element(pages()).toBeVisible();

  // Replacement (new generation) closes the compiler before further work.
  await screen.rerender(view({ ...changed, generation: 2 }));
  expect(runtime.closed).toBe(runtime.created);
  await refresh();
  await expect
    .element(screen.getByText(/Last successful preview/))
    .toHaveTextContent(/generation 2 · Current/);
  await expect.poll(liveWorkers).toBe(1);
  expect(liveUrls()).toBe(1);
  expect(runtime.created - runtime.closed).toBe(1);
  // Other owners (PDF.js) may listen too; only the settled return to baseline is a bound.

  await screen.unmount();
  await expect.poll(liveWorkers).toBe(0);
  expect(liveUrls()).toBe(0);
  expect(runtime.closed).toBe(runtime.created);
  expect(visibility()).toBe(0);
});

it("retains the rendered page when a staged PDF fails, then clamps a valid shorter PDF", async () => {
  await page.viewport(1440, 900);
  const blob = (bytes: Uint8Array<ArrayBuffer>) =>
    URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const original = blob(previewPdf());
  const corrupt = blob(new TextEncoder().encode("not a PDF"));
  const shorter = blob(previewPdf("Shorter", 1));
  const failure = vi.fn();
  function Staging({ next }: { next?: string }) {
    const [visible, setVisible] = useState(original);
    const [failed, setFailed] = useState("");
    const position = useRef<PdfViewPosition>({ page: 1, scale: "page-width" });
    const candidate = (url: string): StagedPdf => ({
      source: { url, key: url, fileName: "fixture.pdf" },
      targetPages: 3,
      onRendered: (value) => {
        position.current = value;
        setVisible(url);
      },
      onFailure: (reason) => {
        failure(reason);
        setFailed(url);
      },
    });
    return frame(
      <PdfPreview
        staging={{
          displayed: candidate(visible),
          candidate:
            next && next !== visible && next !== failed
              ? candidate(next)
              : null,
          position,
        }}
      />,
    );
  }
  const screen = await render(<Staging />);
  try {
    const number = screen.getByRole("textbox", { name: "PDF page number" });
    const zoom = screen.getByRole("textbox", { name: "PDF zoom" });
    await expect.element(zoom).toBeEnabled();
    await zoom.fill("125");
    await userEvent.keyboard("{Enter}");
    await number.fill("3");
    await userEvent.keyboard("{Enter}");
    await expect.element(number).toHaveValue("3");
    await screen.rerender(<Staging next={corrupt} />);
    await expect.poll(() => failure.mock.calls.length).toBe(1);
    await expect.element(number).toHaveValue("3");
    await expect.element(zoom).toHaveValue("125%");
    await expect.poll(liveWorkers).toBe(1);
    await screen.rerender(<Staging next={shorter} />);
    await expect.element(number).toHaveValue("1");
    await expect.element(zoom).toHaveValue("125%");
    await expect.poll(liveWorkers).toBe(1);
  } finally {
    await screen.unmount();
    for (const url of [original, corrupt, shorter]) URL.revokeObjectURL(url);
  }
});
