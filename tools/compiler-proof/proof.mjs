import { getDocument, GlobalWorkerOptions } from "/pdf.mjs";

import { adaptReferenceSource, BrowserCompiler } from "./compiler.mjs";

GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
const element = (id) => document.getElementById(id);
const outputs = new Map();
let compiler;
let active = false;
let manifest;
const labels = {
  initializing: "Loading local engine and packages…",
  ready: "Engine ready",
  compiling: "Compiling in browser…",
  successful: "Compiled successfully",
  failed: "Compilation failed",
  "timed-out": "Compilation timed out",
};

function configuration() {
  return {
    initializationTimeoutMs: Number(element("init-timeout").value) * 1000,
    compilationTimeoutMs: Number(element("compile-timeout").value) * 1000,
    onState: (state) => {
      element("status").textContent = labels[state] || state;
    },
  };
}

function reset() {
  compiler?.close();
  compiler = undefined;
  element("status").textContent = "Ready for cold initialization";
}

function setBusy(value) {
  active = value;
  for (const id of [
    "compile",
    "both",
    "reset",
    "locale",
    "init-timeout",
    "compile-timeout",
  ]) {
    element(id).disabled = value;
  }
}

async function inspectPdf(bytes) {
  const task = getDocument({ data: bytes.slice(), isEvalSupported: false });
  try {
    const doc = await task.promise;
    const metadata = await doc.getMetadata();
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const annotations = await page.getAnnotations();
      pages.push({
        page: i,
        text: content.items
          .map((item) => item.str + (item.hasEOL ? "\n" : " "))
          .join(""),
        links: annotations
          .filter((item) => item.subtype === "Link")
          .map((item) => item.url || item.unsafeUrl || item.dest),
      });
    }
    return { pageCount: doc.numPages, metadata: metadata.info, pages };
  } finally {
    await task.destroy();
  }
}

function show(locale) {
  element("reference").href = `/reference/${locale}.pdf`;
  const output = outputs.get(locale);
  element("preview").src = output?.url || "about:blank";
  element("preview-title").textContent = `Actual compiled PDF · ${locale}`;
  element("log").textContent = output?.log || "";
  element("diagnostics").textContent = output
    ? JSON.stringify(output.diagnostics, null, 2)
    : "Compile this language to inspect its PDF.";
}

function refreshDownloads() {
  element("downloads").replaceChildren();
  for (const [locale, output] of outputs) {
    const link = document.createElement("a");
    link.href = output.url;
    link.download = `douglas-yabuki-${locale}-compilation-proof.pdf`;
    link.textContent = `Download ${locale} PDF`;
    element("downloads").append(link);
  }
}

async function run(locales) {
  if (active) return;
  setBusy(true);
  element("error").hidden = true;
  const records = [];
  try {
    compiler ||= new BrowserCompiler(configuration());
    for (const locale of locales) {
      const response = await fetch(`/reference/${locale}.tex`);
      if (!response.ok)
        throw new Error(
          "Reference source missing. Run the preparation script.",
        );
      const source = adaptReferenceSource(await response.text(), locale);
      const result = await compiler.compile({
        source,
        locale,
        snapshotId: `reference-${manifest.version}-${locale}`,
      });
      const diagnostics = await inspectPdf(result.bytes);
      const previous = outputs.get(locale);
      if (previous) URL.revokeObjectURL(previous.url);
      const url = URL.createObjectURL(
        new Blob([result.bytes], { type: "application/pdf" }),
      );
      outputs.set(locale, { ...result, diagnostics, url });
      records.push({
        locale,
        initializationMs: result.initializationMs,
        compilationMs: result.compilationMs,
        bytes: result.bytes.length,
        pages: diagnostics.pageCount,
      });
    }
    element("metrics").textContent = records
      .map(
        (record) =>
          `${record.locale}: initialization ${(record.initializationMs / 1000).toFixed(2)}s · compilation ${(record.compilationMs / 1000).toFixed(2)}s · ${record.pages} pages · ${record.bytes.toLocaleString()} bytes`,
      )
      .join("\n");
    refreshDownloads();
    show(element("locale").value);
    return records;
  } catch (error) {
    element("error").textContent =
      error.message + (outputs.size ? ". Previous PDFs remain available." : "");
    element("error").hidden = false;
    element("log").textContent = error.log || "";
    element("status").textContent = error.timedOut
      ? "Timed out; adjust the timeout and retry"
      : "Failed; inspect diagnostics and retry";
    compiler?.close();
    compiler = undefined;
    throw error;
  } finally {
    setBusy(false);
  }
}

element("compile").addEventListener("click", () => {
  void run([element("locale").value]).catch(() => {});
});
element("both").addEventListener("click", () => {
  void run(["en-US", "pt-BR"]).catch(() => {});
});
element("locale").addEventListener("change", () =>
  show(element("locale").value),
);
element("reset").addEventListener("click", reset);
for (const id of ["init-timeout", "compile-timeout"])
  element(id).addEventListener("change", reset);
window.addEventListener("pagehide", () => {
  compiler?.close();
  for (const output of outputs.values()) URL.revokeObjectURL(output.url);
});

// Expose the demonstration for interactive browser-console inspection, not a test suite.
window.versoProof = { run, reset, outputs };
try {
  const response = await fetch("/assets/manifest.json");
  if (!response.ok)
    throw new Error(
      "Run python tools/compiler-proof/prepare.py before using this demonstration",
    );
  manifest = await response.json();
  element("manifest").textContent = JSON.stringify(manifest, null, 2);
} catch (error) {
  element("error").textContent = error.message;
  element("error").hidden = false;
  element("compile").disabled = true;
  element("both").disabled = true;
}
