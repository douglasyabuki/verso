import { strToU8, zipSync } from "fflate";

import type { ResumeOutput } from "@/types-and-constants/output";
import type { ResumeDocument } from "@/types-and-constants/resume";

/**
 * Build a safe, readable filename segment.
 * @param value Owner or variant name.
 * @returns {string} ASCII slug, or "resume".
 * @example fileSlug("Alex Morgan")
 */
export function fileSlug(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "resume"
  );
}

/**
 * Start a browser download without treating it as durable workspace storage.
 * @param data File content.
 * @param name Filename.
 * @param type MIME type.
 * @returns {void} Nothing; URL is released later.
 * @example downloadFile(json, "backup.json", "application/json")
 */
export function downloadFile(
  data: Uint8Array | string,
  name: string,
  type: string,
): void {
  const blob = new Blob(
    [typeof data === "string" ? data : new Uint8Array(data).buffer],
    { type },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Package PDFs from a single frozen revision.
 * @param document Snapshot.
 * @param variantName Variant label.
 * @param outputs Successfully compiled languages.
 * @returns {Uint8Array} ZIP bytes with output identities.
 * @example bilingualZip(doc, "General", outputs)
 */
export function bilingualZip(
  document: ResumeDocument,
  variantName: string,
  outputs: ResumeOutput[],
): Uint8Array {
  const prefix = `${fileSlug(document.profile.name)}-${fileSlug(variantName)}-r${document.revision}`;
  const files: Record<string, Uint8Array> = {};
  for (const output of outputs)
    files[`${prefix}-${output.locale}.pdf`] = output.bytes;
  files["manifest.json"] = strToU8(
    JSON.stringify(
      {
        schemaVersion: 1,
        revision: document.revision,
        template: document.template,
        variant: variantName,
        outputs: outputs.map((output) => ({
          locale: output.locale,
          snapshotId: output.snapshotId,
          bytes: output.bytes.length,
        })),
      },
      null,
      2,
    ),
  );
  return zipSync(files, { level: 0 });
}

/**
 * Export generated source together with the exact browser runtime and resources.
 * @param output Frozen compiled output.
 * @returns {Promise<Uint8Array>} A self-contained source ZIP; throws if any required local asset cannot be read.
 * @example await latexZip(output)
 */
export async function latexZip(output: ResumeOutput): Promise<Uint8Array> {
  const response = await fetch("/compiler/manifest.json");
  if (!response.ok)
    throw new Error(
      "The files needed to download LaTeX are unavailable. Reload the app and try again. If this continues, the app’s template files need to be prepared again.",
    );
  const manifest = (await response.json()) as {
    id: string;
    version: string;
    assets: Record<string, unknown>;
  };
  if (
    manifest.id !== output.templateId ||
    manifest.version !== output.templateVersion
  )
    throw new Error(
      "The available template files do not match this resume. Reload the app and try downloading again.",
    );
  const files: Record<string, Uint8Array> = {
    "main.tex": strToU8(output.rendered.source),
    "assets/manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
    "template-settings.json": strToU8(
      JSON.stringify(
        {
          template: output.rendered.assetManifest,
          settings: output.rendered.settings,
          locale: output.locale,
          revision: output.revision,
        },
        null,
        2,
      ),
    ),
  };
  const assets = Object.keys(manifest.assets);
  if (assets.some((name) => !/^[a-zA-Z0-9.-]+$/.test(name)))
    throw new Error("The template manifest has an invalid asset path.");
  const results = await Promise.allSettled(
    assets.map(async (name) => {
      const response = await fetch("/compiler/" + name);
      if (!response.ok) throw new Error(`Template asset unavailable: ${name}`);
      return [name, new Uint8Array(await response.arrayBuffer())] as const;
    }),
  );
  for (const result of results) {
    if (result.status === "rejected") throw result.reason;
    files["assets/" + result.value[0]] = result.value[1];
  }
  files["index.html"] = strToU8(
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>Resume source compilation</title><h1>Compile exported LaTeX</h1><p>Serve this folder over localhost, then compile using the included pinned browser engine.</p><button id="compile">Compile PDF</button><p id="status" role="status"></p><a id="download" hidden download="resume.pdf">Download PDF</a><pre id="log"></pre><script type="module">import { BrowserCompiler } from './assets/compiler.mjs'; const button=document.getElementById('compile');const compiler=new BrowserCompiler({assetBase:'./assets/',onState:s=>document.getElementById('status').textContent=s});button.onclick=async()=>{button.disabled=true;try{const source=await(await fetch('./main.tex')).text();const output=await compiler.compile({source,snapshotId:'exported-source',locale:${JSON.stringify(output.locale)}});document.getElementById('log').textContent=output.log;const link=document.getElementById('download');link.href=URL.createObjectURL(new Blob([output.bytes],{type:'application/pdf'}));link.hidden=false;}catch(error){document.getElementById('log').textContent=error.message+'\\n'+(error.log||'');}finally{button.disabled=false;}};</script></html>`,
  );
  files["README.txt"] = strToU8(
    "Generated LaTeX and exact bundled assets. Run python -m http.server 8000 in this folder and open http://localhost:8000. The browser compiles main.tex locally. Native TeX installations are not guaranteed to reproduce this pinned WebAssembly format. Review the included license-* notices and resources.lock.json. This source export is not an editable Verso workspace backup; use Export JSON for that.\n",
  );
  return zipSync(files, { level: 0 });
}
