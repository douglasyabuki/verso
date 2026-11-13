# Independent resumes — implementation and verification

Recorded 2026-11-03. Implementation status and outstanding acceptance are in
[requirements](requirements.md); maintained behavior and commands are in
[README](../README.md).

## Source and build

- Working tree on `develop`, based on
  `091a0afefae676c1d7b99a2870c0609f38b36516`; no commit was created.
- Presentation reference: `master` at `d9b2b2d`. Existing collection cards,
  icon colors, dialog/disclosure primitives, sidebar, toolbar, responsive shell,
  and sorting presentation were reused without mounting schema-1 providers.
- Production build exercised by the final E2E suite: `53lbVYc8TJA-n-pWGmGEJ`.
- Node `v24.16.0`; existing npm/lockfile and selected dependency versions retained.
- Implementation/test manifest SHA-256:
  `ebb65bc11eaf4240e332b5f1b0b584022695934f0dcd26399653f029c1978f87`.
  This covers the 14 modified/new `.ts` and `.tsx` paths returned by
  `git ls-files --modified --others --exclude-standard`, sorted by path. Each
  manifest line is path, NUL, SHA-256 of file bytes, LF; the manifest is UTF-8.
  Documentation is excluded from that digest.
- After the successful full suite, a final formatter pass changed wrapping only
  in `lib/career/resumes.ts`; targeted lint and repository formatting were checked
  again. The tested pre-format manifest was
  `3a4304e8637c0b6121c26927b526960acc4c0f0a006554b418e61661510c83e5`.

## Executed checks

| Check                                             | Final result                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `npm run format:check`                            | Passed                                                           |
| `npm run lint`                                    | Passed                                                           |
| `npm run typecheck`                               | Passed; includes Next route generation                           |
| `npm test` / Node                                 | 40 passed in 9 files                                             |
| `npm test` / Chromium Browser Mode                | 59 passed in 6 files                                             |
| `npm test` / production E2E                       | 43 passed; Chromium, Firefox, WebKit                             |
| Production build                                  | Passed as part of the E2E runner; fresh server on localhost:3100 |
| Changed Markdown local links / `git diff --check` | Passed                                                           |

The final `npm test` chain completed without failures or skipped configured cases.
Explicit performance measurements remain outside the routine test chain. The
quota scenario runs only in Chromium, as configured; Browser Mode is Chromium.

Coverage includes independent Content/Wording/name scopes; retained hidden
configuration; inherited/custom/empty wording; language copies without fallback;
archive restrictions; contact ordering; deletion confirmation/history;
real IndexedDB conflicts and interrupted creation receipts; restore-as-new with
original recovery retained; native pointer dragging and keyboard alternatives;
read-only shared facts; dirty navigation, reload, Back/Forward, and narrow
Editor/PDF switching. Existing backup/recovery/storage regression cases also ran.

Production flows create and tailor a resume, duplicate it, copy it to Portuguese,
compare effective committed content, and delete/undo/redo. Actual English and
Portuguese PDFs verify selected custom wording, achievements, omitted contacts /
summary / entry fields, and embedded fonts in all three engines. Existing PDF
text/link/metadata checks remain separate from visual inspection.

## Findings resolved during implementation

- A committed creation with an interrupted acknowledgment must check its immutable
  receipt before attempting creation again. Retry now produces one commit/history
  step, with the same operation identity.
- Schema normalization can change object property order without changing values.
  A failing regression demonstrated false scope/history conflicts. Scope equality
  is now structural, preserving array order and null/missing distinctions;
  immutable request fingerprint serialization remains unchanged.
- A quick view switch during Save could be ignored. Resume navigation buttons
  now expose the saving-disabled state until the operation finishes.
- Interacting with an entering collection card could move an open menu. Pointer
  entry / focus settles that card's finite entrance before opening its actions.
- Recovered malformed Wording/identity values use the editable JSON recovery
  fallback rather than crashing typed forms. Prototype properties cannot become
  implicit wording overrides.
- Initial browser selectors were corrected for visible resume language labels and
  nested cards. Native drag checks await settled geometry and observable async
  completion, rather than assuming synchronous callbacks.
- Initial sandbox process-launch and formatting-directory enumeration errors were
  resolved by rerunning authorized checks with the required execution access.

## Visual evidence and remaining acceptance

Settled desktop collection and 390px Content screenshots were captured through the
production flow in each browser. Chromium captures were visually inspected for
the retained shell/card/color presentation and narrow layout. Generated files are
under the ignored `test-results/` directory (`resume-collection-desktop.png` and
`resume-content-narrow.png`); they are not committed snapshots or owner sign-off.

No new performance matrix, CPU-throttled measurements, manual disposable-workspace
round-trip, touch-device testing, actual Safari run, or owner PDF layout/clipping
acceptance was performed. No PDF/UA, universal ATS, long-session memory, hosted,
account, sync, or publication claim follows from these checks. The inherited
F1–F7 records remain deferred/unpassed as acceptance records; current regression
evidence does not silently close them. Templates, compiler assets, and dependency
versions were preserved.
