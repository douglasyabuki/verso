# Resume Manager — Application Requirements

This checklist defines a complete first release of a personal, cloud-backed resume application. Completion means the application is deployed and the acceptance scenarios at the end pass, not merely that its screens have been implemented.

## 1. Product scope and decisions

The application replaces repeated manual updates to English and Portuguese resumes and the portfolio's downloadable resume. Structured career content is the source of truth; LaTeX produces the PDFs. Everyday editing requires no LaTeX knowledge.

Working defaults: Next.js with TypeScript; managed authentication and a cloud database; object storage for published PDFs; an existing LaTeX resume adapted into one supported template. These are proposed implementation choices, not requirements to use a specific vendor.

- [ ] Document the selected authentication, database, file-storage, and hosting providers and how they fit together.
- [ ] Select the LaTeX engine and compilation environment after successfully compiling the existing resume template, including its fonts, packages, links, and Portuguese accents.
- [ ] Decide whether compilation runs in the browser or in an isolated service. Confirm its compatibility, deployment constraints, and dependency licenses before building the rest of the rendering pipeline around it.
- [ ] Define the first release as a private personal editor with public, read-only published outputs. Account creation for arbitrary visitors is outside this release.
- [ ] Record supported browsers, supported page sizes, and the default page-count target. One supported template is sufficient for completion.

## 2. Authentication and access from anywhere

- [ ] The owner can sign in, sign out, and regain access through the chosen provider's recovery mechanism.
- [ ] Unauthenticated visitors cannot read drafts, revision history, private assets, or editor settings, or perform mutations.
- [ ] Ownership is checked on the server or database for every private resource; hiding controls in the interface is not the access-control mechanism.
- [ ] The owner can open the deployed app on another supported computer and access the latest saved content, templates, and variants.
- [ ] Expired sessions produce a clear sign-in prompt and preserve recoverable unsaved work without exposing it to another account.

## 3. Structured career content

- [ ] Store profile information, contact details, social links, summaries, work experience, projects, education, skills, certifications, and optional custom sections.
- [ ] Every reusable entry and localized bullet has a stable identifier, so variants and translations remain associated after reordering or renaming.
- [ ] Shared facts—dates, URLs, technologies, and other nonlocalized fields—are stored once and reused across language versions.
- [ ] Localized fields support separate `en-US` and `pt-BR` text without duplicating the entire career record.
- [ ] Dates are stored independently of their displayed language and support ongoing roles and projects.
- [ ] Entries can be created, edited, reordered, archived, and restored. Permanent deletion explains its effect on resume variants before confirmation.
- [ ] Required fields, date ranges, and URLs are validated with useful messages beside the relevant inputs.
- [ ] Structured content and template configuration have an explicit schema version and a migration path for future changes.

## 4. Editing without LaTeX syntax

- [ ] The main interface uses labeled forms for content and offers a compiled PDF preview alongside or readily accessible from the editor.
- [ ] The owner can add and reorder achievement bullets, manage links, select sections, and edit translations without entering LaTeX commands.
- [ ] Supported formatting is intentionally limited and documented, such as plain text, emphasis, and links. Formatting is represented structurally rather than as arbitrary executable LaTeX.
- [ ] All user-provided text is safely encoded for its LaTeX context, including special characters, accented letters, and link values.
- [ ] Template controls expose supported choices such as page size, spacing, and typography within validated limits.
- [ ] Empty optional fields and sections disappear cleanly from generated documents.
- [ ] The editor remains usable by keyboard, has visible focus states and accessible labels, and works on the screen sizes defined for this release.
- [ ] Destructive operations have confirmation or recovery, and failed operations do not silently remove content.

## 5. Bilingual workflow

- [ ] English and Portuguese wording can be reviewed together or switched without losing editing state.
- [ ] Editing localized source text marks the associated existing translation as needing review; it does not silently overwrite it.
- [ ] Missing translations and translations needing review are visibly distinguishable.
- [ ] The owner can mark a translation reviewed after checking it.
- [ ] Shared-fact changes appear in both language outputs without manual duplication.
- [ ] Section headings, date labels, and other template-provided text use the selected output language.
- [ ] Publishing a language with missing required text is blocked. Outstanding translation-review flags require explicit acknowledgment before publication.
- [ ] Each language can have different wording lengths and appropriate layout adjustments while referring to the same underlying entries.

Automatic translation is optional. Human-reviewed bilingual content is sufficient for this release.

## 6. Resume variants

- [ ] The owner can create, name, duplicate, and delete resume variants, such as general, frontend, and backend resumes.
- [ ] Each variant selects entries and individual bullets from the shared content library and controls their order and section visibility.
- [ ] Editing a shared entry updates every draft variant that references it; published revisions remain unchanged.
- [ ] Each variant can generate English and Portuguese outputs using the supported template.
- [ ] A default public variant is selected explicitly; private or job-specific variants are not exposed accidentally.

## 7. Saving, recovery, and version history

- [ ] Changes autosave to the cloud, with visible saving, saved, offline, and failed states.
- [ ] The interface only reports a successful cloud save after the server confirms persistence.
- [ ] Recoverable local drafts protect edits during connection loss or a page refresh, and the interface distinguishes them from cloud-saved content.
- [ ] Reconnection retries do not duplicate entries or silently overwrite a newer remote revision.
- [ ] Concurrent edits from two tabs or devices are detected; the owner can resolve the conflict without losing either version.
- [ ] Revision history supports inspecting and restoring an earlier saved snapshot. Restoration creates a new current revision.
- [ ] Signing out or changing accounts clears or appropriately isolates private local caches.

Full offline compilation and seamless real-time collaboration are not required.

## 8. LaTeX generation and compilation

- [ ] A deterministic renderer converts a specific content revision, variant, locale, and template version into `.tex` source.
- [ ] Engine, package, font, and template versions are pinned or otherwise controlled so outputs can be reproduced.
- [ ] Generated files are treated as artifacts; ordinary content edits happen in structured records, and layout changes happen in the template.
- [ ] The owner can export generated `.tex` and the template assets needed to compile it, subject to font and asset redistribution licenses.
- [ ] Compilation has visible pending, running, successful, failed, and timed-out states and can be retried.
- [ ] Compilation errors provide a useful explanation and diagnostic details without exposing secrets or unrelated filesystem information.
- [ ] A late compilation result cannot replace the preview for a newer edit. The preview identifies its content revision and whether it is out of date.
- [ ] Compilation uses bounded time, memory, input size, and concurrency. Server-side jobs have isolated temporary files, restricted filesystem/network access, and shell execution disabled unless a narrowly justified implementation requires otherwise.
- [ ] Temporary compilation files are cleaned up after success or failure, and repeated requests reuse suitable results rather than creating unlimited duplicate jobs.

Arbitrary third-party `.tex` imports, unrestricted template execution, and editing a PDF back into structured data are outside the first release.

## 9. PDF preview, navigation, and readability

- [ ] The preview displays the actual compiled PDF using a PDF viewer; a separate HTML approximation is not the final acceptance reference.
- [ ] The viewer supports page navigation, zoom, working hyperlinks, and access to text selection/search through the selected viewer's supported interface.
- [ ] PDF text is selectable and searchable, including Portuguese accents, punctuation, dates, and technology names.
- [ ] Email, website, repository, portfolio, and LinkedIn links point to the intended destinations.
- [ ] PDF metadata includes an appropriate document title, author, and language.
- [ ] An extracted-text view or equivalent diagnostic makes reading order and missing characters inspectable.
- [ ] Both languages are checked for sensible text-extraction order; essential information is not conveyed only through icons, graphics, or visual positioning.
- [ ] The app shows the compiled page count and warns when it exceeds the configured target. It does not silently remove content to fit.
- [ ] Representative PDFs have no clipped text, overlapping elements, broken characters, unintended blank pages, or detached headings.
- [ ] Check and document assistive-technology reading behavior. Do not claim PDF/UA conformance or universal recruitment-system compatibility without the corresponding validation.

Text-extraction checks are a diagnostic for machine readability, not a guarantee that every applicant tracking system will interpret the PDF identically. If formal tagged-PDF accessibility is a release requirement, select a compatible template/toolchain and add explicit conformance acceptance tests before implementation.

## 10. Downloads and backups

- [ ] The owner can download either language's PDF and generate/download both language outputs in one action.
- [ ] Filenames clearly identify the resume owner, locale, and variant where appropriate.
- [ ] PDF downloads correspond to an identifiable content/template revision and never silently mix old and new language outputs.
- [ ] A complete editable backup can be exported, including structured content, translations, variants, settings, and required template/assets or references to their bundled versions.
- [ ] Backup import validates its schema before modifying data and reports incompatible or malformed files clearly.
- [ ] Import explains whether it replaces or merges data, preserves a recovery snapshot, and does not publish imported content automatically.
- [ ] An exported backup can restore a working private draft in a clean test account or clean application environment.

## 11. Publication lifecycle

- [ ] Draft saves and public publication are separate actions.
- [ ] Publication presents the selected variant, locales, public fields, and the exact revisions being released for review.
- [ ] Published data is selected through an explicit public-field schema; private editor fields, history, and internal notes are excluded.
- [ ] The app compiles and validates all selected outputs before switching the public publication pointer.
- [ ] A failed publication leaves the previous working public release available. Visitors never receive a partially updated release.
- [ ] Published JSON and PDFs reference the same immutable release identifier.
- [ ] Published PDFs are stored and served as artifacts rather than compiled for every visitor request.
- [ ] The owner can inspect publication history, roll back to a previous complete release, and unpublish current outputs with clearly explained behavior.
- [ ] Historical asset visibility and retention are defined; unpublishing removes intended public access rather than merely hiding a link in the editor.

## 12. Public API and portfolio integration

- [ ] Provide a documented, versioned public JSON endpoint for each supported locale of the selected published variant, for example `/api/public/v1/resume?locale=en-US`.
- [ ] Provide stable public PDF URLs or endpoints for both locales, with documented behavior for unsupported locales and missing/unpublished releases.
- [ ] Public responses expose only approved published content and require no secret embedded in the portfolio frontend.
- [ ] Configure CORS for browser-based JSON requests from the production portfolio and explicitly supported development origins. Required preflight requests work.
- [ ] Private endpoints enforce authentication and ownership independently of CORS; CORS is not treated as authorization.
- [ ] PDF endpoints return correct content types, useful filenames, and download headers where download behavior is intended.
- [ ] Responses use appropriate caching/version identifiers, with a documented bound on how long visitors can see an older release after publication.
- [ ] The existing Vite portfolio displays its resume content from the published JSON and links its English and Portuguese download controls to the published PDF URLs.
- [ ] The portfolio has loading, unavailable, and empty states, and a deliberate fallback such as the last successfully published content.
- [ ] The production Vite portfolio can consume the deployed Next.js endpoints without authentication prompts or CORS failures.
- [ ] Publishing a new revision updates the portfolio within the defined cache window without manually replacing files or redeploying the portfolio.

Updating a separate portfolio repository is part of integration acceptance, even if that work happens outside this app's repository.

## 13. LinkedIn assistance

- [ ] Generate copy-ready localized summaries, experience descriptions, and project text from the shared content.
- [ ] The owner can compare relevant changes against a snapshot previously marked as copied to LinkedIn.
- [ ] The owner can mark the current LinkedIn text as manually applied, recording the corresponding revision and date.
- [ ] The interface clearly states that copying or marking text does not itself update LinkedIn.

Direct LinkedIn account integration and automatic posting/profile updates are outside this release.

## 14. Reliability, privacy, and deployment

- [ ] The app, database, asset storage, and chosen compiler are deployed and reachable through production HTTPS URLs.
- [ ] Database migrations, environment configuration, and deployment steps are documented and repeatable.
- [ ] Secrets remain server-side; database and storage permissions are verified using unauthenticated and unauthorized requests.
- [ ] Uploaded files, imported backups, and compilation inputs have validated types and size limits. Displayed links accept only intended URL schemes.
- [ ] Compilation and mutation endpoints have appropriate abuse controls and request limits, and authenticated browser mutations have protections appropriate to the selected session model.
- [ ] Logs identify failed saves, compilation jobs, and publications without routinely recording private resume content, session credentials, or secrets.
- [ ] A health check or monitoring mechanism makes production failures discoverable.
- [ ] Database and file backups have a retention policy, and at least one recovery exercise has been completed.
- [ ] The owner can export and delete personal content, with documented treatment of published artifacts and retained backups.
- [ ] Define measurable save, preview, and public-download response targets; measure them against representative resumes on the selected production infrastructure.
- [ ] Setup documentation covers local development, compilation dependencies, backups, restore, deployment, and common failure recovery.

## 15. Agent guidance and maintainability

- [ ] Repository `AGENTS.md` records the source-of-truth model, generated-file policy, supported locales, architecture boundaries, and required verification commands.
- [ ] A repository skill at `.agents/skills/resume-latex/SKILL.md` documents template editing, compilation, font/package conventions, and PDF verification.
- [ ] The skill requires checking both language outputs after template changes, including visual inspection, links, and extracted text.
- [ ] Repeatable compilation and validation are available as scripts or tests; application operation does not depend on an AI agent following a skill.
- [ ] Automated checks cover access control, content validation, locale/variant rendering, special-character encoding, publication consistency, and public API contracts.
- [ ] Automated integration checks cover save recovery/conflicts and compiler/publication failures without replacing visual review of representative PDFs.
- [ ] Reference fixtures include Portuguese accents, LaTeX special characters, long titles, long URLs, empty optional fields, and content near page boundaries.

## 16. End-to-end completion scenarios

Check these only against the deployed application and integrated portfolio.

- [ ] **Initial setup:** Sign in, enter or migrate the existing resume content, review both translations, and generate PDFs matching the required template behavior.
- [ ] **One edit, multiple outputs:** Add a project once, enter its English and Portuguese wording, select it in a variant, and generate both PDFs without editing LaTeX.
- [ ] **Translation maintenance:** Change an English bullet, see the Portuguese review flag, update that translation, and clear the flag without changing shared facts twice.
- [ ] **Cross-device use:** Save an edit on computer A, open computer B, and find the latest saved content and working preview.
- [ ] **Interrupted saving:** Lose connectivity during editing, refresh if supported by the local-draft design, recover the draft, reconnect, and save without data loss.
- [ ] **Conflicting edits:** Edit the same record in two tabs/devices and resolve the conflict without silently discarding either version.
- [ ] **Private drafts:** Edit a published project and verify that visitors still see the previous release until a new publication is completed.
- [ ] **Publication:** Publish both languages, confirm JSON and PDFs belong to the same release, and see the updated portfolio without replacing files or redeploying it.
- [ ] **Failed publication:** Trigger a controlled compilation/storage failure and confirm the previous public release remains usable.
- [ ] **Rollback:** Restore a prior public release and confirm the portfolio and both PDF links resolve consistently to it after the documented cache window.
- [ ] **PDF quality:** Verify both languages visually, inspect extracted text, test links/search/selection, and resolve page overflow or explicitly accept it.
- [ ] **LinkedIn workflow:** Copy updated text, apply it manually, and mark the matching revision as applied.
- [ ] **Backup recovery:** Export editable data, restore it into a clean environment, and regenerate the selected bilingual variant successfully.
- [ ] **Access control:** Confirm a visitor can retrieve public outputs while private data and mutations remain inaccessible.
- [ ] **Operational readiness:** Complete deployment, recovery documentation, monitoring, license review, and the required automated checks with no unresolved release-blocking failures.

## Explicitly deferred features

The following are not needed to call this release complete: public SaaS registration, billing, collaborative editing, arbitrary LaTeX project imports, a template marketplace, direct editing of PDF contents, automatic translation or AI rewriting, automatic LinkedIn updates, additional output languages, and formal PDF/UA certification unless separately adopted as a requirement.

Any deferred feature added later should receive its own acceptance criteria rather than silently expanding this checklist.
