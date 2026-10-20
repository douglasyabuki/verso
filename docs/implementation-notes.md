# Resume workspace behavior

Verso uses a tab-scoped observable workspace controller provided through React
context, pure domain code in `lib/resume/`, and the independent compiler adapter
proven in [the compilation milestone](compilation-proof.md). Browser persistence
is isolated in `lib/workspace/storage.ts`; there is no global application store.
Next.js serves the shell and prepared compiler assets. It never receives resume
edits or compilation inputs. Authentication, account storage, publication, public
resume APIs, and portfolio/LinkedIn integration remain unimplemented.

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

## Local saving, backups, and replacements

One guest career workspace is stored in `verso.workspace.v1`: a version-1 envelope
containing an opaque token, save timestamp, unchanged schema-1 ResumeDocument,
and nullable backup fingerprint. `verso.layout.v1` holds only sidebar visibility,
preview visibility and split proportions. The existing theme key remains separate.

The storage boundary exposes load, conditional commit, and external-change
subscription, with success/conflict/failure/cancelled outcomes. A load preserves
exact raw bytes even for incompatible records; only validated documents enter the
editor. Every workspace write holds `verso.workspace.v1.commit` through Web Locks,
rereads storage and compares the entire reviewed record (including its token).
A successful write creates a new opaque token. No unlocked workspace writes exist.

Ordinary saves debounce by 500 ms. Restoration precedes edits and default saves.
Saving failures retain the editable draft and pause further autosaves. A hidden-page
flush is best effort. Browser warnings depend on unsaved local work or blocked saving,
not on JSON backup freshness; warnings cannot guarantee protection against shutdown.

JSON imports or initiated validated JSON backup downloads set a SHA-256 fingerprint
of exact portable serialization. The fingerprint is saved with the workspace, so
backup freshness survives reloads. In insecure session-only contexts without
SubtleCrypto, exact serialized JSON provides the in-memory comparison identity.
Browser autosaves, PDFs, bilingual ZIPs and LaTeX exports do not advance this baseline.
A failed metadata write leaves persisted freshness conservative; the current tab
can still track the initiated export. Portable JSON retains its existing schema and
never includes storage metadata, UI preferences, workers, or PDF caches.

Import still validates the full 5 MB maximum backup, template identity, settings,
IDs/references and draft schema before asking for replacement. Incomplete wording
remains editable. Browser-storage validation uses the same domain parser.

Imports, example loading, recovery and explicit overwrites all stage a candidate
before confirmation. Persistent replacements apply only after the locked commit
succeeds, retaining one previous document and its backup baseline in memory. A
confirmation binds to the reviewed stored bytes. If they change again, no replacement
occurs and another review/confirmation is required. Loading a reviewed external
version also rechecks it under the lock and retains local recovery.

When localStorage or Web Locks is unavailable, the UI explicitly enters session-only
mode. Confirmed replacements then modify only this tab and retain recovery; no
workspace or backup-metadata storage write occurs. Failed persistent replacements
leave the current workspace unchanged and offer retry/review or an explicit
session-only confirmation. A conflict never implicitly authorizes this fallback.
Continuing session-only remains sticky until the user explicitly resumes saving,
rereads storage and confirms a conditional replacement against that reviewed version.
Corrupt data is never silently discarded. Recovery lasts only for the current tab.

## Conceptual account boundary

Future Better Auth GitHub/Google sign-in/sign-up will select a different,
authenticated storage destination backed by Prisma/Postgres. The domain document
and UI must not depend on that backend. Server-side ownership checks must govern
account reads/writes; private account data must not be stored under guest keys.
Signing out or switching accounts must invalidate account-scoped state and late
responses. Guest data remains separate and import into an account requires explicit
choice, never silent merge/overwrite. Provider setup, database schema, account
linking and synchronization are future work. There are no placeholder auth/database
modules, dependencies, credentials, or unused account adapters in this refactor.

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

## UI refactor verification

See [the progress/handoff document](ui-refactor-progress.md) for checks actually
executed in this pass. Earlier observations below are historical and do not verify
the new shell or persistence behavior. Automated tests remain excluded.
