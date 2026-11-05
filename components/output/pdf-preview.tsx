"use client";

import {
  ArrowLeft,
  ArrowRight,
  Download,
  Images,
  Info,
  Minus,
  MoreHorizontal,
  MoveHorizontal,
  PanelLeft,
  Plus,
  Scan,
  Search,
  Summary,
  X,
} from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { PDFDateString } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

import { PdfPreviewPlaceholder } from "@/components/output/pdf-preview-placeholder";
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
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { SidebarSelection } from "@/components/ui/sidebar-selection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const [navigationTab, setNavigationTab] = useState("thumbnails");
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [properties, setProperties] = useState(false);
  const count = pdf.pdf?.numPages ?? 0;
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
        className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 border-b px-2 py-1.5"
        aria-label="PDF controls"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="PDF navigation"
            aria-expanded={navigation}
            aria-controls="pdf-navigation"
            disabled={!count}
            onClick={() => {
              if (!navigation) setNavigationTab("thumbnails");
              setNavigation(!navigation);
            }}
          >
            <PanelLeft />
          </Button>
          <Separator
            orientation="vertical"
            className="h-4 data-vertical:self-center"
          />
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-1.5">
            <Input
              key={pdf.page}
              appearance="utility"
              type="text"
              inputMode="numeric"
              className="h-7 min-w-9 px-1.5 py-0.5 text-center"
              style={{ width: `${Math.max(1, String(count).length) + 2}ch` }}
              aria-label="PDF page number"
              defaultValue={pdf.page}
              disabled={!count}
              onBlur={(event) => {
                const text = event.target.value.trim();
                const value = Number(text);
                event.target.value = String(
                  go(
                    /^\d+$/.test(text) &&
                      Number.isSafeInteger(value) &&
                      value > 0
                      ? value
                      : pdf.page,
                  ),
                );
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
            <span className="text-xs" aria-live="polite">
              / {count || "..."}
            </span>
          </div>
          <div className="flex items-center gap-1">
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
            <Input
              key={`${pdf.scale.value}:${pdf.scale.percent}`}
              appearance="utility"
              type="text"
              inputMode="decimal"
              aria-label="PDF zoom"
              className="h-7 w-18 px-1.5 py-0.5 text-center"
              defaultValue={`${pdf.scale.percent}%`}
              disabled={!count}
              onBlur={(event) => {
                const text = event.target.value.trim();
                const value = Number(text.replace(/%$/, ""));
                if (
                  !/^\d+(?:\.\d+)?%?$/.test(text) ||
                  !Number.isFinite(value) ||
                  value <= 0
                ) {
                  event.target.value = `${pdf.scale.percent}%`;
                  return;
                }
                const percent = Math.max(25, Math.min(400, value));
                event.target.value = `${Math.round(percent)}%`;
                setScale(String(percent / 100));
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
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
            {[
              { value: "page-width", label: "Fit width", Icon: MoveHorizontal },
              { value: "page-fit", label: "Fit page", Icon: Scan },
            ].map(({ value, label, Icon }) => (
              <Tooltip key={value}>
                <TooltipTrigger
                  render={
                    <Button
                      variant={
                        pdf.scale.value === value ? "secondary" : "ghost"
                      }
                      size="icon-sm"
                      aria-label={label}
                      aria-pressed={pdf.scale.value === value}
                      disabled={!count}
                      onClick={() => setScale(value)}
                    />
                  }
                >
                  <Icon aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
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
        </div>
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
      <div className="@container/pdf relative isolate flex min-h-0 min-w-0 flex-1 overflow-hidden bg-preview-surface">
        {navigation && pdf.pdf && (
          <aside
            id="pdf-navigation"
            aria-label="PDF document navigation"
            className="absolute inset-y-0 start-0 z-10 flex w-60 shrink-0 border-e bg-background shadow-md @min-[36rem]/pdf:static @min-[36rem]/pdf:shadow-none"
          >
            <Tabs
              orientation="vertical"
              value={navigationTab}
              onValueChange={(value) => setNavigationTab(String(value))}
              className="min-h-0 min-w-0 flex-1 gap-0"
            >
              <div className="flex w-12 shrink-0 flex-col items-center gap-2 border-e py-2">
                <SidebarSelection
                  activeItemSelector='[role="tab"][data-active]'
                  className="w-9"
                >
                  <TabsList
                    aria-label="PDF navigation views"
                    activateOnFocus
                    variant="line"
                    className="gap-2 rounded-none bg-transparent p-0"
                  >
                    {[
                      {
                        value: "thumbnails",
                        label: "Thumbnails",
                        Icon: Images,
                      },
                      {
                        value: "outline",
                        label: "Document outline",
                        Icon: Summary,
                      },
                    ].map(({ value, label, Icon }) => (
                      <Tooltip key={value}>
                        <TooltipTrigger
                          render={
                            <TabsTrigger
                              value={value}
                              aria-label={label}
                              className="h-9 w-9 flex-none p-0 group-data-vertical/tabs:w-9 group-data-vertical/tabs:justify-center after:hidden"
                            />
                          }
                        >
                          <Icon aria-hidden="true" />
                        </TooltipTrigger>
                        <TooltipContent side="right">{label}</TooltipContent>
                      </Tooltip>
                    ))}
                  </TabsList>
                </SidebarSelection>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="mt-auto size-9 rounded-md"
                  aria-label="Close PDF navigation"
                  onClick={() => setNavigation(false)}
                >
                  <X />
                </Button>
              </div>
              <TabsContent
                value="thumbnails"
                data-pdf-navigation
                className="min-h-0 min-w-0 flex-1 overflow-auto p-2"
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
                className="min-h-0 min-w-0 flex-1 overflow-auto p-2"
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
          {!pdf.rendered && (
            <div className="absolute inset-0 z-10 flex">
              <PdfPreviewPlaceholder
                busy={!pdf.error}
                title={
                  pdf.error
                    ? "Your PDF could not be displayed"
                    : "Opening your PDF"
                }
                description={
                  pdf.error
                    ? "Try refreshing the preview, or download the PDF from the actions menu."
                    : "Loading the pages and getting them ready to read."
                }
              />
            </div>
          )}
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
    <PdfPreviewPlaceholder />
  );
}
