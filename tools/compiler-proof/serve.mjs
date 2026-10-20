import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const here = fileURLToPath(new URL("./", import.meta.url));
const port = Number(process.env.COMPILER_PROOF_PORT || 3199);
const assets = path.join(root, ".cache/compiler-proof/assets");
const inputs = path.join(root, ".cache/compiler-proof/inputs");
const files = {
  "/": path.join(here, "index.html"),
  "/proof.mjs": path.join(here, "proof.mjs"),
  "/compiler.mjs": path.join(here, "compiler.mjs"),
  "/pdf.mjs": path.join(root, "node_modules/pdfjs-dist/build/pdf.mjs"),
  "/pdf.worker.mjs": path.join(
    root,
    "node_modules/pdfjs-dist/build/pdf.worker.mjs",
  ),
};
const types = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".tex": "text/plain; charset=utf-8",
};

createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; frame-src 'self' blob:; object-src 'none'; img-src 'self' data:",
  );
  if (request.method !== "GET") {
    response.writeHead(405).end("Read-only demonstration");
    return;
  }
  let file = files[url.pathname];
  if (/^\/assets\/[a-zA-Z0-9.-]+$/.test(url.pathname)) {
    file = path.join(assets, path.posix.basename(url.pathname));
  }
  if (/^\/reference\/(en-US|pt-BR)\.(tex|pdf)$/.test(url.pathname)) {
    file = path.join(inputs, path.posix.basename(url.pathname));
  }
  if (!file) {
    response.writeHead(404).end("Not found");
    return;
  }
  try {
    const data = await readFile(file);
    response.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
    });
    response.end(data);
  } catch {
    response
      .writeHead(404)
      .end(
        "Missing local asset. Run python tools/compiler-proof/prepare.py first.",
      );
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Compiler proof: http://127.0.0.1:${port}`);
  console.log(
    "Local reference documents only. No editor, storage, or remote package resolver.",
  );
});
