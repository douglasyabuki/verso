"use client";

import { useState } from "react";

import { toast } from "@/components/ui/toast";
import { useResumeCompiler } from "@/hooks/resume/use-resume-compiler";
import {
  bilingualZip,
  downloadFile,
  fileSlug,
  latexZip,
} from "@/lib/resume/files";
import { validateOutput } from "@/lib/resume/validation";
import type { Locale, ResumeDocument } from "@/types-and-constants/resume";
import { locales } from "@/types-and-constants/resume";

type WorkspaceExportsOptions = {
  document: ResumeDocument;
  variant: ResumeDocument["variants"][number];
  locale: Locale;
  compiler: ReturnType<typeof useResumeCompiler>;
};

/** Export frozen browser-compiled snapshots without changing JSON backup freshness.
 * @param options Current document, output selection and compiler.
 * @returns Download action and pending state. Success and failure feedback uses toast notifications.
 * @example const exports = useWorkspaceExports({ document, variant, locale, compiler });
 */
export function useWorkspaceExports({
  document,
  variant,
  locale,
  compiler,
}: WorkspaceExportsOptions) {
  const [exporting, setExporting] = useState(false);
  const runExport = async (kind: "pdf" | "both" | "latex") => {
    setExporting(true);
    const snapshot = structuredClone(document);
    const selected = variant.id;
    const selectedLocale = locale;
    const prefix = `${fileSlug(snapshot.profile.name)}-${fileSlug(variant.name)}-r${snapshot.revision}`;
    try {
      if (kind === "both") {
        for (const language of locales) {
          const issues = validateOutput(
            snapshot,
            snapshot.variants.find((item) => item.id === selected)!,
            language,
          ).errors;
          if (issues.length)
            throw new Error(
              `Bilingual export needs valid ${language} content: ${issues.map((issue) => issue.message).join(" ")}`,
            );
        }
        const outputs = [];
        for (const language of locales)
          outputs.push(await compiler.getPdf(snapshot, selected, language));
        downloadFile(
          bilingualZip(snapshot, variant.name, outputs),
          prefix + "-bilingual.zip",
          "application/zip",
        );
      } else {
        const output = await compiler.getPdf(
          snapshot,
          selected,
          selectedLocale,
        );
        if (kind === "latex")
          downloadFile(
            await latexZip(output),
            `${prefix}-${selectedLocale}-latex.zip`,
            "application/zip",
          );
        else
          downloadFile(
            output.bytes,
            `${prefix}-${selectedLocale}.pdf`,
            "application/pdf",
          );
      }
      toast.add({
        type: "success",
        title: "Download requested",
        description: `${kind === "both" ? "Bilingual ZIP" : kind === "latex" ? "LaTeX and assets" : "PDF"} download started. JSON backup freshness is unchanged.`,
      });
    } catch (error) {
      toast.add({
        type: "error",
        title: "Action could not finish",
        description: (error as Error).message,
      });
    } finally {
      setExporting(false);
    }
  };
  return {
    exporting,
    runExport,
  };
}
