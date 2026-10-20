# Resume workspace behavior

Verso uses a client-scoped reducer, pure domain code in `lib/resume/`, and the
independent compiler adapter proven in [the compilation milestone](compilation-proof.md).
Next.js serves the shell and prepared static compiler assets. It never receives
resume edits or compilation inputs. There is no auth, database, browser storage,
publication, public resume API, or portfolio/LinkedIn integration.

## Editing and output

Content includes profile/contact details, summary, experience, projects,
education, skills, certifications, and custom sections. Entries/achievements
have stable IDs, shared dates/technologies/links, and separate localized wording.
Text segments support plain text, emphasis, and safe-scheme links. Raw LaTeX is
encoded as text. Optional empty fields disappear from PDFs.

Library ordering and variant output ordering are independent. Variants select
and order sections, entries, and achievements. Archiving hides content from every
output while preserving its references for restoration. Permanent deletion
confirms its effect on variants before removing references.

Editing a localized field flags an existing counterpart for review. Missing
required selected wording blocks only that output language. Review flags warn
without blocking previews/downloads or requiring acknowledgment. Bilingual
exports require both languages to be valid and compile one frozen snapshot.

Settings precedence is workspace, workspace locale, variant, then variant
locale. Supported settings are A4/Letter, body size, margins, line height, section
spacing, and page target; Inter and the reference design remain fixed. The
three-page target follows the supplied references. Overflow is reported rather
than dropping content.

The compiler hook serializes jobs, skips superseded queued automatic work,
keeps four suitable results in memory, and checks snapshot identity before
updating the preview. Failed jobs retain the previous PDF, labeled out of date.
PDF.js provides page navigation, zoom, text selection, search, hyperlinks, and
extraction diagnostics. Heavy viewer/compiler code loads in the browser.

## Backups and draft lifetime

Only a full JSON export advances backup freshness. PDF, bilingual ZIP, and
LaTeX exports do not clear the unbacked-work state. Downloads are browser
requests; the app cannot confirm that the user completed a save dialog.

Schema-1 backups include all content, translations, variants and selections,
workspace/locale/variant template overrides, compiler timeout settings, and the
exact template identity exported by `lib/resume/model.ts`. Transient UI state, PDF caches,
and compiler workers are excluded. The bundled assets are identified by version,
not embedded into every JSON backup.

Import validates the entire file (5 MB maximum), structure, IDs/references,
template settings, and exact template identity before mutation. It reports
unavailable template versions and incompatible settings separately. Future
schema versions require an explicit migration; there is no guessed conversion.
Draft wording and incomplete field values are preserved; URL/date/email validity
is checked separately before rendering. Unsafe URL schemes are never made
clickable or compiled. JSON export checks that its result can be imported before
advancing backup freshness.

Import replaces the workspace after confirmation, retaining one in-memory
recovery snapshot and its original backup freshness. It never publishes content.

The persistent notice says “Session only—export JSON to save your work”.
`beforeunload` protection is best-effort; tab closure, crashes, and device shutdown
can bypass it. Recovery snapshots and drafts disappear when the page is lost.
There is no cross-tab/device synchronization or refresh recovery.

Source ZIPs include the generated `.tex`, effective template settings, pinned
engine/resources, licenses, and a local browser compilation launcher. They can
be served using `python -m http.server`; native TeX is not guaranteed to reproduce
the WebAssembly format. Source ZIPs are not editable workspace backups.

## Verification scope

The user excluded adding/running automated tests. Existing starter smoke tests
remain available but are not updated or claimed as product coverage. Run
formatting, lint, generated route types/type checking, and a production build.
Manually inspect the browser workflows and both generated PDFs. Compiler/browser
observations and known output limitations are recorded in the milestone report.

### Observed manual checks

These are historical local observations. Private reference inputs, generated
PDFs, downloaded backups, and browser inspection evidence are not included in
the repository. They are not acceptance checks reproduced by a fresh checkout.
Use the bundled fictional example for independent editor and export review;
comparison against the private reference documents requires access to those inputs.

Production Chrome review covered example loading, edits in both languages,
translation-review warnings, valid English export with an unfinished Portuguese
title, blocked bilingual export, and JSON freshness remaining unchanged after
PDF downloads. Full JSON import restored content; unknown template versions and
incompatible layout settings were rejected before replacement.

Downloaded backups retained workspace/locale/variant overrides. Variant
duplication and section reordering preserved shared entry IDs. Archive/restore
worked, and permanent deletion named the affected variant and removed its
references. The 375px layout had no horizontal document overflow; mobile
navigation opened and closed through the accessible sheet.

PDF review covered special-character encoding, case-sensitive URLs with query
strings/fragments, Letter output, document metadata, zoom, selection/search,
navigation, extraction, and overflow warnings without content removal. A long
achievement exposed a detached project heading; the corrected template reserves
space for section/entry headers. Both language outputs were then recompiled and
visually inspected. The PDF viewer remounts per output identity so an old canvas
is not labeled with a newly compiled language while its viewer is loading.

The downloaded source ZIP recompiled from a clean local folder with no external
requests. Separate initialization and compilation timeouts produced explicit
timed-out errors, left no worker running, and allowed a successful retry. Invalid
source returned a diagnostic log. Safari and assistive-technology review remain
unverified; no automated tests were added or run.
