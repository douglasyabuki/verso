"use client";

import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import * as core from "pdfjs-dist";
import type {
  EventBus,
  PDFLinkService,
  PDFViewer,
} from "pdfjs-dist/web/pdf_viewer.mjs";
import * as controls from "pdfjs-dist/web/pdf_viewer.mjs";
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { PdfOutline, PdfSource } from "@/types-and-constants/pdf-preview";

export type PdfViewPosition = { page: number; scale: string; offset?: number };

type PdfDocumentOptions = {
  source: PdfSource;
  container: RefObject<HTMLDivElement | null>;
  pages: RefObject<HTMLDivElement | null>;
  positionRef: RefObject<PdfViewPosition>;
  restorePosition: boolean;
  initialPositionRef?: RefObject<PdfViewPosition>;
  activePositionRef?: RefObject<RefObject<PdfViewPosition> | undefined>;
};

/** Load one PDF and coordinate its viewer, links, search events, and fit-on-resize lifecycle.
 * @param options Source, page-container refs, and the mounted viewer's position and restore policy.
 * @returns Loaded PDF (null while loading), whether a page has rendered, viewer services, page/scale/search status, outline, and any load/render failure.
 * @example const pdf = usePdfDocument({ source, container, pages, positionRef, restorePosition: true });
 */
export function usePdfDocument({
  source,
  container,
  pages,
  positionRef,
  restorePosition,
  initialPositionRef,
  activePositionRef,
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
    let port: Worker | undefined;
    let worker: core.PDFWorker | undefined;
    let workerFailed = false;
    let releaseLinks: (() => void) | undefined;
    let observer: ResizeObserver | undefined;
    let frame = 0;
    const abort = new AbortController();
    const initialPosition = restorePosition
      ? (initialPositionRef ?? positionRef).current
      : { page: 1, scale: "page-width" };
    const record = (position: PdfViewPosition) => {
      positionRef.current = position;
      if (activePositionRef?.current)
        activePositionRef.current.current = position;
    };
    record(initialPosition);
    let restored = false;
    const intendedPage = () =>
      Math.min(
        (initialPositionRef?.current ?? initialPosition).page,
        viewer!.pagesCount,
      );
    const restore = () => {
      if (!viewer || !container.current) return;
      const position = initialPositionRef?.current ?? initialPosition;
      const page = intendedPage();
      viewer.currentScaleValue = position.scale;
      viewer.scrollPageIntoView({ pageNumber: page });
      const view = viewer.getPageView(page - 1);
      if (view && page === position.page && position.offset)
        container.current.scrollTop += view.div.offsetHeight * position.offset;
      record({
        page,
        scale: position.scale,
        offset: page === position.page ? position.offset : 0,
      });
      setPage(page);
    };
    const load = async () => {
      if (cancelled || !container.current || !pages.current) return;
      port = new Worker("/compiler/pdf.worker.mjs", { type: "module" });
      worker = core.PDFWorker.create({ port });
      const workerError = () => {
        workerFailed = true;
        if (!cancelled)
          setError("The PDF viewer worker stopped. Try updating the preview.");
      };
      port.addEventListener("error", workerError, { signal: abort.signal });
      port.addEventListener("messageerror", workerError, {
        signal: abort.signal,
      });
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
      const viewerOptions = {
        container: container.current,
        viewer: pages.current,
        eventBus: bus,
        linkService: links,
        findController: find,
        textLayerMode: 1,
        annotationMode: 2,
        maxCanvasPixels: 8_000_000,
        // PDF.js consumes this option to disconnect its own scroll and resize observers.
        abortSignal: abort.signal,
      };
      viewer = new controls.PDFViewer(viewerOptions);
      links.setViewer(viewer);
      releaseLinks = () => links.setDocument(null);
      instance.current = { viewer, bus, links };
      bus.on(
        "pagerendered",
        (event: {
          error?: unknown;
          pageNumber: number;
          cssTransform?: boolean;
        }) => {
          if (cancelled || !viewer) return;
          if (!restored && viewer.currentPageNumber !== intendedPage()) {
            restore();
            viewer.update();
            return;
          }
          if (!restored && event.pageNumber !== intendedPage()) return;
          if (event.error) {
            setError(
              "A PDF page could not be displayed. Try refreshing the preview.",
            );
            return;
          }
          if (!restored && !event.cssTransform) {
            const position = initialPositionRef?.current ?? initialPosition;
            if (
              viewer.currentPageNumber !== intendedPage() ||
              viewer.currentScaleValue !== position.scale
            ) {
              restore();
              viewer.update();
              return;
            }
            restore();
            restored = true;
            setRendered(true);
          }
        },
        { signal: abort.signal },
      );
      bus.on(
        "pagesinit",
        () => {
          if (!cancelled) restore();
        },
        { signal: abort.signal },
      );
      bus.on(
        "updateviewarea",
        () => {
          if (!restored || cancelled || !viewer || !container.current) return;
          const element = viewer.getPageView(viewer.currentPageNumber - 1)?.div;
          if (!element?.offsetHeight) return;
          const offset =
            (container.current.getBoundingClientRect().top -
              element.getBoundingClientRect().top) /
            element.offsetHeight;
          record({
            ...positionRef.current,
            offset: Math.max(0, Math.min(1, offset)),
          });
        },
        { signal: abort.signal },
      );
      bus.on(
        "pagechanging",
        (event: { pageNumber: number }) => {
          if (!cancelled) {
            record({
              ...positionRef.current,
              page: event.pageNumber,
              offset: 0,
            });
            setPage(event.pageNumber);
          }
        },
        { signal: abort.signal },
      );
      bus.on(
        "scalechanging",
        (event: { scale: number; presetValue?: string }) => {
          if (!cancelled) {
            const value = event.presetValue || String(event.scale);
            record({ ...positionRef.current, scale: value });
            setScaleState({
              value,
              percent: Math.round(event.scale * 100),
            });
          }
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
      loading = core.getDocument({
        url: source.url,
        isEvalSupported: false,
        worker,
      });
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
      const releaseWorker = () => {
        if (!port) return;
        worker?.destroy();
        port.terminate();
        port = undefined;
      };
      // Give PDF.js a bounded opportunity to release its per-document transport
      // before stopping the owned port, including after load or render failure.
      if (workerFailed || !loading) releaseWorker();
      else {
        const timeout = setTimeout(releaseWorker, 1000);
        void loading
          .destroy()
          .catch(() => {})
          .finally(() => {
            clearTimeout(timeout);
            releaseWorker();
          });
      }
    };
  }, [
    source.key,
    source.url,
    container,
    pages,
    positionRef,
    restorePosition,
    initialPositionRef,
    activePositionRef,
  ]);
  const setScale = useCallback((value: string) => {
    if (instance.current) instance.current.viewer.currentScaleValue = value;
  }, []);
  const go = useCallback(
    (number: number) => {
      const next = Math.max(1, Math.min(pdf?.numPages ?? 1, number));
      if (instance.current && pdf)
        instance.current.viewer.currentPageNumber = next;
      return next;
    },
    [pdf],
  );
  const find = useCallback(
    (query: string, again = false, previous = false) =>
      instance.current?.bus.dispatch("find", {
        source: instance.current.viewer,
        type: again ? "again" : "",
        query,
        caseSensitive: false,
        entireWord: false,
        highlightAll: true,
        findPrevious: previous,
        matchDiacritics: false,
      }),
    [],
  );
  const closeFind = useCallback(() => {
    instance.current?.bus.dispatch("findbarclose", {});
    setMatches("");
  }, []);
  const goToDestination = useCallback((destination: string | unknown[]) => {
    void instance.current?.links.goToDestination(destination);
  }, []);
  return useMemo(
    () => ({
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
    }),
    [
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
    ],
  );
}
