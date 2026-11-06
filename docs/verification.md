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
