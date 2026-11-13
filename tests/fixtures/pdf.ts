/** Build an isolated three-page PDF with bookmarks, metadata, links, and searchable text.
 * @param title Embedded title, useful for detecting stale document results.
 * @returns Complete UTF-8 PDF bytes with a deterministic cross-reference table.
 * @example const url = URL.createObjectURL(new Blob([previewPdf().buffer]));
 */
export function previewPdf(title = "Viewer fixture"): Uint8Array<ArrayBuffer> {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R /Outlines 10 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 9 0 R >> >> /Contents 4 0 R /Annots [14 0 R] >>",
    stream("First page search needle"),
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 9 0 R >> >> /Contents 6 0 R >>",
    stream("Second page content"),
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 9 0 R >> >> /Contents 8 0 R >>",
    stream("Third page search needle"),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Outlines /First 11 0 R /Last 12 0 R /Count 2 >>",
    "<< /Title (Overview bookmark) /Parent 10 0 R /Next 12 0 R /Dest [3 0 R /Fit] >>",
    "<< /Title (Final bookmark) /Parent 10 0 R /Prev 11 0 R /Dest [7 0 R /Fit] >>",
    `<< /Title (${title}) /Author (Verso fixture author) /Creator (Verso browser tests) /CreationDate (D:20261103120000Z) >>`,
    "<< /Type /Annot /Subtype /Link /Rect [40 740 300 770] /A << /S /URI /URI (https://example.com/) >> >>",
  ];
  let source = "%PDF-1.7\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(source.length);
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = source.length;
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  source += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 13 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(source);
}

/** Wrap fixture text in an uncompressed PDF content stream. */
function stream(text: string): string {
  const content = `BT /F1 16 Tf 40 760 Td (${text}) Tj ET`;
  return `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
}
