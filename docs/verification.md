# Verification boundaries and acceptance checks

These checks describe acceptance work, not implemented features or passed results.
Automated test sources and historical runs do not establish manual PDF acceptance,
actual Safari behavior, or measured performance. Engineering targets and safety
contracts are maintained in [AGENTS.md](../AGENTS.md).

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
      metadata changes no layout commands. Revision metadata can stale previews.

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
