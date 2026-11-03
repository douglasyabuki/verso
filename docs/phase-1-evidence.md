# Phase 1 implementation and acceptance evidence

The owner's latest plan defers outstanding Phase-1 acceptance to the final
[requirements follow-up list](requirements.md#pending-follow-up--solve-after-phase-1).
It no longer blocks roadmap progression. Results below are historical and do not
verify the final import/discard edits; the requested regression run was interrupted
before execution. See the [current handoff](phase-1-handoff.md).

## Completion pass — 2026-11-03

The staged schema-2 UI and architecture were retained. Phase 2 has not been
activated. Owner visual review, PDF clipping/layout review, and the manual
disposable-workspace round-trip sign-off remain external acceptance items.
Historical entries below describe earlier states and do not override this pass.

Current functional execution:

- Unit: **8 files, 26 passed, zero failed/skipped**.
- Chromium Browser Mode: **3 files, 46 passed, zero failed/skipped**.
- Production Playwright: **2 files, 31 passed, zero failed/skipped** across
  Chromium, Firefox, and WebKit. Includes both output languages in each engine.
- The combined `npm test` command completed successfully, including production
  build/start. Later history-request refinements were rechecked in Browser Mode.
- Next route generation/TypeScript and ESLint passed. Full formatting passed
  after formatting the previously staged files with the configured formatter.
  Sandbox traversal of an existing ignored temporary directory required running
  the full format check with access; this was tooling access, not a product failure.

Implemented and verified corrections:

- Ordinary actions pause list entrance scale during press/release. The previous
  pointerdown cancellation moved the button before pointerup and swallowed its
  click. Real pointer and keyboard reorder cases now pass; selection, hidden
  positions, independent drafts, navigation cancellation, and draft-only sorting
  remain intact.
- Saving explicitly disables rich contenteditable and formatting/link controls.
  Unsaved creation URLs reload into a missing-record/recovery destination rather
  than an empty JSON editor. Narrow preview-panel switches preserve drafts.
- Explicit discard records a durable exact-version cleanup intent before cleanup.
  Startup retries intents without removing newer versions. Intents live in the
  existing preferences store; no database/portable schema upgrade is needed.
- Save and history receipts distinguish completed-but-unacknowledged outcomes.
  Uncertain receipts remain protected from retention pruning; interrupted
  requests are discoverable after restart. Retrying Save or Undo reuses the
  immutable request and produces no duplicate revision/history movement. Receipt
  retries also clean only the exact acknowledged recovery version.
- Controller retention options default to 30 days/1,000 acknowledged completed
  operations. Maintenance runs at startup and during use; failures do not disable
  coordination. Pending/uncertain operations and unresolved drafts are protected.
- Import validation runs in a terminated-on-completion/cancellation worker, with
  progress after 500 ms. Rejected imports perform no writes. Partial recovery
  storage failures identify completed draft count and retain the source file.
- Real byte tests accept exact 64-MiB workspace and 256-MiB recovery files,
  including envelope overhead, and reject one extra byte. Exact 64-MiB drafts
  and oversized raw-chunk export are covered. Manifest pagination covers one
  normal file's inventory across several bounded pages. Raw Unicode chunks have
  an independently tested offline reassembly tool that rejects missing/duplicate
  chunks and existing output files. See [recovery files](recovery-files.md).
- Real Chromium quota exhaustion aborts Save and replacement while preserving
  head, previous workspace, and recovery. The test verifies the override is active
  and allows Chromium's 30-second cached quota allotment to expire. No injected
  DOMException is used for this evidence. Retrying the same operation after quota
  restoration commits once.
- Successful previews capture resume ID/name, language, revision, and generation.
  Switching resumes or a failed refresh cannot relabel an old PDF's download.
  Deterministic tests reject late results and release replaced/unmounted URLs.
  A real message-worker pair is terminated on compiler timeout; retry creates a
  fresh pair, with at most two owned workers and no concurrent compile accepted.
- English/Portuguese PDFs in all three engines are checked with pinned PDF.js:
  searchable accents/special characters, rich multiline prose, selected archived
  entries, embedded Inter fonts, author/language metadata, and exact standalone
  and inline query-string hyperlink destinations. Page counts are recorded, not
  used as clipping or PDF/UA evidence.

The mandatory 30-minute/100-refresh soak and sustained heap-growth acceptance
were removed at the owner's request. Resource evidence is deterministic; no
long-session heap, native PDF-viewer worker/canvas, Safari, or ATS claim is made.

### Production measurements

The preliminary production pass completed all four fixtures at normal and 4x CPU
throttling, with 100 typing samples and 30 controller Save/open samples per
fixture, plus 10 warm/5 cold compiler runs per CPU rate. It is a baseline, not
final acceptance: expanded selection/reorder and worker-import measurements are
recorded separately below. Its capacity Save p95 was 2.01 s, narrowly above the
2 s target. A focused synthetic 63-MiB copy measurement showed full cloning taking
61?119 ms versus branch copies below 0.05 ms; the redundant copies were removed
while retaining whole-document validation. Empty-query list searching also avoids
scanning all large wording strings (117.9 ms versus 0.53 ms over 100 synthetic
300-row scans). These microbenchmarks identify costs; they are not UI timings.

Two expanded runs were interrupted after the small fixture while investigating
slow list measurement progress; these are not acceptance evidence. A bounded
representative-only diagnostic then completed and exposed the pristine-form
cleanup overhead. Removing unnecessary writes reduced selection p95 from
100.4 ms to 10.5 ms in the completed normal-speed representative fixture.
The harness has bounded paint/action waits and reports each measurement phase. Final measurements must
identify controller-open versus full application-open timing and any unavailable
metrics explicitly.

### Phase-1 criterion map

| Criterion | Evidence / remaining acceptance                                                                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1.0      | Installed compatible Node/browser runners; actual unit, Browser Mode, and three-engine production tests pass.                                                     |
| P1.0a     | Draft/committed separation, independent order/form Saves, local undo, dirty navigation, recovery, conflicts, interrupted Save/history, and cleanup browser cases. |
| P1.1      | Active career forms own profile/summary/sections/entries independently of imported resume selection; committed-only output checks.                                |
| P1.2      | Domain identity/duplication/scope-safety tests plus real-browser creation, archive-based Undo/Redo, and ordering.                                                 |
| P1.2a     | Archive/restore and archived-selection protections; imported selections remain labeled/removable; selected archived text survives compiled PDFs.                  |
| P1.3      | Single-language fixtures and durable addition of a third language without counterpart wording.                                                                    |
| P1.4      | Typed fact/wording separation, nested identities and independent overrides covered by domain/output and round-trip tests.                                         |
| P1.5      | Built-in/custom factories, valid incomplete Saves, malformed dates/links and retained failed drafts; rich wording is limited to prose.                            |
| P1.6      | Durable activation/deactivation/reactivation preserves wording; inactive English/Portuguese output and unsupported-language rejection are tested.                 |
| P1.7      | Automated workspace/recovery round trips, capacity and rejection/atomicity checks pass. Owner manual disposable-workspace round-trip sign-off remains pending.    |

## Historical implementation notes

Stopped at the owner's request to wrap up lengthy tests. Phase 1 is not accepted
as complete; no Phase 2 work is authorized by this attempt.

The active page now mounts a schema-2 career editor with explicit drafts,
IndexedDB scope transactions, recovery, archive/restore, language activation,
backup/replacement/rollback, and minimal imported-resume output. Former schema-1
workflow/state modules remain unmounted reference assets; the reusable workspace
presentation is mounted around the schema-2 editor as described below.

Recorded execution:

- Vitest Node: 4 files, 17 passed, 0 failed/skipped.
- Latest Chromium Browser Mode: 1 file, 25 passed, 0 failed/skipped.
- Last Playwright: 1 file, 6 passed, 0 failed/skipped, through the combined
  `npm test` command. The save/reload test now waits for saved revision 1 instead
  of matching the initial saved status before the asynchronous Save completes.
  The initial diagnostic run had 4 passes, a save/reload race, and an English PDF
  timeout; both PDF cases passed in the final full run.
- Both inactive-language fixtures with selected archived content produced PDF
  downloads in Chromium (English and Portuguese). Visual/text/font/link QA was not done.
- TypeScript with Next route generation, ESLint, and format:check passed.
- Production build and server startup completed through Playwright. The reported
  webServer startup exit could not be reproduced; build/startup stdout is now
  visible alongside stderr for future diagnosis.

Additional Phase 1 regression coverage (2026-11-02):

- Real IndexedDB concurrent same-scope Saves allow one winner and retain the losing
  draft. Immutable operation IDs reject changed content and forged fingerprints.
- Receipt-write failure after queuing the head write aborts the entire Save;
  committed content and recovery remain intact and the same request can retry.
- Receipt pruning protects pending requests and completed operations referenced by
  unresolved recovery, then removes eligible receipts after explicit resolution.
- Ordinary Saves invalidate stale replacement reviews. Adoption and rollback
  preserve unresolved recovery separately from the previous workspace.
- Typing during an in-flight Save remains a newer recoverable draft with an updated
  baseline; the captured Save and subsequent Save create separate history steps.
- Dirty drafts block workspace history, Discard requires a separate Undo invocation,
  new Saves clear Redo, and history cannot overwrite competing same-scope changes.
- Failed Discard cleanup retains both editable and durable recovery. Recovery imports
  get independent identities without importing replayable receipts or committing
  content. Missing recovered entries require explicit restore-as-new and Save.
- Browser interaction verifies navigation Discard without committed changes or
  history. Component tests restore URL/history state to avoid cross-test drafts.
- Output retains resume overrides after shared edits, uses career wording after
  override removal, follows resume entry order, and excludes unselected content.

The added coverage was verified with separate non-watch unit/browser commands,
Next route generation and TypeScript, and lint/format checks on changed tests.
Playwright was not rerun for these test-only additions; its result above is from
the preceding harness fix. Injected storage failures prove transaction rollback,
not real browser quota exhaustion.

Outstanding acceptance includes real quota rather than injected failure, broader browser coverage,
manual backup/recovery/PDF review, recovery export chunk/manifest behavior at its
limits, full retention/late-work review, applicable skill updates, and performance
measurements. Capacity Node tests cover 120 resumes, 10,000 entries, nested maximum
shapes, and exact 64-MiB document rejection boundaries. They do not prove capacity
responsiveness or browser storage quota. Existing output evidence is deliberately
limited; do not claim full P1.2a/P1.6 acceptance from compilation alone.

## Workspace shell correction (2026-11-02)

Compared the retained shell composition with Git HEAD (`e667c3d`) before editing.
The schema-2 root now reuses WorkspaceShell, WorkspaceUtilityRail, AppearanceControl,
the extracted original toolbar presentation and adaptive sidebar collections, the
existing sidebar/sheet/select/tabs/resizable primitives, and device layout preferences.
It restores branded navigation, history/status and language header rows, independent
scrolling, desktop sidebar collapse, imported-resume split preview, and narrow-screen
navigation with footer utilities and Editor/PDF preview tabs.

Necessary adaptations: Career details contains Profile, Summary and current sections;
Content languages replaces the retired review footer. Existing imported resumes link
only to their implemented selection forms. Add section opens the existing overview
creation controls. Data & backups opens the schema-2 destination instead of the old
schema-1 data menu. No resume-creation, translation-review, default-layout, or other
future controls are presented as available. Empty workspaces and backups use the
full-width editor; preview controls appear when imported resumes exist.

CareerController remains the sole content/draft/history authority. No controller,
model, IndexedDB protocol, database identity, or storage initialization changes were
made. No user storage was reset or migrated. Unresolved recovery, explicit Save/Cancel,
Save/Discard/Stay, history, replacement/rollback and committed-only output remain on
the schema-2 paths. Appearance/layout preferences stay device-only.

Validation for this correction:

- Chromium Browser Mode: 1 file, 25 passed, zero failed/skipped in the final run.
  The first run was interrupted by Vite dependency optimization before collection;
  the next exposed two UI tests relying on the former always-visible navigation.
  Those tests now set an explicit desktop viewport; all original assertions remain.
- Focused production Playwright: 1 file, 5 passed, zero failed/skipped. Includes
  save/reload, Back/Forward/native draft undo, desktop and 390px Save/Cancel and
  Save/Discard/Stay through sidebar/rail navigation, sidebar collapse, mobile footer
  access, and imported-resume desktop split/preview toggle/narrow panel access.
  Initial new-test failures used a banner role for a header nested in main; the
  selector was corrected to the existing labeled header.
- Production build/start, route generation/TypeScript and ESLint passed.
- Desktop (1440px and 1280px) and narrow (390px) production screenshots were inspected
  for the rail/sidebar/header/editor/split/drawer/preview composition and usable forms.
- Full `format:check` and local documentation link validation passed. The first
  sandboxed formatting attempt could not traverse an existing ignored temporary
  directory; rerunning with access succeeded. `git diff --check` also passed.

Phase 1 remains partial with all previously outstanding acceptance unchanged.
Capacity, PDF compilation/QA, other browsers, and full acceptance were deliberately
not rerun for this presentation correction. No Phase 2 work was started.

## Previous editor layout restored

The follow-up correction uses the original career overview card grid, destination
headings/icons, entry-list card, editor widths/padding, and grouped field composition.
Labels now sit above their inputs rather than wrapping inputs inside label flex rows.
The existing Add section action opens its chooser from both the sidebar and overview.
The shared utility rail/sidebar/shell and schema-2 model, storage, and recovery remain
unchanged by this correction.

Validation: one Chromium Browser Mode file, two focused tests passed; 24 other tests
were excluded by the name filter. These checks cover the overview/section chooser,
desktop/narrow forms, Cancel, Save, and dirty-navigation resolution. An initial new
test needed a scoped Add section locator; the final focused run passed. Typecheck,
lint and formatting for changed files, production build, and `git diff --check` passed.
Production screenshots at 1440px and 390px were inspected, with no horizontal overflow.
The screenshot script needed a partial heading match because the status badge forms
part of the accessible heading name. No full acceptance or PDF/capacity suites were run.

## Editor interaction correction (2026-11-03)

Implemented the owner-approved presentation correction on top of the existing
staged Phase-1 work. Entry lists now use the shared sortable/animated cards with
Up/Down/Edit and per-entry Duplicate/Archive/Restore menus. Direct moves open the
existing order draft scope; the same mounted list retains search/filter/scroll.
Order changes require Save, preserve filtered-out positions, and remain separate
from committed output and history until saved. Competing dirty forms must resolve
first; blocked drags must be attempted again rather than replayed.

Section properties moved to the section-heading menu. Draggable cards regained
rounded surfaces and padding. Active native selectors now use shared Select
primitives with option icons. Footer actions align to the end with the primary
rightmost. Ordinary forms use Cancel / Save and disable both while unchanged or
saving. Dirty-navigation dialogs use Cancel / Discard / Save; dialog Cancel keeps
the draft open. Shared-content clear/delete remains deferred by P1.2a.

Browser/E2E test sources were adapted for inline sorting, clean disabled actions,
and scoped navigation Cancel locators. Tests and visual/browser validation were
not run for this correction at the owner's request. Visual acceptance remains
with the owner; earlier execution evidence does not validate these changes.
Phase 1 remains partial, with previously recorded acceptance gaps outstanding.

The edited coverage also specifies blocked moves during dirty entry editing,
Cancel retaining that draft, Discard without replay/history, and a fresh move
starting an order draft. Entry search now searches content values rather than
serialized schema keys, so filtering can actually hide unrelated records. The
rich-text link popover uses Cancel / Remove link (when applicable) / Apply.
Static validation: scoped ESLint and Next route generation/TypeScript passed;
no unit, browser-component, E2E, build, or visual validation was performed.

### Selection and entry-card follow-up (2026-11-03)

Card selection now survives switching from entry editing to an order draft and
through reorder Save/Cancel within the mounted section list. The text selection
button no longer adds a separate hover background; Edit precedes Up/Down.
The existing dirty-entry/reorder test source now asserts retained selection.
Tests and visual validation remain unrun at the owner's request. Opening an entry
with pending order changes still uses the existing guard pending a decision on
independent drafts versus a combined section-level Save/Cancel boundary.

## Independent entry/order drafts and recovery presentation (2026-11-03)

This follow-up supersedes the earlier requirement to resolve an entry before
sorting. CareerController now owns a form draft and an independent section
entry-order draft, each with its own scope baseline, recovery identity/version,
operation identity, error, and recovery status. The existing IndexedDB Save path
is reused per draft; saving/discarding one leaves the other intact. Each Save
creates a separate workspace history step. No portable/storage schema changed.

Entry forms remain open during sorting. Opening an existing entry retains pending
order without a prompt. Separate Save order/Cancel order and Save entry/Cancel entry
actions identify the affected scope. Navigation outside the section resolves each
applicable draft independently; dialogs describe only the issue they handle and
never mention another dialog. Failed or canceled later resolution does not undo
an earlier explicit Save/Discard.

Per the owner's follow-up, removed the order comparison panel and its Compare
order/Reconcile order/Export recovery buttons. Moved recovery discovery out of
the editor and into Data & backups, with readable names and Restore draft actions.
Data & backups can be visited without resolving open drafts; export includes both
active drafts, and Back to editing retains them. Replacement/rollback and history
still require resolution. Stored recovery was not deleted, reset, or auto-restored.

Updated browser test sources for independent Save/Cancel/history, both durable
recovery records, conflict isolation, cleanup failure, reload discovery/explicit
restore, utility navigation, and issue-specific navigation dialogs. These tests
were not run; visual/browser validation and builds remain unrun at the owner's
request. Static validation results are recorded after the final edits. Phase 1
remains partial with the earlier acceptance gaps outstanding.

Final static checks for this follow-up: scoped ESLint passed with no warnings,
Next route generation plus TypeScript passed, scoped Prettier checking passed,
and git diff --check passed. No test suite, production build, or visual/browser
validation was run. The edited behavior cases remain unexecuted.
