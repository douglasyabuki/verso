# Verso

A locally saved bilingual resume workspace built with Next.js 16.4.2, React 19.3,
TypeScript, Tailwind CSS 4, and Base UI shadcn components. Edit structured career
content, review English/Portuguese wording, tailor resumes, and generate actual
LaTeX PDFs entirely in the browser.

## Local setup

Use Node.js 20.19+ and npm 11.3.0, plus Python 3.12+ for compiler asset preparation.
No credentials, database, Docker, or native LaTeX installation are required.

```sh
npm ci
npm run compiler:prepare
npm run dev
```

Open http://localhost:3000. Preparation downloads hash-locked engine/package
archives and creates ignored assets under `public/compiler/` and `.cache/`.
The first run needs network access; compilation uses only self-hosted assets.
Keep the verified download cache because changed upstream archives are rejected.

The bundled fictional workspace in `lib/resume/example.ts` provides reproducible
content for reviewing the editor and exporting both languages. Load it through
the workspace data menu after preparing the compiler assets.

## Code organization

| Directory               | Responsibility                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `app/`                  | Routes, layouts, and global styles                                                            |
| `components/workspace/` | Workspace composition, readiness, navigation UI, shell, and controls                          |
| `components/content/`   | Career overview and shared content editors                                                    |
| `components/variants/`  | Resume collection, identity, selection, and comparison                                        |
| `components/wording/`   | Shared and variant wording, translation comparison, and review editing                        |
| `components/output/`    | Template settings, layout controls, and PDF preview                                           |
| `components/review/`    | Output issues and navigation into their editors                                               |
| `components/editor/`    | Shared editing fields, sorting, and rich-text editor modules                                  |
| `components/shared/`    | Language indicators and semantic badges shared across features                                |
| `components/ui/`        | Shared UI primitives                                                                          |
| `hooks/`                | Reusable hooks and feature interaction coordination in `workspace/`, `output/`, and `review/` |
| `contexts/`             | Mounted workflow, output, backup coordination, and narrow owner-editor links                  |
| `stores/workspace/`     | Observable controller, persistence, and React lifecycle adapter                               |
| `types-and-constants/`  | Shared domain contracts and declarative defaults                                              |
| `lib/resume/`           | Canonical document schemas, factories, and fictional example                                  |
| `lib/content/`          | Career content, resume selection, certification dates, and entry labels                       |
| `lib/wording/`          | Localization, structured spans, and variant wording rules                                     |
| `lib/review/`           | Validation, issue descriptions, and review queue derivation                                   |
| `lib/output/`           | Deterministic LaTeX rendering, resolved settings, and browser downloads                       |
| `lib/workspace/`        | Portable backup validation/migrations and editor destinations                                 |
| `lib/ordering.ts`       | Generic array ordering, including filtered-list moves                                         |
| `types/`                | External-library declarations                                                                 |

Use `career` for shared profile, summary, sections, and entries; the interface calls
this area **Career details**. Use `shared` for wording inheritance and
`shared-wording` for the review reason. Resume selection, visibility, and output
order belong to the variants feature. In `lib/content/`, `career.ts` owns clearing
and deletion, `entries.ts` owns search and duplication, `section-fields.ts` owns
labels, and `selection.ts` owns achievement selection.

Domain logic does not depend on React or storage. Shared contracts use type-only
schema imports, and stores keep their React adapter separate from controller and
persistence code. Hooks connect those layers to presentation. The workspace
controller is the single writable owner of resume state; navigation selections,
compiler lifecycle, and local interaction state retain their existing owners.

After readiness, the workspace mounts workflow, output, and backup providers in
that order. They stay mounted across destination changes and preview visibility.
The workflow provider composes navigation and career/resume actions, confirmations,
and issue-focus coordination. Navigation alone owns review contexts and return
destinations; the editor-review hook derives their effective context and coordinates
updates without storing another copy. The output provider owns one compiler,
validation, auto-sync, and exports. The backup provider owns one backup-hook instance
and input ref shared by every menu and inline presentation; the workspace renders
exactly one import input.

`WorkspaceView` composes layout and connected controls. `EditorPane` composes the
scrolling/disabled boundary, header, return navigation, and destination content.
Their extracted components render controls, career tabs, review content, settings,
preview/issues panels, and dialogs. Reusable controls retain explicit props, while
connected workspace components consume the appropriate contexts. See
[context guidance](contexts/AGENTS.md) for ownership and mounting constraints.

See [store guidance](stores/AGENTS.md) and
[contract guidance](types-and-constants/AGENTS.md) for dependency rules and
persistence invariants.

## Working with drafts

Start empty or explicitly load the fictional example in **Data & backups**.
**Career details** opens Overview; each section has **Edit content** and
**Review translations** tabs. Shared edits affect every resume using that content.
New entries and achievements stay outside all resumes until explicitly included.
**Resumes** opens All resumes for creation, duplication, opening, and deletion.
Each resume owns **Content & order**, **Translations**, and **Layout**.
Layout starts with Resume and Resume-language scopes; **Edit shared defaults**
opens workspace/language defaults separately. Compiler timeouts live in Data & backups.
Desktop has a resizable editor/PDF split; narrow screens switch between panels.
Career details navigation stays in English while resume wording follows the
selected language. Section-specific forms show relevant fields, with retained
extra fields available under Additional details. Certifications support a
credential ID and optional issue/expiration dates; date setup saves as one edit
only after confirmation.

Summaries, headings, titles, and achievements share a formatted editor with
emphasis and links. Select text to format it, or place the caret in a link to
edit its destination. Ctrl/Command+I toggles emphasis and Ctrl/Command+K opens
link editing. Paste inserts plain text; HTML, Markdown, and LaTeX syntax remain
literal text. Links accept only validated http, https, mailto, and tel destinations.

Search career entries within the current section or Content & order across sections, matching
shared facts and wording in both languages without case or accent differences.
Archived entries are hidden until Include archived entries is enabled. Duplicate
an entry to create an independent copy outside every resume. Use drag handles,
keyboard sorting, or move buttons to reorder content; Escape cancels a drag.
Career content order and each resume's output order remain independent. In Content & order,
Select all appends missing achievements to the existing selection order; Clear
all removes achievement selections while keeping the entry included.

Auto-update preview is enabled by default and updates the PDF preview after
800 ms without output-affecting changes. Edits to hidden sections, unselected
entries/achievements, or other variants do not trigger automatic compilation.
Turn it off beside Refresh to update manually; turn it back on to sync the
current draft. This option lasts only for the current tab session.

The utility rail provides workspace data/backups and appearance controls. Collapse
the sidebar to gain editing space, or hide the PDF preview for a full-width editor.
On mobile these utilities live in the navigation sheet. Sidebar visibility,
preview visibility, and split proportions are saved separately from resume content
when browser storage is available; JSON backups do not include these preferences.

Toolbar Undo and Redo cover document edits, translations, entries, achievements,
archiving, ordering, variants, and template settings. Typing in one field groups
until a one-second pause or leaving the field; paste and cut are separate steps,
and each IME composition is one step regardless of duration. Use Command+Z and
Shift+Command+Z on Apple platforms, or Ctrl+Z and Ctrl+Y / Ctrl+Shift+Z elsewhere.
While a formatted field is focused, these shortcuts use its field-local history;
ordinary text inputs retain native browser undo/redo. Workspace toolbar undo/redo
and workspace replacements clear formatted fields' local histories. Workspace
history stays available during autosaving and pauses during workspace replacement
confirmation. It retains up to 100 steps in memory, clears
on reload or successful workspace replacement, and never restores backup markers.
Undo and redo create new document revisions and follow the current preview sync
and local-saving settings.

The workspace restores from this browser and autosaves 500 ms after edits when
localStorage and Web Locks are available. Save status reflects confirmed browser
writes, independently of JSON backup reminders. JSON backup freshness survives
reloads; PDF and LaTeX downloads do not advance it. Browser storage can be cleared,
so export JSON for a portable backup. Downloads are reported as initiated, since
completion of a browser save dialog cannot be confirmed. Saved work is specific
to this browser profile and origin: changing the hostname or port opens a separate
workspace. Use a JSON export/import to move drafts between them.

JSON exports use resume schema 8. Compatible schema-1 through schema-7 backups migrate
on import or browser restoration, preserving wording, IDs, revisions, and review
flags. Missing historical review snapshots stay unknown until explicitly reviewed;
schema-1 certification metadata starts unset. Older resumes receive an indigo navigation color and retain their original PDF colors. Unsupported schemas/templates are rejected.

Custom career sections have a shared icon selected from 25 career-related choices.
Click the section heading icon to choose an icon, then Save or Cancel. Saved icons
appear throughout the workspace, including Content & order and Text to review,
and are included in JSON backups. Built-in sections retain their default icons.

Other-tab changes pause saving. Review the stored version before loading it or
explicitly replacing it; a changed version invalidates any previous confirmation.
Import, example loading and recovery use this same conditional replacement path.
One previous workspace remains recoverable during the current session.

If storage or safe coordination is unavailable, editing, JSON import/export,
example loading and recovery still work in **session-only mode**. Confirmed
replacements affect only this tab, remain unsaved, and leave stored data untouched.
Failed persistent replacements offer retry or an explicit session-only choice.
Resume browser saving explicitly through workspace controls; it never silently
restarts over potentially newer data. Leaving-page warnings cover unsaved or
blocked local saving. Hidden-page flushes and warnings are best effort and cannot
guarantee protection against closure or device shutdown.

A missing required translation blocks only that language. Translation-review
flags warn without blocking draft downloads. Bilingual export requires two valid
outputs from the same snapshot. Open Issues to inspect the active variant's
English and Portuguese blocking errors, translation-review warnings, and layout
status separately. Field links navigate to the affected editor. Check layout
compiles that language and compares its PDF page count with the template target;
it does not detect clipping or overlap. Exceeding the page target warns without
blocking downloads.

PDF appearance settings cover paper, four margins, Inter/Source Sans 3/Source
Serif 4, body and heading typography, header alignment, section dividers, entry
and paragraph gaps, achievement bullets, six color roles, and localized page
numbering. They follow all-resumes, language, resume, and resume-language scopes.
Use default removes a scoped override (or restores the factory value at base
scope); Template default stores the original template behavior explicitly.
Numeric drafts commit on blur/Enter; Escape cancels. Linking side margins affects
the next margin commit only. JSON backups and undo/redo include appearance.

Named text colors meet 4.5:1 contrast against white. Explicit link color wins
inside headings and emphasis. Template-default links follow section color;
secondary text and icons follow explicit body color, otherwise original grays.

Source ZIPs include generated LaTeX, the exact browser runtime/resources, notices,
and a standalone local compilation launcher.

### Resume wording and comparison

Resumes inherit shared career wording until you explicitly choose **Customize for this resume**
for a summary or achievement in a particular language. The other language keeps
inheriting. The editor labels each source and explains its scope before editing.
**Reset to shared** removes that language's override, with confirmation and workspace
undo. Facts and achievement IDs stay shared. Hidden, unselected, and archived content
retains overrides; permanent career entry deletion removes them.

Resume translation review compares its effective bilingual pair. If English has
an override and Portuguese inherits, editing shared Portuguese flags the English
override for translation review (and vice versa). **Shared wording changed** is a
separate review of same-language shared text beneath an override. Its acknowledgment
never clears translation review. Draft downloads remain available when valid.

Open **Compare resumes** in Content & order for a read-only, language-specific comparison
of visibility, selections, ordering, effective wording and its source/review state,
and effective template settings. **Differences only** hides equal rows; edit links
open the corresponding resume and field. JSON backups preserve all overrides and
review metadata.

**Translation review** is the global unresolved queue. Its badge counts distinct
owner/field/language items across both languages, including archived career content
and excluded resume customizations. Resolving an opened item keeps it in a labeled
current-item area until another item is opened or its review context is left.
Filters and focus changes do not dismiss it. Owner-editor return links preserve
queue filters, list scroll, and the current item. Translation target language is
independent of the resume output language.

Navigation uses typed, tab-local destinations; editor navigation does not create
URL history entries or shareable links to individual views yet.

## Verification

| Command                    | Purpose                                                   |
| -------------------------- | --------------------------------------------------------- |
| `npm run compiler:prepare` | Verify locked downloads and prepare local compiler assets |
| `npm run format:check`     | Check source formatting                                   |
| `npm run lint`             | Lint source and import ordering                           |
| `npm run typecheck`        | Run Next.js route type generation and TypeScript          |
| `npm run build`            | Produce a production build                                |
| `npm start`                | Serve the production build                                |

Automated tests are excluded from this implementation. Existing Playwright
scripts remain available but are not product acceptance coverage. Use the bundled
fictional example on a disposable localhost origin for manual verification.
Static checks and production builds do not establish browser behavior. Safari and
assistive-technology compatibility remain unverified; no PDF/UA or universal ATS
compatibility is claimed.

The workspace sends no resume data to a backend. Authentication, account persistence,
publication, public APIs, portfolio/LinkedIn integration, and hosted deployment
are outside this implementation. Builds fetch the existing Geist interface
fonts through Next.js; document fonts are in the local compiler bundle.

Agent guidance is in [AGENTS.md](AGENTS.md). Template/compiler maintenance is
covered by the repository's `resume-latex` skill. The
[browser compilation milestone](docs/compilation-proof.md) documents the pinned
bundle, standalone demonstration, and recorded compiler verification.

[Product requirements](docs/requirements.md) describe a broader cloud-backed
release roadmap; the current implementation is the local-only workspace described
above.
