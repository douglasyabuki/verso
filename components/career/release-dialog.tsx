"use client";

import { Check, Copy, Globe, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Releases } from "@/hooks/releases/use-releases";
import type { PreviewOutput } from "@/stores/output/preview-coordinator";
import {
  ReleaseError,
  type ReleaseInput,
} from "@/stores/releases/release-store";
import {
  type CreateReleaseResponse,
  RELEASE_ROUTES,
} from "@/types-and-constants/releases";

/** Absolute public URL for a release path.
 * @param path Route path from {@link RELEASE_ROUTES}.
 * @returns {string} URL on the current origin.
 * @example publicUrl(RELEASE_ROUTES.latest(token))
 */
export function publicUrl(path: string): string {
  return typeof window === "undefined"
    ? path
    : new URL(path, window.location.origin).toString();
}

/** Copy a public URL with feedback and a prompt to copy it manually on failure. */
export function CopyLinkButton({
  url,
  label,
  primary = false,
}: {
  url: string;
  label: string;
  primary?: boolean;
}) {
  const [feedback, setFeedback] = useState<"copied" | "failed" | null>(null);
  useEffect(() => {
    if (feedback !== "copied") return;
    const timer = setTimeout(() => setFeedback(null), 2000);
    return () => clearTimeout(timer);
  }, [feedback]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("copied");
    } catch {
      setFeedback("failed");
    }
  };
  return (
    <>
      <Button
        variant={primary ? "default" : "outline"}
        size={primary ? "default" : "sm"}
        onClick={() => void copy()}
      >
        {feedback === "copied" ? (
          <Check aria-hidden="true" data-icon="inline-start" />
        ) : (
          <Copy aria-hidden="true" data-icon="inline-start" />
        )}
        {feedback === "copied" ? "Copied" : label}
      </Button>
      {feedback === "failed" && (
        <p role="status" className="text-sm text-muted-foreground">
          {primary
            ? "Clipboard unavailable. Copy the URL above."
            : "Clipboard unavailable."}
        </p>
      )}
    </>
  );
}

type Review = Pick<ReleaseInput, "output" | "workspaceId">;

type Publication =
  | { kind: "publishing" }
  | { kind: "unconfirmed"; input: ReleaseInput }
  | { kind: "failed"; message: string }
  | { kind: "published"; result: CreateReleaseResponse; advance: boolean };

/** Review and publish the current committed PDF, with a retry for unanswered uploads.
 * @param props Mounted release store, current committed output, and workspace identity.
 * @returns Release trigger with its review dialog, or nothing for guests.
 * @example <ReleaseControl releases={releases} output={current} workspaceId={head.workspaceId} />
 */
export function ReleaseControl({
  releases,
  output,
  workspaceId,
  signedOutHint,
}: {
  releases: Releases | null;
  /** Current committed output, or null when the preview is missing or outdated. */
  output: PreviewOutput | null;
  workspaceId: string;
  /** Explanation shown in place of the trigger for guests; omitted when accounts are unavailable. */
  signedOutHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [publication, setPublication] = useState<Publication | null>(null);
  if (!releases)
    return signedOutHint ? (
      <p className="text-xs text-muted-foreground">{signedOutHint}</p>
    ) : null;
  const { store, state } = releases;
  const busy = publication?.kind === "publishing";
  const blocked = busy || state.busy !== null;
  const unconfirmed = publication?.kind === "unconfirmed" ? publication : null;
  const published = publication?.kind === "published" ? publication : null;
  const error = publication?.kind === "failed" ? publication.message : null;
  const reviewOutput = review?.output;
  const current =
    output !== null &&
    review !== null &&
    review.workspaceId === workspaceId &&
    review.output.key === output.key &&
    review.output.revision === output.revision;
  const link = state.list?.links.find(
    (item) => item.resumeId === reviewOutput?.tag.resumeId,
  );
  const released = published?.result.list.links.find(
    (item) => item.id === published.result.linkId,
  );
  const pinned = released?.releases.find(
    (item) => item.id === published?.result.releaseId,
  );
  const path = released
    ? published?.advance
      ? RELEASE_ROUTES.latest(released.token)
      : pinned && RELEASE_ROUTES.pinned(released.token, pinned.number)
    : undefined;

  const submit = async (advance: boolean) => {
    if (busy || store.getSnapshot().busy !== null) return;
    const input =
      unconfirmed?.input ??
      (current && review ? { ...review, advance, automatic: false } : null);
    if (!input) return;
    setPublication({ kind: "publishing" });
    try {
      const result = await store.release(input);
      setPublication({ kind: "published", result, advance: input.advance });
    } catch (failure) {
      setPublication(
        failure instanceof ReleaseError && failure.code === "offline"
          ? { kind: "unconfirmed", input }
          : { kind: "failed", message: (failure as Error).message },
      );
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (next && !unconfirmed) {
          if (!output) return;
          setReview({ output, workspaceId });
          setPublication(null);
        }
        setOpen(next);
      }}
    >
      <DialogTrigger
        render={<Button variant="outline" size="sm" />}
        disabled={!output && !unconfirmed}
        title={
          output || unconfirmed
            ? undefined
            : "Refresh the preview to publish saved content"
        }
      >
        <Globe aria-hidden="true" data-icon="inline-start" />
        Publish PDF
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {published ? "PDF published" : "Publish this PDF"}
          </DialogTitle>
          <DialogDescription>
            {published
              ? "Anyone with the link can open and share this PDF."
              : "Review the saved PDF before sharing it publicly."}
          </DialogDescription>
        </DialogHeader>
        {reviewOutput && !published && (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Resume</dt>
              <dd>{reviewOutput.resumeName || "Untitled resume"}</dd>
              <dt className="text-muted-foreground">Language</dt>
              <dd>{reviewOutput.language}</dd>
              <dt className="text-muted-foreground">Saved revision</dt>
              <dd>{reviewOutput.revision}</dd>
              <dt className="text-muted-foreground">Link</dt>
              <dd>
                {link
                  ? `Existing link · ${link.releases.length} ${link.releases.length === 1 ? "release" : "releases"}`
                  : "A new unlisted link is created"}
              </dd>
            </dl>
            <Alert>
              <AlertTitle>Anyone with the link can open this PDF</AlertTitle>
              <AlertDescription>
                The PDF includes your name and this resume&apos;s name in its
                metadata. You can revoke links in Settings.
              </AlertDescription>
            </Alert>
            {!busy &&
              !unconfirmed &&
              (current ? (
                <p className="text-sm text-muted-foreground">
                  Publish PDF updates the latest link. A pinned version gets a
                  numbered link and keeps the current latest selection.
                </p>
              ) : (
                <p role="status" className="text-sm text-muted-foreground">
                  The preview changed. Reopen this review from the current PDF.
                </p>
              ))}
          </>
        )}
        {published && path && (
          <div className="flex flex-col gap-3 text-sm">
            <a
              className="break-all underline"
              href={path}
              target="_blank"
              rel="noreferrer"
            >
              {publicUrl(path)}
            </a>
            {!published.advance && (
              <p className="text-muted-foreground">
                {released?.latestReleaseId
                  ? "The latest link still points to the selected version."
                  : "No latest version has been selected."}
              </p>
            )}
          </div>
        )}
        {(unconfirmed || error) && (
          <Alert variant="destructive">
            <AlertTitle>
              {unconfirmed ? "Publication unconfirmed" : "Publication failed"}
            </AlertTitle>
            <AlertDescription>
              {unconfirmed
                ? "The server did not confirm this publication. Retry checks the same request."
                : error}
            </AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          {published ? (
            <>
              <DialogCancel>Done</DialogCancel>
              {path && (
                <CopyLinkButton
                  primary
                  url={publicUrl(path)}
                  label={
                    published.advance ? "Copy latest link" : "Copy pinned link"
                  }
                />
              )}
            </>
          ) : (
            <>
              <DialogCancel disabled={busy}>
                {unconfirmed ? "Close" : "Cancel"}
              </DialogCancel>
              {!unconfirmed && !busy && (
                <Button
                  variant="outline"
                  disabled={!current || blocked}
                  onClick={() => void submit(false)}
                >
                  Publish pinned version
                </Button>
              )}
              <Button
                disabled={(!current && !unconfirmed) || blocked}
                aria-busy={busy}
                onClick={() => void submit(true)}
              >
                {busy && (
                  <LoaderCircle
                    aria-hidden="true"
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                )}
                {busy
                  ? "Publishing…"
                  : unconfirmed
                    ? "Retry publish"
                    : "Publish PDF"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
