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

Career library navigation and section page titles use fixed English interface
labels, independent of the resume language switch. Custom sections use their
English heading or "Custom section". The editable resume heading and output
wording still use the selected locale.

Content includes profile/contact details, summary, experience, projects,
education, skills, certifications, and custom sections. Entries/achievements
have stable IDs, shared dates/technologies/links, and separate localized wording.
Summaries, headings, titles, and achievements use one formatted text editor,
including in translation views. The per-field toolbar supports emphasis and
links only; raw HTML, Markdown, and LaTeX syntax are treated as text. Paste
inserts plain text and line breaks with the insertion point's formatting, without
importing external formatting or automatically creating links. Optional empty
fields disappear from PDFs.

Select text to apply/remove emphasis or add a link. A caret inside an existing
link edits/removes its complete contiguous destination, including changes in
emphasis; a selected range changes only that range. The URL popover supports
Apply, Cancel/Escape, and Remove, retaining text and emphasis when unlinking.
The existing URL validator allows only https, http, mailto, and tel and rejects
credentials, spaces, control characters, and backslashes. Invalid destinations
from old backups remain editable data but never become clickable editor URLs.

The labeled toolbar has one Tab stop with Left/Right and Home/End navigation.
Ctrl/Command+I toggles emphasis, Ctrl/Command+K opens link editing, and Enter or
Shift+Enter inserts a line break. Editor undo/redo shortcuts and native history
input events use field-local history, including consuming empty history commands.
The workspace toolbar retains document-wide history. Successful workspace
undo/redo and replacements clear field histories using a transient epoch that
is excluded from backups and browser storage. Ordinary typing/composition and
accepted clipboard/formatting actions retain workspace edit grouping.

Only portable wording spans are stored; their shape remains compatible with schema 1. Editor JSON and HTML never enter the document.
Genuine edits remove empty spans and merge adjacent runs with equal emphasis
and destinations, splitting at 20,000 UTF-16 units without splitting surrogate
pairs. Empty wording retains one plain empty span. Semantically unchanged edits
do not rewrite segmentation, increment revisions, or flag translations; opening
an old backup never normalizes it or changes its backup-freshness baseline.

A ProseMirror transaction filter checks normalized output before editor state
and local history are applied. Edits exceeding 100 spans or the destination limit
are rejected without truncation. Rejection preserves content, selection, stored
marks, both undo/redo branches, and history grouping; it makes no workspace edit
or save request. Native DOM changes are reconciled against the untouched editor
state rather than applying and undoing rejected input. The rejection is announced
without moving focus.

Library ordering and variant output ordering are independent. Variants select
and order sections, entries, and achievements. Archiving hides content from every
output while preserving its references for restoration. Permanent deletion
confirms its effect on variants before removing references.

Content searches its current library section; Variants searches across sections.
Search matches every whitespace-separated term against shared organizations and
technologies plus titles and achievement wording in both languages, ignoring case
and accents. Include archived entries is explicit and off initially. Filtering
does not change selections. An opened Content entry stays editable when its
wording no longer matches the query; issue navigation reveals archived targets.

Duplicate entry creates an unarchived library copy immediately after its source,
opens it, and clears search. Entry, achievement, and link IDs are regenerated;
wording, formatting, translation metadata, and shared facts are copied exactly.
The copy starts outside every variant. The existing 300-entry limit applies.

Selection indicators and achievement counts refer to the active variant and
explain archived/hidden-section output suppression. Select all preserves the
existing achievement output order, appending missing IDs in library order.
Clear all removes achievement selections while leaving the entry included.
These actions require an included, unarchived entry.

Content achievements always display in library order. Only Variants displays
selected entries and achievements first, in output order, followed by unselected
items in library order. Drag handles and labeled move buttons share the same
ordering operation. Filtered entry moves use visible slots without moving hidden
entries. Variants can also reorder sections, while selected entry/achievement
moves affect only the active variant. Drag previews are transient; valid drops
commit one workspace edit, and Escape cancels. Keyboard handles support
Space/Enter, arrow movement, and Escape. Scrolling remains available outside the
handles. See [library editing verification](library-editing-verification.md) for
completed checks and remaining device coverage.

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

## Section-specific forms and schema compatibility

Experience, education, projects, skills, certifications, and custom sections have
section-specific labels, descriptions, empty states, and field visibility. Main
forms omit irrelevant fields; populated Additional details remain editable and
visible in output. Skill items reuse localized bullets and their stable variant
references. Tool and technology names remain shared facts.

Output uses company/institution first for experience/education and localized
names/categories first otherwise. Location accompanies the heading; organization
or role and generic dates occupy the secondary line. Technologies follow, then
selected localized items and links. Education retains technologies in Additional
details; projects retain location; skills retain organization/location/dates; certifications retain
location/generic dates/technologies. These fields keep the same output positions
regardless of where they are edited. Empty optional values create no empty lines
or separators.

Schema 2 adds optional certification metadata: credential ID and nullable
structured dates. Dates accept YYYY or YYYY-MM (1900 through 2299), never a month
without a year or a full day. Issue date is optional. Expiration is unspecified,
never, or a required date. Comparison rejects expiration only when its latest
possible month precedes the issue date's earliest possible month: issue 2024-12
and expiration 2024 overlap and are accepted. Precision is preserved in output.

Date setup/editing uses a modal with local draft state. Opening, typing, Cancel,
Escape, outside dismissal, and navigation do not edit the document or PDF. Save
validates and commits all dates as one undoable edit; unchanged values do nothing.
Saving unspecified/no expiration removes any active structured expiration date.
Workspace replacement or history changes close the modal and discard its draft.
Use legacy dates only sets structured dates to null without touching the retained
range or credential ID. Undo restores structured dates; reopening setup starts
blank. Other entry fields still autosave normally.

Certification output places committed issue/expiration information below the
issuer, followed by credential ID. When structured dates exist, retained generic
dates follow as Additional dates / Outras datas; otherwise the retained range
occupies the primary date position. Unspecified expiration prints nothing. The
retained start/end/ongoing facts are never inferred from or rewritten by setup.
They continue using the existing generic validation, independently of the new rules.

The backup boundary first validates schema 1 with template
`yabuki-reference@1.0.0-proof.2`, migrates deterministically to schema 2 and template
`1.0.0-proof.3`, and validates references. It never normalizes old wording,
changes IDs/revisions, or interprets generic dates. Existing certification dates
start unset. Schema-2 imports require the exact current template; unknown schemas
or templates remain rejected. Both browser restoration and JSON imports use this
boundary; exports use schema 4. Loading does not rewrite stored bytes. The next
ordinary commit still uses the reviewed bytes and shared lock. Existing stored
backup fingerprints remain conservative; an explicit imported backup establishes
its migrated document's baseline.

## Local saving, backups, and replacements

One guest career workspace is stored in `verso.workspace.v1`: a version-1 envelope
containing an opaque token, save timestamp, schema-4 ResumeDocument,
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
can still track the initiated export. Portable JSON exports schema 4 and
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

See [section forms verification](section-forms-verification.md) for this change's
completed checks and remaining manual coverage.

Do not add or run automated tests for this implementation. Run formatting, lint,
route type generation/type checking, and a production build. These checks validate
source structure and bundling, not browser behavior or persistence correctness.

Use the committed fictional example in `lib/resume/example.ts` for manual editor,
backup, and both-language PDF/LaTeX export review. The
[editor verification handoff](text-editor-verification.md) lists the manual
scenarios and records which checks have actually been performed.

## Translation review and schema 3

The translation editor starts with actual active-variant output wording, all
sections, the workspace language as target, and all wording. All library also
includes archived/unselected content in library order. Section, target language,
and status filters combine. Required empty headings, titles, and selected items
are missing; the optional summary can remain empty. Unresolved navigation follows
the filtered order without wrapping, retaining the focused field while its edit
resolves the current status filter. Source context uses stable field IDs, entry
wording, and shared organization; renaming and reordering do not change identity.

Each target locale stores nullable `reviewedCounterpart: { locale, revision,
spans }`. Reference languages are explicit in domain snapshots and review actions;
the current UI selects the other of English/Portuguese. Review rejects stale
reference/target revisions or wording, a changed selected reference locale, and
deleted fields. Successful review copies the displayed reference and clears only
the target flag through one ordinary undoable workspace edit. Populated clear
wording can also be explicitly reviewed to establish a baseline.

Read-only references preserve emphasis, line breaks, and visible link destinations
without activating imported links. Before/after panels appear only if snapshot
locale or semantic spans differ; revision-only changes display current wording
once. Null snapshots display current wording and "No historical comparison
available". Editing retains review snapshots and flags populated counterparts;
editing a target never silently acknowledges its reference. Review warnings
remain nonblocking for otherwise valid draft previews and exports.

Schema 3 adds these snapshots without changing the bundled template. The parser now strictly accepts schemas 1, 2, 3, and 4. Schema 1 first receives the existing
certification/template upgrade; schema 2 then gains null snapshots in every locale
record. Migration preserves all IDs, wording segmentation, revisions, and flags;
missing history never creates a new review flag. Schema-3 snapshots require a
supported reference locale distinct from the target. Browser restoration shares
the parser and leaves raw stored bytes unchanged. Existing storage envelopes,
locks, reviewed-token checks, recovery, and backup freshness remain in force.

See [translation review verification](translation-review-verification.md) for
executed checks and outstanding manual scenarios.

## Variant wording and schema 4

The current schema extends variants with `wording.summary` and
`wording.achievements[achievementId]`. Each retained field has optional locale
`overrides` (structured spans, revision, same-language `sharedBaseline`) and separate
bilingual `review` records. A field exists only while it has an explicit override.
Shared facts and achievement IDs are never copied. Schema 1/2/3 imports migrate
through their existing steps and then add empty variant wording, without changing
wording, IDs, revisions, flags, or the bundled template identity. Imports validate
all override references, including unselected and archived achievements.

`lib/resume/wording.ts` owns creation, editing, reset, effective resolution, independent
reviews, and edit reconciliation. The workspace controller reconciles the previous
and edited documents before history/save processing. Reconciliation removes orphaned
achievement metadata after deletion and flags the populated effective counterpart
when effective text changes. This runs for every retained field in every variant,
regardless of selection, visibility, or archive status. Undo/redo restore the complete
wording and review state through ordinary document history.

In particular, with an English override and inherited Portuguese, editing shared
Portuguese changes effective Portuguese and flags the English override for variant
translation review. The symmetric case works identically. Changing shared English
beneath its English override leaves effective English unchanged and only makes the
English shared baseline stale. Semantic no-ops do not flag review. Explicit creation
preserves effective review status without inventing acknowledgment. Reset changes
provenance and recomputes counterpart review while another override remains; removing
the last override restores library review behavior. Variant review actions never
modify shared library review metadata.

Shared-review acknowledgment verifies the displayed shared revision/spans and only
updates that baseline. Translation review verifies target and counterpart revisions,
spans, languages, and shared/override provenance before clearing only the target flag.
Both review states survive backups independently. Output validation emits separate
translation and shared-wording warning categories, restricted to selected output;
optional empty summaries are omitted and empty selected achievement overrides block
only their language. Rendering and compiler snapshot keys use effective wording, so
an override cannot reuse a PDF compiled for older text.

Variants exposes summary and expandable achievement wording controls. Disclosure
mounts achievement editors only when opened, and keeps the complete achievement
inside its measured sortable row. Active-variant Translations resolves effective
wording with explicit source labels and creation/shared-edit actions. Library editing
remains shared. Filters distinguish translation review from shared-wording changes.

Compare mode is transient UI state. It aligns library identities across two distinct
variants, includes excluded/archived content and retained overrides, displays stored
ordering and output suppression, and resolves template settings through the existing
precedence chain. The view is read-only, supports language selection and differences
only, and uses paired cards below the wide-screen breakpoint. Edit links carry variant,
locale, field, and scope to the corresponding editor; template links open variant-language
settings. Comparison selections never enter JSON backups or browser persistence.

See [variant wording verification](variant-wording-verification.md) for executed
checks and the outstanding browser/PDF handoff.
