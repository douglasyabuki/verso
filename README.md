# Verso

A locally saved bilingual resume workspace built with Next.js 16.4.2, React 19.3,
TypeScript, Tailwind CSS 4, and Base UI shadcn components. Edit structured career
content, review English/Portuguese wording, choose variants, and generate actual
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

The standalone compiler proof depends on private reference documents that are
excluded from the repository. Its server is available through
`npm run compiler:proof` at http://127.0.0.1:3199, but the reference comparison
cannot be reproduced from a fresh checkout alone. These documents are optional
for asset preparation and are not required to use the editor or fictional example.

## Working with drafts

Start empty or explicitly load the fictional example. Use Content for shared
career records, Translations for side-by-side review, Variants for selections
and output ordering, and Template for layout overrides and compiler timeouts.
Desktop has a resizable editor/PDF split; narrow screens switch between panels.
Auto-update preview is enabled by default and updates the PDF preview after 800 ms without
input changes. Turn it off beside Refresh to update manually; turn it back on
to sync the current draft. This option lasts only for the current tab session.

The utility rail provides workspace data/backups and appearance controls. Collapse
the sidebar to gain editing space, or hide the PDF preview for a full-width editor.
On mobile these utilities live in the navigation sheet.

The workspace restores from this browser and autosaves 500 ms after edits when
localStorage and Web Locks are available. Save status reflects confirmed browser
writes, independently of JSON backup reminders. JSON backup freshness survives
reloads; PDF and LaTeX downloads do not advance it. Browser storage can be cleared,
so export JSON for a portable backup. Downloads are reported as initiated, since
completion of a browser save dialog cannot be confirmed.

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
outputs from the same snapshot. Source ZIPs include generated LaTeX, the exact
browser runtime/resources, notices, and a standalone local compilation launcher.

## Verification

| Command                    | Purpose                                                   |
| -------------------------- | --------------------------------------------------------- |
| `npm run compiler:prepare` | Verify locked downloads and prepare local compiler assets |
| `npm run compiler:proof`   | Serve the independent browser compilation demonstration   |
| `npm run format:check`     | Check source formatting                                   |
| `npm run lint`             | Lint source and import ordering                           |
| `npm run typecheck`        | Run Next.js route type generation and TypeScript          |
| `npm run build`            | Produce a production build                                |
| `npm start`                | Serve the production build                                |

Automated tests were explicitly excluded from this implementation. Existing
Playwright scripts remain in the repository but were not added to, updated, or
run as product acceptance coverage. Follow the manual scenarios in
[implementation notes](docs/implementation-notes.md) and the observed browser/PDF
results in [the compilation milestone](docs/compilation-proof.md).

Chrome, Edge, and Firefox browser compilation was checked locally; the private
inputs and generated evidence for those observations are not included. Safari and
mobile compilation are unverified. The converter has documented decorative-icon
text-extraction limitations; no PDF/UA or universal ATS compatibility is claimed.

The workspace sends no resume data to a backend. Authentication, account persistence,
publication, public APIs, portfolio/LinkedIn integration, and hosted deployment
are outside this implementation. Builds fetch the existing Geist interface
fonts through Next.js; document fonts are in the local compiler bundle.

Agent guidance is in [AGENTS.md](AGENTS.md). Template/compiler maintenance is
covered by the repository's `resume-latex` skill.

The implementation checklist and handoff are in
[UI refactor progress](docs/ui-refactor-progress.md). Future account/storage
boundaries are documented in [implementation notes](docs/implementation-notes.md).
