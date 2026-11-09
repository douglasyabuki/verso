import { afterEach, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { CommittedOutput } from "@/components/career/committed-output";
import { ResumeOverview } from "@/components/career/resume-workspace";
import { createCareerDocument } from "@/lib/career/model";
import type { CareerHead } from "@/stores/career/persistence";
import { devicePreferenceDefaults } from "@/types-and-constants/settings";

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

it("shows saved-content issues only in the PDF footer while retaining the last successful PDF", async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:ready");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  runtime.compile.mockResolvedValue({
    bytes: new Uint8Array([37, 80, 68, 70]),
  });
  const committed = head();
  const onIssue = vi.fn();
  const screen = await render(
    <CommittedOutput head={committed} onIssue={onIssue} />,
  );
  await expect
    .element(screen.getByRole("button", { name: "Issues (0)", exact: true }))
    .toHaveAttribute("aria-expanded", "false");
  await expect
    .element(screen.getByText("Ready for PDF", { exact: true }))
    .toBeVisible();
  await screen.getByRole("button", { name: "Refresh preview" }).click();
  await expect
    .element(screen.getByRole("link", { name: "Download PDF" }))
    .toBeVisible();
  const blocked = structuredClone(committed);
  blocked.revision++;
  const name = blocked.document.profile.fields[0];
  blocked.document.resumes[0].overrides[name.id] = "";
  await screen.rerender(<CommittedOutput head={blocked} onIssue={onIssue} />);
  await expect
    .element(screen.getByRole("button", { name: "Refresh preview" }))
    .toBeDisabled();
  await expect.element(screen.getByText("1 blocking")).toBeVisible();
  await expect
    .element(screen.getByText(/Last successful preview/))
    .toHaveTextContent(/Outdated/);
  await expect
    .element(screen.getByRole("link", { name: "Download PDF" }))
    .toBeVisible();
  const message = `Add full name wording in en-US before output.`;
  await expect
    .element(screen.getByText(message, { exact: true }))
    .not.toBeInTheDocument();
  await screen.getByRole("button", { name: "Issues (1)", exact: true }).click();
  await expect
    .element(screen.getByText(message, { exact: true }))
    .toBeVisible();
  await screen
    .getByRole("button", { name: "Edit wording", exact: true })
    .click();
  expect(onIssue).toHaveBeenLastCalledWith({
    destination: "resume-wording/resume-0",
    fieldId: name.id,
  });
  const overview = await render(
    <section aria-label="Overview readiness test">
      <ResumeOverview
        document={blocked.document}
        resume={blocked.document.resumes[0]}
      />
    </section>,
  );
  try {
    const overviewRegion = overview.getByRole("region", {
      name: "Overview readiness test",
    });
    await expect
      .element(
        overviewRegion.getByRole("region", { name: "Active resume readiness" }),
      )
      .not.toBeInTheDocument();
    await expect
      .element(
        overviewRegion.getByRole("button", {
          name: "Edit wording",
          exact: true,
        }),
      )
      .not.toBeInTheDocument();
    expect(onIssue).toHaveBeenCalledTimes(1);
  } finally {
    await overview.unmount();
  }
  await screen.rerender(<CommittedOutput head={committed} onIssue={onIssue} />);
  await expect
    .element(screen.getByText("Ready for PDF", { exact: true }))
    .toBeVisible();
  await expect
    .element(screen.getByRole("button", { name: "Issues (0)", exact: true }))
    .toHaveAttribute("aria-expanded", "true");
  await screen.getByRole("button", { name: "Issues (0)", exact: true }).click();
  await expect
    .element(screen.getByRole("button", { name: "Issues (0)", exact: true }))
    .toHaveAttribute("aria-expanded", "false");
  expect(runtime.compile).toHaveBeenCalledTimes(1);
  await screen.unmount();
});

it("uses saved device timeouts on the next compiler instance without compiling on preference changes", async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preferences");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  runtime.compile.mockResolvedValue({
    bytes: new Uint8Array([37, 80, 68, 70]),
  });
  const committed = head();
  const onIssue = () => {};
  const screen = await render(
    <CommittedOutput head={committed} onIssue={onIssue} />,
  );
  try {
    await screen.getByRole("button", { name: "Refresh preview" }).click();
    await expect
      .element(screen.getByRole("link", { name: /Download PDF/ }))
      .toBeVisible();
    expect(runtime.options).toHaveBeenLastCalledWith(
      expect.objectContaining({
        initializationTimeoutMs: 120000,
        compilationTimeoutMs: 30000,
      }),
    );
    const beforeChange = runtime.close.mock.calls.length;
    await screen.rerender(
      <CommittedOutput
        head={committed}
        onIssue={onIssue}
        preferences={{
          ...devicePreferenceDefaults,
          initializationTimeoutMs: 60000,
          compilationTimeoutMs: 45000,
        }}
      />,
    );
    expect(runtime.compile).toHaveBeenCalledTimes(1);
    expect(runtime.close).toHaveBeenCalledTimes(beforeChange);
    await screen.getByRole("button", { name: "Refresh preview" }).click();
    await expect.poll(() => runtime.compile.mock.calls.length).toBe(2);
    expect(runtime.options).toHaveBeenLastCalledWith(
      expect.objectContaining({
        initializationTimeoutMs: 60000,
        compilationTimeoutMs: 45000,
      }),
    );
    expect(runtime.close).toHaveBeenCalledTimes(beforeChange + 1);
  } finally {
    await screen.unmount();
  }
});
