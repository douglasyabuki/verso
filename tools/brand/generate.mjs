// Rebuild identity assets from the same geometry used by BrandMark.
// Uses the existing Next.js toolchain; no additional dependencies.
import { readFile, writeFile } from "node:fs/promises";

import sharp from "sharp";

const geometry = JSON.parse(
  await readFile("components/brand/geometry.json", "utf8"),
);
const paths = geometry.pages.map((d) => `<path d="${d}"/>`).join("");
const font = await readFile(
  "node_modules/next/dist/next-devtools/server/font/geist-latin.woff2",
);
const fontStyle = `<style>@font-face{font-family:Geist;src:url(data:font/woff2;base64,${font.toString("base64")}) format('woff2');font-weight:100 900}</style>`;
const svg = (body, viewBox = geometry.viewBox, attributes = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ${attributes}>${body}</svg>\n`;
for (const [name, color, text] of [
  ["", "#1F6258", "#202827"],
  ["-dark", "#8DCCBF", "#EDF2F1"],
  ["-mono", "currentColor", "currentColor"],
]) {
  await writeFile(
    `public/brand/verso-mark${name}.svg`,
    svg(`<g fill="${color}">${paths}</g>`),
  );
  await writeFile(
    `public/brand/verso-horizontal${name}.svg`,
    svg(
      `${fontStyle}<g fill="${color}">${paths}</g><text x="42" y="24" fill="${text}" font-family="Geist" font-size="24" font-weight="500" letter-spacing="-0.6">verso</text>`,
      "0 0 106 32",
    ),
  );
}
const icon = svg(
  `<style>:root{color:#1F6258}@media(prefers-color-scheme:dark){:root{color:#8DCCBF}}</style><g fill="currentColor">${paths}</g>`,
);
await writeFile("app/icon.svg", icon);
const pngs = [];
for (const size of [16, 24, 32]) {
  const png = await sharp(Buffer.from(svg(`<g fill="#1F6258">${paths}</g>`)))
    .resize(size, size)
    .png()
    .toBuffer();
  pngs.push(png);
}
// ICO container with lossless PNG entries at the three review sizes.
const header = Buffer.alloc(6 + pngs.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
let offset = header.length;
for (const [index, png] of pngs.entries()) {
  const entry = 6 + index * 16;
  header[entry] = header[entry + 1] = [16, 24, 32][index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
}
await writeFile("app/favicon.ico", Buffer.concat([header, ...pngs]));
await sharp(
  Buffer.from(
    svg(
      `<rect width="180" height="180" rx="32" fill="#1F6258"/><g transform="translate(26 26) scale(4)" fill="#FFFFFF">${paths}</g>`,
      "0 0 180 180",
    ),
  ),
)
  .resize(180)
  .png()
  .toFile("app/apple-icon.png");
console.log(
  "Generated horizontal, standalone, monochrome, SVG, ICO, and Apple touch assets.",
);
