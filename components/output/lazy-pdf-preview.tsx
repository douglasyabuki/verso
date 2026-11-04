"use client";

import dynamic from "next/dynamic";

const PdfPreview = dynamic(() => import("@/components/output/pdf-preview"), {
  ssr: false,
  loading: () => (
    <p role="status" className="p-3">
      Loading PDF viewer...
    </p>
  ),
});

export default PdfPreview;
