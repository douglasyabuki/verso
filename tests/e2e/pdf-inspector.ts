import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

/** Extract PDF acceptance evidence without rendering or inspecting screenshots. */
export async function inspectPdf(base64: string) {
  GlobalWorkerOptions.workerSrc = "/compiler/pdf.worker.mjs";
  const task = getDocument({
    data: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
    fontExtraProperties: true,
  });
  const pdf = await task.promise;
  try {
    const metadata = await pdf.getMetadata();
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const text = await page.getTextContent();
      await page.getOperatorList();
      const fontIds = [
        ...new Set(
          text.items.flatMap((item) =>
            "fontName" in item ? [item.fontName] : [],
          ),
        ),
      ];
      const fonts = fontIds.map((id) => {
        const font = page.commonObjs.get(id) as {
          name: string;
          missingFile: boolean;
          data?: Uint8Array;
        };
        return {
          id,
          name: font.name,
          missingFile: font.missingFile,
          embeddedBytes: font.data?.length ?? 0,
        };
      });
      pages.push({
        text: text.items
          .flatMap((item) => ("str" in item ? [item.str] : []))
          .join(" "),
        urls: (await page.getAnnotations()).flatMap((item) =>
          item.url ? [item.url as string] : [],
        ),
        fonts,
      });
      page.cleanup();
    }
    return { pageCount: pdf.numPages, info: metadata.info, pages };
  } finally {
    await task.destroy();
  }
}
