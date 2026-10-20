/**
 * Adapt the supplied pdfTeX resume for the pinned XeTeX toolchain without
 * changing its content or visual design.
 * @param {string} source Original Overleaf source.
 * @param {"en-US" | "pt-BR"} locale Output metadata language.
 * @returns {string} XeTeX-compatible source with explicit font weights/driver.
 * @example adaptReferenceSource(source, "pt-BR")
 */
export function adaptReferenceSource(source, locale) {
  if (!["en-US", "pt-BR"].includes(locale)) {
    throw new Error("Unsupported output language");
  }

  return source
    .replace(
      "\\pdfgentounicode=1",
      "\\ifdefined\\pdfgentounicode\\pdfgentounicode=1\\fi",
    )
    .replace(
      "\\usepackage[dvipsnames]{xcolor}",
      "\\usepackage[xetex,dvipsnames]{xcolor}",
    )
    .replaceAll("\\fontseries{black}\\selectfont", "\\interheavy")
    .replaceAll("\\fontseries{bold}\\selectfont", "\\bfseries")
    .replace(
      "pdftitle={Douglas Yabuki Resume},",
      `pdftitle={Douglas Yabuki Resume},\n    pdfauthor={Douglas Yuji Yabuki},\n    pdflang={${locale}},`,
    );
}

/** Browser engine error retaining the diagnostic log for inspection. */
export class CompilerError extends Error {
  constructor(message, log = "", timedOut = false) {
    super(message);
    this.name = "CompilerError";
    this.log = log;
    this.timedOut = timedOut;
  }
}

/**
 * Compile trusted generated source in two local-only WebAssembly workers.
 * Construction does not load the engine. One instance runs one job at a time.
 * @example const compiler = new BrowserCompiler({ compilationTimeoutMs: 30000 });
 */
export class BrowserCompiler {
  constructor({
    assetBase = "/assets/",
    initializationTimeoutMs = 120_000,
    compilationTimeoutMs = 30_000,
    onState = () => {},
  } = {}) {
    for (const timeout of [initializationTimeoutMs, compilationTimeoutMs]) {
      if (!Number.isFinite(timeout) || timeout < 100 || timeout > 600_000) {
        throw new Error("Timeouts must be between 100 and 600000 milliseconds");
      }
    }
    this.assetBase = new URL(assetBase, location.href);
    if (this.assetBase.origin !== location.origin) {
      throw new Error("Compiler assets must be hosted on this origin");
    }
    this.initializationTimeoutMs = initializationTimeoutMs;
    this.compilationTimeoutMs = compilationTimeoutMs;
    this.onState = onState;
    this.workers = [];
    this.ready = false;
    this.busy = false;
    this.pending = new Set();
  }

  async initialize() {
    if (this.ready) return { initializationMs: 0, reused: true };
    const start = performance.now();
    this.onState("initializing");
    this.controller = new AbortController();
    let timer;
    try {
      await Promise.race([
        this.loadAssets(this.controller.signal),
        new Promise((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new CompilerError(
                  "Compiler initialization timed out",
                  "",
                  true,
                ),
              ),
            this.initializationTimeoutMs,
          );
        }),
      ]);
      this.ready = true;
      this.onState("ready");
      return { initializationMs: performance.now() - start, reused: false };
    } catch (error) {
      this.close();
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async loadAssets(signal) {
    const response = await fetch(new URL("manifest.json", this.assetBase), {
      signal,
    });
    if (!response.ok)
      throw new CompilerError("Prepare compiler assets before initializing");
    this.manifest = await response.json();
    const bundleResponse = await fetch(
      new URL("resources.bundle", this.assetBase),
      {
        signal,
      },
    );
    if (!bundleResponse.ok)
      throw new CompilerError("The local package bundle is unavailable");
    const compressed = await bundleResponse.arrayBuffer();
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", compressed)),
    )
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    if (hash !== this.manifest.bundleSha256) {
      throw new CompilerError(
        "Package bundle integrity mismatch; prepare the assets again",
      );
    }
    const stream = new Blob([compressed])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    const encoded = await new Response(stream).json();
    signal.throwIfAborted();
    const files = encoded.map(([name, text]) => {
      const binary = atob(text);
      return [
        name,
        Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer,
      ];
    });
    for (const name of ["xetex", "dvipdfm"]) {
      signal.throwIfAborted();
      const worker = new Worker(
        new URL(`swiftlatex${name}.js`, this.assetBase),
      );
      this.workers.push(worker);
      await this.receive(worker, undefined);
      signal.throwIfAborted();
      await this.send(worker, "bundle", { files });
    }
  }

  receive(worker, command) {
    return new Promise((resolve, reject) => {
      const fail = (error) => {
        this.pending.delete(fail);
        reject(error);
      };
      this.pending.add(fail);
      worker.onerror = (event) =>
        fail(new CompilerError(event.message || "Compiler worker crashed"));
      worker.onmessageerror = () =>
        fail(
          new CompilerError("Compiler worker returned an unreadable response"),
        );
      worker.onmessage = (event) => {
        if (command === undefined && event.data.result === "failed") {
          fail(
            new CompilerError(
              "Compiler initialization failed",
              event.data.log || "",
            ),
          );
          return;
        }
        if (event.data.cmd !== command) return;
        this.pending.delete(fail);
        if (event.data.result !== "ok") {
          reject(
            new CompilerError("LaTeX compilation failed", event.data.log || ""),
          );
        } else {
          resolve(event.data);
        }
      };
    });
  }

  send(worker, cmd, extra = {}) {
    const promise = this.receive(
      worker,
      cmd.startsWith("compile") ? "compile" : cmd,
    );
    worker.postMessage({ cmd, ...extra });
    return promise;
  }

  /**
   * Compile an identifiable source snapshot using two TeX passes and XDV-to-PDF.
   * @param {{source: string, snapshotId: string, locale: string}} request Frozen source identity.
   * @returns {Promise<object>} PDF bytes, logs, identity, and separate timing measurements.
   * @example await compiler.compile({source, snapshotId: "draft-1", locale: "en-US"})
   */
  async compile(request) {
    if (this.busy) throw new CompilerError("Another compilation is running");
    if (
      !request.source ||
      new TextEncoder().encode(request.source).length > 1_000_000
    ) {
      throw new CompilerError(
        "Source must be nonempty and no larger than 1 MB",
      );
    }
    this.busy = true;
    let timer;
    let log = "";
    try {
      const initialization = await this.initialize();
      const start = performance.now();
      this.onState("compiling");
      const result = await Promise.race([
        (async () => {
          const [tex, pdf] = this.workers;
          tex.postMessage({ cmd: "flushcache" });
          pdf.postMessage({ cmd: "flushcache" });
          await this.send(tex, "writefile", {
            url: "main.tex",
            src: request.source,
          });
          tex.postMessage({ cmd: "setmainfile", url: "main.tex" });
          await this.send(tex, "compilelatex");
          const xdv = await this.send(tex, "compilelatex");
          log = xdv.log;
          await this.send(pdf, "writefile", {
            url: "main.xdv",
            src: new Uint8Array(xdv.pdf),
          });
          pdf.postMessage({ cmd: "setmainfile", url: "main.xdv" });
          const compiled = await this.send(pdf, "compilepdf");
          const bytes = new Uint8Array(compiled.pdf);
          if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
            throw new CompilerError(
              "The compiler did not return a PDF",
              compiled.log,
            );
          }
          return {
            bytes,
            log: log + "\n" + compiled.log,
            snapshotId: request.snapshotId,
            locale: request.locale,
            templateId: this.manifest.id,
            templateVersion: this.manifest.version,
            ...initialization,
            compilationMs: performance.now() - start,
          };
        })(),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new CompilerError("Compilation timed out", log, true)),
            this.compilationTimeoutMs,
          );
        }),
      ]);
      this.onState("successful");
      return result;
    } catch (error) {
      this.close();
      this.onState(error.timedOut ? "timed-out" : "failed");
      throw error;
    } finally {
      clearTimeout(timer);
      this.busy = false;
    }
  }

  close() {
    this.ready = false;
    this.controller?.abort();
    for (const worker of this.workers) worker.terminate();
    this.workers = [];
    for (const fail of this.pending) fail(new CompilerError("Compiler closed"));
    this.pending.clear();
  }
}
