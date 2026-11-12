# Verification boundaries and acceptance checks

These checks describe acceptance work, not implemented features or passed results.
Automated test sources and historical runs do not establish manual PDF acceptance,
actual Safari behavior, or measured performance. Engineering targets and safety
contracts are maintained in [AGENTS.md](../AGENTS.md).

## Settings and navigation acceptance

Settings now uses a dialog with its own responsive sidebar and durable panel URLs.
The implementation adds browser preferences and a recoverable workspace appearance-
defaults editing scope. Optional automatic preview refresh was added later (see
Saving and preview resources below). Browser Mode,
production browser suites, screenshots, and manual interaction/PDF validation for
these changes were explicitly left to the owner and have not been executed.
Earlier automated results predate these changes and do not prove this slice.

Non-browser verification executed on 2026-11-07: `npm run format:check`,
`npm run lint`, `npm run typecheck` (including generated routes), and
`npm run build` passed. `npm run test:unit` passed all 156 tests across 14 files,
with no failures or skips. The initial unit run could not spawn its worker in the
sandbox; the successful run used approved process access. The initial formatting
check could not enumerate a temporary directory; its read-only retry passed.
Maintained-document links and diff whitespace checks passed. These checks do not
prove browser IndexedDB behavior, rendered interaction, visual layout, or PDF output.

Authored coverage is in `tests/browser/settings.browser.test.tsx`, the added
compiler-preference case in `tests/browser/output.browser.test.tsx`,
theme persistence-failure coverage in `tests/browser/theme.browser.test.tsx`, and
`tests/e2e/settings.spec.ts`. Run the existing browser suites as well as these new
cases because navigation and data tools changed their presentation. On disposable
origins, verify:

- [ ] Open Settings from desktop utilities and the mobile sidebar. Check five
      labeled panels, selected state, keyboard navigation, heading focus, close
      access, independently scrolling content, short screens, text zoom, and theme.
      Check Escape and IME composition without discarding an unresolved form.
- [ ] Direct-load/reload every Settings panel, follow old language/backup links,
      and use Back/Forward through panels and dialog closure. Cancel dirty history
      navigation; URL and draft must remain current. Close to the original workspace
      with appropriate focus and preserved scroll; direct-load closure goes to Overview.
- [ ] Keep dirty entry and order drafts while visiting Appearance, Editing & preview,
      and Data & backups. Exports stay accessible, selections/filter/scroll persist,
      and no Save/history step occurs. Resolve occupied drafts independently before
      editing languages/defaults; failed Save or canceled resolution prevents entry.
- [ ] Suspend dirty Settings languages/defaults in Data & backups and return to
      editing. Close, switch workspace forms, restore recovery, and attempt replacement/
      rollback with Cancel/Discard/Save. Preserve both versions on failures/conflicts.
- [ ] Change compiler preferences, reload, and verify browser-only persistence and
      bounds. Verify failed preference writes, current-tab feedback, retry, and rapid
      changes retaining the latest value. Import/rollback must preserve preferences.
      Changing preferences alone never compiles or enters workspace Undo. Timeout
      changes preserve active work and affect the next compiler instance.
- [ ] Verify retention age/count choices, including zero, against real IndexedDB:
      protect pending/uncertain, unacknowledged, and recovery-referenced operations;
      load preferences before pruning after restart. Unresolved drafts never expire.
- [ ] Edit/reset/save/cancel new-resume defaults, including hidden invalid fields and
      relative values. Existing resumes/library items stay unchanged; new blank
      resumes copy appearance and frozen defaults. Check one atomic history step,
      Undo/Redo, interrupted identical retries, exact cleanup, two-tab conflicts,
      recovery imports, workspace backups, replacement, and rotating rollback.
- [ ] Verify missing/malformed career, entry, resume, Library, and Settings URLs:
      useful recovery navigation, no content creation, no private text in generated
      URLs. Recheck Library/resume expansion, inline profile navigation, exact issue
      focus, color-popover selection/dismissal/focus, and narrow Editor/PDF switching.
- [ ] Inspect actual English/Portuguese PDF output after explicit Saves and manual
      refresh. The fictional defaults sample does not compile or prove pagination.

All earlier deferred acceptance and performance/resource measurements remain open.

## Resume readiness and PDF acceptance

Manual visual/PDF acceptance and browser execution for the PDF footer/control
refactor remain with the owner; its updated browser-component and production E2E
test sources have not been executed for this change. In a disposable workspace,
check the following in your usual browsers, at desktop and phone widths:

- Clear and Save full name, a selected title/degree or achievement, and a rendered
  custom-section heading. Issues should appear only in the PDF footer, never
  Overview; Refresh preview should be disabled. Optional empty values should
  remain allowed.
- Before compiling, check the collapsed Issues count/status row at the PDF panel
  bottom. Expand/collapse with mouse and keyboard; verify the choice survives
  saved-content updates, long lists scroll within 40dvh, and the PDF keeps its own
  scrolling area. Repeat with loading/failure and a retained outdated PDF.
- Review the illustrated placeholder in light/dark appearance and short/narrow panes.
  Generate explicitly; check preparation, generation, viewer loading and first-page
  rendering states, reduced motion, blocked guidance, retry after failure, and
  retained PDF/download access during refresh. Updated browser tests for these
  states remain unexecuted until owner validation.
- Check compact page entry (Enter/blur, invalid input, upper-bound clamping),
  spinner-free percentage zoom entry (Enter/blur, invalid input and 25-400% bounds), separate active Fit width/Fit page buttons on resize,
  toolbar grouping/wrapping, navigation separator, and right-aligned actions.
- Open PDF navigation: verify Images/Summary icon tabs in the left rail, tooltips,
  vertical keyboard navigation, navbar-style moving selection surface/bar, reduced
  motion, independently scrolling thumbnails/outline, bottom Close, and narrow
  overlay behavior. Check thumbnail and outline destinations still navigate.
- Follow **Edit wording** to the exact card, including from narrow PDF view and
  when Wording is already open. Check visible focus, scrolling, keyboard operation,
  disclosure expansion, long issue labels, and light/dark appearance.
- With a dirty form, follow an issue and exercise Cancel, Discard, and Save. Cancel
  retains edits; Discard leaves saved content unchanged; Save navigates only after
  success. Invalid dates/links retain the draft and prevent navigation on Save.
- Repair wording without saving: readiness must still describe saved content.
  Save the repair: readiness updates, but PDF compilation still requires Refresh.
  On narrow screens, choosing PDF while Save finishes must not jump back to Editor.
- Customize wording, edit the shared career text, and confirm the customization
  stays intact. **Use career wording** should restore inheritance only after Save.
- Exclude a section/entry/achievement or hide an entry and confirm its missing
  wording stops blocking output. Archive selected content or deactivate its
  verified language and confirm output remains available. Other resumes do not
  affect the selected resume's readiness.
- Generate a PDF, then Save a change that blocks output. Keep the old PDF visibly
  labeled outdated and downloadable with its original resume identity. Check
  switching resumes and retaining the last PDF after compilation failure.
- After Save, reload and use Back/Forward through Overview/Wording. One Back should
  return to the preceding destination. Saved repairs must persist;
  recovered drafts must stay separate from readiness until explicitly saved.
- Inspect actual English/Portuguese PDFs for accents, dates, headings, links,
  selectable text, omissions, and clipping. An unverified language must remain
  unavailable even when active. Custom section icons should remain consistent in
  editors and stay out of PDF graphics.

## Storage, performance, and presentation acceptance

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

Native desktop Find coverage of unrendered PDF pages is unverified. Component
checks establish only that the viewer leaves the browser Find shortcut intact.

## Layout, presets, and starters: owner acceptance

Browser Mode, production Playwright, screenshots/computer-use, and manual/PDF
checks for the layout/reusable-configuration implementation have not been run by
the implementation agent. Their execution and visual acceptance belong to the
owner. Added cases in `tests/browser/layout-setups.browser.test.tsx` and
`tests/e2e/layout-setups.spec.ts` are authored/type-checked coverage, not passing
browser evidence. Earlier deferred acceptance above remains open.

- [ ] Run `npm run test:browser` and `npm run test:e2e` on an isolated origin; record
      file/test counts, failures, and skips. E2E includes a fresh production build.
- [ ] Review Layout and setup collections in light/dark themes, narrow Editor/PDF
      panes, long labels, and reduced motion. Verify hierarchy, semantic colors,
      independent scrolling, keyboard focus and disclosure controls.
- [ ] Exercise Cancel/Save and dirty navigation Cancel/Discard/Save, invalid numeric
      text and decimals, Back/Forward/reload, missing records, and recovery restore.
      Save must not compile. The illustrative sample must remain clearly distinct
      from saved PDF output and produce no compiler work while typing.
- [ ] Select/order contacts in Content & order. Check icons off/on, separators,
      automatic wrapping, 1-4 contacts per row, custom sizes, excess contacts,
      empty values and unused rows. Full name must remain required.
- [ ] Create/name/edit/duplicate/delete presets and starters; load presets into a
      draft, cancel and undo. Confirm copied settings never change after later
      library edits/deletion and presets never change content or shared icons.
- [ ] Capture starter structure without wording/entries/contact selections. Edit
      structure/icons/order/default fields, review ambiguous/reused/new/archived
      mappings, and create a resume. New entries must use copied defaults without
      reversing explicit deselections. Custom heading wording must stay empty.
- [ ] Verify real IndexedDB transaction abort/quota handling, two-tab mapping and
      layout conflicts, uncertain acknowledgment/restart/retry, exact recovery
      cleanup, one-step creation Undo/Redo, and stable section identities.
- [ ] Round-trip workspaces and separate malformed/recoverable layout/library
      drafts. Rejected imports write nothing; replacement/rollback retain library
      configuration, one previous workspace, recovery and device preferences.
- [ ] Compile English and Portuguese with Inter, Source Sans 3, and Source Serif 4.
      Inspect every page for clipping, overlap, unwanted blanks, detached headings,
      long contacts/URLs/titles, accents, selected fields, inline emphasis, and
      near-boundary content. Inspect extracted text, links, fonts and metadata.
- [ ] Exercise typography, spacing, bullets, colors, dividers, page numbering and
      page-warning threshold. Retained PDFs must keep their original threshold
      and identity. Confirm counts alone do not imply correct layout or PDF/UA.
- [ ] Test fresh development workspaces and explicit rejection of older layouts/
      templates. Rejection must not clear storage, recovery, or silently reseed.

### Non-browser implementation checks, 2026-11-05

Formatting, ESLint, generated Next.js route types/TypeScript, 115 unit tests
across 13 files, and the production build passed for the layout/configuration
implementation. This adds 51 unit cases. Seven Browser Mode cases and two
parameterized production E2E definitions (desktop/phone, configured across three
browser projects) were added and type-checked, but not executed. No browser,
computer-use, screenshot, visual, or manual/PDF validation was performed.

Initial checks found an outdated sample workspace and a Zod refinement-composition
error in composite creation; both were fixed and the final unit suite passed.
The initial unit startup and formatting directory scan hit sandbox EPERM errors;
permission retries passed. Compiler preparation passed with the existing bundle
and updated template metadata; manifest-only refresh initially rejected the old
identity. Four local links across five maintained documents were checked, and
`git diff --check` passed. These checks do not establish actual IndexedDB quota,
transactional browser acceptance, rendered PDF correctness, or performance budgets.
Earlier deferred acceptance remains open.

### Location-icon compilation correction, 2026-11-05

The English sample's reported LaTeX failure and the corresponding Portuguese
failure were reproduced using the pinned XeTeX WASM engine in a non-browser
Node VM. The undefined `\faMapMarkerAlt` command was replaced by the bundled
package's `\faMapMarker*` command. Both samples subsequently completed both
XeTeX passes successfully. No browser, PDF conversion, screenshot, or visual
validation was performed. The sample regression now asserts the supported
command. All 58 targeted rendering/sample unit tests across three files passed;
changed-code lint/format and generated route types/TypeScript passed. The full
unit and browser suites were not rerun for this correction. Existing owner
browser/PDF acceptance remains open.

## Library navigation and reuse workflows: owner acceptance

The Library/navigation follow-up retains the current Verso presentation and
workspace schema 2/recovery format 1. Initial browser cases were authored and
left for owner execution; the automated regression follow-up below records later
execution requested by the owner. Computer-use, manual interactions, and
visual/PDF acceptance remain with the owner. Earlier open acceptance and
historical results above remain separate.

- [x] Run `npm run test:browser` and `npm run test:e2e -- tests/e2e/layout-setups.spec.ts`
      on isolated test storage; record actual counts, failures and skips below.
      Broader application regressions remain necessary before complete acceptance.
- [ ] Compare Library, collections, editors, creation and use dialogs against current
      Career details, Resumes, resume views and Data & backups: text hierarchy,
      semantic colors, selection surfaces, spacing and primary/rightmost actions
      except Library destructive actions, which must be last.
      Check light/dark themes, long names, reduced motion and narrow/short screens.
- [ ] With empty and many-item collections, reach both Library links and utilities;
      verify active states, independent scrolling, location truncation, keyboard
      focus, dialog scrolling, and Editor/PDF switching. Confirm the sidebar order
      Career details > Library > Resumes, with Library in the normal flow. Clicking
      either library item must not remount, expand/select, or replay pop animations
      on resume rows. Library pages/editors omit unrelated career-language controls
      and career/resume return links.
- [ ] Navigate Library overview, both collections, and editors directly and by sidebar/contextual links;
      reload and use Back/Forward. Check new/missing labels and guarded parent links.
      Cancel must keep dirty drafts; failed Save must prevent the requested action.
- [ ] Use a preset with an explicitly selected resume; loading changes only its
      Layout draft, announces unsaved state, and leaves committed output unchanged.
      Check no-op loading, Cancel, Save, Undo, recovery, and deleted source/target
      records. No-resume use must offer ordinary creation without automatic apply.
- [ ] Capture saved appearance after Save/Discard/Cancel resolution. Later edits
      or deletion of a library item must not change existing copied configurations.
- [ ] Create blank and from starter through both entry points. Review structure,
      summary/field defaults, style and mappings. Cancellation creates nothing;
      missing starters cannot silently fall back to blank. Verify failed-creation
      recovery, atomic creation and Undo/Redo without changing shared content.
- [ ] Verify layout group order/default expansion and automatic error revelation.
      Typing, preset loading and Style samples must not compile. Saving remains
      separate from PDF refresh; inspect real English/Portuguese output separately.

- [ ] Open Library with keyboard/side navigation and check descriptions, icons, Edit links, and absence of saved-item counts,
      collection links, and guarded Library breadcrumbs. Verify direct
      `?scope=library`, reload, Back/Forward, empty collections, and short screens.
- [ ] Check one page heading per collection and creation at the end of the page title row. Verify
      Edit / Duplicate / Apply or Create / Delete footer order through wrapping and
      keyboard traversal; confirmation remains Cancel / Delete. No preset/starter
      search fields appear in collections or contextual pickers; all choices remain.
- [ ] In Resume Layout, edit and Save directly without selecting a preset. Expand
      initially collapsed Layout presets (optional); check the empty explanation
      or complete preset choices. Selection alone changes nothing; Load opens an
      unsaved change, whose announcement stays visible after collapsing. Check
      matching/no-op loads, capture/manage actions, Cancel, Save, and Undo.

### Library follow-up non-browser verification

On 2026-11-06, formatting, ESLint, generated route types/TypeScript, all 117 unit
tests across 13 files, and the production build passed. Initial sandbox-only
failures prevented the unit runner's subprocess startup and the formatter's
scan of a temporary directory; both commands passed on sandbox retries.
Documentation links and diff whitespace were checked separately.

Twelve new Browser Mode cases cover library navigation/new items, stable resume
rows without expansion/selection or repeated entrances, parent guards, preset draft isolation and Undo, failed Saves, missing source/target records,
no-op loading, no-resume creation, starter preselection and missing starters.
Existing layout/disclosure and resume-location assertions were updated. Two
parameterized desktop/phone production E2E definitions now cover library entry
points, ordinary creation, reload/Back navigation, many resumes and short screens;
they remain configured across Chromium/Firefox/WebKit. These cases were
source-reviewed and type-checked only. No Browser Mode, Playwright, browser launch,
computer-use, screenshot, manual interaction, or PDF validation was executed.
All owner acceptance checkboxes above remain open.

### Library overview and optional-preset correction verification

The correction adds authored Browser Mode coverage for overview icons/Edit links without counts,
resume-row isolation, collection title-row creation/footer order, Library parent draft
guards, direct layout Save without a preset, explicit loading and announcements,
and the empty optional disclosure. Production desktop/phone definitions include
overview reload, Back/Forward, parent navigation, and optional disclosure
access. At this initial handoff, these cases were left for owner execution;
no browser/manual/visual/PDF checks were performed then. Automated execution
requested later is recorded below; earlier results remain historical.

Non-browser checks for this correction on 2026-11-06: formatting, ESLint,
generated route types/TypeScript, 117 unit tests across 13 files (all passed),
and production build passed. Eight local documentation links and both staged
and working-tree diff whitespace checks passed. Initial unit subprocess startup
and formatter directory scanning were blocked by sandbox EPERM; both passed
outside the sandbox. After the final presentation edits, the production build
also hit sandbox EPERM when starting its TypeScript subprocess and passed in
full outside the sandbox. Final formatting, lint, and route types/TypeScript
checks passed. An initial import-order lint error was corrected before
the passing check. No browser suite was launched and no tests were skipped to
obtain these results. Owner acceptance remains open.

The final presentation follow-up adds Palette/FileText icons to Library overview
cards and collection/editor headings using existing card/page icon sizes. Overview
actions are Edit and omit counts. Collection creation aligns to the end of the
page title row, matching Career details. Authored regression assertions reflect
these changes. Browser execution was left with the owner at that handoff and
subsequently requested below; manual visual validation remains with the owner.

### Library automated regression fixes

On 2026-11-06, the owner requested failing-test repair and automated browser
execution. The initial complete Chromium Browser Mode run had 105 passing and
five failing cases across ten files. The failures were test assumptions about
EmptyTitle rendering plain text, Base UI using presence-only active attributes,
role locators excluding collapsed content, and Select clearing a removed option.
Assertions now match those contracts while verifying that unavailable selections
cannot mutate committed content, drafts, or workspace history. All 29 Library
component cases then passed.

Production Library E2E initially failed all six cases: mobile navigation is a
named dialog rather than the desktop navigation region, and the complete select
trigger text includes its decorative arrow. The next run passed two cases and
exposed a mobile sheet-close race and WebKit reload before Save acknowledgment.
Tests now wait for sheet closure before reopening and the committed revision
before reload. The final focused run passed all six desktop/phone cases across
Chromium, Firefox, and WebKit using the normal two workers, no configured retries,
and no skips. Each production run built and started a fresh server.

Complete component reruns also exposed Cancel/reopen and Save/Undo races in
older test code that directly reopened or canceled controller drafts before UI
navigation completed. The icon test now waits for the entry-list search control
and reopens properties through its menu. The Library test waits for enabled
history, resolves the clean form through Library navigation, and invokes Undo
through the toolbar. An intermediate Entries-heading assertion failed because
the heading includes an accessible help control; the settled-list assertion uses
the searchbox instead. Intermediate full runs had 109/110 and 108/110 passing
cases; the final full run passed all 110 cases across ten files, without skips
or configured retries.

Application behavior and test timeouts were unchanged. Changed-test ESLint and
formatting, generated route types/TypeScript, and the production build passed.
Unit tests and unrelated production E2E cases were not rerun for these test-only
changes. The initial sandbox browser launch was blocked at compiler subprocess
startup with EPERM; execution succeeded outside the sandbox. Failure screenshots
were inspected only for diagnosis; this is not visual or PDF acceptance.

## Layout editor refactoring and frozen defaults

Implemented shared resume/preset/starter controls with concrete or readable
relative default values, group resets, conditional dependent fields, margin
hover/focus, inline guarded profile navigation, and named color popovers. Resume
defaults are frozen appearance copies, independent of subsequent library edits.
Existing supported layouts without baseline metadata initialize from saved
appearance on their next layout Save, without load-time writes. Preset/starter
authors reset to app defaults. See README and recovery-file documentation for
the complete behavior and portable-data contracts.

Non-browser verification on 2026-11-07: `npm run format:check`, `npm run lint`,
`npm run typecheck`, `npm run test:unit`, and `npm run build` passed. The unit
suite executed 125 tests across 13 files with no failures or skips. Added cases
cover baseline-only changes, frozen copies, duplication, existing-data
initialization, workspace/recovery preservation, unchanged generated output,
atomic Save/Cancel/Undo/Redo, and relative/color default resolution. Existing
expectations were updated for baseline metadata.

Initial unit startup and formatting traversal encountered sandbox EPERM errors;
both checks passed outside the sandbox. Intermediate unit assertions were
updated for the new metadata, and an optional-property test type error was fixed
before the final successful typecheck/build. These are non-browser results,
not proof of real IndexedDB transactions or presentation acceptance.

Browser Mode cases and desktop/phone production E2E cases were updated and
type-checked. No browser suites, computer-use, screenshots, manual interaction,
or PDF inspection were executed for this refactoring, at the owner's request.
Earlier browser results do not establish acceptance of these changes.

- [x] Run the affected Browser Mode and production E2E suites; inspect actual
      counts and failures, including all three appearance editor contexts.
- [ ] Review group icons, compact reset placement, default descriptions, spacing,
      light/dark appearance, wrapping, and keyboard focus on desktop/narrow screens.
- [ ] Verify relative-value focus/typing, hidden-value retention and actionable
      errors, divider/numbering/contact checkboxes, and custom contact rows.
- [ ] Verify Paper precedes and updates the guide; hover/focus highlights each
      edge, hover wins, and leaving restores keyboard focus highlighting.
- [ ] Verify named color selection/dismissal/focus return and disabled dependencies.
      Selecting a color, resetting a group, and loading a preset remain drafts.
- [ ] Apply a preset, customize/save/reload, and reset groups to its frozen defaults.
      Edit/delete the library preset; existing resume defaults remain unchanged.
      Verify starter/blank creation, duplication, and baseline-only preset loads.
- [ ] Exercise Save/Cancel, history, uncertain prepared retries, recovery/restart,
      two-tab conflicts, backup/import, previous-workspace replacement, and rollback
      on disposable origins; preserve both appearance and defaults atomically.
- [ ] Check English/Portuguese PDFs and confirm that default sentinels retain
      template behavior, saved appearance renders correctly, and baseline-only
      metadata changes no layout commands. Revision-only Saves keep previews Current.

All earlier deferred acceptance remains open.

### Conditional layout control positioning

Numbering alignment/format now stay beneath Show page numbers, with the page
warning threshold alongside. Custom row sizes and row-break choices stay beneath
Contacts per row; row spacing and separator stay together alongside that column.
Divider thickness likewise stays beneath Section divider; toggling it preserves
the neighboring title-size field's position. The authored 720/1000 px regression
cases include this divider behavior.
The warning explanation uses the existing label-sized InfoHint, and row-break
checkboxes share one Start a new row before legend with contact-only labels.

Changed-code ESLint, formatting, generated route types/TypeScript, local document
links, and diff whitespace checks passed for this presentation correction.
Authored Browser Mode cases check neighboring field positions at 720/1000 px,
dependent control grouping, shared row-break labels, and warning-hint access.
Browser/manual validation remains with the owner and was not run. Unit suites
and production build were not rerun for this UI-only correction; earlier results
remain separate.

### Automated regression repair

The owner subsequently authorized automated failing-test repair. The initial
full run passed all 125 unit tests but failed three of 120 Browser Mode cases.
Two divider-position assertions measured document coordinates: removing the
Style sample's divider moved the entire form by one pixel. They now measure
the title field relative to its Typography group, retaining the same tolerance
and checks for thickness placement. This tests stable neighboring controls
without treating the illustrative sample's size as fixed.

The hint failure exposed missing tooltip semantics in the shared InfoHint.
Its popup now has a stable ID and tooltip role, and its trigger references the
open help using aria-describedby. The regression checks help text, accessible
description, Escape dismissal, and removal of the closed description reference.
Failure screenshots were inspected only for diagnosis, not visual acceptance.
No test timeouts, configured retries, or skips were added.

On 2026-11-07, the targeted layout Browser Mode run passed all 39 cases. The final
`npm test` passed 125 unit tests across 13 files, 120 Chromium Browser Mode tests
across ten files, and all 55 production E2E cases across Chromium, Firefox, and
WebKit, with no failures or skips. The E2E runner built and started a fresh
production server. Changed-code ESLint/formatting, generated route types /
TypeScript, maintained-document links, and diff whitespace checks also passed.

These automated results supersede the earlier unexecuted-browser status for the
refactoring and positioning correction. Owner manual/visual/PDF acceptance and
other deferred verification remain open; the tests do not establish complete
product acceptance or performance measurements.

## Saving and preview resources

Implemented behavior (see README "Current capabilities" and AGENTS.md):

- A workspace preview coordinator above the editor/preview layout owns one
  compiler instance, one active job, one replaceable queued job, one retained
  PDF URL, and an optional automatic-refresh timer. Results are tagged with
  generation, resume, and an output fingerprint that ignores revision
  metadata; stale results are discarded before any URL is created.
- Hiding the preview unmounts the PDF.js viewer (document, canvases, worker,
  listeners) while keeping the last PDF and any in-flight compile.
- Optional device-only automatic refresh (off by default) runs about 800 ms
  after a committed output change while the preview and tab are visible.
  It retains target identity while output is blocked and refreshes when a Save
  makes the same resume ready. Already queued automatic work waits while hidden;
  disabling the preference or switching resumes drops its obsolete queue.
- Save status is typed and separate from recovery, preview, and backup status;
  storage failures carry typed reasons. Session-only mode can be left through a
  reviewed choice: discard tab-only Saves or adopt this tab's workspace through
  atomic replacement. Adoption identifies the previous snapshot and requires
  export or explicit continuation without export; export failures keep adoption
  blocked. Tab-only Saves after storage startup failure retain a persistent
  disclosure and workspace-export guidance.

Initial checks on 2026-11-09 (before the follow-up corrections below):

- `npm run format:check`, `npm run lint`, and `npm run typecheck` (generated
  routes plus TypeScript) passed.
- `npm run test:unit` passed 165 tests across 15 files, with no failures or skips.
  Two later reruns under the same high host load timed out (5 s) only in the
  unchanged `recovery-cli` subprocess test (164/165).
- Targeted Browser Mode runs passed:
  - `output.browser.test.tsx`: 8 tests.
  - `preview-resources.browser.test.tsx`: 1 test, 3 consecutive runs.
  - `save-status.browser.test.tsx`: 4 tests, 3 consecutive runs.
  - `pdf-preview.browser.test.tsx`: 5 tests.
  - `settings.browser.test.tsx`: 12 tests.
- An earlier full Browser Mode run of the same application code passed 135 tests
  across 11 files, before the new resource, status, and settings cases existed.
- Targeted Chromium production E2E runs, each with a fresh build, passed:
  - all 11 `career.spec.ts` cases, including the new hidden-preview and
    automatic-refresh case and the two-tab remote-update assertion;
  - the new case again on its own after a test-flow fix.

Initial failed or incomplete runs:

- The complete `npm test` run failed in Browser Mode: 13 of 141 tests across 6
  files, mostly 15-second timeouts. Because the browser stage failed, its
  Firefox and WebKit E2E stage did not run.
- A standalone Browser Mode rerun failed 23 tests.
- During these runs the host was at about 96% CPU from unrelated applications.
- The two custom-section icon cases that failed did not pass in isolation, and
  fail identically on the unchanged pre-change code (`git stash`) under the
  same load. This indicates host contention rather than a regression, but it
  does not prove it.
- A complete `npm test` on an idle host is still required before counting this
  slice as verified.

Initial coverage limitations (follow-up results below supersede where stated):

- No Firefox or WebKit E2E run of the new cases.
- No Chromium E2E for session-only disclosure with IndexedDB blocked. Session
  behavior is covered by real-IndexedDB Browser Mode cases only.
- The backup button keeps its existing "saved workspace only" label at all
  times; it is not limited to when drafts exist.

Owner acceptance (open):

- [ ] Rapid edits and resume switches with manual and automatic refresh: at most
      one compile runs and one waits. The label tracks Current/Outdated correctly.
- [ ] Hide/show the preview, cross the narrow/desktop breakpoint, and switch
      narrow tabs. The last PDF persists; the viewer reloads without recompiling.
- [ ] Compiler failure and timeout (lower the timeout in Settings): the last PDF is
      kept, the retry works, and the timeout guidance and compiler log appear.
- [ ] Two tabs: other-tab Saves show "Updated from another tab". Same-scope
      conflicts keep the draft and report the conflict reason.
- [ ] Session-only: block storage or choose Save in this tab only, confirm the
      banner and close warning, then exercise both Return to durable saving choices.
- [ ] Inspect memory/task manager after settling. Bounds are deterministic test
      checks, not long-session memory claims.

All earlier deferred acceptance remains open.

### Saving and preview follow-up verification

**Status: Resolved.** The implementation gaps and automated regression failures
are closed. The owner acceptance checklist remains separate and unexecuted.

Corrections on 2026-11-09:

- Session adoption now identifies the retained previous-workspace snapshot and
  requires its export or explicit continuation without export. Export failure
  retains the review, shows the error inside the dialog, and blocks adoption.
  Successful export alone does not change durable content. The export control
  wraps on narrow screens.
- Tab-only Saves retain their disclosure and export guidance when IndexedDB
  could not open. Production checks cover this startup failure and prevention of
  `beforeunload` for tab-only commits in Chromium, Firefox, and WebKit.
- The preview target keeps its resume/generation identity while readiness blocks
  output. A committed Save that makes that resume ready schedules optional
  automatic refresh. Already queued automatic requests wait while hidden, are
  canceled when disabled, and are dropped when the resume changes. Explicit
  queued refreshes remain explicit.

Earlier follow-up runs exposed additional test issues. A career ordering case
unmounted its controller after observing the committed head but before Save
maintenance settled. Disposal stops subsequent publications, leaving its
`saving` snapshot true; failed teardown then contaminated the icon fixtures.
The case now waits for Save completion before unmount. A preview test queried
an option's DOM before its select popup opened; it now waits for visibility.
The Settings E2E case still expected the removed "remains manual" wording. It
now checks that automatic refresh remains off after reload, alongside its
existing compiler-preference persistence assertions. The session review test
waits for dialog closure before reopening. Assertions, timeouts, configured
retries, and skip behavior were not weakened.

Failed and intermediate checks remain separate from final evidence:

- The first normal `npm test` stopped at the unchanged five-second recovery-CLI
  timeout: 167/168 unit tests passed. A single-worker unit run then passed all
  168 cases before the final queue-switch regression was added.
- A single-worker Browser Mode attempt failed before executing tests because its
  local server refused the connection. The next parallel run passed 129/144;
  sequential browser files passed 141/144, exposing the ordering teardown race
  and two contaminated icon cases described above.
- The first full production E2E run passed 76/82; all six failures were the stale
  Settings wording assertion on desktop/phone across the three browsers.
- A subsequent normal run passed 169 unit tests and 144/145 Browser Mode cases,
  exposing the select-popup timing issue. Focused output/session regressions then
  passed all 16 cases, including export success/failure, adoption gating, and
  narrow-dialog overflow checks.

Final verification on 2026-11-09:

- The normal, unmodified `npm test` command passed 169 unit tests across 15 files,
  145 Chromium Browser Mode tests across 13 files, and all 82 production E2E
  cases across Chromium, Firefox, and WebKit, with no failures or skips and no
  configured retries. The E2E stage built and started a fresh production server.
- `npm run format:check`, `npm run lint`, and `npm run typecheck` passed. The
  production build also checked the final TypeScript. Formatting separately
  checked the preview hook/coordinator because the existing `output/` ignore
  pattern excludes those subfolders from ordinary Prettier traversal.
- Maintained-document local links and diff whitespace checks passed. Initial
  sandbox subprocess/traversal EPERM errors were resolved by running the same
  checks outside the sandbox.

These final results supersede the earlier incomplete automated status, including
the missing Firefox/WebKit and blocked-storage coverage. Failure screenshots
were inspected for diagnosis only. The owner checklist above, visual/PDF
acceptance, manual resource inspection, and earlier deferred acceptance remain
open; no performance measurements or sustained-memory acceptance were executed.

## Vercel deployment readiness

Build-time compiler assets and the Vercel preview are separate from local product
acceptance. Automated/local evidence does not prove the hosted deployment.

- [x] A clean `npm run build` regenerates `public/compiler/` with the recorded bundle
      SHA-256; a repeat build reports "Compiler assets verified; skipping preparation."
- [x] A corrupted cached archive fails the build and leaves existing assets unchanged.
- [ ] Owner: a Vercel preview build log shows the Python version, downloads (or cache
      reuse), the bundle SHA-256, and a successful `next build`.
- [ ] Owner: on the preview URL, English and Portuguese PDFs compile; `/compiler/*.wasm`
      returns 200 with `application/wasm`; `/compiler/SOURCE.txt` is served.
- [ ] Owner: a second deployment reuses the download cache.
