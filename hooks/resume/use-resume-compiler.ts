"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { renderLatex } from "@/lib/resume/render";
import { resolveSettings } from "@/lib/resume/settings";
import { BrowserCompiler } from "@/tools/compiler-proof/compiler.mjs";
import type { OutputLayout, ResumeOutput } from "@/types-and-constants/resume";
import type { Locale, ResumeDocument } from "@/types-and-constants/resume";

type ResumeCompilerOptions = {
  document: ResumeDocument;
  variantId: string;
  locale: Locale;
  autoSync: boolean;
  initializationTimeoutMs: number;
  compilationTimeoutMs: number;
};

/** Identify selected output independently of workspace revision and hidden content.
 * @param document Frozen workspace. @param variantId Variant. @param locale Language.
 * @returns A deterministic local key, including selected wording and effective settings.
 * @example snapshotKey(doc, "general", "en-US")
 */
function snapshotKey(
  document: ResumeDocument,
  variantId: string,
  locale: Locale,
): string {
  const variant = document.variants.find((item) => item.id === variantId);
  return JSON.stringify({
    template: document.template,
    profile: document.profile,
    variantId,
    name: variant?.name,
    locale,
    settings: variant && resolveSettings(document, variant, locale),
    sections: variant?.sections
      .filter((selected) => selected.visible)
      .map((selected) => {
        const section = document.sections.find(
          (item) => item.id === selected.sectionId,
        );
        return {
          id: selected.sectionId,
          heading: section?.heading,
          kind: section?.kind,
          entries: selected.entries.flatMap((selection) => {
            const entry = section?.entries.find(
              (item) => item.id === selection.entryId,
            );
            return entry && !entry.archived
              ? [
                  {
                    ...entry,
                    bullets: selection.bulletIds.map((id) =>
                      entry.bullets.find((bullet) => bullet.id === id),
                    ),
                  },
                ]
              : [];
          }),
        };
      }),
  });
}

/** Read the actual page count without letting PDF inspection hold downloads indefinitely.
 * @param bytes Compiled PDF bytes, copied before PDF.js transfers them to its worker.
 * @returns Page count; throws on a parsing failure or after ten seconds, with resources destroyed.
 * @example await readPageCount(output.bytes)
 */
async function readPageCount(bytes: Uint8Array): Promise<number> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/compiler/pdf.worker.mjs";
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    isEvalSupported: false,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const pdf = await Promise.race([
      task.promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("PDF inspection timed out")),
          10_000,
        );
      }),
    ]);
    return pdf.numPages;
  } finally {
    clearTimeout(timer);
    await task.destroy();
  }
}

/** Coordinate browser compilation and latest-only preview updates. @param options Current snapshot, selection, automatic sync toggle (800 ms debounce), and independent timeouts. @returns Preview/status/error, pending state covering queued and active requests, stale indicator, serial snapshot compiler, snapshot-matched layout status for either locale, and manual refresh action that ignores requests while pending and remains available when sync is paused. @example useResumeCompiler({document, variantId, locale, autoSync: true, initializationTimeoutMs: 120000, compilationTimeoutMs: 30000}) */
export function useResumeCompiler(options: ResumeCompilerOptions) {
  const {
    document,
    variantId,
    locale,
    autoSync,
    initializationTimeoutMs,
    compilationTimeoutMs,
  } = options;
  const [layouts, setLayouts] = useState<OutputLayout[]>([]);
  const [pendingKeys, setPendingKeys] = useState<string[]>([]);
  const [preview, setPreview] = useState<ResumeOutput>();
  const [status, setStatus] = useState("idle");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<{ message: string; log: string }>();
  const engine = useRef<BrowserCompiler | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pendingRequests = useRef(0);
  const layoutCache = useRef(new Map<string, OutputLayout>());
  const cache = useRef(new Map<string, ResumeOutput>());
  const activeKey = useRef("");
  const automaticKey = useRef("");
  const mounted = useRef(false);
  const key = useMemo(
    () => snapshotKey(document, variantId, locale),
    [document, variantId, locale],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      engine.current?.close();
      engine.current = null;
    };
  }, [initializationTimeoutMs, compilationTimeoutMs]);

  const getPdf = useCallback(
    (
      snapshot: ResumeDocument,
      selectedVariant: string,
      selectedLocale: Locale,
      automatic = false,
      force = false,
    ): Promise<ResumeOutput> => {
      const requestedKey = snapshotKey(
        snapshot,
        selectedVariant,
        selectedLocale,
      );
      pendingRequests.current += 1;
      if (mounted.current) {
        setIsPending(true);
        setPendingKeys((keys) => [...keys, requestedKey]);
        if (pendingRequests.current === 1) {
          setError(undefined);
          setStatus("queued");
        }
      }
      const job = queue.current
        .catch(() => {})
        .then(async () => {
          if (
            !mounted.current ||
            (automatic && automaticKey.current !== requestedKey)
          )
            throw new Error("Obsolete preview request");
          setError(undefined);
          setStatus("queued");
          const rendered = renderLatex(
            snapshot,
            selectedVariant,
            selectedLocale,
          );
          let output = force ? undefined : cache.current.get(requestedKey);
          // Downloads retain exact revision metadata; automatic previews can reuse
          // the last PDF when an edit only changes content omitted from output.
          if (!automatic && output?.revision !== snapshot.revision)
            output = undefined;
          if (!output) {
            engine.current ||= new BrowserCompiler({
              assetBase: "/compiler/",
              initializationTimeoutMs,
              compilationTimeoutMs,
              onState: (state) => {
                if (mounted.current) setStatus(state);
              },
            });
            try {
              const result = await engine.current.compile({
                source: rendered.source,
                locale: selectedLocale,
                snapshotId: `revision-${snapshot.revision}-${selectedVariant}-${selectedLocale}`,
              });
              if (
                result.templateId !== snapshot.template.id ||
                result.templateVersion !== snapshot.template.version
              )
                throw new Error(
                  "The prepared compiler bundle does not match this document's exact template version. Prepare the matching assets before exporting.",
                );
              output = {
                ...result,
                rendered,
                key: requestedKey,
                revision: snapshot.revision,
              };
              cache.current.set(requestedKey, output);
              if (cache.current.size > 4)
                cache.current.delete(cache.current.keys().next().value!);
            } catch (error) {
              engine.current?.close();
              engine.current = null;
              throw error;
            }
          }
          let layout = layoutCache.current.get(requestedKey);
          if (!layout || force || layout.error) {
            try {
              layout = {
                key: requestedKey,
                locale: selectedLocale,
                pageCount: await readPageCount(output.bytes),
              };
            } catch {
              layout = {
                key: requestedKey,
                locale: selectedLocale,
                error:
                  "The PDF compiled, but its page count could not be read. Try checking layout again.",
              };
            }
            layoutCache.current.set(requestedKey, layout);
            if (layoutCache.current.size > 4)
              layoutCache.current.delete(
                layoutCache.current.keys().next().value!,
              );
          }
          if (mounted.current)
            setLayouts((results) =>
              [
                ...results.filter((result) => result.key !== requestedKey),
                layout!,
              ].slice(-4),
            );
          if (mounted.current && activeKey.current === requestedKey) {
            setPreview(output);
            setError(undefined);
            setStatus("successful");
          }
          return output;
        })
        .catch((reason: unknown) => {
          if (
            mounted.current &&
            (reason as Error).message !== "Obsolete preview request"
          ) {
            const failure = {
              key: requestedKey,
              locale: selectedLocale,
              error:
                (reason as Error).message ||
                "Compilation failed. Retry the layout check.",
            };
            setLayouts((results) =>
              [
                ...results.filter((result) => result.key !== requestedKey),
                failure,
              ].slice(-4),
            );
          }
          throw reason;
        })
        .finally(() => {
          pendingRequests.current -= 1;
          if (!mounted.current) return;

          setPendingKeys((keys) => {
            const index = keys.indexOf(requestedKey);
            return keys.filter((_, position) => position !== index);
          });
          const remaining = pendingRequests.current;
          setIsPending(remaining > 0);
          setStatus((current) =>
            remaining > 0 ? "queued" : current === "queued" ? "idle" : current,
          );
        });
      queue.current = job;
      return job;
    },
    [initializationTimeoutMs, compilationTimeoutMs],
  );

  const reportError = useCallback((reason: unknown) => {
    const failure = reason as {
      message?: string;
      log?: string;
      timedOut?: boolean;
    };
    if (failure.message === "Obsolete preview request" || !mounted.current)
      return;
    setError({
      message: failure.message || "Compilation failed",
      log: failure.log || "",
    });
    setStatus(failure.timedOut ? "timed-out" : "failed");
  }, []);

  useEffect(() => {
    activeKey.current = key;
    automaticKey.current = autoSync ? key : "";
    if (!autoSync || preview?.key === key) return;

    const timer = setTimeout(() => {
      void getPdf(document, variantId, locale, true).catch((reason) => {
        if (activeKey.current === key) reportError(reason);
      });
    }, 800);
    return () => {
      clearTimeout(timer);
      automaticKey.current = "";
    };
  }, [
    key,
    document,
    variantId,
    locale,
    autoSync,
    getPdf,
    reportError,
    preview?.key,
  ]);

  const refresh = useCallback(() => {
    if (pendingRequests.current > 0) return;

    void getPdf(document, variantId, locale, false, true).catch(reportError);
  }, [document, variantId, locale, getPdf, reportError]);

  return {
    preview,
    layoutFor: (language: Locale) => {
      const expectedKey = snapshotKey(document, variantId, language);
      return {
        result: layouts.find((result) => result.key === expectedKey),
        outdated: layouts.some(
          (result) => result.locale === language && result.key !== expectedKey,
        ),
        pending: pendingKeys.includes(expectedKey),
      };
    },
    status: isPending && status === "successful" ? "queued" : status,
    isPending,
    error,
    stale: preview?.key !== key,
    getPdf,
    refresh,
  };
}
