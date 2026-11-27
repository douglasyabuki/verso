import { afterEach, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import {
  CommittedOutput,
  CommittedOutputView,
} from "@/components/career/committed-output";
import { useCommittedPreview } from "@/hooks/output/use-committed-preview";
import { createCareerDocument } from "@/lib/career/model";
import type { CareerHead } from "@/stores/career/persistence";
import { setupCareerTests } from "@/tests/support/browser/career";
import { devicePreferenceDefaults } from "@/types-and-constants/settings";

setupCareerTests();

const runtime = vi.hoisted(() => ({
  options: vi.fn(),
  compile: vi.fn(),
  close: vi.fn(),
  onState: vi.fn<(state: string) => void>(),
}));
vi.mock("@/tools/compiler-proof/compiler.mjs", () => ({
  BrowserCompiler: class {
    constructor(options: {
      onState?: (state: string) => void;
      initializationTimeoutMs: number;
      compilationTimeoutMs: number;
    }) {
      runtime.options(options);
      runtime.onState.mockImplementation(options.onState ?? (() => {}));
    }
    compile = runtime.compile;
    close = runtime.close;
  },
}));

// The compiler coordinator is tested independently from Next's dynamic-loader boundary.
vi.mock("@/components/output/lazy-pdf-preview", () => ({
  default: ({ document }: { document?: { url: string; fileName: string } }) =>
    document ? (
      <a href={document.url} download={document.fileName}>
        Download PDF
      </a>
    ) : null,
}));

afterEach(() => {
  vi.restoreAllMocks();
  runtime.options.mockReset();
  runtime.compile.mockReset();
  runtime.close.mockReset();
  runtime.onState.mockReset();
});

/** A committed bilingual fixture with independent resume identities. */
function head(): CareerHead {
  const document = createCareerDocument();
  document.languages.push({ tag: "pt-BR", active: false });
  document.profile.fields[0].wording = { "en-US": "Ana", "pt-BR": "Ana" };
  document.resumes = ["en-US", "pt-BR"].map((language, index) => ({
    id: `resume-${index}`,
    name: `Application ${index}`,
    language,
    template: "yabuki-reference@1.0.3",
    selection: [],
    overrides: {},
    layout: { ...document.defaults },
  }));
  return {
    key: "guest",
    workspaceId: "workspace",
    revision: 7,
    generation: 2,
    document,
  };
}

it("refreshes manually, retains captured download identity after switching, and releases replaced URLs", async () => {
  const create = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValueOnce("blob:first")
    .mockReturnValueOnce("blob:second");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  runtime.compile.mockResolvedValue({
    bytes: new Uint8Array([37, 80, 68, 70]),
  });
  const committed = head();
  committed.document.resumes[1].color = "rose";
  const screen = await render(
    <CommittedOutput onIssue={() => {}} head={committed} />,
  );
  try {
    expect(runtime.compile).not.toHaveBeenCalled();
    await screen.getByRole("button", { name: "Refresh preview" }).click();
    await expect
      .element(screen.getByRole("link", { name: /Download PDF/ }))
      .toHaveAttribute("download", "verso-resume-0-en-US-7.pdf");
    const selector = screen.getByRole("combobox", { name: "Existing resume" });
    expect(
      selector
        .element()
        .querySelector("[data-resume-color]")
        ?.getAttribute("data-resume-color"),
    ).toBe("indigo");
    await selector.click();
    const option = screen.getByRole("option", {
      name: "Application 1 (pt-BR)",
    });
    await expect.element(option).toBeVisible();
    expect(
      option
        .element()
        .querySelector("[data-resume-color]")
        ?.getAttribute("data-resume-color"),
    ).toBe("rose");
    await option.click();
    expect(
      selector
        .element()
        .querySelector("[data-resume-color]")
        ?.getAttribute("data-resume-color"),
    ).toBe("rose");
    await expect
      .element(screen.getByRole("link", { name: /Download PDF/ }))
      .toHaveAttribute("download", "verso-resume-0-en-US-7.pdf");
    await expect
      .element(screen.getByText(/Last successful preview/))
      .toHaveTextContent(/Application 0.*Outdated/);
    runtime.compile.mockRejectedValueOnce(new Error("Compilation timed out"));
    await screen.getByRole("button", { name: "Refresh preview" }).click();
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent(/Error: Compilation timed out/);
    expect(revoke).not.toHaveBeenCalledWith("blob:first");
    await screen.getByRole("button", { name: "Refresh preview" }).click();
    await expect
      .element(screen.getByRole("link", { name: /Download PDF/ }))
      .toHaveAttribute("download", "verso-resume-1-pt-BR-7.pdf");
    expect(revoke).toHaveBeenCalledWith("blob:first");
    expect(create).toHaveBeenCalledTimes(2);
  } finally {
    await screen.unmount();
  }
  expect(revoke).toHaveBeenCalledWith("blob:second");
  expect(runtime.close).toHaveBeenCalled();
});

it("shows preparation and generation before the first PDF, supports retry, and keeps a PDF visible during refresh", async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:generated");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  let fail!: (error: Error) => void;
  runtime.compile.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
  );
  const screen = await render(
    <CommittedOutput head={head()} onIssue={() => {}} />,
  );
  await expect
    .element(screen.getByText("Your resume, ready to preview", { exact: true }))
    .toBeVisible();
  expect(runtime.compile).not.toHaveBeenCalled();
  await screen
    .getByRole("button", { name: "Generate preview", exact: true })
    .click();
  await expect
    .element(
      screen.getByRole("status").filter({ hasText: "Preparing your preview" }),
    )
    .toBeVisible();
  await expect
    .element(screen.getByRole("button", { name: /Refreshing/ }))
    .toBeDisabled();
  runtime.onState("compiling");
  await expect
    .element(
      screen.getByRole("status").filter({ hasText: "Generating your PDF" }),
    )
    .toBeVisible();
  fail(new Error("Please retry"));
  await expect
    .element(screen.getByRole("alert"))
    .toHaveTextContent(/Please retry/);
  runtime.compile.mockResolvedValueOnce({
    bytes: new Uint8Array([37, 80, 68, 70]),
  });
  await screen.getByRole("button", { name: "Try again", exact: true }).click();
  await expect
    .element(screen.getByRole("link", { name: "Download PDF" }))
    .toBeVisible();
  runtime.compile.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
  );
  await screen
    .getByRole("button", { name: "Refresh preview", exact: true })
    .click();
  await expect
    .element(
      screen
        .getByRole("status")
        .filter({ hasText: "Your last successful preview stays available." }),
    )
    .toBeVisible();
  await expect
    .element(screen.getByRole("link", { name: "Download PDF" }))
    .toBeVisible();
  fail(new Error("Refresh failed"));
  await expect
    .element(screen.getByRole("alert"))
    .toHaveTextContent(/Refresh failed/);
  await expect
    .element(screen.getByRole("link", { name: "Download PDF" }))
    .toBeVisible();
  await screen.unmount();
});

it("explains missing wording before generation without offering an unusable generate action", async () => {
  const blocked = head();
  blocked.document.profile.fields[0].wording = {};
  const screen = await render(
    <CommittedOutput head={blocked} onIssue={() => {}} />,
  );
  await expect
    .element(screen.getByText("A few details need attention", { exact: true }))
    .toBeVisible();
  await expect
    .element(
      screen.getByRole("button", { name: "Refresh preview", exact: true }),
    )
    .toBeDisabled();
  await expect
    .element(
      screen.getByRole("button", { name: "Generate preview", exact: true }),
    )
    .not.toBeInTheDocument();
  await expect
    .element(screen.getByText("1 blocking", { exact: true }))
    .toBeVisible();
  expect(runtime.compile).not.toHaveBeenCalled();
  await screen.unmount();
});

it("rejects late compilation after replacement and after unmount without creating URLs", async () => {
  const create = vi.spyOn(URL, "createObjectURL");
  let finish!: (value: { bytes: Uint8Array }) => void;
  runtime.compile.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const original = head();
  const screen = await render(
    <CommittedOutput onIssue={() => {}} head={original} />,
  );
  await screen.getByRole("button", { name: "Refresh preview" }).click();
  await screen.rerender(
    <CommittedOutput
      onIssue={() => {}}
      head={{ ...original, generation: 3, revision: 8 }}
    />,
  );
  finish({ bytes: new Uint8Array([1]) });
  await expect
    .element(screen.getByRole("button", { name: "Refresh preview" }))
    .toBeEnabled();
  expect(create).not.toHaveBeenCalled();
  await screen.getByRole("button", { name: "Refresh preview" }).click();
  await screen.unmount();
  finish({ bytes: new Uint8Array([2]) });
  await Promise.resolve();
  expect(create).not.toHaveBeenCalled();
  expect(runtime.close).toHaveBeenCalled();
});

it("forces automatic refresh for a resume that releases automatically, even when preferences change identity on Save", async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:auto-release");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  runtime.compile.mockResolvedValue({
    bytes: new Uint8Array([37, 80, 68, 70]),
  });
  function Preview({
    value,
    ids,
    preferences,
  }: {
    value: CareerHead;
    ids: string[];
    preferences: typeof devicePreferenceDefaults;
  }) {
    const preview = useCommittedPreview({
      head: value,
      preferences,
      automaticResumeIds: ids,
    });
    return (
      <CommittedOutputView
        preview={preview}
        visible
        showSelector
        onIssue={() => {}}
      />
    );
  }
  // A fresh preferences object with each Save, as the controller publishes.
  const view = (value: CareerHead, ids: string[]) => (
    <Preview
      value={value}
      ids={ids}
      preferences={{ ...devicePreferenceDefaults }}
    />
  );
  const committed = head();
  const id = committed.document.resumes[0].id;
  const screen = await render(view(committed, [id]));
  try {
    await expect
      .element(screen.getByText(/Automatic refresh · Saved content only/))
      .toBeVisible();
    const changed = structuredClone(committed);
    changed.revision += 1;
    changed.document.resumes[0].name = "Released application";
    await screen.rerender(view(changed, [id]));
    await expect.poll(() => runtime.compile.mock.calls.length).toBe(1);
    const manual = structuredClone(changed);
    manual.revision += 1;
    manual.document.resumes[0].name = "Manual again";
    await screen.rerender(view(manual, []));
    await expect
      .element(screen.getByText(/Manual refresh · Saved content only/))
      .toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    expect(runtime.compile).toHaveBeenCalledTimes(1);
  } finally {
    await screen.unmount();
  }
});
