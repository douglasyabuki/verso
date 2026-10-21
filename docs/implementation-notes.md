# Resume workspace behavior

Verso uses a tab-scoped observable workspace controller in
`stores/workspace/controller.ts`, a thin React context/lifecycle adapter in
`stores/workspace/provider.tsx`, pure domain code in `lib/resume/`, and browser
persistence in `stores/workspace/persistence.ts`. Shared contracts and defaults
live in `types-and-constants/`; external-library declarations stay in `types/`.

`components/workspace/workspace.tsx` composes the provider and readiness UI.
The workspace view composes editors, preview, shell, and controls. Navigation and
JSON backup hooks coordinate interactions without creating another document
owner. Compiler lifecycle and PDF/LaTeX exports retain their dedicated hooks.

The resume model contains schemas and the canonical template identity. Domain
functions are grouped into localization, factories, collection operations,
settings resolution, validation, backup parsing/serialization, rendering, example
content, and download utilities. Schema-derived shared types use type-only
imports; domain logic never imports stores, hooks, or components.

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
spacing, and page target; Inter and the bundled template remain fixed. The default
page target is three. Overflow is reported rather than dropping content.

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

Do not add or run automated tests for this implementation. Run formatting, lint,
route type generation/type checking, and a production build. These checks validate
source structure and bundling, not browser behavior or persistence correctness.

Use the committed fictional example in `lib/resume/example.ts` for manual editor,
backup, and both-language PDF/LaTeX export review. The
[verification handoff](ui-refactor-progress.md) lists the manual scenarios and
records which checks have actually been performed.
