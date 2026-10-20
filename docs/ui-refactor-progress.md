# UI refactor progress

## Accepted scope

Dayplan-inspired shell, one career workspace, reliable local saving, and explicit
session-only fallback. Future Better Auth GitHub/Google and Prisma/Postgres work
is conceptual only. No automated tests are to be added or run.

## Milestones

- [x] Extract document/persistence state, exports, editors, and shell components.
- [x] Implement the utility rail, collapsible sidebar, compact toolbars and typography.
- [x] Implement restoration, conditional saves, durable backup metadata and conflicts.
- [x] Support confirmed session-only replacements and explicit saving resumption.
- [x] Update README, implementation notes and agent guidance.
- [x] Run final format check, lint, route type generation/typecheck and production build.
- [ ] Finish interactive browser/visual verification (browser unavailable).

## Decisions and handoff context

- ResumeDocument schema 1 and portable JSON exports remain unchanged.
- Every persistent workspace write must hold one Web Lock and compare the reviewed
  storage token, including replacements and backup metadata. Stale confirmations
  must never authorize a newer stored version.
- Session-only replacements keep a recovery snapshot, never write workspace
  storage, and remain unsaved. Saving may resume only after explicit resolution.
- Backup freshness survives reloads and is independent of browser-save status.
- Hidden-page flushes and browser leaving-page warnings are best effort.
- Keep account modules/adapters absent; document guest/account isolation instead.

## Current status

Implementation is complete; interactive browser acceptance remains unverified.
No auth/database modules, unused account adapters, or dependencies were added.
The existing automated test setup was preserved and no automated tests were run.

### File map

- `components/resume/workspace.tsx` connects navigation/selection, editor, compiler
  and exports; it is no longer the owner of document saving or replacement state.
- `components/workspace/` contains the provider, shell/layout, navigation, data
  menu, save/conflict feedback and confirmations. `hooks/workspace/` contains
  observable workspace access, layout preferences and snapshot exports.
- The previous `components/resume/editors.tsx` is split into content, translation,
  variant and template editors plus shared wording/types and editor/preview panes.
- `lib/workspace/controller.ts` owns tab-scoped observable state and commands.
  `lib/workspace/storage.ts` is the only browser workspace mutation boundary.
- shadcn Base UI sidebar, menu, tooltip and skeleton sources were added without
  overwriting existing primitives. The sidebar uses the existing media-query hook,
  local layout preferences rather than cookies, and avoids Ctrl+B inside inputs.
- Card titles expose section/entry sizes with semantic heading elements.
- TypeScript excludes `temp/`, `.cache/` and `output/`; the reference app was
  previously included by the broad source glob and caused unrelated errors.

### Storage details

- Workspace key: `verso.workspace.v1`; lock: `verso.workspace.v1.commit`.
- Record: `{ version: 1, token, savedAt, document, backupFingerprint }`.
- Commit compares exact reviewed bytes (including the opaque token), validating
  the candidate before a write. Even corrupt records retain bytes for explicit,
  conditional replacement. Outcomes: success, conflict, failure, cancelled.
- Layout key: `verso.layout.v1` with sidebar/preview visibility and split percentage.
- JSON import/export baselines use SHA-256 over portable serialization. An insecure
  session-only context without SubtleCrypto uses exact JSON identity in memory.
- Replacement candidates are staged separately. Persistent application waits for
  commit; failed candidates stay available for review/retry or explicit session-only
  confirmation. Recovery retains the prior document and backup baseline in memory.
- Session-only mode is sticky. Resume explicitly rereads storage and stages a new
  overwrite confirmation. No session-only replacement writes workspace metadata.
- A late download fingerprint is invalidated by a later replacement. Metadata
  changed during a pending ordinary save is scheduled again after that save.
- Private account data must never be written into guest keys. See implementation
  notes for the conceptual destination/ownership boundary and explicit guest import.

### Checks executed

- `npm run typecheck`: passed after excluding reference/temporary source trees.
  The first run failed on the unrelated Dayplan copy; no Verso errors were reported.
- `npm run build`: passed (Turbopack compilation, TypeScript, static generation).
- `npm run lint`: final pass passed without errors or warnings. An earlier unused
  import warning was fixed.
- `npm run format:check`: final pass passed. Formatting was applied after an
  intermediate check caught a wrapped line in the storage controller.
- Final `npm run typecheck` and `npm run build` passed after shell extraction and
  backup-marker failure feedback changes; no framework configuration was changed.
- `git diff --check`: passed; Git reports the repository's normal LF/CRLF notices.
- Browser inventory through computer-use returned no browsers. Creating an in-app
  browser failed with `Browser is not available: iab`. No screenshots, interactive
  checks, PDF downloads, or multi-tab observations are claimed for this refactor.

## Next action

With a browser available, start Verso and perform the following manual acceptance
pass using fictional content on a disposable localhost origin. Do not run automated
tests without a change to the user's current instruction.

1. Review 375px, tablet and desktop layouts in both themes: rail/sidebar collapse,
   mobile sheet utilities, keyboard focus, long labels, resizable split and preview
   hiding. Check that menus/tooltips compose correctly and nothing overflows.
2. Edit both languages, variants, archive/order selections and template settings.
   Reload to confirm restoration; export JSON and reload to confirm backup freshness.
   PDF/LaTeX exports must not clear JSON reminders. Check both output languages.
3. Use two tabs: edit one, resolve the other's paused saving, and change storage
   again after an overwrite confirmation opens. The stale confirmation must fail
   without changing the tab or stored data. Repeat with import/example/recovery.
4. Simulate storage read/write/quota errors and missing Web Locks. Confirm that
   in-memory import/example/recovery work only after session-only confirmation,
   retain recovery, show unsaved status and leave the old stored bytes unchanged.
5. Restore storage/locks and explicitly resume saving. Change stored data during
   review again; a fresh resolution must be required. Check leaving-page warnings
   for unsaved/blocked saves separately from backup reminders. Hidden-page flushing
   is best effort and cannot be asserted as a guaranteed shutdown save.

Remaining risk: no live browser was available to verify runtime interaction and
visual layout. Static checking/build success does not establish these behaviors.
