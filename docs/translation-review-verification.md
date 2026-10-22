# Translation review verification

Implementation date: October 22, 2026.

## Executed checks

- No automated tests were added or run, as instructed.
- Browser interaction review is blocked: the browser inventory was empty and
  opening the in-app browser returned `Browser is not available: iab`.
- `npm run format:check` passed.
- `npm run lint` passed with no warnings after fixing two import-order errors.
- `npm run typecheck` passed, including route generation.
- `npm run build` passed, including TypeScript and static page generation.
- `git diff --check` passed.

## Manual acceptance handoff (pending)

- Load the fictional example. Confirm default active-output fields and order,
  then combine section, target language, and all/missing/review/unresolved filters.
  Confirm target-language selection does not change workspace output language.
- Compare Active variant with All library: hidden/empty sections, archived and
  unselected entries, and unselected achievements appear only in All library.
  Rename and reorder sections/entries/achievements and confirm field associations,
  source context, review history, and output ordering remain correct.
- Empty an optional summary in one or both languages. Confirm Optional empty,
  no missing/unresolved match, and valid exports. Empty selected headings/titles/
  achievements and confirm missing required wording blocks only that language.
- Navigate unresolved fields in both directions, at boundaries and after filters
  change. Resolve a focused missing/review field and verify it stays mounted until
  navigation continues. Delete a target or change variants and confirm navigation
  handles unavailable fields without stale focus or accidental edits.
- Mark populated wording reviewed, including clear migrated wording. Check current
  counterpart appears once when unchanged and before/after panels appear only for
  changed wording/formatting/link destinations. Verify line breaks, emphasis,
  Portuguese text, empty references, and visible but inactive link destinations.
- Repeat counterpart edits before another review. Verify the original acknowledged
  baseline stays unchanged. Revert source wording with a newer revision and confirm
  current wording appears once even while its review flag remains outstanding.
- Exercise a stale displayed reference revision/spans, stale target version, changed
  selected reference locale, and deleted field against the review operation: each
  must reject without clearing flags or writing a baseline. Confirm rejection is
  announced when an acknowledgment can no longer be applied.
- Review from both translation and content forms. Undo/redo and duplicate entries;
  snapshots/flags must restore or copy with wording and remain associated with the
  correct regenerated IDs after duplication.
- Import schema-1 and schema-2 backups and restore them from browser storage. Check
  unchanged flags, IDs, revisions, and wording, null snapshots, and No historical
  comparison available. Restoration alone must leave stored bytes untouched.
- Export/reimport schema 3, reload, and verify explicit reference locales/revisions/
  spans survive. Reject unsupported schemas/locales, self-reference snapshots,
  invalid spans/revisions, duplicate IDs, and invalid variant references.
- Verify review flags allow otherwise valid previews, PDF, LaTeX, and bilingual
  draft exports. JSON backup freshness and blocked/session-only saving must retain
  existing lock, conflict, recovery, and replacement behavior.
