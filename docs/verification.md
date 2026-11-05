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
