# Unified editor verification

## Implementation checks

Browser interaction review is pending: the implementation session exposed no
browser, and opening the in-app browser returned `Browser is not available: iab`.
No automated tests were added or run, following the repository's verification
scope. Source checks are recorded below after execution.

Checks completed on October 21, 2026:

- `npm run format:check` — passed.
- `npm run lint` — passed with no warnings.
- `npm run typecheck` — passed, including Next.js route type generation.
- `npm run build` — passed, including TypeScript and static page generation.
  The first sandboxed attempt compiled but failed to spawn the TypeScript worker
  with `EPERM`; the approved retry outside the sandbox completed successfully.

## Manual acceptance scenarios

- Switch EN/PT while viewing each Career library section. Built-in navigation
  labels and section page/card titles must stay English. Custom sections keep
  their English heading (or "Custom section" when empty), while the editable
  resume heading and output still use the selected language.
- In both languages, edit summary, section heading, entry title, and achievement
  wording, including the translation view. Confirm labels, errors, missing-text
  badges, review flags, and Mark reviewed still work.
- Select across old span boundaries in both directions. Apply and remove
  emphasis, including mixed selections and caret formatting. Combine emphasis
  with links, including a link spanning differently emphasized text and newlines.
- Add a link to selected text; edit and remove a link with only a caret inside
  it. Confirm selected ranges affect only that range and unlinking keeps wording
  and emphasis. Cancel/Escape must preserve content and selection.
- Accept https, http, mailto, and tel destinations. Reject missing schemes,
  javascript/data schemes, credentials, spaces, control characters, and
  backslashes. Import a legacy invalid destination and correct/remove it without
  losing text; verify it is never navigable in the editor.
- Reach the toolbar using Tab, navigate controls with arrows/Home/End, and exit
  with Tab. Verify visible focus, accessible names, mixed/pressed states, URL
  validation announcements, Ctrl/Command+I/K, and focus/selection restoration.
- Type at formatting boundaries, use keyboard word/line navigation and reverse
  selection, delete ranges, and edit Portuguese accents, emoji, and IME input.
  Check Enter/Shift+Enter, leading/trailing/repeated spaces, blank lines, and
  multiline paste. Paste HTML/Markdown/URLs as literal text without external
  formatting or automatic links; check copy/cut and local undo/redo.
- Check workspace toolbar undo/redo, imports, example loading, recovery, and
  reviewed replacements. Local history must reset without emitting edits or
  stealing focus; switching field or locale must dismiss stale link controls.
- Import an existing backup with empty and equivalent adjacent spans. Merely
  opening/focusing/selecting it must not change content, revisions, review flags,
  or backup freshness. After actual edits, export/reimport JSON and check both
  languages, local saves/reload, session-only behavior, and PDF/LaTeX formatting.
- At the 100-span and 20,000-unit boundaries, exercise accepted and rejected
  typing, multiline paste, emphasis, links, deletion, and composition. Check
  surrogate pairs at split boundaries. Rejection must preserve content,
  selection direction, stored marks, local and workspace history, and saving
  status, while announcing the rejection without moving focus.
- Create an accepted edit, undo it to leave a redo branch, then attempt an
  over-limit edit. Redo must restore only the previously accepted edit, never
  rejected input. Rejection must not clear redo, add an undo step, or change
  grouping of surrounding accepted edits. Repeat for rejected paste, formatting,
  and link changes, including a reverse selection and active stored emphasis.
