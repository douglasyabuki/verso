import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, it } from "vitest";

it("reassembles Unicode raw chunks in any order and rejects incomplete or duplicate chunks without overwriting", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "verso-recovery-"));
  const script = path.resolve("tools/reassemble-recovery.mjs");
  const destination = path.join(directory, "draft.json");
  const draft = { draftId: "draft", draftVersion: 1, values: "A\ud83d\ude42B" };
  const source = JSON.stringify(draft);
  const split = source.indexOf("\ud83d") + 1;
  const paths = [
    path.join(directory, "chunk1.json"),
    path.join(directory, "chunk2.json"),
  ];
  try {
    for (let i = 0; i < 2; i++)
      await writeFile(
        paths[i],
        JSON.stringify({
          format: "verso.recovery.raw",
          schemaVersion: 1,
          encoding: "json-text-fragment",
          sourceWorkspaceId: "workspace",
          draftId: "draft",
          draftVersion: 1,
          index: i,
          chunks: 2,
          data: i ? source.slice(split) : source.slice(0, split),
        }),
      );
    expect(() =>
      execFileSync(process.execPath, [script, destination, paths[0]], {
        stdio: "pipe",
      }),
    ).toThrow();
    expect(() =>
      execFileSync(
        process.execPath,
        [script, destination, paths[0], paths[0]],
        { stdio: "pipe" },
      ),
    ).toThrow();
    execFileSync(process.execPath, [script, destination, paths[1], paths[0]], {
      stdio: "pipe",
    });
    expect(JSON.parse(await readFile(destination, "utf8"))).toEqual(draft);
    expect(() =>
      execFileSync(process.execPath, [script, destination, ...paths], {
        stdio: "pipe",
      }),
    ).toThrow();
    expect(JSON.parse(await readFile(destination, "utf8"))).toEqual(draft);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
