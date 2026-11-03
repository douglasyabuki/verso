import { readFile, writeFile } from "node:fs/promises";

// Explicit offline salvage only. The output is a raw draft, not an importable
// recovery file; oversized/malformed values still require manual reconciliation.
const [destination, ...sources] = process.argv.slice(2);
if (!destination || !sources.length)
  throw new Error(
    "Usage: node tools/reassemble-recovery.mjs output.json chunk-1.json chunk-2.json ...",
  );
const chunks = await Promise.all(
  sources.map(async (source) => JSON.parse(await readFile(source, "utf8"))),
);
const first = chunks[0];
for (const chunk of chunks) {
  if (
    chunk.format !== "verso.recovery.raw" ||
    chunk.schemaVersion !== 1 ||
    chunk.encoding !== "json-text-fragment" ||
    chunk.sourceWorkspaceId !== first.sourceWorkspaceId ||
    chunk.draftId !== first.draftId ||
    chunk.draftVersion !== first.draftVersion ||
    chunk.chunks !== first.chunks ||
    !Number.isInteger(chunk.index) ||
    typeof chunk.data !== "string"
  )
    throw new Error(
      "Chunks do not describe one matching raw recovery version.",
    );
}
chunks.sort((a, b) => a.index - b.index);
if (
  chunks.length !== first.chunks ||
  chunks.some((chunk, index) => chunk.index !== index)
)
  throw new Error("Missing or duplicate recovery chunks.");
// Joining before UTF-8 encoding preserves surrogate pairs across fragment edges.
const source = chunks.map((chunk) => chunk.data).join("");
const draft = JSON.parse(source);
if (
  draft.draftId !== first.draftId ||
  draft.draftVersion !== first.draftVersion
)
  throw new Error(
    "Reassembled draft identity differs from its chunk metadata.",
  );
await writeFile(destination, source, { encoding: "utf8", flag: "wx" });
console.log(
  "Reassembled raw draft. Keep the original chunks; this file is not a normal recovery import.",
);
