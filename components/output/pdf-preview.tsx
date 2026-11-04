"use client";

import {
  ArrowLeft,
  ArrowRight,
  Download,
  Info,
  Minus,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { PDFDateString } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DisclosureChevron,
  DisclosureLabel,
  disclosureTriggerClassName,
} from "@/components/ui/disclosure";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePdfDocument } from "@/hooks/output/use-pdf-document";
import type { PdfOutline, PdfSource } from "@/types-and-constants/pdf-preview";

function Thumbnail({
  pdf,
  number,
  current,
  onSelect,
}: {
  pdf: PDFDocumentProxy;
  number: number;
  current: boolean;
  onSelect: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let task: RenderTask | undefined;
    const target = canvas.current!;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void (async () => {
          const page = await pdf.getPage(number);
          if (cancelled) return;
          const original = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: 120 / original.width });
          target.width = Math.ceil(viewport.width);
          target.height = Math.ceil(viewport.height);
          task = page.render({ canvas: target, viewport });
          await task.promise;
        })().catch(() => {
          if (!cancelled) setError(true);
        });
      },
      {
        root: button.current?.closest("[data-pdf-navigation]"),
        rootMargin: "100px",
      },
    );
    observer.observe(button.current!);
    return () => {
      cancelled = true;
      observer.disconnect();
      task?.cancel();
      target.width = 0;
      target.height = 0;
    };
  }, [pdf, number]);
  return (
    <Button
      ref={button}
      variant={current ? "secondary" : "ghost"}
      className="h-auto w-full flex-col gap-2 py-3"
      aria-label={`Go to PDF page ${number}`}
      aria-current={current ? "page" : undefined}
      onClick={onSelect}
    >
      <canvas
        ref={canvas}
        aria-hidden="true"
        className="h-auto min-h-24 max-w-30 bg-white shadow-sm"
      />
      <span>
        {error
          ? `Page ${number} \u00b7 thumbnail unavailable`
          : `Page ${number}`}
      </span>
    </Button>
  );
}

function Outline({
  items,
  navigate,
}: {
  items: PdfOutline;
  navigate: (destination: string | unknown[]) => void;
}) {
  return (
    <ul className="flex min-w-0 flex-col gap-1">
      {items.map((item, index) => {
        const entry = item.dest ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto justify-start whitespace-normal"
            onClick={() => navigate(item.dest!)}
          >
            {item.title || "Untitled bookmark"}
          </Button>
        ) : item.url && /^(https?:|mailto:)/i.test(item.url) ? (
          <a
            className="block rounded-lg px-3 py-2 text-sm underline"
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {item.title || "Untitled bookmark"}
          </a>
        ) : (
          <span className="block px-3 py-2 text-sm wrap-anywhere">
            {item.title || "Untitled bookmark"}
          </span>
        );
        return (
          <li key={index} className="min-w-0 wrap-anywhere">
            {item.items.length ? (
              <Collapsible defaultOpen>
                <CollapsibleTrigger
                  render={<Button variant="ghost" size="sm" />}
                  className={disclosureTriggerClassName}
                >
                  <DisclosureChevron />
                  <DisclosureLabel>
                    {item.title || "Untitled bookmark"}
                  </DisclosureLabel>
                </CollapsibleTrigger>
                {item.dest && entry}
                <CollapsibleContent className="ms-3 border-s ps-3">
                  <Outline items={item.items} navigate={navigate} />
                </CollapsibleContent>
              </Collapsible>
            ) : (
              entry
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Properties({
  pdf,
  source,
  page,
}: {
  pdf: PDFDocumentProxy;
  source: PdfSource;
  page: number;
}) {
  const [rows, setRows] = useState<[string, string][] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [metadata, downloaded, currentPage] = await Promise.all([
        pdf.getMetadata(),
        pdf.getDownloadInfo(),
        pdf.getPage(page),
        import("pdfjs-dist"),
      ]);
      const info = metadata.info as Record<string, unknown>;
      const text = (key: string) =>
        typeof info[key] === "string" && info[key]
          ? String(info[key])
          : "Unavailable";
      const date = (key: string) =>
        PDFDateString.toDateObject(
          typeof info[key] === "string" ? String(info[key]) : "",
        )?.toLocaleString("en-US") ?? "Unavailable";
      const viewport = currentPage.getViewport({ scale: 1 });
      const values: [string, string][] = [
        ["Filename", source.fileName],
        ["File size", `${downloaded.length.toLocaleString("en-US")} bytes`],
        ["Pages", String(pdf.numPages)],
        [
          "Current-page dimensions",
          `${((viewport.width * 25.4) / 72).toFixed(1)} \u00d7 ${((viewport.height * 25.4) / 72).toFixed(1)} mm (page ${page})`,
        ],
        ["Title", text("Title")],
        ["Author", text("Author")],
        ["Subject", text("Subject")],
        ["Creator", text("Creator")],
        ["Producer", text("Producer")],
        ["Created", date("CreationDate")],
        ["Modified", date("ModDate")],
        ["PDF version", text("PDFFormatVersion")],
      ];
      if (!cancelled) setRows(values);
    })().catch(() => {
      if (!cancelled) setError("Document properties could not be loaded.");
    });
    return () => {
      cancelled = true;
    };
  }, [pdf, source.fileName, page]);
  return error ? (
    <p role="alert">{error}</p>
  ) : !rows ? (
    <p role="status">Loading properties...</p>
  ) : (
    <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="wrap-anywhere">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function LoadedPreview({ source }: { source: PdfSource }) {
  const container = useRef<HTMLDivElement>(null);
  const pages = useRef<HTMLDivElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const focusFrame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(focusFrame.current), []);
  const pdf = usePdfDocument({ source, container, pages });
  const [navigation, setNavigation] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [properties, setProperties] = useState(false);
  const count = pdf.pdf?.numPages ?? 0;
  const zoom =
    pdf.scale.value === "page-width" || pdf.scale.value === "page-fit"
      ? pdf.scale.value
      : String(pdf.scale.percent / 100);
  const zoomItems = [
    { value: "page-width", label: "Fit width" },
    { value: "page-fit", label: "Fit page" },
    ...[25, 50, 75, 100, 125, 150, 200, 300, 400].map((percent) => ({
      value: String(percent / 100),
      label: `${percent}%`,
    })),
  ];
  if (!zoomItems.some((item) => item.value === zoom))
    zoomItems.push({ value: zoom, label: `${pdf.scale.percent}%` });
  const { setScale, go, find } = pdf;
  const closeSearch = () => {
    pdf.closeFind();
    setQuery("");
    setSearch(false);
    searchButton.current?.focus();
  };
  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      aria-label="PDF viewer"
    >
      <div
        className="flex shrink-0 flex-wrap items-center gap-1 border-b px-2 py-1.5"
        aria-label="PDF controls"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="PDF navigation"
          aria-expanded={navigation}
          aria-controls="pdf-navigation"
          disabled={!count}
          onClick={() => setNavigation(!navigation)}
        >
          <PanelLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Previous PDF page"
          disabled={pdf.page <= 1}
          onClick={() => go(pdf.page - 1)}
        >
          <ArrowLeft />
        </Button>
        <Input
          key={pdf.page}
          appearance="utility"
          type="number"
          min={1}
          max={count || 1}
          className="w-14"
          aria-label="PDF page number"
          defaultValue={pdf.page}
          disabled={!count}
          onBlur={(event) => {
            const value = Number(event.target.value);
            event.target.value = String(
              go(Number.isInteger(value) && value > 0 ? value : pdf.page),
            );
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <span className="text-xs" aria-live="polite">
          / {count || "..."}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next PDF page"
          disabled={pdf.page >= count}
          onClick={() => go(pdf.page + 1)}
        >
          <ArrowRight />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom out PDF"
          disabled={!count || pdf.scale.percent <= 25}
          onClick={() =>
            setScale(String(Math.max(25, pdf.scale.percent - 10) / 100))
          }
        >
          <Minus />
        </Button>
        <Select
          items={zoomItems}
          value={zoom}
          disabled={!count}
          onValueChange={(value) => {
            if (value) setScale(value);
          }}
        >
          <SelectTrigger appearance="utility" size="sm" aria-label="PDF zoom">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {zoomItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="sr-only" role="status">
          PDF zoom {pdf.scale.percent}%
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom in PDF"
          disabled={!count || pdf.scale.percent >= 400}
          onClick={() =>
            setScale(String(Math.min(400, pdf.scale.percent + 10) / 100))
          }
        >
          <Plus />
        </Button>
        <Button
          ref={searchButton}
          variant="ghost"
          size="icon-sm"
          aria-label="Search PDF"
          aria-expanded={search}
          aria-controls="pdf-search"
          disabled={!count}
          onClick={() => {
            if (search) closeSearch();
            else {
              setSearch(true);
              focusFrame.current = requestAnimationFrame(() =>
                searchInput.current?.focus(),
              );
            }
          }}
        >
          <Search />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="PDF actions" />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem
                render={<a href={source.url} download={source.fileName} />}
              >
                <Download />
                Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!count}
                onClick={() => setProperties(true)}
              >
                <Info />
                Document properties
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {search && (
        <div
          id="pdf-search"
          className="flex shrink-0 flex-wrap items-center gap-1 border-b p-2"
        >
          <InputGroup className="min-w-32 flex-1">
            <InputGroupInput
              ref={searchInput}
              appearance="utility"
              aria-label="Search PDF text"
              value={query}
              placeholder="Find in document"
              onChange={(event) => {
                setQuery(event.target.value);
                find(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") find(query, true, event.shiftKey);
                if (event.key === "Escape") {
                  event.stopPropagation();
                  closeSearch();
                }
              }}
            />
            {query.length !== 0 && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label="Clear PDF search"
                  onClick={() => {
                    setQuery("");
                    find("");
                    searchInput.current?.focus();
                  }}
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          <span className="text-xs" role="status">
            {query ? pdf.matches : ""}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous PDF match"
            disabled={!query}
            onClick={() => find(query, true, true)}
          >
            <ArrowLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next PDF match"
            disabled={!query}
            onClick={() => find(query, true)}
          >
            <ArrowRight />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close PDF search"
            onClick={closeSearch}
          >
            <X />
          </Button>
        </div>
      )}
      {pdf.error && (
        <Alert variant="destructive">
          <AlertTitle>PDF viewer error</AlertTitle>
          <AlertDescription>{pdf.error}</AlertDescription>
        </Alert>
      )}
      {!count && !pdf.error && (
        <p role="status" className="p-3 text-sm">
          Loading PDF...
        </p>
      )}
      <div className="@container/pdf relative isolate flex min-h-0 min-w-0 flex-1 overflow-hidden bg-preview-surface">
        {navigation && pdf.pdf && (
          <aside
            id="pdf-navigation"
            aria-label="PDF document navigation"
            className="absolute inset-y-0 start-0 z-10 flex w-60 shrink-0 flex-col border-e bg-background shadow-md @min-[36rem]/pdf:static @min-[36rem]/pdf:shadow-none"
          >
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-sm">Document navigation</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close PDF navigation"
                onClick={() => setNavigation(false)}
              >
                <X />
              </Button>
            </div>
            <Tabs
              defaultValue="thumbnails"
              className="flex min-h-0 flex-1 flex-col gap-2 p-2"
            >
              <TabsList className="w-full">
                <TabsTrigger value="thumbnails">Thumbnails</TabsTrigger>
                <TabsTrigger value="outline">Document outline</TabsTrigger>
              </TabsList>
              <TabsContent
                value="thumbnails"
                data-pdf-navigation
                className="min-h-0 flex-1 overflow-auto"
                aria-label="PDF thumbnails"
              >
                {Array.from({ length: count }, (_, index) => (
                  <Thumbnail
                    key={index}
                    pdf={pdf.pdf!}
                    number={index + 1}
                    current={pdf.page === index + 1}
                    onSelect={() => go(index + 1)}
                  />
                ))}
              </TabsContent>
              <TabsContent
                value="outline"
                className="min-h-0 flex-1 overflow-auto"
                aria-label="Document outline"
              >
                {pdf.outline.length ? (
                  <Outline
                    items={pdf.outline}
                    navigate={(destination) => {
                      pdf.goToDestination(destination);
                    }}
                  />
                ) : (
                  <p className="p-2 text-sm text-muted-foreground">
                    {pdf.outlineError || "This PDF has no document outline."}
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </aside>
        )}
        <div className="relative min-w-0 flex-1">
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
      </div>
      <Dialog open={properties} onOpenChange={setProperties}>
        <DialogContent className="max-h-[85dvh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Document properties</DialogTitle>
            <DialogDescription>
              Properties of the last successful PDF.
            </DialogDescription>
          </DialogHeader>
          {properties && pdf.pdf && (
            <Properties pdf={pdf.pdf} source={source} page={pdf.page} />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default function PdfPreview({ document }: { document?: PdfSource }) {
  return document ? (
    <LoadedPreview key={`${document.key}:${document.url}`} source={document} />
  ) : (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>Your document starts here</EmptyTitle>
        <EmptyDescription>
          Refresh the preview to display your saved resume.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
