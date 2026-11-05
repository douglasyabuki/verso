"use client";

import { cn } from "cn";
import { LoaderCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

/** Present an illustrated PDF empty/loading state with optional explicit generation. */
export function PdfPreviewPlaceholder({
  title = "Your resume, ready to preview",
  description = "Generate a PDF to see how your saved resume looks on the page.",
  busy = false,
  onGenerate,
  actionLabel = "Generate preview",
}: {
  title?: string;
  description?: string;
  busy?: boolean;
  onGenerate?: () => void;
  actionLabel?: string;
}) {
  const lineClass = cn(
    "h-1 rounded-sm motion-reduce:animate-none",
    !busy && "animate-none",
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-auto bg-preview-surface">
      <Empty className="m-auto flex-none gap-5 rounded-none px-6 py-10">
        <EmptyMedia aria-hidden="true">
          {busy ? (
            <LoaderCircle className="size-8 text-muted-foreground motion-safe:animate-spin" />
          ) : (
            <div className="relative isolate w-28">
              <div className="absolute inset-0 -z-1 translate-x-2 rotate-6 rounded-lg border bg-muted" />
              <div className="flex aspect-[1/1.414] -rotate-3 flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-1.5">
                  <div className="h-1.5 w-10 rounded-sm bg-primary/50" />
                  <Skeleton className={cn(lineClass, "w-14")} />
                </div>
                {[0, 1, 2].map((section) => (
                  <div key={section} className="flex flex-col gap-1.5">
                    <Skeleton className={cn(lineClass, "w-8")} />
                    <Skeleton className={cn(lineClass, "w-full")} />
                    <Skeleton className={cn(lineClass, "w-3/4")} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </EmptyMedia>
        <EmptyHeader role={busy ? "status" : undefined}>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        {onGenerate && !busy && (
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={onGenerate}>
              <RefreshCw aria-hidden="true" data-icon="inline-start" />
              {actionLabel}
            </Button>
          </EmptyContent>
        )}
      </Empty>
    </div>
  );
}
