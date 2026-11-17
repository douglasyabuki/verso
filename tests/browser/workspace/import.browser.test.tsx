import { expect, it } from "vitest";

import { importPortable } from "@/lib/career/portable-import";

it("transfers validated recovery in bounded batches without losing Unicode or assigning prototype setters", async () => {
  const text = "á🙂\n".repeat(50_000);
  const values = JSON.parse('{"__proto__":{"polluted":true},"wording":{}}');
  values.wording["en-US"] = text;
  const file = new File(
    [
      JSON.stringify({
        format: "verso.recovery",
        schemaVersion: 1,
        sourceWorkspaceId: "workspace",
        exportedAt: "2026-11-03T12:00:00.000Z",
        drafts: [
          {
            draftId: "draft",
            draftVersion: 1,
            workspaceId: "workspace",
            scope: "summary",
            generation: 0,
            baselineRevision: 0,
            baseline: null,
            values,
          },
        ],
      }),
    ],
    "recovery.json",
  );
  const result = await importPortable(
    file,
    "recovery",
    new AbortController().signal,
  );
  expect(result.format).toBe("verso.recovery");
  if (result.format !== "verso.recovery") throw new Error("Wrong format");
  const restored = result.drafts[0].values as typeof values;
  expect(restored.wording["en-US"]).toBe(text);
  expect(Object.hasOwn(restored, "__proto__")).toBe(true);
  expect(Object.getPrototypeOf(restored)).toBe(Object.prototype);
  expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
});
