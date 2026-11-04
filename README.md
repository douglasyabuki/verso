# Verso

Local career information and resume editor. The active application uses workspace schema 2,
explicit form Save/Cancel, and transactional IndexedDB. Schema-1 development data
and backups are unsupported and are never loaded or converted.

## Current capabilities

The schema-2 career editor runs inside the retained workspace shell: utility rail,
collapsible branded sidebar, workspace toolbar/history/status, and wording-language
header. Career navigation uses the schema-2 dirty-form guard. Narrow screens use
the existing navigation drawer, with Data & backups and Appearance in its footer.
Independent resumes expose Content and Wording forms and committed-only output in
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

Resumes can be created, named, colored, duplicated, opened, and deleted with
confirmation. The final resume can be deleted without deleting career content.
New resumes choose an active language and start with full name only; optional
contacts, summary, sections, entries, fields, achievements, and links are selected
and ordered in Content & order. Hiding a section or entry retains its nested choices.
The six icon colors identify resumes in the app and do not change PDF appearance.
Existing archived selections remain labeled and rendered; archived content cannot
be newly selected. Every Content Save commits one independent scope/history step.

Wording customizes profile text, summaries, section headings, entry text,
achievements, and link labels for one resume. Shared facts remain in Career
details. Shared wording changes update inheriting resumes while preserving custom
text, including explicit empty customizations. Use career wording removes the
override on Save. Copying into another language retains shared identities,
selection/order, color, and compatible layout, clears source customizations, and
uses destination career wording without translation or cross-language fallback.
Missing destination wording stays missing. Language-dependent wrapping can differ.
Comparison shows two resumes' effective committed values in their own languages;
drafts are excluded. Content/Wording deep links, reload, and guarded Back/Forward
use opaque IDs. Earlier selection links open Content.

Wording and comparison cards use the same section icons as the sidebar and
readable English field labels. Wording source badges sit beside card titles;
expanded read-only references use the shared nested list-card surface with compact
Open Career details navigation links and the shared list entrance animation. Card icons align with the
first title line, including wrapped titles. Comparison separates resume identity, inclusion/source metadata,
and values. Owner browser, E2E, and visual validation of these presentation
changes remains outstanding.

The sidebar restores each resume's tree: its name opens and selects the read-only
Overview child, above Content & order and Wording. Individual resume views use
their colored icon beside the title, with the actions menu in the title row.
Overview, Content & order, and Wording use underlined tabs with icons; tab changes
follow the same dirty-form guard as sidebar navigation. Compare resumes remains
a separate action. Narrow tab lists scroll horizontally.
Name & color hides those controls and offers Back to overview through the same
dirty-form guard.
Resume selectors show the same colored icons in options and selected values.
The overview card omits color; edit it on the Name & color page. Return to the
collection through the sidebar's Resumes destination. That destination is selected
only for the collection and comparison; individual views show the resume name
and current view in the workspace breadcrumb. The read-only overview card has no
footer actions or navigation instructions. Empty Content & order groups show an
explicit message; search misses are distinguished from unavailable choices.
Overview, sidebar, and collection
share actions for editing name/color, duplication, language copying, and confirmed
deletion. Name/color editing uses a dedicated Save/Cancel page. Overview/details
URLs support reload and guarded Back/Forward. Sidebar names stay on one line
with ellipsis; full names/languages remain available in tooltips. Collection sizing
uses layout heights so entrance animations do not create unnecessary scrollbars;
short windows and long collections retain independent scrolling.

The committed-snapshot output panel manually compiles the pinned template for
English/Portuguese; unsupported languages have no PDF output. Save never compiles
a draft. The Verso-styled PDF.js viewer provides page navigation, percentage zoom,
Fit width/Fit page with resize updates, on-demand thumbnails, embedded document
outline, search, download, and a document-properties dialog. Its navigation starts
closed and overlays the PDF in narrow panes. Search opens through its button;
Ctrl/Cmd+F is left to the browser. Native browser Find across unrendered pages is
not guaranteed and still needs manual browser-specific acceptance. Compilation
failure retains the labeled last successful PDF. Viewer replacement cancels its
owned rendering tasks and releases workers; compiler and URL ownership remain
with the committed-output coordinator.

Entry search uses a conditional inline X that clears the query and restores
input focus. Resume selection checkboxes and sorting controls align with the
first title line, including multiline labels.

Independent-resume PDF fixtures produced English/Portuguese PDFs in Chromium,
Firefox, and WebKit. Automated text/font/link/metadata inspection uses pinned
PDF.js. See the verification section for the current refactor checks; historical
fixture checks do not prove the new viewer's acceptance. Visual PDF acceptance
remains with the owner.

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
are shared with the active schema-2 composition. Presets/starters, layout editing,
readiness dashboards, and the broader settings experience are not delivered.
Outstanding verification is listed below; it does
not block subsequent user-authorized development and is not passed acceptance.

## Planned capabilities

These are accepted directions, not available features or authorization to start
new work. Update this list and Current capabilities as implementation ships.

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
Resume color/contact/summary configuration and hidden selection flags are optional
schema-2 additions. When absent, older schema-2 resumes retain their prior output
defaults without writes on load. New resumes explicitly store unselected defaults.
Name/color, Content, Wording, and single-resume lifecycle scopes commit separately;
older selection drafts and immutable pending requests remain supported unchanged.
Deleting a resume retains unresolved recovery. When its shared references still
exist, Restore as new creates an uncommitted resume in an explicitly chosen active
language and retains the original recovery. Invalid references require reconciliation
or export. Interrupted creation/deletion receipts are checked before replay; Undo
and Redo never overwrite a conflicting resume.

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

Resume navigation and icon updates on 2026-11-04 have updated browser-component
and E2E test sources. Browser tests and manual validation were left to the owner;
the earlier results below do not verify these updates.

Independent-resume verification on 2026-11-03 passed formatting, lint, route generation /
TypeScript, and the complete `npm test` chain: 40 Node tests in 9 files, 59
Chromium component tests in 6 files, and 43 production E2E cases across Chromium,
Firefox, and WebKit, including a fresh production build and actual English /
Portuguese PDF checks. These functional results do not establish performance,
manual round-trip acceptance, actual Safari behavior, or owner visual sign-off.

Presentation-refactor verification on 2026-11-03 passed formatting, lint, generated
route types / TypeScript, 40 Node tests (9 files), 67 Chromium component tests
(7 files), and 46 production E2E cases across Chromium, Firefox, and WebKit with a
fresh build. The three suites ran sequentially, with `test:e2e -- --workers=1`
after overlapping verification runs encountered host resource contention. Coverage
includes the real PDF viewer, thumbnails/outline/search/zoom/properties, worker
cleanup, overview/details navigation, checkbox alignment, inline search clearing,
ellipsis labels, and tall/short sidebar overflow.

Development-server visual checks of an English fixture at 1440×900 and 390×900
covered light/dark themes and open/closed PDF navigation. They showed no page
errors, horizontal overflow, or unnecessary desktop sidebar scrolling. These
spot checks remain separate from owner visual/PDF acceptance.

Native desktop Find acceptance remains unverified: the Computer Use helper could
not connect to its native pipe after retry and reinitialization. Component checks
verify that the viewer does not intercept the browser's Find shortcut; that does
not prove native Find coverage of unrendered PDF pages.

These items are deferred rather than passed. Complete them before claiming full
local acceptance, or explicitly agree a revised scope. They do not block further
authorized feature development.

- Reconcile inherited import/discard acceptance with current automated evidence.
  The current regression run does not retroactively close the deferred historical
  acceptance record or establish unexecuted manual/capacity/failure scenarios.
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
