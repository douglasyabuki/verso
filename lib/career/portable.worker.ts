import { parsePortable } from "@/lib/career/model";
import type {
  PortableTransferEntry,
  PortableTransferMessage,
} from "@/lib/career/portable-import";

/** Send bounded object/string batches so a capacity import cannot require one huge main-thread clone.
 * @param value Validated portable envelope.
 * @returns No value; emits construction instructions followed by completion.
 * @example transfer(parsePortable(source, "workspace"))
 */
function transfer(value: unknown): void {
  const stack: { path: (string | number)[]; value: unknown }[] = [
    { path: [], value },
  ];
  let batch: PortableTransferEntry[] = [];
  let units = 0;
  const send = () => {
    self.postMessage({ entries: batch } satisfies PortableTransferMessage);
    batch = [];
    units = 0;
  };
  const push = (entry: PortableTransferEntry) => {
    batch.push(entry);
    units += typeof entry.value === "string" ? entry.value.length : 1;
    if (units >= 32_768 || batch.length >= 128) send();
  };
  while (stack.length) {
    const { path, value } = stack.pop()!;
    if (value !== null && typeof value === "object") {
      push({ path, kind: Array.isArray(value) ? "array" : "object" });
      const keys = Object.keys(value);
      for (let i = keys.length - 1; i >= 0; i--) {
        const key = keys[i];
        stack.push({
          path: [...path, Array.isArray(value) ? Number(key) : key],
          value: (value as Record<string, unknown>)[key],
        });
      }
    } else if (typeof value === "string" && value.length > 32_768) {
      for (let i = 0; i < value.length; i += 32_768)
        push({
          path,
          kind: i ? "append" : "value",
          value: value.slice(i, i + 32_768),
        });
    } else push({ path, kind: "value", value });
  }
  if (batch.length) send();
  self.postMessage({ done: true } satisfies PortableTransferMessage);
}

// Validation stays off the editing thread. The owner terminates this worker
// after success, error, cancellation, or unmount.
self.onmessage = (
  event: MessageEvent<{ file: File; kind: "workspace" | "recovery" }>,
) => {
  void event.data.file
    .text()
    .then((source) => {
      try {
        transfer(parsePortable(source, event.data.kind));
      } catch (error) {
        self.postMessage({ error: String(error) });
      }
    })
    .catch((error) => self.postMessage({ error: String(error) }));
};
