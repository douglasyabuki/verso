"use client";

import dynamic from "next/dynamic";

import { PdfPreviewPlaceholder } from "@/components/output/pdf-preview-placeholder";

const PdfPreview = dynamic(() => import("@/components/output/pdf-preview"), {
  ssr: false,
  loading: () => (
    <PdfPreviewPlaceholder
      busy
      title="Opening your preview"
      description="Your PDF is ready. Getting the viewer ready to display it."
    />
  ),
});

export default PdfPreview;
