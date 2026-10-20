"use client";

import { ArrowLeft, ArrowRight, FileText, Search } from "lucide-react";
import type { EventBus, PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { useEffect, useId, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ResumeOutput } from "@/lib/resume/render";

export default function PdfPreview({ output }: { output?: ResumeOutput }) {
  const container = useRef<HTMLDivElement>(null);
  const pages = useRef<HTMLDivElement>(null);
  const instance = useRef<{ viewer: PDFViewer; bus: EventBus } | null>(null);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [query, setQuery] = useState("");
  const [diagnostics, setDiagnostics] = useState("");
  const [error, setError] = useState("");
  const [searchResult, setSearchResult] = useState("");
  const id = useId();

  useEffect(() => {
    if (!output || !container.current || !pages.current) return;
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | undefined;
    let viewer: PDFViewer | undefined;
    const load = async () => {
      const pdfjs = await import("pdfjs-dist");
      const controls = await import("pdfjs-dist/web/pdf_viewer.mjs");
      if (cancelled) return;
      pdfjs.GlobalWorkerOptions.workerSrc = "/compiler/pdf.worker.mjs";
      const bus = new controls.EventBus();
      const linkService = new controls.PDFLinkService({
        eventBus: bus,
        externalLinkTarget: 2,
        externalLinkRel: "noopener noreferrer",
      });
      const findController = new controls.PDFFindController({
        eventBus: bus,
        linkService,
      });
      viewer = new controls.PDFViewer({
        container: container.current!,
        viewer: pages.current!,
        eventBus: bus,
        linkService,
        findController,
        textLayerMode: 1,
        annotationMode: 2,
        maxCanvasPixels: 8_000_000,
      });
      linkService.setViewer(viewer);
      bus.on("pagesinit", () => {
        if (!cancelled) viewer!.currentScaleValue = "page-width";
      });
      bus.on("pagechanging", (event: { pageNumber: number }) => {
        if (!cancelled) setPage(event.pageNumber);
      });
      bus.on(
        "updatefindmatchescount",
        (event: { matchesCount: { current: number; total: number } }) => {
          if (!cancelled)
            setSearchResult(
              `${event.matchesCount.current} / ${event.matchesCount.total}`,
            );
        },
      );
      const loading = pdfjs.getDocument({
        data: output.bytes.slice(),
        isEvalSupported: false,
      });
      task = loading;
      const pdf = await loading.promise;
      if (cancelled) {
        await loading.destroy();
        return;
      }
      instance.current = { viewer, bus };
      viewer.setDocument(pdf);
      linkService.setDocument(pdf);
      setCount(pdf.numPages);
      setPage(1);
      setError("");
      setQuery("");
      setSearchResult("");
      const metadata = await pdf.getMetadata();
      const text: string[] = [JSON.stringify(metadata.info, null, 2)];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const annotations = await page.getAnnotations();
        text.push(
          `\nPAGE ${i}\n` +
            content.items
              .map((item) =>
                "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
              )
              .join(""),
        );
        text.push(
          "\nLinks:\n" +
            annotations
              .filter((annotation) => annotation.subtype === "Link")
              .map(
                (annotation) =>
                  annotation.url ||
                  annotation.unsafeUrl ||
                  "Internal destination",
              )
              .join("\n"),
        );
      }
      if (!cancelled) setDiagnostics(text.join("\n"));
    };
    void load().catch((reason) => {
      if (!cancelled) setError(reason.message || "Unable to display PDF");
    });
    return () => {
      cancelled = true;
      instance.current = null;
      viewer?.setDocument(null!);
      void task?.destroy();
    };
  }, [output]);

  if (!output)
    return (
      <div className="flex min-w-0 flex-1 items-center p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>Your document starts here</EmptyTitle>
            <EmptyDescription>
              Add your name and some career content. The compiled PDF will
              appear here as you work.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );

  return (
    <>
      <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-1.5">
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous PDF page"
              disabled={page <= 1}
              onClick={() => {
                if (instance.current)
                  instance.current.viewer.currentPageNumber = page - 1;
              }}
            >
              <ArrowLeft />
            </Button>
            <span className="min-w-10 text-center text-xs" aria-live="polite">
              {page} / {count || "…"}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next PDF page"
              disabled={page >= count}
              onClick={() => {
                if (instance.current)
                  instance.current.viewer.currentPageNumber = page + 1;
              }}
            >
              <ArrowRight />
            </Button>
          </div>
          <NativeSelect
            aria-label="PDF zoom"
            defaultValue="page-width"
            onChange={(event) => {
              if (instance.current)
                instance.current.viewer.currentScaleValue = event.target.value;
            }}
            size="sm"
          >
            <NativeSelectOption value="page-width">
              Fit width
            </NativeSelectOption>
            <NativeSelectOption value="0.75">75%</NativeSelectOption>
            <NativeSelectOption value="1">100%</NativeSelectOption>
            <NativeSelectOption value="1.25">125%</NativeSelectOption>
            <NativeSelectOption value="1.5">150%</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="flex min-w-0 flex-[1_1_12rem] items-center gap-2">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <label htmlFor={id} className="sr-only">
            Search PDF text
          </label>
          <Input
            id={id}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find in document"
            onKeyDown={(event) => {
              if (event.key === "Enter")
                instance.current?.bus.dispatch("find", {
                  source: instance.current.viewer,
                  type: "again",
                  query,
                  caseSensitive: false,
                  entireWord: false,
                  highlightAll: true,
                  findPrevious: event.shiftKey,
                  matchDiacritics: false,
                });
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              instance.current?.bus.dispatch("find", {
                source: instance.current.viewer,
                type: "",
                query,
                caseSensitive: false,
                entireWord: false,
                highlightAll: true,
                findPrevious: false,
                matchDiacritics: false,
              })
            }
          >
            Find
          </Button>
          <span className="shrink-0 text-xs" role="status">
            {searchResult}
          </span>
        </div>
      </div>
      {count > output.rendered.settings.targetPages && (
        <Alert className="shrink-0 rounded-none">
          <AlertTitle>
            {count} pages · target {output.rendered.settings.targetPages}
          </AlertTitle>
          <AlertDescription>
            Adjust the layout or variant selections. All your content is
            retained.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" className="shrink-0">
          <AlertTitle>PDF viewer error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="relative isolate min-h-0 min-w-0 flex-1 overflow-hidden bg-muted/50">
        <div
          ref={container}
          className="absolute inset-0 overflow-auto"
          tabIndex={0}
          role="region"
          aria-label="PDF document pages"
        >
          <div ref={pages} className="pdfViewer" />
        </div>
      </div>
      <details className="min-w-0 shrink-0 border-t bg-background px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium">
          Text extraction & diagnostics
        </summary>
        <ScrollArea
          className="mt-2 max-h-[min(12rem,20dvh)] min-w-0"
          viewportProps={{
            role: "region",
            "aria-label": "Extracted PDF text and diagnostics",
          }}
        >
          <pre className="pr-3 text-xs wrap-anywhere whitespace-pre-wrap">
            {diagnostics || "Extracting text…"}
          </pre>
        </ScrollArea>
      </details>
    </>
  );
}
