import type { PDFDocumentProxy } from "pdfjs-dist";

export type PdfSource = { key: string; url: string; fileName: string };

export type PdfOutline = NonNullable<
  Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>
>;
