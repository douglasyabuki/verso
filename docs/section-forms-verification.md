# Section forms verification

Manual review on 2026-10-21 used the fictional example, the production server on
localhost:3100, and the in-app browser. No automated tests were added or run.

## Completed

- Formatting, ESLint, route generation/type checking, production build, and
  `git diff --check` passed. The initial lint run found two import-order errors;
  they were corrected before the successful run.
- Compiler assets were regenerated with template `1.0.0-proof.3`. Resource,
  engine, and font bundle hashes remained unchanged.
- Imported a schema-1/template-proof.2 fictional backup through normal replacement
  confirmation. All six sections remained available. Certification metadata
  started unset; its original 2020–2021 range stayed editable and visible.
  The document showed Matches JSON backup at its original revision.
- Imported schema 2, exported JSON, and re-imported the actual downloaded backup.
  Reload restored certification metadata and retained shared facts.
- Opening and typing in date setup, Cancel, Escape, and outside dismissal left
  committed dates and the document revision unchanged. Cancellation retained the
  current PDF and imported backup baseline. Reopening restored committed values,
  or blank values when structured dates were unset.
- Invalid month `2024-13`, full date `2024-12-01`, missing selected expiration,
  and expiration `2023-12` before issue `2024-12` produced field errors. Issue
  `2024-12` with expiration `2024` saved in one revision. Saving unchanged values
  did not advance the revision. No-expiration dates also saved.
- Use legacy dates only retained the range and credential ID and returned output
  to the original range. Undo restored structured dates; Redo removed them again.
  Reopening setup after removal started blank.
- Archiving the only certification produced the archived-only empty state and
  omitted its section from compiled output. Show archived and Restore retained
  variant inclusion and restored the content.
- Both languages compiled as two-page fictional resumes. PDF.js text exposed all
  six sections, retained education technologies, skill organization/location,
  certification facts, and custom content. Empty project organization produced
  no dangling separator; empty credential metadata disappeared after migration.
- Inspected the English preview and both Portuguese pages, including the lower
  first page and custom section on page two. No clipping, overlap, detached
  heading, broken accents, or unexpected blank page was observed. Portuguese
  output included Emissão, Sem expiração, and Outras datas. PDF.js diagnostics
  exposed the expected title, author, locale, revision, and template. Link
  annotations exposed the expected email, website, project, and credential URLs.
  PDF and bilingual ZIP actions reported download initiation without advancing
  JSON backup freshness.

## Remaining manual coverage

- Cross-tab conflicts, unavailable storage/Web Locks, session-only replacement,
  and recovery failures were not exercised again. Their implementation and
  storage protocol are unchanged; restoration now uses the migrated parser.
- Permanent deletion, every variant reorder combination, missing counterpart
  wording, and concurrent replacement during date setup were not exercised.
  Existing mechanisms are retained, including dialog history-epoch invalidation.
- Standalone months, year bounds, equal dates, and expiration without an issue
  date were not individually exercised in the UI. Dialog saves and imports use
  the same certification-date validator.
- Narrow screens, long URLs/titles, private reference compilations, and standalone
  font inspection remain unverified for this change.
- The browser reported PDF/ZIP download initiation, but those files were not
  available at the expected local paths. File-level inspection was not completed;
  PDF review used the actual compiled PDF.js preview and extraction diagnostics.
  The JSON download was available and its round trip was completed.
