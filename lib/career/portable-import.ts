import type { parsePortable } from "@/lib/career/model";

export type PortableTransferEntry = {
  path: (string | number)[];
  kind: "object" | "array" | "value" | "append";
  value?: unknown;
};
export type PortableTransferMessage = {
  entries?: PortableTransferEntry[];
  done?: boolean;
  error?: string;
};

/** Apply a bounded worker batch without parsing JSON or assigning prototype setters.
 * @param root Partially assembled validated envelope.
 * @param entry Container, primitive, or string-fragment instruction.
 * @returns Updated root; Unicode fragments remain UTF-16 until ordinary export.
 * @example const root = applyTransfer(undefined, {path:[],kind:"object"})
 */
function applyTransfer(root: unknown, entry: PortableTransferEntry): unknown {
  const value =
    entry.kind === "object" ? {} : entry.kind === "array" ? [] : entry.value;
  if (!entry.path.length) return value;
  let target = root as Record<string | number, unknown>;
  for (const key of entry.path.slice(0, -1))
    target = target[key] as Record<string | number, unknown>;
  const key = entry.path.at(-1)!;
  Object.defineProperty(target, key, {
    value:
      entry.kind === "append" ? String(target[key]) + String(value) : value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
  return root;
}

/** Parse and validate an imported file away from the editing thread.
 * @param file Bounded workspace or recovery source, retained by the caller on failure.
 * @param kind Required portable format.
 * @param signal Cancellation when superseded or the owning view unmounts.
 * @returns Validated envelope; rejects on malformed input or cancellation without storage writes.
 * @example await importPortable(file, "workspace", controller.signal)
 */
export function importPortable(
  file: File,
  kind: "workspace" | "recovery",
  signal: AbortSignal,
): Promise<ReturnType<typeof parsePortable>> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./portable.worker.ts", import.meta.url),
      { type: "module" },
    );
    let assembled: unknown;
    let settled = false;
    const cleanup = () => {
      settled = true;
      worker.terminate();
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Import canceled", "AbortError"));
    };
    worker.onmessage = (event: MessageEvent<PortableTransferMessage>) => {
      if (settled) return;
      try {
        if (event.data.error) throw new Error(event.data.error);
        for (const entry of event.data.entries ?? [])
          assembled = applyTransfer(assembled, entry);
        if (event.data.done) {
          cleanup();
          resolve(assembled as ReturnType<typeof parsePortable>);
        }
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    worker.onerror = (event) => {
      cleanup();
      reject(
        new Error(
          event.message ||
            "Import worker failed. Keep the source file and retry.",
        ),
      );
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    worker.postMessage({ file, kind });
  });
}
