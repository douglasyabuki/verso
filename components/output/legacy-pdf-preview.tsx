"use client";

import { useCallback, useState } from "react";

import PdfPreview from "@/components/output/pdf-preview";
import type { ResumeOutput } from "@/types-and-constants/output";
import type { PdfSource } from "@/types-and-constants/pdf-preview";

/** Adapt the unmounted former compiler output to the schema-independent PDF viewer. */
export default function LegacyPdfPreview({
  output,
}: {
  output?: ResumeOutput;
}) {
  const [source, setSource] = useState<PdfSource>();
  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !output) return;
      const url = URL.createObjectURL(
        new Blob([output.bytes.slice().buffer], { type: "application/pdf" }),
      );
      setSource({
        key: output.key,
        url,
        fileName: `verso-${output.revision}.pdf`,
      });
      return () => URL.revokeObjectURL(url);
    },
    [output],
  );
  return (
    <div ref={attach} className="flex min-h-0 flex-1 flex-col">
      <PdfPreview document={source?.key === output?.key ? source : undefined} />
    </div>
  );
}
