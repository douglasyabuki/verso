import { expect, it } from "vitest";

import { createCareerDocument, parsePortable } from "@/lib/career/model";
import { recoveryFiles } from "@/lib/career/recovery-export";
import type { CareerDraft } from "@/types-and-constants/career";

it("accepts exact UTF-8 file ceilings including envelope overhead and rejects one extra byte", () => {
  for (const kind of ["workspace", "recovery"] as const) {
    const ceiling = (kind === "workspace" ? 64 : 256) * 1024 * 1024;
    const envelope =
      kind === "workspace"
        ? {
            format: "verso.workspace",
            schemaVersion: 2,
            exportedAt: "2026-11-03T12:00:00.000Z",
            workspaceId: "boundary",
            document: createCareerDocument(),
          }
        : {
            format: "verso.recovery",
            schemaVersion: 1,
            exportedAt: "2026-11-03T12:00:00.000Z",
            sourceWorkspaceId: "boundary",
            drafts: [],
          };
    const json = JSON.stringify(envelope);
    const source =
      json + " ".repeat(ceiling - new TextEncoder().encode(json).byteLength);
    expect(() => parsePortable(source, kind)).not.toThrow();
    expect(() => parsePortable(source + " ", kind)).toThrow(/byte limit/);
  }
}, 60_000);

it("preserves an exact 64-MiB recovery draft and exports the next byte only as explicit raw chunks", () => {
  const ceiling = 64 * 1024 * 1024;
  const draft: CareerDraft = {
    draftId: "boundary",
    draftVersion: 1,
    workspaceId: "workspace",
    scope: "summary",
    generation: 0,
    baselineRevision: 0,
    baseline: null,
    values: "",
  };
  draft.values = "x".repeat(
    ceiling - new TextEncoder().encode(JSON.stringify(draft)).byteLength,
  );
  const normal = recoveryFiles([draft], "workspace").next().value!;
  const parsed = parsePortable(normal.content, "recovery");
  expect(parsed.format === "verso.recovery" && parsed.drafts[0].draftId).toBe(
    "boundary",
  );
  draft.values += "x";
  const raw = recoveryFiles([draft], "workspace").next().value!;
  expect(JSON.parse(raw.content).format).toBe("verso.recovery.raw");
  const oversized = JSON.stringify({
    format: "verso.recovery",
    schemaVersion: 1,
    exportedAt: "2026-11-03T12:00:00.000Z",
    sourceWorkspaceId: "workspace",
    drafts: [draft],
  });
  expect(() => parsePortable(oversized, "recovery")).toThrow(
    /draft exceeds 64 MiB/,
  );
}, 60_000);
