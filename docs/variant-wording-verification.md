# Variant wording verification

Implementation date: October 22, 2026.

## Executed checks

No automated tests were added or run. Direct Node REPL inspection used fictional,
in-memory example content without browser storage or credentials.

- Creating an English summary override copied only English and preserved clear
  review flags. Shared Portuguese remained inherited.
- Editing inherited Portuguese flagged the English override for translation
  review, changed effective Portuguese, and left the English shared baseline clear.
  The symmetric Portuguese-override/English-inheritance case behaved the same way.
- A stale displayed counterpart was rejected by translation acknowledgment.
- After translation acknowledgment, changing shared English beneath an English
  override left both effective-pair translation flags clear and flagged only the
  English shared baseline. Effective English stayed unchanged.
- Shared-wording acknowledgment left an outstanding translation flag intact.
- English achievement overrides appeared only in English generated LaTeX; shared
  wording and the existing achievement ID remained intact. Structured emphasis and
  safe link fields stayed in the override.
- Empty selected English achievement overrides produced an English blocking issue
  with a variant-scoped editor target; Portuguese remained valid. Reset removed
  the final achievement override and restored shared text.
- Schema-4 JSON serialization/import retained override and review metadata.
  Schema-1, schema-2, and schema-3 fictional backups migrated to schema 4 with empty
  overrides; inspected schema-3 revision and achievement ID stayed unchanged.
- Import rejected an orphaned achievement override reference.
- Hidden, archived, deselected achievements retained overrides and received
  effective-counterpart review updates without adding selected-output warnings.
  Deep-copied variants edited independently. Permanent achievement deletion
  removed override metadata from both variants.
- `npm run format:check`, `npm run lint`, and `npm run typecheck` passed.
- The final `npm run build` passed with production compilation, TypeScript, and
  static page generation. `git diff --check` passed.

The initial production build compiled but the sandbox blocked worker creation
with `spawn EPERM`. Retrying with approved execution outside the sandbox completed
TypeScript, static page generation, and optimization successfully.

Browser inventory was empty. Opening the in-app browser returned
`Browser is not available: iab`. Interactive UI, actual browser compilation, and
PDF visual inspection remain unverified; LaTeX source inspection is not PDF QA.

## Remaining manual acceptance checks

- Open the fictional example in Variants. Verify shared/override labels and scope
  explanations before editing, explicit creation, both locales, empty optional
  summaries, rich formatting/links, and independent library/variant review actions.
- Verify both inherited-counterpart cases through shared edits from Content and
  Translations, including hidden sections, deselected achievements, and archived
  entries. Distinguish translation review from changes beneath an override.
- Verify reset confirmation, workspace undo/redo, field-local history, duplicate
  variant isolation, selection/order changes, archive/restore, and permanent
  achievement/entry/custom-section deletion cleanup. Check JSON backup freshness.
- Reload a saved schema-4 workspace and older stored schemas; verify recovery,
  failed saving, session-only replacements, two-tab conflict handling, and import
  rejection without modifying the current workspace.
- Inspect active-variant versus library translation scope, combined review/status
  filters, unresolved navigation, issue links, archived targets, and stale review
  acknowledgment rejection after wording or provenance changes.
- Compare two variants with different section visibility, entry/achievement
  selection and order, overrides with equal text but distinct provenance, excluded
  content with retained overrides, and locale-specific effective settings. Verify
  differences-only, distinct selectors, edit links, keyboard access, and narrow
  paired-card layout. Confirm comparison preferences are excluded from backups.
- Check pointer/keyboard sorting with collapsed and expanded wording controls,
  cancellation, focus, filtering, no-op drops, and undo. Only selected IDs reorder;
  wording controls must not start a drag.
- Compile both locales and two variants; confirm preview invalidation after
  override edits, frozen bilingual downloads, formatting, links, accents, and
  empty-wording behavior. Visually inspect every PDF page and extracted text for
  clipping, overlap, blank pages, reading order, and unintended cross-variant text.
