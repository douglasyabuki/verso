# Library and variant editing verification

Manual browser review on 2026-10-22 used the fictional example on localhost:3101,
first in development and then against the production build. No automated tests
were added or run.

## Source checks

- Formatting, ESLint, route generation/type checking, production build, and
  `git diff --check` passed. Import ordering and formatting issues found in early
  runs were corrected before the successful checks.
- The adapted dnd-kit skill passed its metadata validator. Its API guidance was
  checked against installed React/DOM packages 0.5.1 and the sortable implementation.

## Completed browser checks

- An English editing view found an entry using uppercase `TRES REACT`, combining
  an unaccented Portuguese achievement term with a shared technology. Search
  clearing restored the list without changing selections.
- Duplicates opened in Content, retained both achievements, and started outside
  the active variant. Editing a duplicate's company did not change its source.
  Archiving a copy removed it from the default list; Include archived entries
  revealed its archive and output-suppression indicators.
- Pointer dragging and keyboard Space/Up/Space reordered library entries.
  An archived entry between two visible entries retained its original slot.
  Undo restored the move in one step. Escape and an outside drop left order
  unchanged. Move buttons retained focus on the moved item's handle.
- Library achievement move buttons and keyboard dragging changed displayed
  library order. Variant achievement moves displayed actual output order and
  did not change Content order. Deselecting an achievement moved it after selected
  achievements; Select all appended it after the existing selection.
- Nested keyboard dragging reordered a variant's achievements, entries, and
  sections. A second variant and the library retained their independent order.
  No React warnings or errors were captured during these interactions.
- Reload restored library ordering and both variants' different reference orders.
  The production Portuguese PDF placed Projects before Experience, reversed the
  selected entries, and reversed the original entry's achievements as configured.
  Content still showed library order. English output was also reviewed in PDF.js.
- Clear all left the entry checked with zero selected achievements; Undo restored
  its selection. Hiding a section displayed output-suppression indicators for its
  entries; Undo restored visibility.
- Exported schema-2 JSON was inspected from the actual downloaded file. A project
  duplicate had new entry, achievement, and link IDs, identical content and shared
  facts after excluding IDs, and no references in either variant. The backup
  retained the archived entry's middle library slot and separate variant orders.
  An initial download attempt was interrupted when the development server stopped;
  repeating against the production server succeeded.

## Remaining verification

- Follow-up changes show the hidden-section tooltip after hovering over muted
  content or spacing for 400 ms. Buttons, inputs, links, labels, editable text,
  and action roles are excluded; pressing or dragging closes the hint. The
  container adds no tab stop and does not cancel child events. There is no extra
  visible message. Preview identity now excludes
  hidden sections, unselected entries/achievements, other variants, and workspace
  revision; downloads still compile current revision metadata. These changes
  passed formatting, lint, type checking, and production build, but have not yet
  been checked in the browser. Verify pointer/keyboard child sorting while a
  section is hidden, undo/reload, no automatic compile on hidden-content edits,
  compilation after showing the section, and current-revision downloads.
- Touch/pen input, screen-reader audio, narrow layouts, and the 300-entry boundary
  have not been exercised on devices. Keyboard instructions, labeled alternatives,
  live announcements, and the existing schema limit remain explicit in code.
- Cross-tab conflicts, unavailable storage/Web Locks, session-only saving, and
  recovery failure paths were not re-exercised; all edits use the existing
  workspace update and conditional persistence pipeline.
