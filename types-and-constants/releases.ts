/** Retention quotas for public PDF releases. Reaching a cap refuses the new
 * release; nothing is pruned automatically, so pinned URLs never break silently. */
export const RELEASE_LIMITS = {
  /** Public links per account (one per resume). */
  links: 10,
  /** Retained releases per link, including revoked ones until deleted. */
  releasesPerLink: 25,
  /** Total stored PDF bytes per account. */
  accountBytes: 50 * 1024 * 1024,
  /** One released PDF; keeps the upload below Vercel's 4.5 MB request cap. */
  pdfBytes: 4 * 1024 * 1024,
} as const;

/** Release API and public PDF routes. */
export const RELEASE_ROUTES = {
  releases: "/api/account/releases",
  link: (linkId: string) =>
    `/api/account/releases/links/${encodeURIComponent(linkId)}`,
  release: (releaseId: string) =>
    `/api/account/releases/${encodeURIComponent(releaseId)}`,
  latest: (token: string) => `/pdf/${encodeURIComponent(token)}`,
  pinned: (token: string, number: number) =>
    `/pdf/${encodeURIComponent(token)}/${number}`,
} as const;

/** Metadata sent with one explicit or automatic release upload. The server
 * re-renders the resume from its committed account workspace and requires the
 * same generation and output fingerprint before storing the PDF. */
export type ReleaseRequestMetadata = {
  /** Stable ID reused by retries of this exact release. */
  operationId: string;
  resumeId: string;
  workspaceId: string;
  /** Committed revision the PDF was compiled from (embedded in PDF metadata). */
  revision: number;
  generation: number;
  /** Revision-independent output fingerprint of the compiled source. */
  fingerprint: string;
  /** Template identity reported by the compiler result. */
  templateId: string;
  /** Advance the link's latest URL to this release (default for explicit releases). */
  advance: boolean;
  /** Automatic releases skip storage when the latest release has identical output. */
  automatic: boolean;
};

/** Stored release metadata; the PDF bytes are only served through public URLs. */
export type ReleaseSummary = {
  id: string;
  number: number;
  resumeId: string;
  revision: number;
  generation: number;
  fingerprint: string;
  locale: string;
  templateId: string;
  runtimeId: string;
  settingsSha256: string;
  sourceSha256: string;
  pdfSha256: string;
  bytes: number;
  fileName: string;
  revokedAt: string | null;
  createdAt: string;
};

/** One public link with its retained release history, newest first. */
export type PublicLinkSummary = {
  id: string;
  token: string;
  resumeId: string;
  /** Resume name when the link was created or last released. */
  resumeName: string;
  autoRelease: boolean;
  latestReleaseId: string | null;
  createdAt: string;
  releases: ReleaseSummary[];
};

/** All of an owner's links plus quota usage. */
export type ReleaseList = {
  links: PublicLinkSummary[];
  usage: { links: number; bytes: number };
};

/** Outcome of one release upload. */
export type CreateReleaseResponse = {
  list: ReleaseList;
  linkId: string;
  /** Stored (or replayed) release; for an unchanged automatic release, the current latest. */
  releaseId: string;
  /** A retry with the same operation ID returned the recorded release. */
  replayed: boolean;
  /** Automatic release found identical output already latest; nothing was stored. */
  unchanged: boolean;
};

/** Link-level actions. */
export type LinkAction =
  | { action: "set-latest"; releaseId: string }
  | { action: "auto-release"; enabled: boolean };

/** Release-level actions; deletion uses the DELETE method. */
export type ReleaseAction = { action: "revoke" } | { action: "restore" };
