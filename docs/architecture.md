# Architecture and behavior contracts

This reference describes the active application and the constraints changes must
preserve. Code paths in backticks are relative to the repository root. Setup and
commands live in the [README](../README.md); transaction and portable-data details
live in [Save and recovery](recovery-files.md); account security and publication
live in [Accounts and public PDFs](accounts-and-public-pdfs.md).

## Ownership and composition

`app/page.tsx` renders the static product presentation (`components/welcome/`);
`/sign-in` and `/sign-up` render `components/account/auth-screen.tsx`. The
workspace lives at `/app` and `/app/*`: `app/app/[[...scope]]/page.tsx` mounts
`components/account/account-root.tsx`, which resolves the session and mounts
`CareerWorkspace` for the guest or account owner. The page never reads `params`,
so every workspace path shares one static shell. `proxy.ts` routes only `/`,
`/sign-in`, and `/sign-up` (see
[entry routing](accounts-and-public-pdfs.md#entry-routing-and-sign-in)). The canonical
workspace model and scope rules live in `lib/career/`; shared derived contracts
live in `types-and-constants/career.ts`. The career controller owns committed
content, one form draft, an independent section entry-order draft, recovery
scheduling, and bounded history. Guest persistence uses IndexedDB transactions;
the account backend uses server-authoritative PostgreSQL.

The career shell reuses the utility rail, sidebar collections, toolbar, layout
preferences, and responsive primitives without mounting schema-1 providers.
`lib/resume/`, `stores/workspace/`, and old workflow contexts remain unmounted
reference modules. Their former autosave, locale-pair, and review assumptions do
not define active behavior. Do not add retired features merely for parity.

## Career content and independent resumes

New workspaces contain empty Experience, Projects, Education, Skills, and
Certifications sections. Never reseed existing content. Career details owns shared
facts and reusable wording; resumes independently select/order content and override
display wording. Shared edits do not overwrite overrides; Use career wording
removes an override. Summaries and achievements/details use rich prose; headings,
names, facts, short values, and link labels use plain controls.

Each resume has one canonical content-language tag. The UI is English; language
activation, wording availability, and verified PDF support are independent.
Deactivation hides creation choices while preserving wording and existing resumes.
Copying into another language uses destination career wording and copied selection,
order, and compatible appearance, with rendering warnings; it does not silently
fall back to another language or promise identical pagination.

Shared content supports archive/restore rather than permanent deletion. Archived
records disappear from new-selection lists, remain usable in existing selections
and output, and are labeled Archived in editors. Removing an existing selection
is allowed. Confirmed resume deletion removes only that resume, never shared career
content. Shared identities cannot be removed or retyped by ordinary Saves.

Custom section icons are validated shared metadata from
`types-and-constants/section-icons.ts`; new custom sections use `file-text`, while
built-in icons are fixed. Section properties edits the icon in its existing draft.
Every section representation uses the saved icon. Icons participate in baselines,
history, recovery, backups, and rollback, but not PDF graphics or readiness.

## Editing, history, and navigation

Forms, selection, and ordering use explicit Cancel / Save. Incomplete valid values
can be saved; malformed values retain the failed draft. Typing and recovery never
mutate committed content, preview inputs, or workspace history. A successful Save
creates one atomic history step; Cancel/Discard creates none. Creation history
archives/restores shared identities; resume creation/deletion history preserves
resume identities without changing shared content.

Entry and section entry-order drafts are independent. Sorting preserves entry
editing, selection, filters, scroll, and hidden-ID slots; each Save/Cancel resolves
only its own scope. Leaving a section resolves applicable drafts separately, and
canceling later navigation does not undo an earlier explicit resolution. Dirty-form
keyboard undo/redo stays in the draft. Workspace Undo/Redo requires resolving the
draft, then a separate history invocation; Undo after Save undoes that Save.

Durable scope URLs support reload and Back/Forward. The destination is the path
after `/app/` (`/app/resumes`, `/app/settings/account`; `/app` is Overview), read
and written by `destinationFromUrl` and `destinationUrl` in `lib/career/navigation.ts`.
Navigation stays client-side (`history.pushState`) and makes no server request.
Legacy `?scope=` values are still read and rewritten to the path form; `/?scope=`
links redirect permanently to `/app/<destination>`. Validate destinations and
resource identities before opening them; missing records never create content.
Dirty departures offer Cancel / Discard / Save, with the primary action rightmost.
Cancel and failed Save retain the draft. Disable form actions while unchanged or
saving. Preserve narrow-screen Editor/PDF switching without closing drafts.

Settings is a durable dialog over the mounted workspace, defaulting to Account,
with Appearance, Content languages, Editing & preview, Data & backups, Resume
defaults, and Public PDFs panels at `settings/<panel>`. Old `languages`/`backups`
links remain usable. Preserve the underlying destination, history metadata,
focus/scroll, and drafts. The account menu and Appearance shortcut live in the
utility rail; OAuth sign-in/sign-up stays in Settings, with shared guarded sign-out.

Device/data panels preserve career drafts. Resolve occupied drafts before language
or workspace-default forms; guard dirty Settings-form departure, closure, and
Back/Forward. Data viewing/export remains accessible without resolution, including
detours from a dirty Settings form. These workspace forms use controller-owned
Save/recovery/history; `defaults` affects future blank resumes only.

Device theme, preview/compiler preferences, and receipt retention apply immediately
outside workspace history and portable exports. Versioned preferences use a record
in IndexedDB separate from cleanup intents. Serialize writes; report tab-only
failures with retry. Read retention before pruning; skip pruning if that read fails
until preferences can be saved. Compiler settings affect the next instance without
interrupting active work.

## Layout and library interactions

The supported single-column template is `yabuki-reference@1.0.3` with the complete
current layout model. No older layout/template conversion, automatic reset, or
storage clearing is supported. Appearance is independent of retired editor state.
The [portable-data reference](recovery-files.md#layout-presets-starters-and-atomic-creation)
owns frozen defaults, exact layout/library scopes, and atomic starter creation.

Resume resets use frozen layout defaults; preset/starter resets use app defaults.
Keep automatic/relative dimensions as sentinels until explicitly edited. Hidden
dependent values remain stored and invalid values remain actionable. Resets and
color picks stay drafts. The fictional style sample does not compile or predict
pagination. Page warnings describe the PDF being viewed, including retained PDFs.

Content & order owns profile inclusion and sequence. Layout owns positional contact
row sizes, alignment, icons, separators, spacing, and optional `contactLocation`.
Omitted location grouping means separate items without load-time writes. Combined
city/country uses their selected sequence and sits at the first selected location
position. Empty values produce no empty rows.

Library is a permanent sidebar group between Career details and Resumes. Its
`/app/library` overview and collections have guarded parent links. Views use full
editor width without unrelated PDF or career-language controls. Keep resume rows
mounted through library navigation so expansion, scroll, and entrance state are
preserved; visiting Library must not expand or select a resume. Keep Library
accessible beside independently scrolling collections. Collection creation aligns
with the title-row end; omit preset/starter search in collections and pickers.
Library destructive actions are last in DOM, keyboard, and visual order.

Sidebar rows with actions (Profile, Summary, sections, Layout presets, Resume
starters, and resumes) open the same quick-action list from their "…" button and on
right-click. Collection headings and resume sub-pages offer right-click actions
only. Navigation actions use guarded navigation; commands such as Archive section
resolve open drafts first and commit through the controller. Negative actions sit
last, after a divider.

Resume Layout is directly editable. Its initially collapsed optional preset
disclosure offers an explanatory empty state or explicit selection/load/capture/
manage actions. Selection alone does not load; loading opens an uncommitted draft
and its announcement stays visible outside the disclosure. Applying from Library
requires an explicit target, dirty-draft resolution, and identity rechecks. Missing
targets/configurations must not silently create a blank resume. Starter creation
shares the explicit Blank resume / From starter flow and mapping review.

## Readiness and output

`lib/career/readiness.ts` and the renderer share committed effective-selection
assessment. Blockers are an unverified PDF language, missing full name, a rendered
custom heading, selected title/degree, or selected achievement wording. Other empty
values remain optional. Preserve built-in headings, URL-label fallback, and explicit
empty overrides without cross-language fallback. Hidden/excluded content and
archive/deactivation status alone do not block output. Save validation is separate.

Issues appear only in the PDF preview footer, initially collapsed with a persistent
count/status row, and an independently scrolling body capped at 40dvh. Preserve its
toggle while mounted. Wording actions use guarded navigation, reveal Editor only
after success, expand the owner/excluded content, and focus the exact row without
editing text. Targets are transient; durable URLs contain no private wording.
Wording groups rows by Career details owner, initially lists included content, and
omits shared facts. Keep shared checkbox and URL-validation helpers independent of
retired review/state modules.

`lib/career/output.ts` resolves committed selected facts/wording with explicit output
capabilities. `lib/output/template.ts` assembles the pinned template independently
of content schemas; `lib/output/encoding.ts` safely escapes text. Selected archived
content remains rendered. Rendered output, not revision alone, determines staleness.

The per-tab workspace preview coordinator owns the compiler and retained PDF above
the editor/preview layout. Hiding the pane, visiting a full-width destination, or
selecting narrow-screen Editor unmounts the PDF.js viewer and releases its document,
worker, canvases, and services, while retaining the last PDF and in-flight compile.
Reopening redisplays the retained PDF without recompilation. Failure retains labeled
download access; viewer failures do not remove the compiled artifact.

Stale-result rejection uses generation, resume ID, and rendered-source fingerprint,
excluding only revision metadata. Automatic refresh is off by default; when enabled
it debounces committed output changes for the same resume/generation by 800 ms.
Switching resumes/generations or changing drafts does not schedule it. Hidden panes
and background tabs defer timers and queued automatic work. A running job is not
interrupted; one replaceable queued request compiles the latest target afterward.
Disabling automatic refresh cancels queued automatic work, preserving explicit
requests and active compilation. A blocked target retains its identity so a Save
that resolves readiness can schedule refresh. Automatic public-release opt-in can
require refresh; see the account reference.

Allow one active compile, one replaceable queued request, one compiler/worker pair,
one retained successful PDF, and one in-flight result per workspace/tab. Reject
stale results; terminate timed-out workers before retry. Release obsolete object
URLs, documents, canvases, listeners, and timers. Compiler defaults are 120 seconds
initialization, 30 seconds compilation, and a 1,000,000-byte source limit.

## Capacity and measurement

Canonical model limits include 120 resumes, 100 sections, 2,000 total entries,
300 entries per section, 100 achievements and 30 links per entry, 30 profile links,
100 starters, and 100 presets. Languages are byte-bounded rather than count-bounded.
Preserve field/rich-text validation. Byte limits and export rules are owned by the
[recovery reference](recovery-files.md). History retains at most 100 steps or 32 MiB
of serialized patches; disclose dropped history or unavailable oversized-save Undo.
Replacement starts a new history generation; Undo is not a backup.

Performance targets are engineering budgets, not claims that every environment has
passed. Use `npm run test:measure` separately from routine tests. Record hardware,
OS/browser/build, fixture identities, counts, failures, p50/p95/max, and normal versus
4x CPU results. Compare the same build/fixtures; disclose historical/mixed-build limits.

Use small (20 entries/3 resumes), representative (300/30), independently customized
multi-resume (60 resumes), and near-capacity (120 resumes) fixtures with English/
Portuguese content. Normal-speed p95 budgets are 100 ms for input/selection/reorder,
500 ms representative / 2 seconds capacity for Save acknowledgment, and 2 seconds
representative / 5 seconds capacity for opening, excluding compiler initialization.
Collect at least 100 interactions and 30 Saves/opens per data fixture. Typing must
not scan the whole workspace.

Recovery acknowledgment targets 3 seconds during continuous input; storage failures
should surface within 1 second of detection. Capacity import preview targets
5 seconds with progress after 500 ms and no recurring parsing/transfer tasks above
50 ms on the main thread. Worker use alone does not establish those results.
Compiler targets are 5 seconds warm (10 runs) and 20 seconds cached-cold initialization
plus compilation (5 runs) for representative 1–3-page resumes; measure proven
uncached downloads separately. Verify deterministic settled resource bounds rather
than claiming sustained heap-growth or soak acceptance without evidence.
