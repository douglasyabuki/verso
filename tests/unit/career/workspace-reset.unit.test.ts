import { describe, expect, it } from "vitest";

import { commitScopeRequest, resetHead } from "@/lib/career/commit";
import { createCareerDocument } from "@/lib/career/model";

const current = {
  workspaceId: "reviewed-workspace",
  revision: 7,
  generation: 2,
  document: createCareerDocument(),
};

describe("workspace data deletion decision", () => {
  it("adopts a fresh identity with monotonic revision and generation", () => {
    const fresh = createCareerDocument();
    const decision = resetHead(current, current, fresh, "fresh-workspace");
    expect(decision).toEqual({
      ok: true,
      head: {
        workspaceId: "fresh-workspace",
        revision: 8,
        generation: 3,
        document: fresh,
      },
    });
  });

  it.each([
    ["workspace", { workspaceId: "other" }],
    ["revision", { revision: 6 }],
    ["generation", { generation: 1 }],
  ])("rejects a changed %s as a conflict", (_field, change) => {
    expect(
      resetHead(
        current,
        { ...current, ...change },
        createCareerDocument(),
        "fresh",
      ),
    ).toMatchObject({ ok: false, reason: "conflict" });
  });

  it("never reuses the deleted identity", () => {
    expect(() =>
      resetHead(current, current, createCareerDocument(), current.workspaceId),
    ).toThrow();
  });

  it("makes Saves prepared against the deleted workspace fail as replaced", () => {
    const decision = resetHead(
      current,
      current,
      createCareerDocument(),
      "fresh",
    );
    if (!decision.ok) throw new Error("expected a fresh head");
    expect(
      commitScopeRequest(decision.head, {
        workspaceId: current.workspaceId,
        generation: current.generation,
        scope: "summary",
        baseline: current.document.summary,
        values: current.document.summary,
      }),
    ).toMatchObject({ ok: false, reason: "replaced" });
  });
});
