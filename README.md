# Verso

Local career information and resume editor. The active application uses workspace schema 2,
explicit form Save/Cancel, and transactional IndexedDB. Schema-1 development data
and backups are unsupported and are never loaded or converted.

## Resume layout and reusable setups

Each resume has an independent **Layout** view with explicit Cancel / Save.
Controls cover A4/Letter, margins, bundled fonts, body and heading typography,
spacing, bullets, colors, dividers, and page numbering. The page-count threshold
is a warning, not automatic fitting or content removal. The established
single-column template remains; free positioning and arbitrary fonts are unsupported.

**Header & contacts** controls alignment, contact icons, separators, row spacing,
automatic wrapping, one to four contacts per row, and custom row sizes such as
`3, 2`. Remaining contacts occupy a final wrapping row; unused rows have no
effect. Empty values are omitted. Contact inclusion and order stay in
**Content & order**, linked directly from Header. Full name remains required.
Custom rows store positions, never contact identities.

The fictional **Style sample** responds immediately without compiling; it is not
a PDF and does not predict pagination or exact font metrics. The real PDF always
uses saved content. Save does not compile: use Refresh preview. The labeled last
successful PDF remains available if new output fails. Its page warning uses the
threshold associated with that PDF, including when the preview is outdated.

**Presets** contain named appearance only and are optional. Edit Layout directly,
or expand the initially collapsed **Layout presets (optional)** disclosure,
select a preset, then **Load into layout** and Save. Selecting alone changes
nothing; no preset is required to edit or save layout. With no presets, the
disclosure explains direct editing instead of showing an empty selector.
The unsaved-load announcement remains visible when the disclosure is collapsed.

**Save as preset** captures saved appearance,
resolving dirty changes first. Manage, edit, duplicate, or confirm deletion from
**Library > Layout presets**, also linked by Manage presets in Layout. Matching is determined
by settings values; there is no live connection to a preset.

**Save as starter** in a resume's actions captures empty section structure,
order, visibility, icons, field defaults, summary visibility, and layout. The
starter editor can add/remove/reorder sections and change these settings. It
copies no entries, achievements, links, contact selections, or localized wording.
Structural labels identify empty sections; newly created custom sections still
need career heading wording before output. Use **Duplicate resume** to reuse
content. Starters can also be created from scratch through **Library > Resume starters**.

Create resume explicitly offers **Blank resume / From starter**, defaulting to
Blank resume. From starter shows the ordered empty structure, summary/field
visibility defaults and illustrative style before reviewing which active Career
sections to reuse or create. **Create resume…** on a starter card opens the same
flow with that starter selected. A missing starter blocks creation rather than
silently creating blank content. Ambiguous matches require a choice; archived
sections must be restored separately. Creation commits the resume and any missing
empty sections atomically. Selecting entries later uses the copied field defaults;
explicit subsequent visibility edits remain independent. Undo removes the resume
and archives only the sections created by that operation. Redo preserves identities.
Later edits or deletion of a starter/preset never change existing resumes.

The sidebar order is **Career details > Library > Resumes**. Clicking **Library**
opens its overview with collection descriptions, icons, and Edit links to
Layout presets and Resume starters. The overview uses the durable `?scope=library`
destination. Both collection links remain visible when empty, with selection and
guarded Library/collection parent location links; reload and Back/Forward restore
the destination. Collection creation sits at the far end of the page title row, matching Career details. Preset/starter search is omitted throughout collections
and contextual pickers. Library item footers order Edit, Duplicate, Use/Create,
then Delete; destructive actions remain last in keyboard and visual order,
including wrapping. Delete confirmation uses Cancel / Delete.

Library views use the full editor width without an unrelated
resume PDF, career-language selector, or career-editor return links; the existing
Style sample remains illustrative. Library navigation never expands/selects a
resume or replays its entrance animation. Resume rows remain mounted, retaining
scroll and entrance history; only explicit resume navigation or Apply preset crosses
into resume editing. Collection space reserves Library access, with independent collection scrolling and an outer
sidebar scroll area for exceptionally short windows.

**Apply preset…** on a library card requires an explicit target resume, resolves
pending forms, and rechecks both records before opening that resume's Layout
draft. Loading is announced as unsaved; Cancel restores saved appearance and Save
commits one history step. A matching preset creates no change. With no resumes,
the dialog offers ordinary creation without automatically applying the preset.
Neither preset loading nor the Style sample compiles. Existing resumes retain
independent copies after library edits or deletion.

Layout groups follow **Typography > Page & margins > Header & contacts >
Spacing & details > Colors**. Typography and Page & margins initially expand;
validation reveals other groups as needed. The resume workflow remains Overview,
Content & order, Wording, Layout, with free guarded navigation between views.

**Load sample workspace** in Data & backups opens the normal replacement review.
The sample contains complete fictional English/Portuguese resumes using the
Classic and Compact navy presets, plus Complete career and Project focused
structure-only starters. Project focused demonstrates creating a missing empty
Research section; both starters retain field defaults without selecting entries.

The current development format requires the complete layout model and template
`yabuki-reference@1.0.3`. Earlier layout/template data is rejected without migration,
automatic storage clearing, or reseeding. Export anything needed using the previous
application before upgrading; use an explicitly cleared or disposable browser
origin for a fresh workspace. Browser clearing removes local recovery too. Current
workspace schema 2 and recovery format 1 remain the portable envelope versions.

## Current capabilities

The schema-2 career editor runs inside the retained workspace shell: utility rail,
collapsible branded sidebar, workspace toolbar/history/status, and wording-language
header. Career navigation uses the schema-2 dirty-form guard. Narrow screens use
the existing navigation drawer, with Data & backups and Appearance in its footer.
Independent resumes expose Content, Wording, and Layout forms and committed-only output in
the resizable desktop preview panel or narrow-screen Editor/PDF preview tabs.
Workspace panel arrangement and interface appearance remain device-only. Resume PDF layout is saved in the workspace. Data & backups opens the
schema-2 backup/recovery/replacement controls; it offers no retired reset/autosave actions.
Light/dark appearance changes suppress color transitions through the next paint,
then restore normal interaction transitions; system-theme changes follow the same path.

The editor uses the previous career overview card grid, destination headings/icons,
entry-list card, and grouped form layout. Schema-2 drafts supply these views without
changing the shared utility rail, sidebar, or workspace shell.
Overview cards and sidebar navigation use shared staggered pop entrances, honoring
reduced motion; reopening the sidebar replays its entrance.

Career details owns profile, summary, built-in/custom sections, entries, achievements,
links, shared facts, and reusable wording. One content language is sufficient.
Content languages use canonical tags; activation is separate from the English UI
and PDF capability. Deactivation retains wording and existing resumes.

Custom sections have one shared, language-independent app icon. Open **Section
properties** from the section heading menu and choose **Section icon**. The picker
edits the properties draft; the form's Cancel / Save resolves the whole edit.
Until Save succeeds, other views retain the committed icon. Saved choices follow
section representations in career navigation/overview, section headings, resume
Content & order, Wording, shared references, and comparison. Resume identity
colors and navigation icons remain separate. Built-in section icons are fixed.

Section icons are required in the current development model and portable section
and starter definitions. Earlier development data without icons is unsupported;
there is no conversion or silent reseeding. Workspace schema 2 and recovery
format 1 are the supported formats. Icons survive recovery, history,
archive/restore, and workspace replacement/rollback. They do not add PDF graphics
or readiness requirements. An icon Save still advances workspace revision and
can mark the preview stale through its existing PDF revision metadata.
Portable starter definitions also carry icon choices.

Create sections/entries explicitly, then edit their wording and facts. Ordinary
forms, ordering, and language changes stay uncommitted until Save. Cancel discards
the affected form. Entry editing and section entry ordering can stay open as
independent drafts with separate Save/Cancel actions and history steps. Opening an
entry preserves pending order; dragging preserves the entry draft and selection.
Dirty navigation and browser Back/Forward offer Cancel/Discard/Save;
close/reload warnings and recovery flushing are best effort. Keyboard undo remains
inside dirty forms. Workspace Undo/Redo is invoked separately after resolving a
form; Undo after Save undoes that Save. Undo of creation archives the new shared
record; Redo restores the same identity. Shared content has archive/restore only.

Recovery is separate from saved content. It writes after 500 ms of inactivity,
with a two-second maximum scheduling wait. Restore opens an uncommitted draft;
compare and reconcile it before Save. Failed/uncertain Saves retain drafts and
reuse immutable operation IDs. Unknown operation history requires reconciliation.
Unresolved drafts do not expire. Browser clearing/eviction can still remove data.
Session-only Save is an explicit choice and does not replace durable content.

Data & backups exports committed schema-2 content and separate format-1 recovery.
It can be visited without resolving open drafts. Stored draft recovery appears
there with readable names and explicit Restore draft actions; entry lists do not
show recovery comparison panels.
Workspace replacement requires review and an atomic current-revision check,
preserving one previous workspace. Rollback rotates that same snapshot. Recovery
is retained separately. Downloads are reported as initiated, not completed.
Device preferences and operation ledgers are excluded from portable exports.

Resumes can be created, named, colored, duplicated, opened, and deleted with
confirmation. The final resume can be deleted without deleting career content.
New resumes choose an active language and start with full name only; optional
contacts, summary, sections, entries, fields, achievements, and links are selected
and ordered in Content & order. Hiding a section or entry retains its nested choices.
The six icon colors identify resumes in the app and do not change PDF appearance.
Existing archived selections remain labeled and rendered; archived content cannot
be newly selected. Every Content Save commits one independent scope/history step.

Wording customizes profile text, summaries, section headings, entry text,
achievements, and link labels for one resume. Shared facts remain in Career
details. Shared wording changes update inheriting resumes while preserving custom
text, including explicit empty customizations. Use career wording removes the
override on Save. Copying into another language retains shared identities,
selection/order, color, and compatible layout, clears source customizations, and
uses destination career wording without translation or cross-language fallback.
Missing destination wording stays missing. Language-dependent wrapping can differ.
Comparison shows two resumes' effective committed values in their own languages;
drafts are excluded. Content/Wording deep links, reload, and guarded Back/Forward
use opaque IDs. Earlier selection links open Content.

Wording and comparison cards use the same section icons as the sidebar and
readable English field labels. Wording source badges sit beside card titles;
expanded read-only references use the shared nested list-card surface with compact
Open Career details navigation links and the shared list entrance animation. Card icons align with the
first title line, including wrapped titles. Comparison separates resume identity, inclusion/source metadata,
and values.

The sidebar restores each resume's tree: its name opens and selects the read-only
Overview child, above Content & order and Wording. Individual resume views use
their colored icon beside the title, with the actions menu in the title row.
Overview, Content & order, and Wording use underlined tabs with icons; tab changes
follow the same dirty-form guard as sidebar navigation. Compare resumes remains
a separate action. Narrow tab lists scroll horizontally.
Name & color hides those controls and offers Back to overview through the same
dirty-form guard.
Resume selectors show the same colored icons in options and selected values.
The overview card omits color; edit it on the Name & color page. Return to the
collection through the sidebar's Resumes destination. That destination is selected
only for the collection and comparison; individual views show the resume name
and current view in the workspace breadcrumb. The read-only overview card has no
footer actions or navigation instructions. Empty Content & order groups show an
explicit message; search misses are distinguished from unavailable choices.
Overview, sidebar, and collection
share actions for editing name/color, duplication, language copying, and confirmed
deletion. Name/color editing uses a dedicated Save/Cancel page. Overview/details
URLs support reload and guarded Back/Forward. Sidebar names stay on one line
with ellipsis; full names/languages remain available in tooltips. Collection sizing
uses layout heights so entrance animations do not create unnecessary scrollbars;
short windows and long collections retain independent scrolling.

The committed-snapshot output panel manually compiles the pinned template for
English/Portuguese; unsupported languages have no PDF output. Save never compiles
a draft. The Verso-styled PDF.js viewer provides page navigation, percentage zoom,
separate Fit width/Fit page buttons with resize updates, on-demand thumbnails,
embedded document outline, search, download, and a document-properties dialog.
Page navigation uses a compact direct-entry field without spinner or previous/next
buttons. The zoom uses a compact percentage input without spinner arrows (25-400%,
committed on Enter or blur); grouped toolbar controls wrap
with navigation at the start, the remaining controls centered, and the actions
menu at the far right. Document navigation starts closed and
overlays the PDF in narrow panes. Its left utility rail uses Images/Summary icon
tabs, tooltips, and the same animated selection surface and vertical bar as the
workspace navbar; the selected content scrolls independently beside it.
Search opens through its button;
Ctrl/Cmd+F is left to the browser. Native browser Find across unrendered pages is
not guaranteed. Compilation
failure retains the labeled last successful PDF. Viewer replacement cancels its
owned rendering tasks and releases workers; compiler and URL ownership remain
with the committed-output coordinator.

Before the first PDF, an illustrated document placeholder offers **Generate preview**
or directs blocked resumes to Issues. Preparation, generation, viewer loading, and
first-page rendering have distinct status messages; loading motion respects reduced
motion. Refresh keeps the last successful PDF visible and downloadable. Failed
generation offers retry; viewer failures retain download access through PDF actions.

Entry search uses a conditional inline X that clears the query and restores
input focus. Resume selection checkboxes and sorting controls align with the
first title line, including multiline labels.

New workspaces start with empty Experience, Projects, Education, Skills, and
Certifications sections. Existing saved workspaces are not reseeded. Summaries
and achievements support rich prose; headings and short fields remain plain.
Switching the narrow Editor/PDF preview panel preserves open drafts.

Import parsing/validation uses a disposable worker and reports progress after
500 ms. See [recovery-file boundaries and raw reassembly](docs/recovery-files.md).
Explicit discard cleanup uses durable exact-version intents and retries on load;
uncertain commit receipts remain protected until acknowledgment and are discoverable
after restart. Completed receipt retention is configurable through controller
options (30 days/1,000 acknowledged operations by default).

The former bilingual schema-1 editor, translation-review queues, automatic
workspace autosaving, and full resume/layout controls are retired from the active
root page. Schema-1 workflow/state modules remain unmounted reference assets;
their reusable shell, sidebar collection, toolbar presentation, and UI primitives
are shared with the active schema-2 composition.

## Resume output readiness

The PDF preview panel alone has an Issues footer for the selected resume's
**saved content only**. Its count/status row remains visible before compilation
and alongside retained PDFs. It starts collapsed, preserves the toggle choice
while mounted, and expands into a separately bordered body with independent
scrolling capped at 40% of the dynamic viewport height. Overview has no Issues
disclosure. The footer lists all blockers in output order: unverified
PDF language, missing full name, missing heading for a rendered custom section,
empty selected title/degree, and empty selected achievements. Other empty values
remain optional; built-in section headings and blank link-label URL fallback are
preserved. Excluded sections, hidden entries, unselected children, unrelated
resumes, archive status, and language deactivation alone do not block output.
Language activation does not grant verified PDF support.

**Edit wording** opens that resume's Wording view and focuses the affected card.
Customize repairs only that resume; the existing Career wording link opens shared
content. Issue navigation uses the ordinary dirty-form guard and reveals Editor on
narrow screens only after navigation succeeds. Cancel or failed Save retains the
draft. Focus targets stay local; durable scope URLs support reload and Back/Forward.
Saving within the current resume editor reopens the saved form without adding a
duplicate browser-history entry.

Readiness and TeX rendering use the same assessment. Incomplete valid content can
still be saved; malformed values retain the failed draft. Typing, recovery
restoration, and unsaved wording never update readiness or compile a PDF. Refresh
preview is disabled while blocked, and compilation errors remain separate. A last
successful PDF remains labeled and downloadable, becoming outdated after saved
output changes. Ready for PDF establishes content eligibility, not visual layout,
clipping, PDF/UA, or ATS acceptance.

Shared rich-text URL validation and the entry-search checkbox are independent of
retired review and workspace-state modules. The retired schema-1 assets remain
unmounted references, with no active counterpart or translation-review workflow.

## Data formats and limits

The supported format is UTF-8 `verso.workspace` schema 2; recovery uses a separate
`verso.recovery` schema 1. Unsupported versions are rejected without changing saved
content. Backups include committed content/configuration, not device preferences or
credentials. Recovery imports restore drafts, never automatically committed edits.
Resume color/contact/summary configuration and hidden selection flags are optional
schema-2 additions. When absent, older schema-2 resumes retain their prior output
defaults without writes on load. New resumes explicitly store unselected defaults.
Name/color, Content, Wording, and single-resume lifecycle scopes commit separately;
older selection drafts and immutable pending requests remain supported unchanged.
Deleting a resume retains unresolved recovery. When its shared references still
exist, Restore as new creates an uncommitted resume in an explicitly chosen active
language and retains the original recovery. Invalid references require reconciliation
or export. Interrupted creation/deletion receipts are checked before replay; Undo
and Redo never overwrite a conflicting resume.

Safety ceilings are 120 resumes, 100 sections, 10,000 entries total, 300 entries per
section, 100 achievements and 30 links per entry, 30 profile links, and 100 each of
starters/presets. Languages are bounded by file size. Workspace documents and files
each allow 64 MiB, including envelope overhead for files; recovery allows 256 MiB
per file and 64 MiB per draft including its baseline. Limits never permit truncation
or automatic eviction of unresolved recovery. In-memory undo is bounded to 100
steps or 32 MiB; undo is not a backup. Browser clearing/eviction can still remove data.

Compiler defaults are a 120-second initialization timeout, 30-second compilation
timeout, and 1,000,000-byte source limit. Compilation uses one active request and
one replaceable queued request, one compiler/worker pair per tab, and one retained
successful PDF plus an in-flight result.

## Setup and checks

Use Node >=20.19 and npm 11.3 with the existing package-lock.json.
Run `npm ci`, `npm run compiler:prepare`, then `npm run dev`.
The browser compiler uses locally prepared assets and needs no account credentials.
Builds use the existing Next.js Google-font integration.

| Command                | Purpose                                                               |
| ---------------------- | --------------------------------------------------------------------- |
| `npm run format:check` | Formatting                                                            |
| `npm run lint`         | ESLint/import order                                                   |
| `npm run typecheck`    | Next route generation and TypeScript                                  |
| `npm run build`        | Production build                                                      |
| `npm run test:unit`    | Vitest Node domain/capacity cases                                     |
| `npm run test:browser` | Real Chromium component/IndexedDB cases                               |
| `npm run test:e2e`     | Playwright with a fresh production build/server on localhost:3100     |
| `npm run test:measure` | Explicit production capacity/interaction/import/compiler measurements |
| `npm test`             | Unit, browser, then E2E suites                                        |

Vitest 4.1.0, renderer 2.2.0, Vite 7.3.1 and a Tailwind Vite adapter are scoped to
testing and preserve the selected Next/React versions. Test browsers live in
`.cache/ms-playwright`. Test against disposable origins; browser storage belongs
to the origin/profile. Tests do not establish Safari support, PDF/UA, universal
ATS compatibility, or production deployment.

Install the pinned browser engines with `PLAYWRIGHT_BROWSERS_PATH` set to
`.cache/ms-playwright` before running cross-browser checks. E2E runs Chromium,
Firefox, and WebKit; the Chromium quota case waits for the browser's 30-second
quota cache to expire. Measurements run separately with one worker and write
raw samples under `.cache/performance/`; their recorded evidence includes reference
hardware, browser version, normal/4x CPU runs, and sample counts.

The application sends no resume content to a backend. Compiler maintenance is
covered in [compilation proof](docs/compilation-proof.md).
