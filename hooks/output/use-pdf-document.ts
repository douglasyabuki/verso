"use client";

import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import * as core from "pdfjs-dist";
import type {
  EventBus,
  PDFLinkService,
  PDFViewer,
} from "pdfjs-dist/web/pdf_viewer.mjs";
import * as controls from "pdfjs-dist/web/pdf_viewer.mjs";
import { type RefObject, useEffect, useRef, useState } from "react";

import type { PdfOutline, PdfSource } from "@/types-and-constants/pdf-preview";

type PdfDocumentOptions = {
  source: PdfSource;
  container: RefObject<HTMLDivElement | null>;
  pages: RefObject<HTMLDivElement | null>;
};

/** Load one PDF and coordinate its viewer, links, search events, and fit-on-resize lifecycle.
 * @param options Source identity/URL and the mounted page-container refs.
 * @returns Loaded PDF (null while loading), whether a page has rendered, viewer services, page/scale/search status, outline, and any load/render failure.
 * @example const pdf = usePdfDocument({ source, container, pages });
 */
export function usePdfDocument({
  source,
  container,
  pages,
}: PdfDocumentOptions) {
  const instance = useRef<{
    viewer: PDFViewer;
    bus: EventBus;
    links: PDFLinkService;
  } | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [rendered, setRendered] = useState(false);
  const [page, setPage] = useState(1);
  const [scale, setScaleState] = useState({
    value: "page-width",
    percent: 100,
  });
  const [outline, setOutline] = useState<PdfOutline>([]);
  const [outlineError, setOutlineError] = useState("");
  const [matches, setMatches] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let loading: PDFDocumentLoadingTask | undefined;
    let viewer: PDFViewer | undefined;
    let releaseLinks: (() => void) | undefined;
    let observer: ResizeObserver | undefined;
    let frame = 0;
    const abort = new AbortController();
    const load = async () => {
      if (cancelled || !container.current || !pages.current) return;
      core.GlobalWorkerOptions.workerSrc = "/compiler/pdf.worker.mjs";
      const bus = new controls.EventBus();
      const links = new controls.PDFLinkService({
        eventBus: bus,
        externalLinkTarget: 2,
        externalLinkRel: "noopener noreferrer",
        ignoreDestinationZoom: true,
      });
      const find = new controls.PDFFindController({
        eventBus: bus,
        linkService: links,
      });
      viewer = new controls.PDFViewer({
        container: container.current,
        viewer: pages.current,
        eventBus: bus,
        linkService: links,
        findController: find,
        textLayerMode: 1,
        annotationMode: 2,
        maxCanvasPixels: 8_000_000,
      });
      links.setViewer(viewer);
      releaseLinks = () => links.setDocument(null);
      instance.current = { viewer, bus, links };
      bus.on(
        "pagerendered",
        (event: { error?: unknown }) => {
          if (cancelled) return;
          if (event.error)
            setError(
              "A PDF page could not be displayed. Try refreshing the preview.",
            );
          else setRendered(true);
        },
        { signal: abort.signal },
      );
      bus.on(
        "pagesinit",
        () => {
          if (!cancelled) viewer!.currentScaleValue = "page-width";
        },
        { signal: abort.signal },
      );
      bus.on(
        "pagechanging",
        (event: { pageNumber: number }) => {
          if (!cancelled) setPage(event.pageNumber);
        },
        { signal: abort.signal },
      );
      bus.on(
        "scalechanging",
        (event: { scale: number; presetValue?: string }) => {
          if (!cancelled)
            setScaleState({
              value: event.presetValue || String(event.scale),
              percent: Math.round(event.scale * 100),
            });
        },
        { signal: abort.signal },
      );
      bus.on(
        "updatefindmatchescount",
        (event: { matchesCount: { current: number; total: number } }) => {
          if (!cancelled)
            setMatches(
              `${event.matchesCount.current} / ${event.matchesCount.total}`,
            );
        },
        { signal: abort.signal },
      );
      bus.on(
        "updatefindcontrolstate",
        (event: {
          state: number;
          matchesCount: { current: number; total: number };
        }) => {
          if (!cancelled)
            setMatches(
              event.state === 1
                ? "No matches"
                : `${event.matchesCount.current} / ${event.matchesCount.total}`,
            );
        },
        { signal: abort.signal },
      );
      loading = core.getDocument({ url: source.url, isEvalSupported: false });
      const document = await loading.promise;
      if (cancelled) return;
      links.setDocument(document);
      viewer.setDocument(document);
      setPdf(document);
      observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          if (cancelled || !viewer) return;
          const value = viewer.currentScaleValue;
          if (value === "page-fit" || value === "page-width")
            viewer.currentScaleValue = value;
          viewer.update();
        });
      });
      observer.observe(container.current);
      try {
        const result = await document.getOutline();
        if (!cancelled) setOutline(result ?? []);
      } catch {
        if (!cancelled)
          setOutlineError("Document outline could not be loaded.");
      }
    };
    void load().catch((reason) => {
      if (!cancelled)
        setError(
          reason instanceof Error ? reason.message : "Unable to display PDF",
        );
    });
    return () => {
      cancelled = true;
      abort.abort();
      observer?.disconnect();
      cancelAnimationFrame(frame);
      instance.current = null;
      // Release cached page canvases/text layers, then detach the document from
      // the viewer, its find controller, and link service before destroying it.
      viewer?.cleanup();
      viewer?.setDocument(null!);
      releaseLinks?.();
      void loading?.destroy();
    };
  }, [source.key, source.url, container, pages]);
  const setScale = (value: string) => {
    if (instance.current) instance.current.viewer.currentScaleValue = value;
  };
  const go = (number: number) => {
    const next = Math.max(1, Math.min(pdf?.numPages ?? 1, number));
    if (instance.current && pdf)
      instance.current.viewer.currentPageNumber = next;
    return next;
  };
  const find = (query: string, again = false, previous = false) =>
    instance.current?.bus.dispatch("find", {
      source: instance.current.viewer,
      type: again ? "again" : "",
      query,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      findPrevious: previous,
      matchDiacritics: false,
    });
  const closeFind = () => {
    instance.current?.bus.dispatch("findbarclose", {});
    setMatches("");
  };
  const goToDestination = (destination: string | unknown[]) => {
    void instance.current?.links.goToDestination(destination);
  };
  return {
    pdf,
    rendered,
    page,
    scale,
    outline,
    outlineError,
    matches,
    error,
    setScale,
    go,
    find,
    goToDestination,
    closeFind,
  };
}
