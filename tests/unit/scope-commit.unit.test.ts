import { expect, it } from "vitest";

import {
  commitScopeRequest,
  type CommittedHead,
  replaceHead,
  scopeFingerprint,
} from "@/lib/career/commit";
import { createCareerDocument, readScope } from "@/lib/career/model";

function head(): CommittedHead {
  return {
    workspaceId: "workspace",
    revision: 4,
    generation: 2,
    document: createCareerDocument(),
  };
}

function orderRequest(current: CommittedHead, reverse: boolean) {
  const baseline = readScope(current.document, "sections") as string[];
  const values = reverse ? [...baseline].reverse() : [...baseline];
  return {
    workspaceId: current.workspaceId,
    generation: current.generation,
    scope: "sections",
    baseline: [...baseline],
    values,
  };
}

it("commits a scope as the next revision while unrelated changes stay compatible", () => {
  const current = head();
  const request = orderRequest(current, true);
  const other = commitScopeRequest(current, {
    workspaceId: current.workspaceId,
    generation: current.generation,
    scope: "summary",
    baseline: readScope(current.document, "summary"),
    values: { ...current.document.summary },
  });
  expect(other.ok).toBe(true);
  const decision = commitScopeRequest(other.ok ? other.head : current, request);
  expect(decision.ok).toBe(true);
  if (!decision.ok) return;
  expect(decision.head.revision).toBe(6);
  expect(decision.head.generation).toBe(2);
  expect(readScope(decision.head.document, "sections")).toEqual(request.values);
  expect(readScope(current.document, "sections")).toEqual(request.baseline);
});

it("rejects a changed scope baseline as a conflict and another generation as replaced", () => {
  const current = head();
  const first = commitScopeRequest(current, orderRequest(current, true));
  if (!first.ok) throw new Error("expected commit");
  expect(
    commitScopeRequest(first.head, orderRequest(current, false)),
  ).toMatchObject({ ok: false, reason: "conflict" });
  expect(
    commitScopeRequest(
      { ...current, generation: 3 },
      orderRequest(current, false),
    ),
  ).toMatchObject({ ok: false, reason: "replaced" });
});

it("replaces only the reviewed revision and advances generation", () => {
  const current = head();
  const incoming = createCareerDocument();
  const decision = replaceHead(current, current, incoming);
  expect(decision).toMatchObject({
    ok: true,
    head: { revision: 5, generation: 3, workspaceId: "workspace" },
  });
  expect(
    replaceHead({ ...current, revision: 5 }, current, incoming),
  ).toMatchObject({ ok: false, reason: "conflict" });
});

it("fingerprints change with any request content", () => {
  const current = head();
  const request = { ...orderRequest(current, true), draftVersion: 1 };
  expect(scopeFingerprint(request)).toBe(scopeFingerprint({ ...request }));
  expect(scopeFingerprint(request)).not.toBe(
    scopeFingerprint({ ...request, draftVersion: 2 }),
  );
});
