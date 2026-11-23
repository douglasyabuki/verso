# Verso

Verso is a career-information and resume editor for people maintaining tailored
resumes from one shared career record. Reuse facts and wording across independent
resumes, customize each resume, and generate PDFs in the browser.

## Features

- Career profile, summaries, built-in and custom sections, entries, achievements,
  and links, with archive/restore for shared content.
- Independent resumes with their own content selection, order, wording overrides,
  and layout. Compare saved resumes from the Resumes collection or any resume's
  action menu. Compare highlights wording, inclusion, and order differences,
  grouped by career section with section and change-type filters and an All rows
  view. Appearance presets, empty-structure starters, duplication, and a
  fictional sample workspace help reuse existing setups.
- **Create resume** shows a blank form until you save a starter in Library ›
  Resume starters. In a resume’s Layout, **Use this layout for new blank resumes…**
  opens Settings › Resume defaults for review and Save. New Library presets and
  starters created from scratch use the built-in appearance.
- Extensible content languages, one language per resume, and verified PDF output
  capabilities for English and Brazilian Portuguese. The interface is English.
- Explicit Save/Cancel, workspace Undo/Redo, separate unsaved-draft recovery,
  and JSON backups. Settings › Data lets you review a workspace replacement
  and restore the one previous workspace.
- Browser-based LaTeX compilation and PDF preview/download. Refresh is manual by
  default; automatic refresh after saved output changes is optional.
- A product presentation at `/` with Sign in, Sign up, Continue as guest, and
  a navbar Appearance control.
  An interactive fictional example shows which parts of one career record two
  independently tailored resumes use, with a static view for reduced motion and
  separately authored English and Brazilian Portuguese examples. The workspace
  lives at `/app` for guests and account owners. Deep links such as
  `/app/settings/account` survive reload and sign-in.
- Guest workspaces stored in this browser. Optional GitHub/Google sign-in adds
  account storage and cross-device freshness checks. Sign-up is explicit; Settings ›
  Account shows which providers are connected, connects or disconnects them (keeping
  at least one), and permanently deletes the account. Configured accounts can
  publish PDFs through latest and pinned public links, with optional automatic releases.

Saving, draft recovery, PDF generation, backups, and publication are separate
operations. Unsaved text does not enter a generated PDF. Incomplete content can be
saved; the preview's Issues list explains missing wording that blocks generation.

## Technology

Next.js 16.4.6, React 19.3, TypeScript, Tailwind CSS 4, and shadcn/Base UI form the
application. Guests use transactional IndexedDB; configured accounts use Better
Auth and Prisma 7 with PostgreSQL. A pinned, self-hosted SwiftLaTeX WebAssembly
bundle generates PDFs locally, and PDF.js displays them.

## Getting started

Prerequisites:

- Node **24.22.1**, as pinned in [.nvmrc](.nvmrc), and npm (the manifest selects
  **11.3.0**). Use the existing `package-lock.json`.
- Python **3.10+** with `lzma` support, available as `python3`, `python`, or `py -3`,
  for compiler asset preparation.
- Docker with Compose v2 running for the default local database workflow.
- Network access for npm installation, locked compiler downloads, and build-time
  Google fonts.

```sh
npm ci
npm run compiler:prepare
npm run dev
```

Open <http://localhost:3000>. `dev` aliases `dev:local`: it starts PostgreSQL 17
on `127.0.0.1:5433`, waits for readiness, generates Prisma Client, applies local
migrations, and starts Next.js. The runner overrides `DATABASE_URL` before loading
environment files, so it cannot accidentally select a hosted database. The app
remains guest-only until account settings are complete, even though this default
development command starts PostgreSQL.

The Compose database has its own persistent volume. Port 5433 must be available.
`npm run db:local:down` stops it while retaining data. Both development commands
accept Next.js flags, for example `npm run dev -- --port 3001`.

Compiler assets are generated into gitignored `public/compiler/`. Private reference
ZIP/PDF inputs are optional and not distributed; a fresh checkout can prepare the
editor assets without them. See [compiler maintenance](docs/compilation-proof.md).

## Configuration

Accounts are optional. Guest-only deployments require no environment variables.
To configure development accounts, copy [.env.example](.env.example) to
`.env.development.local` and supply:

| Variable                                   | Purpose                                                                                |
| ------------------------------------------ | -------------------------------------------------------------------------------------- |
| `DATABASE_URL`                             | PostgreSQL connection for hosted development and deployment; overridden by `dev:local` |
| `BETTER_AUTH_SECRET`                       | Random secret of at least 32 characters                                                |
| `BETTER_AUTH_URL`                          | Application origin, normally `http://localhost:3000` locally                           |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth application credentials                                                   |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth application credentials                                                   |

Accounts activate only when the database, secret, origin, and at least one
provider's complete credential pair are present. Register each callback as
`<BETTER_AUTH_URL>/api/auth/callback/github` or
`<BETTER_AUTH_URL>/api/auth/callback/google`. Update origins/callbacks if changing
ports. Keep secrets server-side, outside source control and `NEXT_PUBLIC_*` variables.

The default Docker runner supplies its development database connection. To use
hosted Prisma Postgres instead, set `DATABASE_URL`, explicitly apply migrations
with `npm run db:prisma:migrate`, and start `npm run dev:prisma`. Hosted startup
generates the client but does not migrate. Local and hosted databases are separate;
switching does not transfer accounts or workspaces. `db:local:migrate` explicitly
selects Docker; `db:migrate:deploy` uses the configured database.

### Deployment

For guest-only Vercel deployments, select **`npm run build`**. For account deployments,
configure the variables above for the exact deployment origin and select
**`npm run vercel-build`**: it prepares compiler assets, generates Prisma Client,
applies checked-in migrations, and builds Next.js. Ordinary `build` never migrates.
Public PDFs use the same account database and need no additional credentials.

The build image needs Node 24.x within the manifest's range, Python 3.10+ with
`lzma`, and outbound HTTPS. Builds verify locked compiler downloads and reuse valid
assets/cache; a failed preparation stops the build. SwiftLaTeX's AGPL source and
third-party notices must remain available with the served compiler assets; see
[licenses and maintenance](docs/compilation-proof.md#licenses-and-maintenance).

## Development commands

| Command                         | Purpose                                                  |
| ------------------------------- | -------------------------------------------------------- |
| `npm run format:check`          | Check formatting                                         |
| `npm run lint`                  | ESLint and import ordering                               |
| `npm run typecheck`             | Generate Prisma/Next route types and check TypeScript    |
| `npm run build` / `npm start`   | Build and serve production output                        |
| `npm run test:unit`             | Vitest Node domain and validation tests                  |
| `npm run test:db`               | Account/API tests against isolated PGlite                |
| `npm run test:browser`          | Real Chromium component and IndexedDB tests              |
| `npm run test:e2e`              | Core production guest flows in Chromium                  |
| `npm run test:e2e:accounts`     | Core isolated account flows in Chromium                  |
| `npm run test:e2e:all`          | Guest flows in Chromium, Firefox, and WebKit             |
| `npm run test:e2e:accounts:all` | Account flows in Chromium, Firefox, and WebKit           |
| `npm test`                      | Run unit, database, browser, guest E2E, then account E2E |
| `npm run test:measure`          | Separate production performance measurements             |

Before browser tests, install the pinned engines into the shared test-browser path:

```sh
# POSIX shell
PLAYWRIGHT_BROWSERS_PATH=.cache/ms-playwright npx playwright install chromium firefox webkit
```

```powershell
# PowerShell
$env:PLAYWRIGHT_BROWSERS_PATH = ".cache/ms-playwright"
npx playwright install chromium firefox webkit
```

E2E commands build fresh production servers on `127.0.0.1` ports 3100 (guest) and 3101
(accounts). The isolated account test database uses an OS-assigned loopback port.
Tests use isolated origins/databases and do not require real OAuth credentials.
Run focused checks for the behavior being changed; documentation
changes generally need only formatting and link/configuration validation.

Tests are grouped by runner, then feature under `tests/unit/`, `tests/db/`,
`tests/browser/`, and `tests/e2e/{guest,accounts}/`. Shared harnesses live in
`tests/support/`; static fixtures live in `tests/fixtures/`. The core suite protects
data integrity, security, resume output, and essential user journeys, with each
rule primarily tested at its owning layer. Production performance scenarios live
in `tests/measurements/` and run only through `test:measure`. `npm test` uses Chromium
for E2E; the `:all` commands opt into the three-engine matrix. Real OAuth and
concurrent PostgreSQL row locking remain separate acceptance checks.

## Limitations and data safety

- Browser clearing or eviction can remove guest content and local recovery,
  including unsent account edits. Download backups; recovery exports preserve
  unsaved drafts separately. Workspace replacement retains **one previous workspace**,
  not version history. Undo is bounded and is not a backup.
- Accounts use periodic/event-driven freshness checks rather than live coauthoring.
  Offline or uncertain Saves retain recoverable work; they are not confirmed server Saves.
  Guest content is imported into an account only through explicit reviewed replacement.
- Workspace schema 2 and recovery format 1 are supported. Earlier development data,
  incomplete layout models, and old template identities are rejected without conversion,
  silent resets, or reseeding. Workspace/backup files are capped at 4 MiB; recovery
  files at 32 MiB, with an 8-MiB draft limit and separate raw-salvage export for oversized drafts.
- Layout uses the supported single-column template and bundled fonts. A style sample
  approximates appearance; the compiled PDF determines pagination. Unsupported
  content languages cannot generate PDFs. No PDF/UA, universal ATS, or Safari
  compatibility is claimed.
- Deleting an account is permanent: its workspace, previous workspace, connected
  sign-in methods, sessions, and public PDF links are removed. Download a backup first.
- Public PDF links allow anyone holding the URL to download the published PDF.
  Release quotas require explicit cleanup; publishing never silently removes older
  releases. Revocation cannot retrieve copies already downloaded.
- Automated checks and historical compiler observations do not establish hosted
  OAuth/deployment acceptance, current visual/PDF acceptance, or physical-device behavior.

## Architecture and documentation

The root route is the static product presentation; `/app` mounts an account-aware
shell around the career workspace, and `proxy.ts` sends signed-in visitors there.
`lib/career/` owns the canonical model and pure rules; `stores/career/` owns committed
state, drafts, history, and storage backends. Components and hooks provide the UI,
while `lib/account/` owns server-side account and release access. Retained schema-1
modules are unmounted reference code.

- [Architecture and behavior contracts](docs/architecture.md)
- [Save, recovery, and portable data](docs/recovery-files.md)
- [Accounts and public PDFs](docs/accounts-and-public-pdfs.md)
- [Compiler maintenance and historical proof](docs/compilation-proof.md)
- [Brand identity](docs/brand-identity.md)
- [Coding agent instructions](AGENTS.md)
