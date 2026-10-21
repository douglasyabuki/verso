"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { renderLatex } from "@/lib/resume/render";
import { BrowserCompiler } from "@/tools/compiler-proof/compiler.mjs";
import type { ResumeOutput } from "@/types-and-constants/resume";
import type { Locale, ResumeDocument } from "@/types-and-constants/resume";

type ResumeCompilerOptions = {
  document: ResumeDocument;
  variantId: string;
  locale: Locale;
  autoSync: boolean;
  initializationTimeoutMs: number;
  compilationTimeoutMs: number;
};

/** Serialize a compiler cache identity without transmitting it. @param document Frozen workspace. @param variantId Variant. @param locale Language. @returns A deterministic local key. @example snapshotKey(doc, "general", "en-US") */
function snapshotKey(
  document: ResumeDocument,
  variantId: string,
  locale: Locale,
): string {
  return JSON.stringify({ document, variantId, locale });
}

/** Coordinate browser compilation and latest-only preview updates. @param options Current snapshot, selection, automatic sync toggle (800 ms debounce), and independent timeouts. @returns Preview/status/error, pending state covering queued and active requests, stale indicator, serial snapshot compiler, and manual refresh action that ignores requests while pending and remains available when sync is paused. @example useResumeCompiler({document, variantId, locale, autoSync: true, initializationTimeoutMs: 120000, compilationTimeoutMs: 30000}) */
export function useResumeCompiler(options: ResumeCompilerOptions) {
  const {
    document,
    variantId,
    locale,
    autoSync,
    initializationTimeoutMs,
    compilationTimeoutMs,
  } = options;
  const [preview, setPreview] = useState<ResumeOutput>();
  const [status, setStatus] = useState("idle");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<{ message: string; log: string }>();
  const engine = useRef<BrowserCompiler | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pendingRequests = useRef(0);
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
          if (mounted.current && activeKey.current === requestedKey) {
            setPreview(output);
            setError(undefined);
            setStatus("successful");
          }
          return output;
        })
        .finally(() => {
          pendingRequests.current -= 1;
          if (!mounted.current) return;

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
    if (!autoSync) return;

    const timer = setTimeout(() => {
      void getPdf(document, variantId, locale, true).catch((reason) => {
        if (activeKey.current === key) reportError(reason);
      });
    }, 800);
    return () => {
      clearTimeout(timer);
      automaticKey.current = "";
    };
  }, [key, document, variantId, locale, autoSync, getPdf, reportError]);

  const refresh = useCallback(() => {
    if (pendingRequests.current > 0) return;

    void getPdf(document, variantId, locale, false, true).catch(reportError);
  }, [document, variantId, locale, getPdf, reportError]);

  return {
    preview,
    status: isPending && status === "successful" ? "queued" : status,
    isPending,
    error,
    stale: preview?.key !== key,
    getPdf,
    refresh,
  };
}
