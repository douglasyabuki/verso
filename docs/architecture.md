# Architecture and behavior contracts

This reference describes the active application and the constraints changes must
preserve. Code paths in backticks are relative to the repository root. Setup and
commands live in the [README](../README.md); transaction and portable-data details
live in [Save and recovery](recovery-files.md); account security and publication
live in [Accounts and public PDFs](accounts-and-public-pdfs.md).

## Ownership and composition

`app/page.tsx` renders the static product presentation (`components/welcome/`);
`/sign-in` and `/sign-up` render `components/account/auth-screen.tsx`. The
workspace lives at `/app` and `/app/*`: `app/app/[[...scope]]/page.tsx` mounts
`components/account/account-root.tsx`, which resolves the session and mounts
`CareerWorkspace` for the guest or account owner. The page never reads `params`,
so every workspace path shares one static shell. `proxy.ts` routes only `/`,
`/sign-in`, and `/sign-up` (see
[entry routing](accounts-and-public-pdfs.md#entry-routing-and-sign-in)). The canonical
workspace model and scope rules live in `lib/career/`; shared derived contracts
live in `types-and-constants/career.ts`. The career controller owns committed
content, one form draft, an independent section entry-order draft, recovery
scheduling, and bounded history. Guest persistence uses IndexedDB transactions;
the account backend uses server-authoritative PostgreSQL.

The career shell reuses the utility rail, sidebar collections, toolbar, layout
preferences, and responsive primitives without mounting schema-1 providers.
`lib/resume/`, `stores/workspace/`, and old workflow contexts remain unmounted
reference modules. Their former autosave, locale-pair, and review assumptions do
not define active behavior. Do not add retired features merely for parity.

## Career content and independent resumes

New workspaces contain empty Experience, Projects, Education, Skills, and
Certifications sections. Never reseed existing content. Career details owns shared
facts and reusable wording; resumes independently select/order content and override
display wording. Selecting an entry that is not yet in a resume's `entryIds` adds
its fields (or only the fields matching copied starter defaults) and its
non-archived achievements and links to the draft, after existing choices and in
career order. An entry that was excluded and is selected again keeps its earlier
detail choices. Shared edits do not overwrite overrides; Use career wording
removes an override. Summaries and achievements/details use rich prose; headings,
names, facts, short values, and link labels use plain controls.

Each resume has one canonical content-language tag. The UI is English; language
activation, wording availability, and verified PDF support are independent.
Deactivation hides creation choices while preserving wording and existing resumes.
Copying into another language uses destination career wording and copied selection,
order, and compatible appearance, with rendering warnings; it does not silently
fall back to another language or promise identical pagination.

Shared content supports archive/restore rather than permanent deletion. Archived
records disappear from new-selection lists, remain usable in existing selections
and output, and are labeled Archived in editors. Removing an existing selection
is allowed. Confirmed resume deletion removes only that resume, never shared career
content. Shared identities cannot be removed or retyped by ordinary Saves.

Custom section icons are validated shared metadata from
`types-and-constants/section-icons.ts`; new custom sections use `file-text`, while
built-in icons are fixed. Section properties edits the icon in its existing draft.
Every section representation uses the saved icon. Icons participate in baselines,
history, recovery, backups, and rollback, but not PDF graphics or readiness.

### Section vocabulary, internal names, and links

`lib/career/terminology.ts` owns per-kind interface terms (entry creation,
detail and link actions, group headings, and which groups are primary). Entry
lists, quick actions, the entry form, Content & order, and Wording use them;
**Add section** stays generic. Empty secondary groups sit behind **Add more**;
populated groups always render.

Achievements/details and links accept an optional `name` (internal name). It is
shared across resumes and languages, appears only in editors, and never reaches
TeX. Row labels come from `detailRowLabel`/`linkRowLabel`: the internal name, then
the applicable wording excerpt or display label and URL, else a numbered,
kind-specific fallback ("Skill detail 2", "Link 3"). Renaming and reordering keep
identities and resume selections.

Links accept an optional `icon` override from `types-and-constants/link-icons.ts`;
absence means Automatic. `lib/career/link-icons.ts` matches exact registrable
domains and their subdomains (plus `scholar.google.<tld>`), otherwise the generic
chain icon. The editor and the PDF header share one glyph/codepoint table. Profile
links render with the contact details (icons follow **Contact icons** and the icon
color). Entry links render beneath their entry as clickable labels without icons.
A blank label prints the URL. Entry URLs are added through the link list. A saved
`url` (Website) field stays editable and selectable. When a selected Website and a
selected entry link share a destination (`sameDestination`: only scheme/host case,
default port, and an empty root path are ignored), the labeled link prints once.

### Spoken languages and attached evidence

The `languages` section kind (not seeded; offered by Add section) has `title`
(language name) and `level` (optional proficiency) wording, independent of
Settings › Content languages. Certifications gained an optional verbatim `score`
fact. It is listed in `LATER_FIELDS`, so older entries without it stay valid, and
editors append it when the user first enters a value.

A language entry's optional `evidence` array holds attachment records
(`{id, entryId, archived}`) that point to certification entries. The certification
stays the one shared record, so edits reach every resume after Save. Detach and
Reattach archive and restore the attachment. Removal and changing its target are
rejected like other shared identities. A resume's section selection carries
optional `evidenceIds`, independent of any Certifications selection, so a result
can render under Languages, Certifications, or both. Newly selecting a language
includes its active attachments. Newly selecting a detached attachment, or one
whose certification is archived, is rejected. Existing selections keep rendering.

Creating a test from a language form first resolves that draft. A language that
was never saved stops the flow. The flow then opens the composite
`language-evidence/<certificationId>` scope, whose Save creates the
certification and appends the attachment in one transaction and returns to the
language. Undo archives both; Redo restores both. Attach existing stays a
separate draft edit.

## Editing, history, and navigation

Forms, selection, and ordering use explicit Cancel / Save. Incomplete valid values
can be saved; malformed values retain the failed draft. Typing and recovery never
mutate committed content, saved PDF inputs, or workspace history. A successful Save
creates one atomic history step; Cancel/Discard creates none. Creation history
archives/restores shared identities; resume creation/deletion history preserves
resume identities without changing shared content.

Entry and section entry-order drafts are independent. Sorting preserves entry
editing, selection, filters, scroll, and hidden-ID slots; each Save/Cancel resolves
only its own scope. Leaving a section resolves applicable drafts separately, and
canceling later navigation does not undo an earlier explicit resolution. Dirty-form
keyboard undo/redo stays in the draft. Workspace Undo/Redo requires resolving the
draft, then a separate history invocation; Undo after Save undoes that Save.

Entering a scope with stored edits opens a recovery dialog before its editor
accepts changes. Dismissing the review retains the stored draft and returns to
the parent view. See [Save and recovery](recovery-files.md#save-and-recovery-protocol)
for comparison and discard behavior.

Durable scope URLs support reload and Back/Forward. The destination is the path
after `/app/` (`/app/resumes`, `/app/settings/account`; `/app` is Overview), read
and written by `destinationFromUrl` and `destinationUrl` in `lib/career/navigation.ts`.
Navigation stays client-side (`history.pushState`) and makes no server request.
Legacy `?scope=` values are still read and rewritten to the path form; `/?scope=`
links redirect permanently to `/app/<destination>`. Validate destinations and
resource identities before opening them; missing records never create content.
Dirty departures offer Cancel / Discard / Save, with the primary action rightmost.
Cancel and failed Save retain the draft. Disable form actions while unchanged or
saving. Preserve narrow-screen Editor/PDF switching without closing drafts.

Settings is a durable dialog over the mounted workspace, defaulting to Account,
with Appearance, Data, Resume defaults, Content languages, Editing & preview, and
Public PDFs panels at `settings/<panel>`. Old `languages`/`backups`
links remain usable. Preserve the underlying destination, history metadata,
focus/scroll, and drafts. The account menu and Appearance shortcut live in the
utility rail; OAuth sign-in/sign-up stays in Settings, with shared guarded sign-out.

Device/data panels preserve career drafts. Resolve occupied drafts before language
or workspace-default forms; guard dirty Settings-form departure, closure, and
Back/Forward. Data viewing/export remains accessible without resolution, including
detours from a dirty Settings form. These workspace forms use controller-owned
Save/recovery/history; `defaults` affects future blank resumes only. **Delete
workspace data** sits last in Settings › Data and needs no draft resolution
first: it deletes open drafts with the workspace. On success every tab of the
owner opens the fresh Overview with no resume selected (see
[workspace data deletion](recovery-files.md#workspace-data-deletion)).

Device theme and automatic preview refresh apply immediately outside workspace
history and portable exports. The preview preference uses a versioned IndexedDB
record separate from cleanup intents. Writes are serialized and tab-only failures
offer a retry. On load, legacy records preserve the automatic refresh choice.
The editor uses a 120-second compiler initialization timeout and a 30-second
compilation timeout. Receipt maintenance uses fixed defaults and skips pruning
after a preference read fails until a preference write succeeds.

## Layout and library interactions

The supported single-column template is `yabuki-reference@1.0.3` with the complete
current layout model. No older layout/template conversion, automatic reset, or
storage clearing is supported. Appearance is independent of retired editor state.
The [portable-data reference](recovery-files.md#layout-presets-starters-and-atomic-creation)
owns frozen defaults, exact layout/library scopes, and atomic starter creation.

Resume resets use frozen layout defaults; preset/starter resets use app defaults.
Keep automatic/relative dimensions as sentinels until explicitly edited. Hidden
dependent values remain stored and invalid values remain actionable. Resets and
color picks stay drafts. The fictional style sample does not compile or predict
pagination. Page warnings describe the PDF being viewed, including retained PDFs.

Content & order owns profile inclusion and sequence. Layout owns positional contact
row sizes, alignment, icons, separators, spacing, and optional `contactLocation`.
Omitted location grouping means separate items without load-time writes. Combined
city/country uses their selected sequence and sits at the first selected location
position. Empty values produce no empty rows.

Library is a permanent sidebar group between Career details and Resumes. Its
`/app/library` overview and collections have guarded parent links. Views use full
editor width without unrelated PDF or career-language controls. Keep resume rows
mounted through library navigation so expansion, scroll, and entrance state are
preserved; visiting Library must not expand or select a resume. Keep Library
accessible beside independently scrolling collections. Collection creation aligns
with the title-row end; omit preset/starter search in collections and pickers.
New presets and starters created from scratch use the built-in appearance.
Saved Library cards show Apply preset or Create resume beside a quick-actions
menu for Edit, Duplicate, and Delete. Delete appears last after a divider.

Sidebar rows with actions (Profile, Summary, sections, Layout presets, Resume
starters, and resumes) open the same quick-action list from their "…" button and on
right-click. Both section menus can open a new entry draft. Collection headings
and resume sub-pages offer right-click actions only. Create resume and Compare
resumes appear beside the Resumes title and in the sidebar heading's context
menu. Comparison opens the committed-content view once two resumes
exist. Compare in a resume's menu opens `/app/resume-compare/<id>` with that
resume on the left and the first other saved resume on the right. The collection
action opens `/app/resume-compare` with the default pair. The view starts with
saved wording, inclusion, and order differences grouped by Career details
section and entry. All rows includes unchanged and excluded values and
wording-source-only differences. Section and change-type filters work together.
Opening a group uses the shared list entrance. Order differences compare the
relative sequence of shared IDs. Choosing the opposite resume swaps the pair.
Filters and disclosure state are local to the visit. Navigation actions use
guarded navigation. Commands such as Archive section resolve open drafts first
and commit through the controller. Negative actions sit last, after a divider.

Resume Layout is directly editable. Its initially collapsed optional preset
disclosure offers an explanatory empty state or explicit selection/load/capture/
manage actions. Selection alone does not load; loading opens an uncommitted draft
and its announcement stays visible outside the disclosure. Applying from Library
requires an explicit target, dirty-draft resolution, and identity rechecks. Missing
targets/configurations must not silently create a blank resume. **Use this layout
for new blank resumes…** resolves pending edits and opens Settings › Resume
defaults with the source resume’s saved appearance for review and Save.

The Create resume dialog shows only the blank form until a saved starter exists.
With starters available, it offers From starter and a mapping review. Library
starter cards open the same review with the starter selected. If the selected
starter becomes unavailable, the user must choose another starter or explicitly
switch to blank before creating the resume.

## Readiness and output

`lib/career/readiness.ts` and the renderer share effective-selection
assessment. Blockers are an unverified PDF language, missing full name, a rendered
custom heading, selected title/degree, selected achievement wording, or the name of
a selected attached test or certificate. Other empty
values remain optional. Preserve built-in headings, URL-label fallback, and explicit
empty overrides without cross-language fallback. Hidden/excluded content and
archive/deactivation status alone do not block output. Save validation is separate.

Issues appear only in the PDF preview footer, initially collapsed with a persistent
count/status row, and an independently scrolling body capped at 40dvh. Preserve its
toggle while mounted. Issue actions reveal Editor on mobile, expand the relevant
group, and focus the input, selection control, or Customize button. Cross-editor
issue navigation offers Save and go or Keep editing while the current form is
dirty. Targets are transient. Durable URLs contain no private wording.
Wording groups rows by Career details owner, initially lists included content, and
omits shared facts. Keep shared checkbox and URL-validation helpers independent of
retired review/state modules.

`lib/career/output.ts` resolves selected facts and wording with explicit output
capabilities. `lib/output/template.ts` assembles the pinned template independently
of content schemas; `lib/output/encoding.ts` safely escapes text. Selected archived
content remains rendered. Rendered output, not revision alone, determines staleness.

The workspace preview coordinator tracks committed and draft versions synchronously
and exposes PDF status to the pane separately from the editor. Layout, Wording, and
Content & order coalesce completed interactions for 300 ms. Text fields, rich-text
formatting controls, and their popovers share an editing session. Composition
finishes before a request captures the accepted text. **Update preview** and mobile
PDF pane entry request the eligible version immediately. Hidden panes and background
tabs defer automatic draft work. Other destinations can opt into refresh after Save.

A dedicated worker receives the active resume’s projected shared records in
acknowledged batches. Wording and layout updates send changed scope keys, including
deletions. The projection includes language-specific wording, selected records
(including certifications attached to selected languages), an identity and formatting index for override validation, and the committed byte
allowance. Preview applies the Save scope rules and the shared renderer. Save still
validates and commits the complete workspace at its authoritative storage boundary.

One worker owns the warm XeTeX and XDV-to-PDF pair and runs one job at a time.
Saved actions take priority after the active job reaches a safe boundary. Resume,
workspace generation, committed head, and exact draft version guard preparation,
compilation, and viewer handoff. Rendered fingerprints allow equivalent PDFs to be
reused, including layout changes that only affect the page warning. Draft PDF
metadata says unsaved. Saved output retains its actual compiled revision.

The pane keeps the last readable document while an inert PDF.js candidate renders
the intended page. Promotion preserves page, zoom or fit mode, and relative
vertical scroll. A removed page lands at the top of the new last page. Closing
the pane releases PDF.js resources and keeps reading position for reopening on
the same resume. A resume, owner, or workspace generation change clears that
position and retained output. Compiler defaults are 120 seconds for initialization,
30 seconds for compilation, and a 1,000,000-byte source limit.

## Capacity and measurement

Canonical model limits include 120 resumes, 100 sections, 2,000 total entries,
300 entries per section, 100 achievements, 30 links, and 30 attached tests or
certificates per entry, 30 profile links,
100 starters, and 100 presets. Languages are byte-bounded rather than count-bounded.
Preserve field/rich-text validation. Byte limits and export rules are owned by the
[recovery reference](recovery-files.md). History retains at most 100 steps or 32 MiB
of serialized patches; disclose dropped history or unavailable oversized-save Undo.
Replacement starts a new history generation; Undo is not a backup.

Performance targets are engineering budgets, not claims that every environment has
passed. Use `npm run test:measure` separately from routine tests. Record hardware,
OS/browser/build, fixture identities, counts, failures, p50/p95/max, and normal versus
4x CPU results. Compare the same build/fixtures; disclose historical/mixed-build limits.

Use small (20 entries/3 resumes), representative (300/30), independently customized
multi-resume (60 resumes), and near-capacity (120 resumes) fixtures with English/
Portuguese content. Normal-speed p95 budgets are 100 ms for input/selection/reorder,
500 ms representative / 2 seconds capacity for Save acknowledgment, and 2 seconds
representative / 5 seconds capacity for opening, excluding compiler initialization.
Collect at least 100 interactions and 30 Saves/opens per data fixture. Typing must
not scan the whole workspace.

Recovery acknowledgment targets 3 seconds during continuous input; storage failures
should surface within 1 second of detection. Capacity import preview targets
5 seconds with progress after 500 ms and no recurring parsing/transfer tasks above
50 ms on the main thread. Worker use alone does not establish those results.
Compiler targets are 5 seconds warm (10 runs) and 20 seconds cached-cold initialization
plus compilation (5 runs) for representative 1–3-page resumes; measure proven
uncached downloads separately. Verify deterministic settled resource bounds rather
than claiming sustained heap-growth or soak acceptance without evidence.
