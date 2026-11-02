"use client";

import { useState } from "react";

import { useResumeCompiler } from "@/hooks/output/use-resume-compiler";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
import {
  bilingualZip,
  downloadFile,
  fileSlug,
  latexZip,
} from "@/lib/output/files";
import { validateOutput } from "@/lib/review/validation";
import type { Locale } from "@/types-and-constants/languages";
import { languageNames } from "@/types-and-constants/languages";
import { locales } from "@/types-and-constants/languages";
import type { ResumeDocument } from "@/types-and-constants/resume";

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
  const { controller } = useWorkspace();
  const [exporting, setExporting] = useState(false);
  const runExport = async (kind: "pdf" | "both" | "latex") => {
    if (controller.getSnapshot().pending || controller.getSnapshot().replacing)
      return;
    const epoch = controller.getSnapshot().workspaceEpoch;
    const generation = controller.getGeneration();
    const current = () =>
      controller.getSnapshot().workspaceEpoch === epoch &&
      controller.getGeneration() === generation;
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
              `Bilingual export needs valid ${languageNames[language]} content: ${issues.map((issue) => issue.message).join(" ")}`,
            );
        }
        const outputs = [];
        for (const language of locales)
          outputs.push(await compiler.getPdf(snapshot, selected, language));
        if (!current()) return;
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
        if (!current()) return;
        if (kind === "latex") {
          const bytes = await latexZip(output);
          if (!current()) return;
          downloadFile(
            bytes,
            `${prefix}-${selectedLocale}-latex.zip`,
            "application/zip",
          );
        } else
          downloadFile(
            output.bytes,
            `${prefix}-${selectedLocale}.pdf`,
            "application/pdf",
          );
      }
      if (current())
        controller.notify(
          "Download started",
          `${kind === "both" ? "Bilingual ZIP" : kind === "latex" ? "LaTeX and assets" : "PDF"} download started. Download a backup separately to keep your editable career details, resumes, and settings.`,
        );
    } catch (error) {
      if (current())
        controller.notify("Download could not start", (error as Error).message);
    } finally {
      setExporting(false);
    }
  };
  return {
    exporting,
    runExport,
  };
}
