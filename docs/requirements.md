# Verso — Requirements and implementation order

Updated: 2026-11-02.

This replaces the previous bilingual cloud-release checklist. It defines the next
local-editor milestone and future account/public-download work, not delivered
features. README.md describes the current implementation.

## Confirmed direction

- Design the app the owner needs, even when that requires replacing or recreating
  existing features. Current code is a reference and reusable asset, not a product
  constraint. Preserve user data and safety guarantees, not obsolete architecture.
- Career details define available information; resumes select what appears;
  layout controls its presentation. Hiding fields never deletes career data.
- Address single-language use, languages beyond en-US/pt-BR, differing content and
  fields across language versions, and the burden of mandatory translation review.
- Use a language-agnostic model with user-selected languages, no mandatory locales,
  fixed language count, or hardcoded counterpart. English and Portuguese remain
  desired output languages through the same extensible mechanisms as other locales;
  existing support must not dictate the new architecture.
- Provide a settings menu.
- Future work: login similar to `temp/dayplan`, authenticated storage through
  Prisma ORM with Prisma Postgres, and synchronization across tabs and browsers.
- Future downloadable resumes provide a PDF URL for a specified or latest version.
- Routes for every view and explicit Save actions remain undecided.

## Recommended design, subject to phase-0 decisions

- One language per resume, with independent selection, field visibility, order,
  wording, and layout; shared Career details retain reusable identities and facts.
- Optional groups and directional translation relationships between resumes.
  Independent adaptations need not convey identical content.
- Layout presets save appearance. Resume starters save initial sections/order,
  field defaults, and layout. Duplicate resume copies specific content selections.
- Presets/starters copy configuration on application, without live inheritance.
- Routes for durable destinations; local state for transient controls and typing.
- Preserve recoverable editing/autosaving initially; control PDF refresh separately.
  Measure memory consumption before introducing explicit Save as its remedy.
- Public latest links follow the latest successfully released version, separately
  from draft saving. Confirm that meaning before implementing public links.

These are recommendations, not blanket owner approval. Record consequential
decisions before dependent implementation; do not silently convert proposals into
confirmed requirements. Future infrastructure choices need not block local work.

## Delivery rules

- Work in phase order and dependency order within phases, through complete slices.
- Phases 0–7 are the proposed next local milestone. Phases 8–11 are future work;
  wait for owner activation before installing dependencies or building that work.
- Read root/applicable nested AGENTS.md, relevant installed Next.js guides, and
  task-specific skills. Preserve framework settings, selected versions, npm lockfile,
  and generated Next.js guidance. Do not copy Dayplan dependencies wholesale.
- Root AGENTS.md still describes bilingual schema 1 and local-only scope. Reconcile
  affected guidance during accepted product changes; this roadmap does not silently
  override implementation instructions or remove unrelated constraints.
- Deliver useful editing, accessibility, undo/redo, safe saving, recovery, backups,
  and deterministic rendering under the target design. Refactor, replace, or rebuild
  workflows, schemas, review rules, inheritance, and UI where needed; reproducing
  current behavior is not acceptance unless that behavior serves an accepted
  requirement. Preserve valuable user data through explicit backup/conversion,
  and disclose intentionally changed or retired behavior.
- Automated tests are in scope as of 2026-11-02, superseding the earlier exclusion.
  Add meaningful behavior/regression coverage alongside each implementation slice.
  Use Vitest Node for domain rules and controlled async behavior, Vitest Browser
  Mode for interactive components, and Playwright for complete application flows.
  Configure missing runners only with real initial coverage; no empty suites,
  passWithNoTests, or implementation-shaped assertions.
- Application changes require format:check, lint, typecheck with route generation,
  and build under repository guidance, plus relevant non-watch automated tests and
  meaningful manual verification. Confirm executed file/test counts; starter smoke
  tests alone are not product acceptance coverage. Use isolated databases when
  database behavior is the contract; mocks do not prove real persistence or OAuth.
  Documentation-only changes need formatting and local-link validation.
- Record actual checks, failures, skipped checks, and blocked infrastructure.
  Builds do not prove browser, PDF, OAuth, synchronization, or database behavior.
- Update affected project artifacts in the same implementation slice: this
  checklist and accepted decisions, README usage/setup/current behavior, applicable
  AGENTS.md and repository skills, architecture/compiler documentation, schema and
  backup-format documentation, and configuration/environment examples. Update only
  artifacts affected by the change; distinguish current behavior from future plans.
  Keep links and examples valid, preserve customizations/generated guidance, and
  never copy secrets into documentation. Generated outputs follow their existing
  generation policy. Check off requirements only with recorded acceptance evidence.

## Phase 0 — Decisions and migration plan

- [ ] P0.1 Audit current career, language, resume, review, layout, backup, navigation,
      saving, and compiler contracts; document relevant baseline findings.
- [ ] P0.2 Settle resume/language ownership. Recommended: independent one-language
      resumes. Compare multilingual resumes with independent per-language selections;
      obtain the owner's decision before changing dependent contracts.
- [ ] P0.3 Specify user-selected languages and extensible locale capabilities for
      wording, labels, formatting, fonts, and compilation. English/Portuguese are
      desired outputs, not mandatory workspace languages or architectural exceptions.
      Distinguish editable content, verified PDF support, and interface-language
      scope; do not promise arbitrary scripts. Do not add Spanish solely to prove
      extensibility; settle any extra locales and interface localization explicitly.
- [ ] P0.4 Settle preset/starter scope and whether base career fields means initial
      field definitions, default visibility, or specific preselected career records.
- [ ] P0.5 Decide which durable views get routes, deep-link/reload and Back/Forward
      behavior, and which transient interactions remain local.
- [ ] P0.6 Decide saving separately from preview: memory edits, recovery, durable
      save, compilation, and release. If explicit Save wins, define Save/Cancel scope,
      dirty navigation, validation, undo, failure/retry, conflicts, and shared-edit effects.
- [ ] P0.7 Specify schema versioning, raw backup, and recovery before migration.
      Protect valuable data with previewed conversion where meaningful; never
      reinterpret schema-1 data silently. Do not retain the old schema or behavior
      merely to simplify compatibility. Explain unsupported/retired metadata and
      preserve the original backup without overwriting existing work.
- [ ] P0.8 For one-language resumes, map each bilingual variant to two resumes,
      preserving valuable career content, associations, selections, and customized
      wording. Carry over appearance/review metadata only where meaningful under
      the target design; disclose changes instead of rebuilding obsolete inheritance
      or review solely for parity. Set collection limits from target needs and
      conversion size, rather than retaining the existing 30-variant limit by default.
- [ ] P0.9 Reconcile affected AGENTS.md scope/schema/language guidance with accepted
      decisions, preserving unrelated rules and generated blocks.
- [ ] P0.10 Audit existing Playwright coverage and define test boundaries. Before
      schema conversion, establish meaningful baseline coverage for backup validation,
      identity/reference integrity, desired output selection/settings, and safe
      replacement behavior. Configure Vitest Node with these real cases; add Browser
      Mode when the first interactive slice requires it. Record runner commands,
      discovery patterns, isolation, and installed-version compatibility. Tests
      protect accepted contracts and valuable data, not incidental old UI or behavior.

Exit: decisions and conversion mapping recorded before dependent code.

## Phase 1 — Career information and language contracts

- [ ] P1.1 Career details own available sections, fields, facts, and reusable wording.
      Resume selection and layout do not define which career information can exist.
- [ ] P1.2 Preserve stable section/entry/field/achievement/link identities through
      rename, reorder, archive, localization, and conversion; duplication creates
      independent identities where appropriate.
- [ ] P1.3 Represent active content languages explicitly. One is sufficient; adding
      another does not require translating the entire library. Remove fixed-pair
      assumptions from accepted new contracts.
- [ ] P1.4 Separate facts from localized display wording. Audit organizations,
      degrees/titles, locations, headings, and link labels without duplicating records.
- [ ] P1.5 Define field types/validation from the target information model, reusing
      existing rules where they fit. If custom field definitions are approved,
      define types, labels, IDs, order, deletion impact, and output support in Career
      details; avoid building an incidental unrestricted form designer.
- [ ] P1.6 Keep interface language distinct from output language. Removing/deactivating
      a language explains dependent resumes and retained wording without silent deletion.
- [ ] P1.7 Implement conversion, factories, validation, and backup import/export
      together. Manually round-trip old/new fixtures on disposable workspaces,
      preserving the user's original data and recovery path.
      Add automated conversion/round-trip coverage, including invalid input,
      meaningful preserved content/associations/customizations, disclosed setting
      changes, collection expansion, and no mutation
      of the original workspace on rejection or failed conversion.

Exit: single-language data works without a counterpart; extra languages and old
workspace handling have explicit, safe contracts.

## Phase 2 — Independent resumes and output fields

These criteria express the recommended model; revise explicitly if P0.2 selects
another model.

- [ ] P2.1 Create/name/duplicate/open/delete resumes with a language visible in their
      collection cards and active header.
- [ ] P2.2 Independently select/order sections, entries, achievements, contact fields,
      and relevant career-entry fields. Language resumes can differ without copied facts.
- [ ] P2.3 Distinguish excluded, empty, required, and unsupported fields. Explain
      structural minimums; hiding optional values retains their career data.
- [ ] P2.4 Support customized wording/reset-to-shared and clarify edit scope. Shared
      facts update dependent drafts; custom text remains. Archive/deletion effects
      are explicit and recoverable.
- [ ] P2.5 Provide translated-copy creation using shared career identities with
      independent selection/presentation. Tracking is separate; no implied automatic translation.
- [ ] P2.6 Optional grouping organizes without forcing shared content/settings/saves/
      releases. Comparisons show language/effective content; downloads identify exact snapshots.

Exit: demonstrate English-only use and English/Portuguese resumes with differing
fields, achievements, ordering, and layout.

## Phase 3 — Optional tracking and focused readiness

- [ ] P3.1 Single-language use has no counterpart tasks or bilingual confirmations.
      Another language alone creates no equivalence promise or automatic review debt.
- [ ] P3.2 Explicit directional relationships record source/target IDs/languages and
      acknowledged source revision, without all-to-all flag propagation.
- [ ] P3.3 Source changes offer a nonblocking reminder: update, acknowledge keeping
      the adaptation, or stop tracking. Never overwrite text or acknowledge stale snapshots.
- [ ] P3.4 Separate translation reminders from shared same-language text changing
      beneath an override; acknowledging one does not clear the other.
- [ ] P3.5 Validate required wording only for selected output. Inactive languages,
      hidden fields, unused entries, and archives do not block the active resume.
      Invalid selected facts/unsafe selected links remain actionable errors.
- [ ] P3.6 Active-resume readiness is primary. Any global queue makes unused/archive
      scope explicit and secondary. Preserve comparison/field navigation; intentional
      differences and review reminders do not block valid private downloads.

Exit: intentional adaptations create no compulsory review debt; opted-in tracking helps.

## Phase 4 — Layout presets and resume starters

Implement P0.4's accepted scope. Presets are distinct from template engines. Reuse
or adapt the bundled renderer where it fits; replace relevant rendering mechanisms
when necessary for the accepted language/field/layout design. This does not imply
adding a freeform designer or marketplace.

- [ ] P4.1 Layout controls positioning, typography, paper, spacing, and colors of
      selected fields. Switching layout preserves data/selections and explains unsupported fields.
- [ ] P4.2 Save/name/apply/duplicate/delete layout presets with preview/undo. Presets
      contain appearance, not private career text or source-resume references.
- [ ] P4.3 Save/use starters with approved sections/order, field defaults, and layout.
      Any included field definitions reconcile without ID collisions or silent replacement.
- [ ] P4.4 Keep selected jobs/achievements/custom wording in Duplicate resume unless
      content-bearing starters are separately approved and labeled.
- [ ] P4.5 Copy settings on application. Editing/deleting starters does not mutate
      existing resumes or add live inheritance/review obligations.
- [ ] P4.6 Offer starters in Create resume and presets in Layout. Include them in
      backup/recovery/undo. Map useful existing appearance settings where practical
      and disclose changed output; do not recreate four-scope inheritance solely for parity.

Exit: reusable structure/appearance never owns career data or unexpectedly changes resumes.

## Phase 5 — Settings and navigation

- [ ] P5.1 Discoverable settings menu covers appearance, content languages, editing/
      preview, data/backups, and defaults. Account controls wait for account implementation.
- [ ] P5.2 Distinguish local preferences, document configuration, and future account
      settings; state backup/sync scope. Consolidate controls without losing recovery or diagnostics.
- [ ] P5.3 Implement P0.5. Routes, if adopted, support deep links, reload, Back/Forward,
      validated IDs, and useful missing-resource states. Never expose resume text/secrets in URLs.
- [ ] P5.4 Establish coherent workspace/controller ownership and compiler lifecycle;
      protect edits, focus,
      scroll, issue links, narrow-screen access, and dirty-edit policy across navigation.
      If navigation remains local, document its limitations rather than adding fake URLs.

Exit: settings/navigation consistently follow the recorded policy.

## Phase 6 — Saving and bounded PDF resources

Saving less often does not prove lower PDF memory use. Persistence, history,
compilation, and rendering consume different resources.

- [ ] P6.1 Measure extended sessions: compilers, pending work, retained PDFs, viewer
      documents/workers/canvases, object URLs, and history bounds where inspectable.
- [ ] P6.2 Follow P0.6 with distinct truthful recovery, save, preview, backup, and
      future release statuses.
- [ ] P6.3 Manual refresh is independent of saving. Optional automatic refresh
      compiles only active output-affecting changes.
- [ ] P6.4 Bound concurrent/pending work, supersede stale requests, reject late results,
      release obsolete PDF/worker/canvas/URL resources, and define hidden-preview behavior.
- [ ] P6.5 Preserve a labeled last successful preview on failure, identifying revision,
      stale state, diagnostics, and retry.
- [ ] P6.6 If explicit Save is approved, implement agreed Save/Cancel, recovery, dirty
      navigation, validation, undo, and conflicts. Save without compile is possible;
      refresh/export identify draft versus committed snapshot use.
- [ ] P6.7 Ensure coordinated conditional guest writes/replacements, session-only
      recovery, and other-tab conflict protection regardless of save mode. Reuse
      Web Locks/reviewed tokens or replace them with verified equivalent safeguards;
      the safety contract matters more than preserving implementation details.
- [ ] P6.8 Manually verify rapid edits/switches, hidden previews, failures/timeouts,
      and long sessions against recorded resource bounds.

Exit: deliberate saving behavior and evidenced bounded preview resources.

## Phase 7 — Local acceptance and documentation

- [ ] P7.1 Verify one-language onboarding/editing/export, independent language resumes,
      visibility/order, shared facts, custom wording, and optional tracking.
- [ ] P7.2 Verify each added output language's labels, dates/regions, fonts, hyphenation/
      direction where applicable, metadata, links, selectable/searchable text, and layout.
      Clearly disable unsupported PDF output instead of silently using wrong labels/glyphs.
- [ ] P7.3 Verify approved presets/starters, settings, routing, save/preview, undo,
      keyboard access, and narrow layouts.
- [ ] P7.4 Restore old-converted/new backups on disposable origins; verify identities,
      wording, order/selection, appearance, and recovery. Invalid imports preserve current
      work; imports never publish anything.
- [ ] P7.5 Inspect actual PDFs with accents/special characters, long titles/URLs,
      optional omissions, and page overflow; exercise failure/stale results. Page counts
      do not prove clipping detection, PDF/UA, or universal ATS compatibility.
- [ ] P7.6 Run required static checks/build, record manual evidence/limitations, update
      README/applicable guidance and all other affected project artifacts.
- [ ] P7.7 Run relevant Node, browser-component, and application-flow suites with
      actual file/test/pass/fail/skip counts. Cover single-language use, independent
      selection, optional tracking, persistence conflicts/recovery, stale compiler
      results, and approved navigation/save behavior at appropriate boundaries.
      Test observable contracts with independent expectations, not private structure;
      retain manual visual/PDF inspection and do not hide failures with skips/retries.

Exit: verified local milestone. Future phases await explicit activation.

## Phase 8 — Future authentication and Prisma Postgres storage

Prerequisites: stable local model, owner activation, approved infrastructure. Read
auth/persistence and Prisma setup skills before implementation.

- [ ] P8.1 Inspect Dayplan login, isolation, guest import, recovery, and revision-aware
      saving as references. Verify source/selected-version official docs; do not blindly
      copy credentials, versions, schemas, or stale README claims. Better Auth
      Google/GitHub is the reference direction.
- [ ] P8.2 Record provider/access policy, sessions, runtime/hosting, Prisma version/
      driver, and Prisma Postgres connection choice. Keep secrets/auth/clients server-only.
- [ ] P8.3 Implement login/logout/expiry recovery/account settings and server ownership
      checks for every private read/write; guessed IDs cannot expose drafts.
- [ ] P8.4 Persist validated user-owned career data, resumes, relationships, starters/
      presets, and applicable settings. Choose snapshot versus normalized storage from
      actual consistency/query needs.
- [ ] P8.5 Confirm durable writes after acknowledgment; revision checks and idempotent
      operations prevent stale overwrites/duplicate retries.
- [ ] P8.6 Preserve guest use and explicit previewed import. Login never silently
      merges/replaces account work; define mapping, retries, and cleanup preserving newer guest edits.
- [ ] P8.7 Isolate caches/recovery by account/workspace. Logout/switching preserves or
      resolves pending work without cross-account exposure; guest data stays separate.
- [ ] P8.8 Add isolated-database integration coverage for ownership, durable writes,
      stale revisions, idempotent retries, import, and account isolation; use controlled
      provider-boundary tests for deterministic auth behavior. Manually verify real
      callbacks/expiry. Record blocked infrastructure rather than claiming completion.

## Phase 9 — Future tab, browser, and device sync

Guest tab coordination remains local scope. Browser/device sync needs authenticated
shared storage; localStorage alone cannot provide it.

- [ ] P9.1 Detect revisions on focus/reconnect and a documented periodic/event mechanism;
      specify/measure freshness and apply clean updates without discarding dirty drafts.
- [ ] P9.2 Coordinate local tabs; server revision checks remain authoritative across
      browsers/devices. Web Locks cannot prevent cross-device conflicts.
- [ ] P9.3 Preserve local/remote conflict versions with comparison, export, reload,
      and explicit resolution; no silent full-workspace last-writer-wins.
- [ ] P9.4 Recover edits through network loss/refresh and retry safely. Bound recovery/
      history retention; restoration creates a new revision. Define settings sync scope.
- [ ] P9.5 Verify separate tabs/browser profiles/devices, simultaneous saves, sleeping
      tabs, offline recovery/retries, account changes, and expiry.
      Automate reproducible conflict, stale-response, retry, and recovery scenarios;
      retain manual checks across actual browsers/devices.

Full coauthoring and automatic semantic merging are not required.

## Phase 10 — Future downloadable resumes and versioned URLs

Prerequisites: accounts, persistence, hosted artifacts, and explicit latest policy.
A local blob URL is not a public share URL.

- [ ] P10.1 Owner marks a specific resume downloadable after reviewing its selected
      public content/language; private resumes remain private.
- [ ] P10.2 Store immutable PDF releases identifying resume/content revision, locale,
      template/runtime, settings, and artifact. Compile/store before exposure, not per visitor.
- [ ] P10.3 Provide pinned and stable latest URLs. Recommended latest advances through
      explicit release of a valid saved snapshot. Automatic saved-version release, if
      chosen, needs explicit opt-in/privacy semantics; typing is never implicit publication.
- [ ] P10.4 Advance latest atomically after successful validation/storage. Failure
      preserves the old link; pinned bytes never silently change. Drafts/presets/imports
      cannot mutate existing release artifacts.
- [ ] P10.5 Expose only released PDFs/intended metadata, not editable backups, career
      libraries, internal names, or private data. Define public versus unlisted access;
      unlisted URLs are not authentication.
- [ ] P10.6 Provide copy-link, history, latest inspection, retained-release rollback,
      disable/revoke controls, and defined deletion/retention/missing-link behavior.
      Define cache invalidation; downloaded files cannot be recalled.
- [ ] P10.7 Serve correct PDF type, attachment disposition, filenames, and version-aware
      caching with a documented latest-link freshness bound.
- [ ] P10.8 Verify hosted anonymous downloads, denied private access, pinned stability,
      latest advancement/failure, rollback, revocation, caches, and artifact/cost bounds.
      Add integration/application-flow coverage for release atomicity, authorization,
      pinned/latest behavior, and failed publication preserving the previous release.

## Phase 11 — Future hosted-release readiness

- [ ] P11.1 Document hosting/env/callbacks, Prisma migrations, artifact permissions,
      compiler assets, and recovery. No destructive setup against shared/production data.
- [ ] P11.2 Define account/artifact deletion, backup/log retention, restore procedures;
      perform a recovery exercise.
- [ ] P11.3 Bound input/backup sizes, compilation, mutation/download abuse, and artifacts
      without routinely logging private resume content.
- [ ] P11.4 Verify HTTPS, ownership/origin protections, isolation, caching, browsers,
      and measured save/sync/preview/download targets.
- [ ] P11.5 Record actual hosted acceptance and limitations in project documentation; local
      screens or mocks are not deployment evidence.

## Deferred unless separately requested

Portfolio JSON/public APIs and other-repository integration; LinkedIn assistance;
automatic translation/AI rewriting; arbitrary LaTeX imports/executable user templates;
template marketplace/freeform designer; billing; coauthoring; all-script PDF promises;
formal PDF/UA; automatic public release of drafts.

These are not prerequisites for the local-editor or public-PDF-link milestones.
