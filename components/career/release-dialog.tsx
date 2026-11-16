"use client";

import { Check, Copy, Globe, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import type { Releases } from "@/hooks/releases/use-releases";
import type { PreviewOutput } from "@/stores/output/preview-coordinator";
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

/** Copy a URL and show a short confirmation on the button. */
export function CopyLinkButton({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() =>
        void navigator.clipboard
          ?.writeText(url)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => {})
      }
    >
      {copied ? (
        <Check aria-hidden="true" data-icon="inline-start" />
      ) : (
        <Copy aria-hidden="true" data-icon="inline-start" />
      )}
      {copied ? "Copied" : label}
    </Button>
  );
}

/** Explicit, reviewed public release of the current committed PDF.
 * The trigger is enabled only for signed-in accounts with a current preview; the
 * dialog reviews what becomes public and uploads only after Release.
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
  const [advance, setAdvance] = useState(true);
  const [result, setResult] = useState<CreateReleaseResponse | null>(null);
  const [error, setError] = useState("");
  if (!releases)
    return signedOutHint ? (
      <p className="text-xs text-muted-foreground">{signedOutHint}</p>
    ) : null;
  const { store, state } = releases;
  const busy = state.busy === "release";
  const link = state.list?.links.find(
    (item) => item.resumeId === output?.tag.resumeId,
  );
  const released =
    result && state.list?.links.find((item) => item.id === result.linkId);
  const releasedNumber = released?.releases.find(
    (item) => item.id === result?.releaseId,
  )?.number;
  const submit = async () => {
    if (!output) return;
    setError("");
    try {
      setResult(
        await store.release({
          output,
          workspaceId,
          advance,
          automatic: false,
        }),
      );
    } catch (failure) {
      setError((failure as Error).message);
    }
  };
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={!output}
        title={
          output ? undefined : "Refresh the preview to release saved content"
        }
        onClick={() => {
          setResult(null);
          setError("");
          setAdvance(true);
          setOpen(true);
        }}
      >
        <Globe aria-hidden="true" data-icon="inline-start" />
        Release…
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {result ? "PDF released" : "Release this PDF publicly"}
            </DialogTitle>
            <DialogDescription>
              {result
                ? result.unchanged
                  ? "The latest release already has this output; nothing new was stored."
                  : "Anyone with these links can open the PDF. Private resumes and drafts stay private."
                : "Review what becomes public. Only this compiled PDF is published; your workspace, drafts, and other resumes stay private."}
            </DialogDescription>
          </DialogHeader>
          {output && !result && (
            <>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Resume</dt>
                <dd>{output.resumeName || "Untitled resume"}</dd>
                <dt className="text-muted-foreground">Language</dt>
                <dd>{output.language}</dd>
                <dt className="text-muted-foreground">Saved revision</dt>
                <dd>{output.revision}</dd>
                <dt className="text-muted-foreground">Link</dt>
                <dd>
                  {link
                    ? `Existing link · ${link.releases.length} ${link.releases.length === 1 ? "release" : "releases"}`
                    : "A new unlisted link is created"}
                </dd>
              </dl>
              <Alert>
                <AlertTitle>Unlisted is not private</AlertTitle>
                <AlertDescription>
                  Anyone who has the link can open and share the PDF, including
                  its title metadata (your name and this resume&apos;s name).
                  Revoke the link to stop it working.
                </AlertDescription>
              </Alert>
              <Field>
                <FieldLabel htmlFor="release-advance">
                  <Checkbox
                    id="release-advance"
                    checked={advance}
                    aria-describedby="release-advance-description"
                    onCheckedChange={(checked) => setAdvance(Boolean(checked))}
                  />
                  Make this the latest version
                </FieldLabel>
                <FieldDescription id="release-advance-description">
                  The latest link shows this release. Its numbered link never
                  changes either way.
                </FieldDescription>
              </Field>
            </>
          )}
          {released && (
            <div className="flex flex-col gap-3 text-sm">
              <p className="break-all">
                Latest:{" "}
                <a
                  className="underline"
                  href={RELEASE_ROUTES.latest(released.token)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {publicUrl(RELEASE_ROUTES.latest(released.token))}
                </a>
              </p>
              <div className="flex flex-wrap gap-2">
                <CopyLinkButton
                  url={publicUrl(RELEASE_ROUTES.latest(released.token))}
                  label="Copy latest link"
                />
                {releasedNumber !== undefined && (
                  <CopyLinkButton
                    url={publicUrl(
                      RELEASE_ROUTES.pinned(released.token, releasedNumber),
                    )}
                    label={`Copy link to release ${releasedNumber}`}
                  />
                )}
              </div>
              {released.latestReleaseId !== result?.releaseId && (
                <p className="text-muted-foreground">
                  The latest link still shows an earlier release.
                </p>
              )}
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Release failed</AlertTitle>
              <AlertDescription>
                {error}
                {state.uncertain &&
                  " Retrying sends the same release, so it is never published twice."}
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            {result ? (
              <Button onClick={() => setOpen(false)}>Done</Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  disabled={!output || busy}
                  aria-busy={busy}
                  onClick={() => void submit()}
                >
                  {busy && (
                    <LoaderCircle
                      aria-hidden="true"
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  )}
                  {busy ? "Releasing…" : error ? "Retry release" : "Release"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
