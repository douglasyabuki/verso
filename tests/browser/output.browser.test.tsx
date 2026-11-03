import { afterEach, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { CommittedOutput } from "@/components/career/committed-output";
import { createCareerDocument } from "@/lib/career/model";
import type { CareerHead } from "@/stores/career/persistence";

const runtime = vi.hoisted(() => ({ compile: vi.fn(), close: vi.fn() }));
vi.mock("@/tools/compiler-proof/compiler.mjs", () => ({
  BrowserCompiler: class {
    compile = runtime.compile;
    close = runtime.close;
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  runtime.compile.mockReset();
  runtime.close.mockReset();
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
    template: "yabuki-reference@1.0.2",
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
  const screen = await render(<CommittedOutput head={head()} />);
  try {
    expect(runtime.compile).not.toHaveBeenCalled();
    await screen.getByRole("button", { name: "Refresh preview" }).click();
    await expect
      .element(screen.getByRole("link", { name: /Download PDF/ }))
      .toHaveAttribute("download", "verso-resume-0-en-US-7.pdf");
    await screen.getByRole("combobox").click();
    await screen.getByRole("option", { name: "Application 1 (pt-BR)" }).click();
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
      .toHaveTextContent("Error: Compilation timed out");
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
  const screen = await render(<CommittedOutput head={original} />);
  await screen.getByRole("button", { name: "Refresh preview" }).click();
  await screen.rerender(
    <CommittedOutput head={{ ...original, generation: 3, revision: 8 }} />,
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
