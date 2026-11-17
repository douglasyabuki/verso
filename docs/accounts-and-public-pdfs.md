# Accounts and public PDFs

This reference owns the account and release security, persistence, and resource
contracts. Code paths in backticks are relative to the repository root.
See the [README](../README.md#configuration) for setup and
[Save and recovery](recovery-files.md#save-and-recovery-protocol) for shared commit rules.

## Account storage and sessions

- Stack: Better Auth 1.7.x with its Prisma adapter; Prisma ORM 7.10.x using the `prisma-client` generator (gitignored output), `@prisma/adapter-pg` with `pg`, and `prisma.config.ts` loading env through `@next/env`. Preserve the installed versions; a major upgrade requires a separate compatibility review.
- Hosting: Prisma Postgres through the Vercel Marketplace. Local development defaults to Docker PostgreSQL; `dev:prisma` uses the configured hosted PostgreSQL URL. Automated database tests (`tests/db/`) and account E2E (`tools/accounts-e2e-database.mjs`) apply the checked-in migrations to isolated in-process PGlite servers; never point tests at shared or hosted data. PGlite serializes connections, so real concurrent row locking remains an owner check against an isolated Postgres database.
- `getPrisma()` and `getAuth()` are lazy, `server-only` singletons. Building without account env must succeed and keep the app guest-only. Accounts activate only when `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and at least one provider's `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` or `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are present. See [configuration and deployment](../README.md#configuration) for environment settings.
- Sessions are database-backed with the cookie cache disabled, so expiry and revocation apply on the next request. Google/GitHub sign-ins automatically link only when resolved emails match and both incoming and existing local emails are verified. Keep trustedProviders empty and requireLocalEmailVerified enabled; preserve the existing profile and workspace. Different-email sign-ins remain separate accounts. No password auth or account deletion. Display safe OAuth callback errors in Settings › Account without exposing provider descriptions.
- Account data uses Node-runtime Route Handlers, not Server Actions, so retries and uncertainty receive explicit status codes. Each handler derives `userId` from the verified session using `request.headers`, requires a same-origin `Origin` on mutations, binds the request to the client's session ID to reject writes from a previous session, rejects unknown body fields, and responds `no-store`. With Cache Components enabled, the workspace page stays a static client shell; any server component that reads the session sits behind `<Suspense>`.
- Server storage keeps one schema-2 snapshot per account plus one previous workspace and an operation-receipt table. Saves lock the user row, return a matching receipt unchanged, reject reused IDs with different fingerprints, and apply `lib/career/commit.ts` scope checks so unrelated changes never conflict.
- Workspace transfers are bounded by the 4-MiB workspace ceiling without chunking. Request bodies above that ceiling plus 64 KiB are rejected as `payload_too_large`. A Save request containing values and baselines can exceed that request limit even for a valid workspace; reject it while retaining recovery.
- Client ownership: `components/account/account-root.tsx` resolves the session (`stores/account/session.ts`) and mounts `CareerWorkspace` keyed by `account:<userId>:<sessionId>` or `guest`, so an owner change disposes the controller, its storage, and in-flight requests. `stores/career/account-backend.ts` implements `CareerBackend`, reusing `CareerStorage` against `verso-account-<userId>` for drafts, pending requests, and cleanup intents; device preferences stay in `verso-local`. Expired sessions keep the owner mounted. Server modules live in `lib/account/`; the shared Save decision lives in `lib/career/commit.ts` for both guest and server commits.
- Database statement regression bounds, including the database session lookup (2 reads) (`tests/db/accounts/operation-counts.db.test.ts`): load 3, freshness check 3 (unchanged or changed), first load 7, Save 7 (2 writes), the day's first Save 9 (receipt pruning inside its transaction), replayed retry 5 reads. Reads never write. Treat these as regression bounds; one request is not one billable operation. New account traffic must justify its database operation cost and update the operation-count regression coverage.
- Sync (`stores/career/account-sync.ts`, constants `ACCOUNT_SYNC` in `types-and-constants/account.ts`) is cost-bounded remote freshness, not live collaboration. A freshness check is a conditional `GET /api/account/workspace?workspaceId=&revision=&generation=` that returns identity only when unchanged. Focus, visibility, reconnect, and input-after-idle request a check at most once per 60 s; a visible, active tab checks every 5 minutes; periodic checks stop after 15 minutes without input or while hidden, and an invalid session pauses sync until an acknowledged Save. Tabs of one owner share the last check time over BroadcastChannel and a Web Lock keeps one check in flight per browser. An acknowledged Save or check caches the head in the account database (`heads/account`); other tabs apply that cache on a `saved`/`checked` notice without a server read. Changes made on another device appear within 5 minutes while a tab is visible and active, or at the next focus/reconnect at least 60 s after the last check.
- Receipt pruning (30 days / 1,000) runs inside at most one Save transaction per account per 24 hours (`operationsPrunedAt`), never on reads. A pruned receipt reports `unknown` and requires comparison, never blind replay.
- Pending account Saves are resolved without resending: on open and on reconnect, each draft carrying a prepared operation ID is looked up once through `GET /api/account/workspace/operations/<id>`; a receipt whose hash matches the request fingerprint is recorded and acknowledged locally, and an unknown outcome stays pending behind an explicit **Retry save** (same operation ID). Nothing is requested when nothing is pending. If the server is unreachable at open, the last cached head opens with an "Offline · showing last synced revision" status; server scope checks remain authoritative on retry.
- Conflicts are derived (`lib/career/conflict.ts`) from the draft baseline versus the current committed scope; nothing extra is persisted, so reload recomputes them from recovery. A rejected Save (`conflict`/`replaced`) triggers one refresh so both versions are available. `components/career/conflict-panel.tsx` shows both versions with Export recovery, Keep my draft (rebase onto the saved version, then a separate Save), and Use saved version (confirmed discard, destructive action last) for form, Settings form, and entry-order lanes.

## Public PDFs

- Storage: `public_link` (one per `(userId, resumeId)`, 256-bit base64url token,
  `latestReleaseId`, `nextNumber`, `autoRelease`) and `public_release` (immutable
  `bytea` PDF plus content/locale/template/runtime/settings/PDF identities, per-link
  `number`, `(userId, operationId)` receipt with request hash, optional `revokedAt`).
  Server modules: `lib/account/release-repository.ts`, `lib/account/release-api.ts`,
  `lib/account/public-pdf.ts`; contracts and quotas in `types-and-constants/releases.ts`.
- Release upload is multipart (strict JSON `metadata` + `pdf`), capped at 4 MiB + 64 KiB
  before parsing, behind `accountRequest`. Under the owner lock, one transaction
  replays a matching receipt (different hash → `operation_mismatch`), re-renders the
  resume from the committed account workspace with `renderCareerOutput`, requires the
  same workspace/generation and output fingerprint (the claimed revision may be older
  than the head when output is unchanged), checks readiness/template/PDF markers,
  enforces quotas (`quota_exceeded`, never pruning), creates the link, inserts the
  release, and moves latest when `advance` (default). Runtime identity comes from the
  server's `tools/compiler-proof/resources.lock.json`, not the client. Automatic
  releases whose source SHA-256 equals latest store nothing (`unchanged`).
- Latest moves only through explicit release, `set-latest`, or opted-in automatic
  release. The current latest cannot be revoked or deleted. Revoking a link deletes it
  and its releases. Owner actions are `PATCH`/`DELETE` on
  `/api/account/releases/links/[linkId]` and `/api/account/releases/[releaseId]`, each
  returning the full list.
- Public `/pdf/[token]` and `/pdf/[token]/[number]` call `connection()`, need no
  session, read with one SQL statement, answer `no-store` with nosniff/noindex/
  no-referrer and an inline RFC 5987 file name, and share one 404 for unknown,
  malformed, revoked, deleted, or accounts-disabled requests. Never add caching
  without an owner-approved freshness bound and purge path.
- Client: `stores/releases/release-store.ts` (per-owner, session header, stable
  in-memory operation IDs reused on unanswered retries), `hooks/releases/use-releases.ts`,
  `components/career/release-dialog.tsx` (enabled only for a Current preview), and
  `components/account/releases-panel.tsx`. `PreviewOutput` retains the compiled
  bytes and template identity. `useCommittedPreview`'s `automaticResumeIds` forces
  automatic preview refresh (one effective-preferences effect, so a preferences
  object republished on Save cannot cancel the pending refresh) while the previewed
  resume's link opts in; `hooks/output/use-automatic-release.ts` releases each
  committed output at most once per tab under a `verso-release-<userId>` Web Lock
  and never replays failures.
- Database statement regression bounds (`tests/db/accounts/operation-counts.db.test.ts`, including the 2-read
  session lookup for owner routes): public download 1 read; list 4; release 12
  (2 writes); first release 14 (4 writes); set-latest 8 (1 write). Treat these as
  regression bounds and justify new public-download cost before adding queries.

## Release limits and verification boundaries

Quotas in `types-and-constants/releases.ts` permit 10 links per account, 25 retained
releases per link, 50 MiB of stored PDFs per account, and 4 MiB per PDF. Reaching a
quota rejects publication; it never silently prunes existing or revoked releases.
Unlisted URLs are bearer access, not authentication. Keep career data, backups,
recovery, and credentials out of public artifacts and metadata except the intended
resume output. Failed publication must preserve prior links and latest identity.

The database tests apply checked-in migrations to isolated PGlite; account E2E
seeds sessions rather than contacting OAuth providers. These do not establish
hosted provider callbacks, real PostgreSQL concurrent row locking, or hosted
release access. Verify those boundaries separately before making acceptance claims.
