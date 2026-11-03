# Verso

Local career information editor. The active application uses workspace schema 2,
explicit form Save/Cancel, and transactional IndexedDB. Schema-1 development data
and backups are unsupported and are never loaded or converted.

## Current capabilities

The schema-2 career editor runs inside the retained workspace shell: utility rail,
collapsible branded sidebar, workspace toolbar/history/status, and wording-language
header. Career navigation uses the schema-2 dirty-form guard. Narrow screens use
the existing navigation drawer, with Data & backups and Appearance in its footer.
Imported resumes expose their existing selection form and committed-only output in
the resizable desktop preview panel or narrow-screen Editor/PDF preview tabs.
Layout and appearance preferences remain device-only. Data & backups opens the
schema-2 backup/recovery/replacement controls; it offers no retired reset/autosave actions.

The editor uses the previous career overview card grid, destination headings/icons,
entry-list card, and grouped form layout. Schema-2 drafts supply these views without
changing the shared utility rail, sidebar, or workspace shell.
Overview cards and sidebar navigation use shared staggered pop entrances, honoring
reduced motion; reopening the sidebar replays its entrance.

Career details owns profile, summary, built-in/custom sections, entries, achievements,
links, shared facts, and reusable wording. One content language is sufficient.
Content languages use canonical tags; activation is separate from the English UI
and PDF capability. Deactivation retains wording and existing resumes.

Create sections/entries explicitly, then edit their wording and facts. Ordinary
forms, ordering, and language changes stay uncommitted until Save. Cancel discards
the affected form. Entry editing and section entry ordering can stay open as
independent drafts with separate Save/Cancel actions and history steps. Opening an
entry preserves pending order; dragging preserves the entry draft and selection.
Dirty navigation and browser Back/Forward offer Cancel/Discard/Save;
close/reload warnings and recovery flushing are best effort. Keyboard undo remains
inside dirty forms. Workspace Undo/Redo is invoked separately after resolving a
form; Undo after Save undoes that Save. Undo of creation archives the new shared
record; Redo restores the same identity. Shared content has archive/restore only.

Recovery is separate from saved content. It writes after 500 ms of inactivity,
with a two-second maximum scheduling wait. Restore opens an uncommitted draft;
compare and reconcile it before Save. Failed/uncertain Saves retain drafts and
reuse immutable operation IDs. Unknown operation history requires reconciliation.
Unresolved drafts do not expire. Browser clearing/eviction can still remove data.
Session-only Save is an explicit choice and does not replace durable content.

Data & backups exports committed schema-2 content and separate format-1 recovery.
It can be visited without resolving open drafts. Stored draft recovery appears
there with readable names and explicit Restore draft actions; entry lists do not
show recovery comparison panels.
Workspace replacement requires review and an atomic current-revision check,
preserving one previous workspace. Rollback rotates that same snapshot. Recovery
is retained separately. Downloads are reported as initiated, not completed.
Device preferences and operation ledgers are excluded from portable exports.

Imported resumes have independent language/layout/selection contracts. Existing
archived selections are labeled and can be removed through an explicit form.
A minimal committed-snapshot output panel manually compiles the pinned template
for English/Portuguese; unsupported languages have no PDF output. Save never
compiles a draft. Both inactive-language archived-content fixtures produced PDFs
in Chromium, Firefox, and WebKit. Automated text/font/link/metadata inspection
uses the pinned PDF.js dependency. Visual PDF acceptance remains with the owner.

New workspaces start with empty Experience, Projects, Education, Skills, and
Certifications sections. Existing saved workspaces are not reseeded. Summaries
and achievements support rich prose; headings and short fields remain plain.
Switching the narrow Editor/PDF preview panel preserves open drafts.

Import parsing/validation uses a disposable worker and reports progress after
500 ms. See [recovery-file boundaries and raw reassembly](docs/recovery-files.md).
Explicit discard cleanup uses durable exact-version intents and retries on load;
uncertain commit receipts remain protected until acknowledgment and are discoverable
after restart. Completed receipt retention is configurable through controller
options (30 days/1,000 acknowledged operations by default).

The former bilingual schema-1 editor, translation-review queues, automatic
workspace autosaving, and full resume/layout controls are retired from the active
root page. Schema-1 workflow/state modules remain unmounted reference assets;
their reusable shell, sidebar collection, toolbar presentation, and UI primitives
are shared with the active schema-2 composition. Resume creation, full independent
selection/customization controls, presets/starters, and the broader settings
experience are not delivered. Outstanding verification is listed below; it does
not block subsequent user-authorized development and is not passed acceptance.

## Planned capabilities

These are accepted directions, not available features or authorization to start
new work. Update this list and Current capabilities as implementation ships.

- Independent resumes: create/name/duplicate/open/delete with visible language,
  confirmation before deletion, and no deletion of shared career content. Select
  and order sections, entries, achievements, contacts, and entry fields per resume.
  Explain excluded, empty, required, and unsupported fields without deleting values.
- Wording: inherit career wording or customize any display text per resume.
  Shared edits preserve customizations; **Use career wording** removes an override.
  Copy into another language using destination wording and copied selection/order,
  with compatible layout and font/rendering warnings. Preserve the original;
  leave missing wording missing, without translation or silent fallback.
- Readiness: save valid incomplete work; reject malformed values with retained
  drafts. Only selected output blocks export. Provide issues with editor links;
  unused records, inactive languages, and archive status alone do not block output.
- Layout: control typography, positioning, paper, spacing, and colors. Presets
  contain appearance; starters contain empty structure/default visibility/layout.
  Applying either copies settings without live inheritance. Use Duplicate resume
  for content-bearing reuse. Include supported configuration in backups and undo.
- Settings/navigation: consolidate appearance, content languages, editing/preview,
  data/backups, and defaults. Distinguish device-only from workspace settings.
  Durable validated routes support reload and Back/Forward while preserving
  drafts, focus, scroll, keyboard access, and narrow layouts. URLs contain no private text.
- Preview: manual by default, optional automatic refresh of committed output changes,
  truthful save/recovery/preview status, bounded queued work, deterministic cleanup,
  and a labeled last successful PDF with stale state, diagnostics, and retry.
- Local acceptance: verify independent-language editing, ordering, wording, layouts,
  settings, navigation, backup/recovery, and browser behavior. Inspect real PDFs for
  labels, dates, fonts, links, metadata, selectable text, accents, long content,
  omissions, and overflow. Disable unsupported output explicitly.
- Future accounts, after explicit activation: Better Auth GitHub/Google and
  Prisma/PostgreSQL, with server ownership checks, isolated local recovery, reviewed
  guest import, and immediate explicit Saves confirmed only by server acknowledgment.
  Immutable request IDs and atomic server receipts protect retries and uncertain work.
- Future sync: preserve dirty drafts and both conflict versions across tabs,
  browsers, devices, offline use, reconnect, expiry, and account changes. Define
  measured freshness; local notifications do not replace server revision checks.
- Future public releases/hosting: explicitly reviewed immutable PDFs, pinned/latest
  URLs, atomic latest advancement, rollback/revocation, access/privacy and cache
  policies. Verify hosted anonymous/private access and recovery procedures; local
  compilation is not publication. Typing and imports never publish.

Translation tracking, groups, user-defined field types, content-bearing starters,
freeform/template marketplaces, arbitrary LaTeX imports, AI rewriting, coauthoring,
billing, portfolio/LinkedIn integration, and public content APIs remain outside scope
unless separately requested. No universal ATS, all-script, or formal PDF/UA promise.

## Data limits and performance targets

The supported format is UTF-8 `verso.workspace` schema 2; recovery uses a separate
`verso.recovery` schema 1. Unsupported versions are rejected without changing saved
content. Backups include committed content/configuration, not device preferences or
credentials. Recovery imports restore drafts, never automatically committed edits.

Safety ceilings are 120 resumes, 100 sections, 10,000 entries total, 300 entries per
section, 100 achievements and 30 links per entry, 30 profile links, and 100 each of
starters/presets. Languages are bounded by file size. Workspace documents and files
each allow 64 MiB, including envelope overhead for files; recovery allows 256 MiB
per file and 64 MiB per draft including its baseline. Limits never permit truncation
or automatic eviction of unresolved recovery. In-memory undo is bounded to 100
steps or 32 MiB; undo is not a backup. Browser clearing/eviction can still remove data.

These are production acceptance targets, not verified performance claims:

| Measurement                                                    | Normal-speed target                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Input, selection, reorder                                      | p95 <=100 ms                                                             |
| Save click to committed acknowledgment                         | p95 <=500 ms representative / <=2 s capacity                             |
| Workspace open, excluding compiler initialization              | p95 <=2 s representative / <=5 s capacity                                |
| Recovery acknowledgment during continuous input                | <=3 s; report storage failure within 1 s of detection                    |
| Capacity import preview                                        | <=5 s; progress after 500 ms; no recurring parsing/transfer tasks >50 ms |
| Cached warm compilation / cold initialization plus compilation | <=5 s / <=20 s on representative 1–3-page output                         |

Measure production small (20 entries/3 resumes), representative (300/30),
multi-resume (60 independently configured resumes), and near-limit capacity
fixtures. Record hardware/browser/build, p50/p95/max, failures, at least 100
interactions and 30 Saves/opens per data fixture, plus 10 warm and 5 cached-cold
compiler runs. Separate normal/4x CPU results and uncached downloads; comparisons
use the same build/fixtures or disclose their limitations.

Compiler defaults are a 120-second initialization timeout, 30-second compilation
timeout, and 1,000,000-byte source limit. Bound work to one active compilation and
one replaceable queued request, one compiler/worker pair per tab, and one retained
successful PDF plus an in-flight result. Verify settled cleanup deterministically;
there is no mandatory duration soak. Detailed engineering safeguards live in
[AGENTS.md](AGENTS.md).

## Outstanding verification

These items are deferred rather than passed. Complete them before claiming full
local acceptance, or explicitly agree a revised scope. They do not block further
authorized feature development.

- Run final formatting/lint/typecheck, unit, browser-component, and production
  E2E/build checks; record actual counts. Earlier green runs predate the final
  batched-import and uncertain-discard changes. Rename/discovery checks and static
  validation do not replace regression execution.
- Verify batched import Unicode/prototype safety and cancellation/error cleanup;
  verify discard exact-version/newer-draft safety, receipt resolution, restart
  recovery, and interrupted Save/history retries.
- Reverify automated workspace/recovery round trips and obtain manual disposable-
  workspace acceptance for identities, wording, customizations, selection/order,
  appearance, capacity, and rejection without mutation.
- Complete affected/missing performance rows with the enriched multi-resume fixture.
  Historical measurements are partial; collecting reports does not prove budgets.
  Close Save click-to-acknowledgment, continuous-input recovery, failure-announcement,
  real import long-task/progress, and cached-cold/warm compiler measurement gaps.
- Obtain owner presentation review and English/Portuguese PDF layout/clipping
  acceptance, separately from automated text/font/link/metadata checks.
- Update these current-capability, target, and limitation statements after verified
  changes so they remain accurate without temporary planning/evidence documents.

## Setup and checks

Use Node >=20.19 and npm 11.3 with the existing package-lock.json.
Run `npm ci`, `npm run compiler:prepare`, then `npm run dev`.
The browser compiler uses locally prepared assets and needs no account credentials.
Builds use the existing Next.js Google-font integration.

| Command                | Purpose                                                               |
| ---------------------- | --------------------------------------------------------------------- |
| `npm run format:check` | Formatting                                                            |
| `npm run lint`         | ESLint/import order                                                   |
| `npm run typecheck`    | Next route generation and TypeScript                                  |
| `npm run build`        | Production build                                                      |
| `npm run test:unit`    | Vitest Node domain/capacity cases                                     |
| `npm run test:browser` | Real Chromium component/IndexedDB cases                               |
| `npm run test:e2e`     | Playwright with a fresh production build/server on localhost:3100     |
| `npm run test:measure` | Explicit production capacity/interaction/import/compiler measurements |
| `npm test`             | Unit, browser, then E2E suites                                        |

Vitest 4.1.0, renderer 2.2.0, Vite 7.3.1 and a Tailwind Vite adapter are scoped to
testing and preserve the selected Next/React versions. Test browsers live in
`.cache/ms-playwright`. Test against disposable origins; browser storage belongs
to the origin/profile. Tests do not establish Safari support, PDF/UA, universal
ATS compatibility, production deployment, or the performance targets listed above.

Install the pinned browser engines with `PLAYWRIGHT_BROWSERS_PATH` set to
`.cache/ms-playwright` before running cross-browser checks. E2E runs Chromium,
Firefox, and WebKit; the Chromium quota case waits for the browser's 30-second
quota cache to expire. Measurements run separately with one worker and write
raw samples under `.cache/performance/`; their recorded evidence includes reference
hardware, browser version, normal/4× CPU runs, and sample counts. There is no
mandatory 30-minute resource soak.

The application sends no resume content to a backend. Accounts, synchronization,
public downloads, and deployment remain future scope. Compiler maintenance is
covered in [compilation proof](docs/compilation-proof.md).
