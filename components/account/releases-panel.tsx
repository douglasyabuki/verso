"use client";

import { useState } from "react";

import { CopyLinkButton, publicUrl } from "@/components/career/release-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import type { Releases } from "@/hooks/releases/use-releases";
import type { AccountSession } from "@/stores/account/session";
import type { CareerResume } from "@/types-and-constants/career";
import {
  type PublicLinkSummary,
  RELEASE_LIMITS,
  RELEASE_ROUTES,
  type ReleaseSummary,
} from "@/types-and-constants/releases";

const mib = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;

type Confirmation =
  | { kind: "delete"; release: ReleaseSummary }
  | { kind: "revoke-link"; link: PublicLinkSummary; name: string };

/** Settings › Public PDFs: links, release history, latest/rollback, revocation, automatic release, and quotas.
 * @param props Mounted release store (null for guests), session, and current resumes for labels.
 * @returns Panel content; destructive actions come last and require confirmation where irreversible.
 * @example <ReleasesPanel releases={releases} session={session} resumes={document.resumes} />
 */
export function ReleasesPanel({
  releases,
  session,
  resumes,
}: {
  releases: Releases | null;
  session?: AccountSession;
  resumes: CareerResume[];
}) {
  const [confirming, setConfirming] = useState<Confirmation | null>(null);
  const policy = (
    <p className="text-sm text-muted-foreground">
      Public PDFs are served without caching, so a new latest release, rollback,
      or revocation applies on the next request. Releases are kept until you
      delete them. Limits: {RELEASE_LIMITS.links} links,{" "}
      {RELEASE_LIMITS.releasesPerLink} releases per link,{" "}
      {mib(RELEASE_LIMITS.accountBytes)} in total, and{" "}
      {mib(RELEASE_LIMITS.pdfBytes)} per PDF.
    </p>
  );
  if (!releases)
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          {!session || session.kind === "unavailable"
            ? "Public PDF releases need accounts, which are not enabled on this deployment."
            : session.kind === "expired"
              ? "Sign in again in Account to manage public PDFs."
              : "Sign in from Account to release resume PDFs at unlisted public links. Guest workspaces are never published."}
        </p>
        {policy}
      </div>
    );
  const { store, state } = releases;
  const list = state.list;
  const ignore = () => {};
  const act = (work: () => Promise<unknown>) => void work().catch(ignore);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-sm">
          Use <strong>Publish PDF</strong> in the preview. Each resume has one
          unlisted latest link that follows the version you choose. Numbered
          links always show the same PDF.
        </p>
        {policy}
      </div>
      <Separator />
      {state.error && (
        <Alert variant="destructive">
          <AlertTitle>Release action failed</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {!list ? (
        <div className="flex flex-col items-start gap-2">
          <p role="status">
            {state.loading
              ? "Loading public PDFs…"
              : "Public PDFs are not loaded."}
          </p>
          {!state.loading && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => act(() => store.load())}
            >
              Retry
            </Button>
          )}
        </div>
      ) : (
        <>
          <p
            className="text-xs text-muted-foreground"
            aria-label="Release storage usage"
          >
            {list.usage.links} of {RELEASE_LIMITS.links} links ·{" "}
            {mib(list.usage.bytes)} of {mib(RELEASE_LIMITS.accountBytes)} used
          </p>
          {list.links.length === 0 && (
            <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
              No public releases yet.
            </p>
          )}
          {list.links.map((link) => {
            const resume = resumes.find((item) => item.id === link.resumeId);
            const name = resume
              ? resume.name || "Untitled resume"
              : `Deleted resume (${link.resumeName || "untitled"})`;
            const busy = state.busy !== null;
            const latestUrl = publicUrl(RELEASE_ROUTES.latest(link.token));
            return (
              <section
                key={link.id}
                aria-label={`Public link for ${name}`}
                className="flex flex-col gap-3 rounded-xl border bg-card p-4"
              >
                <h3 className="font-medium">{name}</h3>
                {link.latestReleaseId ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm break-all">
                      Latest:{" "}
                      <a
                        className="underline"
                        href={RELEASE_ROUTES.latest(link.token)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {latestUrl}
                      </a>
                    </p>
                    <CopyLinkButton url={latestUrl} label="Copy latest link" />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No latest release; the latest link shows nothing.
                  </p>
                )}
                <Field orientation="horizontal">
                  <Checkbox
                    id={`auto-release-${link.id}`}
                    checked={link.autoRelease}
                    disabled={busy}
                    onCheckedChange={(checked) =>
                      act(() =>
                        store.updateLink(link.id, {
                          action: "auto-release",
                          enabled: Boolean(checked),
                        }),
                      )
                    }
                  />
                  <FieldContent>
                    <FieldLabel htmlFor={`auto-release-${link.id}`}>
                      Release automatically after Save
                    </FieldLabel>
                    <FieldDescription>
                      Off by default. While this resume&apos;s preview is open
                      in a signed-in tab, each confirmed Save that changes its
                      PDF compiles and becomes the latest release. Typing and
                      unsaved drafts never publish.
                    </FieldDescription>
                  </FieldContent>
                </Field>
                <ol className="flex flex-col divide-y" aria-label="Releases">
                  {link.releases.map((release) => {
                    const latest = release.id === link.latestReleaseId;
                    const pinned = publicUrl(
                      RELEASE_ROUTES.pinned(link.token, release.number),
                    );
                    return (
                      <li
                        key={release.id}
                        aria-label={`Release ${release.number}`}
                        className="flex flex-col gap-2 py-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            Release {release.number}
                          </span>
                          {latest && <Badge>Latest</Badge>}
                          {release.revokedAt && (
                            <Badge variant="outline">Revoked</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(release.createdAt).toLocaleString()} ·
                          revision {release.revision} · {release.locale} ·{" "}
                          {mib(release.bytes)} · {release.templateId}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {!latest && !release.revokedAt && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                act(() =>
                                  store.updateLink(link.id, {
                                    action: "set-latest",
                                    releaseId: release.id,
                                  }),
                                )
                              }
                            >
                              Make latest
                            </Button>
                          )}
                          {!release.revokedAt && (
                            <CopyLinkButton url={pinned} label="Copy link" />
                          )}
                          {release.revokedAt ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                act(() =>
                                  store.updateRelease(release.id, {
                                    action: "restore",
                                  }),
                                )
                              }
                            >
                              Restore
                            </Button>
                          ) : (
                            !latest && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  act(() =>
                                    store.updateRelease(release.id, {
                                      action: "revoke",
                                    }),
                                  )
                                }
                              >
                                Revoke
                              </Button>
                            )
                          )}
                          {!latest && (
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                setConfirming({ kind: "delete", release })
                              }
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() =>
                      setConfirming({ kind: "revoke-link", link, name })
                    }
                  >
                    Revoke link
                  </Button>
                </div>
              </section>
            );
          })}
        </>
      )}
      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming?.kind === "delete"
                ? `Delete release ${confirming.release.number}?`
                : `Revoke the public link for ${confirming?.kind === "revoke-link" ? confirming.name : ""}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.kind === "delete"
                ? "Its numbered link stops working and the stored PDF is removed permanently."
                : "The latest link and every numbered link stop working, and all of its releases are deleted permanently. Releasing again creates a new link."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const target = confirming;
                setConfirming(null);
                if (target?.kind === "delete")
                  act(() => store.deleteRelease(target.release.id));
                else if (target?.kind === "revoke-link")
                  act(() => store.revokeLink(target.link.id));
              }}
            >
              {confirming?.kind === "delete" ? "Delete" : "Revoke link"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
