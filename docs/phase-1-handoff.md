# Phase 1 completion handoff — 2026-11-03

## Owner plan update — deferred acceptance

The owner moved outstanding Phase-1 verification to the final
[pending follow-up list](requirements.md#pending-follow-up--solve-after-phase-1).
It no longer blocks roadmap progression. Earlier instructions to complete all
Phase-1 acceptance first are superseded; deferred checks are not passed checks.
The regression-only request was interrupted before test execution. This update
does not start Phase 2 or run the performance matrix.

Test files now use behavior names: `tests/e2e/career-harness.ts`,
`tests/e2e/storage-quota.spec.ts`, and `tests/e2e/workspace-performance.spec.ts`.
Runner filters/imports and test globals were updated without removing cases.
New performance reports go to `.cache/performance/`; historical reports remain
in `.cache/phase1/`. Paths below describe the earlier stopping point.

## Requirements audit — 2026-11-03: current stopping point

**Phase 1 remains incomplete.** This review compared the Phase-1 checklist and
cross-cutting acceptance contracts in [requirements](requirements.md), the
[evidence record](phase-1-evidence.md), [recovery-file contracts](recovery-files.md),
the current implementation/test sources, and available measurement filenames.
It did not resume implementation or execute application tests, builds, or
measurements. Historical instructions below describe earlier authorization;
the current request was to check remaining work and document where the agent stopped.

### Where implementation stopped

The previous agent stopped **after editing the batched import-worker transfer,
uncertain-operation discard cleanup, and ten-case measurement harness, before
verifying those edits**. Those changes and their new browser cases are present
in the current source. The last recorded full green run predates them:
8 unit files / 26 tests, 3 browser files / 45 tests, and 2 E2E files / 31 tests.
A later browser-only run recorded 3 files / 46 tests, also before the final edits.
These are historical results, not verification of the current source.

The old monolithic measurement run timed out; it did not complete acceptance.
Only `performance.json` and `performance-partial.json` currently exist under
`.cache/phase1/`; no final per-case `performance-<fixture>-<cpuRate>.json` reports
exist. The new harness therefore has no completed matrix recorded here.

At this review HEAD is `d9b2b2d`. Before this documentation edit, all changes
reported by `git status --short` were staged; there were no reported unstaged or
untracked paths. Earlier descriptions of unstaged/untracked implementation work
below are historical. Preserve the current index and content; this review does
not stage or commit anything.

### What remains from Phase 1

| Requirement / gate                        | Remaining work before acceptance                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1.0–P1.6, including P1.0a and P1.2a      | Already checked in requirements with earlier evidence. Reverify affected contracts after the final edits; the checkboxes do not establish that the current source passes. No new product scope is identified for these items by this review.                                                                                                                                                             |
| P1.7: schema-2 backup/recovery            | The only unchecked Phase-1 item. Reverify automatic round trips and rejection/atomicity/capacity behavior after the import/discard changes, then obtain the owner's manual disposable-workspace round-trip sign-off. Check identities, facts/wording, overrides, selection/order, appearance, and separately restored uncommitted recovery; malformed/unsupported input must leave saved content intact. |
| Final import-worker changes               | Typecheck and exercise bounded batches, large Unicode strings, own `__proto__` data, cancellation/unmount/error cleanup, and near-limit imports. Confirm the real application remains responsive, rather than relying only on worker parsing time.                                                                                                                                                       |
| Final uncertain-operation discard changes | Verify exact-version cleanup, newer-draft preservation, matching request/receipt resolution, restart discovery, and interrupted Save/Undo retries. Explicitly discarded synthetic recovery must not reappear; unresolved work must remain protected.                                                                                                                                                     |
| Performance acceptance                    | Validate discovery/execution of the ten-case harness, then complete small, representative, enriched multi-resume, capacity, and compiler cases at normal and 4× CPU. Record actual samples and evaluate budgets; collecting a report is not a budget pass. The prior 4× capacity/compiler work is incomplete and older multi-resume results use the superseded fixture.                                  |
| Owner acceptance                          | Obtain visual/browser presentation review, visual English/Portuguese PDF clipping/layout review, and manual round-trip acceptance. Automated PDF text/font/link/metadata checks already have historical evidence; they do not replace these reviews.                                                                                                                                                     |
| Final evidence and checks                 | After fixes, record actual unit/browser/E2E counts and static/build results for the final source. Reconcile requirements, evidence, README, and this handoff; keep P1.7 open until its full acceptance is recorded.                                                                                                                                                                                      |

Performance/resource and storage gates above are applicable cross-cutting
contracts, not authorization to implement the remaining Phase-6 or Phase-7
roadmap. Phase 2 and later feature work remain outside this review.

### Measurement gaps to resolve explicitly

- The harness records 60 typing, 20 selection, and 20 reorder samples per data
  fixture/rate: 100 interactions total. Report their separate distributions plus
  p50/p95/max, counts, and failures. Normal-speed targets are <=100 ms interaction,
  <=500 ms representative / <=2 s capacity Save, and <=2 s representative / <=5 s
  capacity workspace open. Report 4× results separately.
- The 30 Save samples currently time `controller.save()`, not the required Save
  **click to local committed acknowledgment**. Add application-level Save timing
  or explicitly retain that acceptance gap; controller timings alone do not prove it.
  Controller initialization and the separate 30 application-open samples also
  need distinct labels.
- The harness checks recovery status after its typing loop. This alone does not
  establish acknowledgment within 3 seconds **during continuous input**. Record
  that latency and storage-failure announcement within 1 second of detection.
- Capacity import must meet <=5 s preview, progress after 500 ms, and no recurring
  parsing/transfer main-thread tasks above 50 ms. The older 181/70-ms capacity
  tasks and 358-ms throttled-small task motivated the final unverified transfer
  changes; they have not been resolved by measurement.
- Summarize the compiler's 10 warm and 5 cached-cold runs against <=5 s and <=20 s
  targets, with the first fetch/run reported separately and representative 1–3-page
  output confirmed. The first run alone is not proof of an uncached download.
- The harness writes raw reports but has no budget assertions or aggregate
  acceptance summary. Evaluate them explicitly and correct regressions or record
  an approved budget revision. Keep unavailable resource observations explicit;
  the owner removed the 30-minute/100-refresh soak, not deterministic cleanup checks.

### Concrete resumption order

1. Verify the final source with route generation/typecheck and scoped lint.
2. Run the new import/discard browser cases, then unit/browser/full `npm test`;
   fix failures and record actual counts rather than anticipated totals.
3. Validate `npm run test:measure -- --list` and a focused small case; close the
   measurement-contract gaps above before the full matrix. Run heavy checks and
   measurements sequentially, retaining reports for the same build/fixtures.
4. Complete budget evaluation, the focused recovery/receipt safety audit, owner
   acceptance, and documentation reconciliation. Then record the exact final
   stopping point and any unresolved gates here.

Documentation review validation: check formatting, relative links, and diff
whitespace only. No new application pass/fail or performance claim is made.

## Previous implementation handoff

The owner stopped implementation to hand it to another agent and explicitly
requested this file be updated. **Phase 1 is not fully accepted.** The latest
unverified changes and remaining work are listed here. Sections after
**Historical handoff** are earlier context, not a fresh instruction to redo
completed work. This section also supersedes any stronger completion wording in
`phase-1-evidence.md`; that document needs final reconciliation after verification.

### Authorization and working-tree rules

- Continue the owner's approved **Complete Phase 1 while preserving the staged
  UI** plan. Do not activate Phase 2, add accounts/public APIs/schema-1 support,
  change dependency versions, or redesign the restored presentation.
- The owner removed the mandatory **30-minute/100-refresh resource soak**.
  Keep deterministic lifecycle tests and all the other requested measurements.
  A test timeout is a ceiling, not a mandatory-duration soak.
- Owner handles visual/browser comparison and visual PDF acceptance. Do not
  inspect screenshots. Automated interaction and nonvisual PDF checks are allowed.
- Preserve the original index, worktree, and new untracked files. This agent did
  **not** run `git add`, commit, reset, stash, or discard. Most original Phase-1
  work remains staged; this continuation is unstaged/untracked. Read both layers.
- The configured formatter was run on the previously staged files to satisfy
  the full formatting check. Consequently many original staged paths now have
  unstaged formatting differences as well; these are not a UI rewrite.
- npm and existing lockfile/versions are retained. `package.json` adds only the
  `test:measure` script. No subagents were used.
- Current HEAD at this handoff is `d9b2b2d`; it changed externally during the
  session. This agent did not commit. Historical references to `e667c3d` below
  describe an earlier starting point, not current HEAD.
- The final port check found no listener on 3100.

### Completed implementation work

- Fixed the two original order-draft browser failures. A pointer trace showed
  entrance-scale cancellation on pointerdown moved the action before pointerup,
  so click reached the parent. `hooks/use-list-entrance.ts` pauses ordinary action
  entrances through release; drag handles retain cancellation before measurement
  and are marked `data-sort-handle`. Filter, keyboard cancellation, independent
  form/order drafts, and navigation tests passed afterward.
- Explicit `disabled` now reaches rich summary/achievement editors. Core rich
  editing/link controls and custom undo/paste/beforeinput handlers honor the
  disabled state. A pending-Save keyboard test passed.
- Reloading an unsaved creation URL shows **Record unavailable** and recovery
  navigation instead of opening null-baseline JSON. Native Editor/PDF panel
  switching preserves open drafts rather than resolving/closing clean forms.
- `CareerStorage` persists exact-version discard cleanup intents in the existing
  preferences store and retries them on load; newer versions survive. No database
  or portable schema version changed. Controller retention options default to
  30 days/1,000 acknowledged operations; maintenance runs during use and startup
  without disabling tab coordination on failure.
- Completed receipts have `awaitingAcknowledgment`; controller Save/history
  acknowledges confirmed outcomes. Uncertain outcomes stay protected from pruning
  and their requests can be discovered after restart. Interrupted Undo retries use
  one immutable request. Receipt retries clean only the exact draft version.
  `readRecovery()` merges actual drafts and uncertain receipts, including refresh.
- A pristine, locally opened, never-edited draft is tracked privately and can
  close without writing cleanup intents or toggling the list's saving state.
  This reduced measured representative selection p95 from 100.4 ms to 10.5 ms.
  Dirty/recovered drafts still use durable exact-version cleanup.
- `applyScope` copies only potentially changed branches before full validation,
  avoiding redundant near-64-MiB string clones. Full schema/identity/byte validation
  remains. Empty entry-list searches skip scanning all wording strings.
- Recovery files have incremental byte accounting and exact bounded manifest
  pagination, including one file's inventory split across pages and empty exports.
  `tools/reassemble-recovery.mjs` reconstructs matching raw Unicode fragments,
  rejects missing/duplicate/mixed chunks, and refuses output overwrite. See
  `docs/recovery-files.md`. Workspace export checks envelope-inclusive 64-MiB
  limits and reports failure without changing/truncating content.
- Preview artifacts capture resume ID/name, language, revision, and generation;
  old downloads retain their captured identity after switching/failure. Tests
  cover manual refresh, stale results, URL cleanup, and compiler timeout/retry
  with a real owned message-worker pair.
- Playwright now runs Chromium, Firefox, and WebKit. Genuine Chromium quota
  failure uses CDP, verifies the override, then waits 31 seconds for Chromium's
  30-second cached allotment to expire. Save/replacement abort atomically and the
  same operation succeeds once quota returns. Tiny immediate overrides alone did
  not produce real failures; do not substitute injected exceptions for this case.
- English/Portuguese PDFs were compiled in all three engines and inspected using
  pinned PDF.js: text/accents, rich multiline prose, selected archived content,
  embedded fonts, author/language metadata, page counts, and exact inline and
  standalone query-string links. No visual/clipping/ATS/Safari claim was made.

### Last verified results — not the latest full worktree

- Full `npm test` completed successfully: **8 unit files / 26 passed;
  3 browser-component files / 45 passed; 2 E2E files / 31 passed**, zero failures
  or skips. E2E includes fresh production build/start and all three browser engines.
- Subsequent Browser Mode run after pristine-navigation and rich disabled-handler
  work: **3 files / 46 passed**, zero failed/skipped. This is the latest green
  browser run, before the unverified changes below.
- Earlier full format check, ESLint, Next route generation/TypeScript passed.
  **Do not claim they validate the final worker/cleanup/benchmark edits.**
- Sandboxed test startup fails with esbuild `spawn EPERM`; running the same npm
  test commands with `require_escalated` worked. No automatic approval rejection
  occurred. Full formatting needs access to an existing ignored temporary
  directory, otherwise traversal fails with EPERM.
- Firefox/WebKit are now installed alongside Chromium in the intended project
  cache `.cache/ms-playwright`.

### Latest changes NOT YET VERIFIED — first work for the next agent

1. **Batched worker import transfer.** Initial worker validation already passed
   browser/E2E checks, but returning a whole 63-MiB validated object caused main-
   thread transfer stalls. The newest `lib/career/portable.worker.ts` emits bounded
   construction batches (32,768 string units / 128 instructions, with large strings
   fragmented). `portable-import.ts` assembles containers/values with
   `Object.defineProperty`, preserving Unicode and avoiding prototype setters.
   Abort/error/completion terminate the worker. This internal protocol does not
   change portable formats. **No typecheck or behavior run has validated this
   newest protocol.** New `tests/browser/import.browser.test.tsx` checks large
   Unicode fragments and an own `__proto__` recovery value without pollution.
2. **Explicit discard of uncertain operations.** The newest `discardDraft` accepts
   optional `operationId`; the durable intent retains it. Cleanup atomically
   removes the exact draft and resolves its matching request: acknowledge a
   completed receipt or remove a canceled pending request (missing history remains
   unknown, never replayable). `controller.cancel` passes the operation ID. This
   prevents a discarded synthetic recovery request reappearing after restart.
   The new browser case is unrun. Review exact-version/newer-version safety here.
3. **Measurement harness refactor.** `tests/e2e/phase1-performance.spec.ts` now
   declares **10 separate cases**: small/representative/multi-resume/capacity/compiler
   at normal and 4× CPU. Each has a 12-minute maximum, one worker, bounded action/
   paint waits, and phase logs. This replaces one monolithic 20-minute case that
   timed out. **The new case discovery/types/execution have not been checked.**
4. The multi-resume fixture was enriched with 60 independently selected resumes,
   English/Portuguese wording, hidden/archived content, custom wording, and differing
   layouts. Earlier measurements used minimal empty selections; rerun the enriched
   fixture. Compiler cases now perform one separately recorded initial fetch/run,
   then five cached cold initializations and ten warm compilations per CPU rate.
   These newest fixture/compiler changes are unrun.

### Measurements and artifacts: avoid misreading them

Reference machine: Windows 11 (`10.0.26200`), AMD Ryzen 5 5500, approximately
15.87 GiB RAM; Chromium `156.0.8078.4`. A completed preliminary pass measured
controller opens/Saves and typing for all four fixtures at both CPU rates, but
did not include the final transfer protocol, full application-open samples, or
enriched multi-resume fixture. Later runs narrowed the remaining gaps.

The last monolithic run (exec session **55242**) has now **finished with failure**:
its old 1,200,000-ms timeout expired after 20.2 minutes during the 4× capacity
application-open phase. It was running an older loaded test body while the source
was refactored, so reported source line numbers no longer match the worktree.
The 4× capacity and final compiler samples from that run are incomplete. This
is not a passed acceptance run and not proof that a particular application action
took 20 minutes; the timeout covered the entire matrix.

Existing ignored artifacts:

- `.cache/phase1/performance.json` is **a representative-only diagnostic**, not
  the complete matrix: normal-speed 30 controller Saves/opens, 100 typing,
  50 selection, 50 reorder samples and compiler data, recorded before the pristine
  optimization. It was overwritten by that focused run.
- `.cache/phase1/performance-partial.json` holds completed rows from the timed-out
  monolithic run: all normal-speed fixtures/compiler and 4× small/representative/
  multi-resume. No completed 4× capacity row. These rows predate batched transfer
  and enriched multi-resume data.
- The new harness will write distinct
  `performance-<fixture>-<cpuRate>.json` and corresponding partial files under
  `.cache/phase1/`, including build ID, hardware, browser, raw samples, and counts.
  It has not produced these new per-case files yet.

Selected completed normal-speed p95 values from the old partial artifact, in ms:

| Fixture                                               | Save (30) | Full app open (30) | Typing (60) | Selection (20) | Reorder (20) |
| ----------------------------------------------------- | --------: | -----------------: | ----------: | -------------: | -----------: |
| Small                                                 |       7.0 |              146.6 |        19.2 |            9.8 |          6.5 |
| Representative                                        |      22.2 |              184.7 |        26.4 |           10.5 |          8.8 |
| Multi-resume, old minimal fixture                     |      45.6 |              234.5 |        23.4 |            6.4 |          8.9 |
| Capacity, about 63 MiB / 10,000 entries / 120 resumes |    1593.5 |             1044.5 |        23.7 |            7.6 |          9.5 |

Capacity import preview was 746.8 ms, with progress at 509.3 ms, but observed
main-thread long tasks of **181 ms and 70 ms**. This motivated the unverified
bounded transfer. A throttled small import also observed a 358-ms long task;
do not claim the worker eliminated every long task. Record attribution/limitations
and profile remaining recurring stalls rather than silently waiving the budget.

### Remaining execution and acceptance checklist

1. Read applicable AGENTS/skills; inspect both index/worktree and the new files.
   Run route generation/typecheck and scoped lint first; fix newest protocol,
   operation-cleanup, and benchmark typing issues before lengthy execution.
2. Run Browser Mode, especially the new import and uncertain-discard cases, then
   unit tests and full `npm test` after fixes. The latest source adds two browser
   cases beyond the last 46-pass baseline; do not publish an expected count as an
   executed count. Confirm actual files/tests/pass/fail/skip counts.
3. Run measurement discovery (`npm run test:measure -- --list`), then a focused
   small case to validate the new harness. Use `--grep` with its concrete case
   names; the former `VERSO_MEASURE_RATE/FIXTURE` filtering was removed.
4. Run the ten measurement cases with one worker and **no simultaneous heavy
   checks/builds**. Cases can be selected independently for diagnosis/resume.
   Example: `npm run test:measure -- --grep "capacity at 4x"`.
   They collect 60 typing + 20 selection + 20 reorder samples, 30 Saves/controller
   opens and 30 actual application opens per fixture/rate, recovery acknowledgment,
   import/progress/long-task observations, and separate compiler samples.
5. Compare p50/p95/max, sample counts, failures, and remaining unavailable metrics
   against `requirements.md`. A measurement test passing only means collection
   completed; **budget assertions/summary aggregation are not yet implemented**.
   Correct measured regressions or explicitly retain unresolved acceptance; do
   not infer that all budgets passed. Verify real capacity import responsiveness
   after batched transfer, including cancellation/unmount/Unicode integrity.
6. Finish a small safety audit of interrupted Save/history, exact cleanup, receipt
   acknowledgment/discard, late work, and recovery discovery. New unresolved work
   must not be pruned or silently dropped; current generation/baseline checks and
   atomic head/previous-workspace changes must remain intact.
7. Reconcile `docs/requirements.md`, `docs/phase-1-evidence.md`, README, and this
   handoff with the final executed worktree. Requirements currently check several
   evidenced P1 contracts; P1.7/manual sign-off remains open. The evidence document
   is useful history but its top does not yet account for the final unrun edits or
   latest monolithic timeout. Format/lint/typecheck/build again as appropriate,
   validate local documentation links, and run `git diff --check`.
8. Leave owner visual/PDF clipping/layout and manual disposable-workspace round-
   trip sign-off explicitly pending. Do not inspect screenshots or start Phase 2.

### Processes and feedback at handoff

- Last known measurement session 55242 has exited 1 with the timeout described
  above. No other known test/install/server session remains running; check port
  3100 before starting a fresh Playwright server. Do not stop unrelated services
  or the owner's development server on port 3000.
- No verified Next.js feedback candidates were identified: framework builds
  succeeded; test selector, animation, quota-cache, and harness issues were not
  Next.js issues. Before the eventual final implementation response, repeat the
  AGENTS feedback audit and invoke the reporting CLI only if qualifying candidates
  actually remain.

## Historical handoff

## User request and current authorization

Continue implementing the approved plan below. The owner stopped this agent to move
the work to another chat, not because the implementation was finished.

- Restore the carefully designed previous UI as much as possible, adapting new
  schema-2 actions to it. Reference deployment:
  <https://douglasyabuki-verso.vercel.app/>. Local development app is localhost:3000.
- **Complete Phase 1 too**, including its outstanding applicable acceptance work;
  this was an explicit choice during planning. Do not activate Phase 2 or later work.
- Preserve rich editing for summaries and achievement/detail prose. Use plain
  inputs for headings, titles/degrees, short skill values, names, facts, and link
  labels. Overall typography belongs in layout settings; do not implement the
  future layout editor in this task.
- New workspaces should have empty Experience, Projects, Education, Skills, and
  Certifications sections. Do not inject these into existing saved workspaces.
- **Owner handles visual comparison and browser inspection.** Validate using unit
  tests, browser-component tests, and Playwright. Do not inspect screenshots or
  manually compare the browser UI. Existing planning screenshots predate that
  instruction and are not implementation acceptance evidence.
- **Review and update `docs/requirements.md` and `docs/phase-1-evidence.md`.** Both
  were read, but neither has yet been updated for this implementation. This is a
  particularly important outstanding task. Keep evidence truthful: Phase 1 is not
  complete merely because tests compile/pass, and owner visual acceptance is pending.

## Repository and workflow

- Root: `F:/github/verso`, Windows PowerShell. npm only; preserve package versions,
  lockfile, Next settings, and generated AGENTS blocks.
- HEAD remains `e667c3d` (`Update: Artifacts`). There were already approximately
  35 staged Phase-1 files when this task began. **Do not reset/stash/discard them.**
- The chosen approach is to keep the schema-2 domain/controller/storage work and
  reuse/extract the original presentation, rather than restart from HEAD.
- This agent did not commit or run `git add`. Most new changes became staged
  during the session (apparently externally); current `git status` has a mixture
  of `A`, `M`, and `AM`. Read both index and worktree, not just `git diff`.
- Applicable guidance read: root AGENTS, components/AGENTS, stores/AGENTS; installed
  Next use-client guide; shadcn, dnd-kit, vitest-testing/browser reference,
  nextjs-oauth-persistence, resume-latex, react-state-performance skills. Read any
  other applicable nested guidance before editing. No subagents were used.
- No verified Next.js feedback candidates so far. Before final response, perform
  the AGENTS feedback audit; run the reporting CLI only if qualifying candidates exist.

## Approved implementation shape

1. Keep original theme tokens, typography, spacing, rail/sidebar/header/panels,
   card treatments, responsive behavior, accessible controls, and info hints.
2. Restore purpose-built forms and the full-width name / paired profile fields.
   Use readable labels, not schema keys and implementation suffixes.
3. Reuse selectable/animated cards and sortable handles, retaining keyboard move
   alternatives, filtered reorder semantics, cancellation, and draft-only drops.
4. Save/Cancel are the normal form actions. Show recovery comparison/reconciliation
   only when relevant; routine recovery export belongs in Data & backups.
5. Retain explicit Save, recovery/committed separation, scope checks, stable
   operations, atomic IndexedDB transactions, bounded history, dirty navigation,
   durable destinations, and committed-only/manual preview behavior.
6. Rich wording must survive backups/recovery/history/output safely. No schema-1
   conversion, providers, review queues, or retired features for parity.
7. Finish and verify Phase-1 gaps: recovery file boundaries and manifests/raw
   chunks, cleanup/receipt retention, concurrent transactions and replacement,
   real quota failures, broader browser checks, English/Portuguese output,
   applicable capacity/performance/resource measurements. Record unavailable
   acceptance honestly instead of claiming completion.

## Changes made so far

### Reusable UI

- `components/editor/text/text-editor-core.tsx`: extracted the old Tiptap editor
  into a controlled component with `disabled`, `resetKey`, `onBoundary`, and
  `maxLength` props. The tiny retained `text-editor.tsx` wrapper adapts old
  schema-1 consumers. Active career code uses the core directly.
- `text-editor-extensions.ts`: optional max-character guard in addition to the
  existing span/link bounds; default retains reference editor capacity, active
  prose editor passes 20,000. Rejections should retain text/history.
- `components/editor/order-buttons.tsx`: extracted the existing buttons so active
  sorting does not import the retired field-history hook.
- `sortable-list.tsx`: removed old WorkspaceContext dependency. Accepts object
  revision tokens and compares a live revision ref before deferred reorder.
  Dedicated handles, accessibility announcements, and existing animations remain.
- `components/career/career-fields.tsx`: readable plain fields with hints/errors,
  profile grouping, section-specific grouping/date legends, rich prose fields,
  sortable nested achievement/link rows with archive/restore, compact Add actions.
  Unformatted editor spans are normalized back to strings; marked content stays
  spans. English display names for extensible languages use Intl.DisplayNames.
- `career-entry-list.tsx`: old SelectableList presentation, search across languages,
  archive filter, contextual menus, entry actions, and an independent
  `CareerOrderEditor` using the existing SortableList/reorderVisible operation.
- `scope-comparison.tsx`: added labeled current/draft comparison rows instead of
  routine raw JSON. Latest addition has not been fully validated.

### Active workspace wiring

- Removed the inline generic field/link/entry editors from career-workspace.tsx
  and wired the extracted controls.
- Entry-list cards can remain above an open entry form. Section and entry actions
  use menus. Section archive checkbox is in the section-properties draft.
- Recovery comparison/reconcile/export buttons are conditional rather than always
  beside Save/Cancel. Recovery status moved beside the normal form actions.
- `navigate(next, initialValues?)` supports creation drafts. Create entry,
  duplicate entry, and Create section now open an uncommitted form instead of
  immediately saving an empty record. Save/Cancel now use guarded navigation to
  update the URL as well as local destination.
- Shell displays readable content-language names and hides its language row on
  overview/backups/languages/section-order destinations.
- Some old/unreachable sections/entries array-object DraftEditor branches remain;
  actual order scopes are ID arrays and use CareerOrderEditor. They can be cleaned
  up carefully, but do not weaken malformed-recovery rendering.

### Domain/output/recovery

- `lib/career/wording.ts`: `RichText = string | RichSpan[]`; spans have `text`,
  `emphasis`, `href`. Bounds: 100 spans / 20,000 total text characters, link <=2,000
  with http/https/mailto/tel schemes. Plain strings remain valid.
- model.ts now accepts rich summary/achievement wording and rich overrides only
  for those IDs, keeping other wording plain. New document factory seeds the five
  empty built-in sections with independent IDs; storage only uses initial data
  when no head exists, so existing workspaces are unaffected.
- output.ts uses wordingText for short fields and renderWording for prose. Latest
  change extracts shared `escapeLatexUrl` to lib/output/encoding.ts and uses it in
  inline/standalone links; this fixes an initial attempt that incorrectly encoded
  query separators. Prose newlines render as `\\newline{}`. **Rerun output tests and
  actual PDF generation after this latest change.** Pinned template unchanged.
- `lib/career/recovery-export.ts`: generator produces bounded normal recovery files,
  versioned inventory manifest pages, and explicit raw chunks for oversized drafts.
  Normal files are independently importable. Raw chunks are JSON-text fragments
  requiring ordered reassembly; not claimed as normal recovery imports. Unicode
  fragments are reconstructed losslessly. Export never removes recovery.
- Workspace export handler detects oversized drafts, explains the limitation,
  and offers an explicit Export raw recovery chunks action. Normal export uses
  the generator. The download helper accepts serialized strings as well as values.
- **No controller.ts or persistence.ts implementation changes made yet.** Their
  broader acceptance gaps remain to be audited.

## Tests and actual execution evidence

Commands often need escalation because sandboxed esbuild/browser spawn fails
with `EPERM`. Use `require_escalated` with a concise test justification. No auto-review
rejection occurred. Typecheck/format/lint ordinarily work without escalation.

- Earlier `npm run typecheck` passed after initial integration/creation changes.
- `npm run test:unit`: **5 files, 21 tests passed** (including new wording/recovery
  cases) before the latest URL-encoding/comparison changes. No failed/skipped cases.
- `npm run test:browser`: **1 file, 26 tests passed** after updating the original
  tests to the new labels, contenteditable assertions, creation draft timing, and
  factory defaults.
- Latest browser run after adding two new cases: **1 file, 28 tests, 27 passed,
  1 failed**. Rich-text inline-link/italic/local-undo/Save-history case passed.
  The filtered ordering test timed out before exercising ordering:
  `getByRole("textbox", { name: "Filter order" })` could not find the field.
  **Likely immediate fix: it is `type="search"`, so its role is `searchbox`.**
  After fixing, verify drag cancellation rather than weakening assertions.
- An initial component test startup failed during Vite first-use dependency
  optimization/reload (zero tests); subsequent runs collected normally. Consider
  optimizeDeps only if reproduced, not a product behavior failure.
- A full lint attempt found import-sort errors and two unused imports; scoped
  `eslint ... --fix` resolved ordering, but latest changes need another pass.
- A later typecheck identified a union narrowing issue in the new recovery unit
  test (`parsePortable(...).drafts`); code was changed to check `format` explicitly,
  but **typecheck has not been rerun after that fix**.
- No production build or Playwright E2E run executed in this implementation yet.
- No performance measurements, real quota test, extended resource run, or
  cross-browser storage check executed yet.
- No screenshot inspection or visual acceptance performed during implementation.

New test file: `tests/unit/wording-recovery.unit.test.ts` has four cases covering
factory defaults, safe rich wording/backup/override validation, normal recovery
splitting/manifests, and raw chunk reconstruction. Configurable small byte limits
exercise boundaries; these do not prove real browser quota or actual large-file
responsiveness. Existing capacity tests still cover actual 64-MiB model boundaries.

Existing unit/E2E fixture builders explicitly set `document.sections = []` before
adding custom fixtures, so new factory defaults do not silently change those cases.
Browser tests now locate explicitly created sections by ID instead of assuming [0].
Old screenshot calls were removed from component tests in line with owner handling
visual review. Failure screenshots may still be generated automatically; do not inspect.

## Processes and browser installation

- No known running test/server/install process remains from this agent.
- Last browser process (exec session 6108) completed with 27/28 result above.
- Started `npx --no-install playwright install firefox webkit` for required broader
  checks. Interrupted it at handoff (session 44846, exited 1). Firefox v1555 did
  finish downloading to `C:/Users/yuji/AppData/Local/ms-playwright/firefox-1555`;
  FFmpeg download had just started. WebKit installation not reached.
- **That install command did not set PLAYWRIGHT_BROWSERS_PATH** and therefore
  used the user cache. Project config sets `.cache/ms-playwright`, which contains
  the pinned Chromium v1248 and working headless shell. Install remaining browsers
  into the intended project cache or explicitly configure the correct path; do
  not accidentally use older cached Firefox/WebKit revisions.
- The computer-use UI host is unavailable; user does not want manual browser
  inspection anyway. Use the existing automated testing stack.

## Important unfinished issues to check next

1. Fix the searchbox test locator, rerun focused new tests, then full suites.
2. Run format/import sorting/typecheck again: recent files have deliberately not
   been polished after the owner asked to stop. Do not treat prior green results
   as validation of the latest worktree.
3. Pass `state.saving` explicitly through rich fields to TextEditorCore. The
   surrounding disabled fieldset disables native controls but does not disable
   contenteditable automatically. The core already exposes `disabled`; wire it.
4. Creation deep-link reload currently opens a null baseline draft and may show raw
   JSON. Provide a useful unsaved/missing-resource recovery state instead. Do not
   auto-restore recovery or discard it silently.
5. Review creation form titles/context, action placement, filtered/archive card
   behavior, selected-row persistence/scroll/focus, and Save/Cancel URL behavior
   with automated tests. Some restoration composition is still rudimentary.
6. Recovery generator is implemented but true boundary/performance/large-manifest
   acceptance needs further verification. Raw chunk imports intentionally reject;
   document reassembly/export semantics and distinguish portable normal files.
7. Audit cleanup retry on next load, exact-version deletion, immutable operations,
   retention configurability/protection, and other documented safety contracts.
   Existing tests cover many injected failures but do not prove real quota.
8. Add real Chromium quota exhaustion using CDP `Storage.overrideQuotaForOrigin`
   (installed protocol declarations confirm origin/quotaSize parameters), then
   prove no partial head/previous snapshot changes and retained drafts. Never use
   shared browser data. Broader browser storage/navigation remains outstanding.
9. Perform required nonvisual PDF verification (links including query strings,
   accents, text/fonts/metadata) and production performance/resource measurements
   from requirements. Read performance skill and measure before refactoring.
10. Update requirements, evidence, README/applicable guidance to final behavior.
    Requirements should explicitly record the accepted field policy, default empty
    sections, original UI reuse/action placement, and owner-owned visual acceptance.
    Do not check all Phase-1 boxes until proven; explicitly list remaining blockers.

Stop here was requested solely to hand over context. Continue from these files;
do not restart, throw away staged work, or claim this implementation is complete.

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
