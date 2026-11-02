# Verso — Requirements and implementation order

Updated: 2026-11-02.

This replaces the previous bilingual cloud-release checklist. It defines the next
local-editor milestone and future account/public-download work, not delivered
features. README.md describes the current implementation.

## Confirmed direction

- Design the app the owner needs, even when that requires replacing or recreating
  existing features. Current code is a reference and reusable asset, not a product
  constraint. Protect data created under this roadmap's target contracts and their
  safety guarantees.
- Career details define available information; resumes select what appears;
  layout controls its presentation. Hiding fields never deletes career data.
- Address single-language use, languages beyond en-US/pt-BR, differing content and
  fields across language versions, and the burden of mandatory translation review.
- Use a language-agnostic model with user-selected languages, no mandatory locales,
  fixed language count, or hardcoded counterpart. English and Portuguese remain
  desired output languages through the same extensible mechanisms as other locales;
  existing support must not dictate the new architecture.
- Schema 2 is the sole supported workspace schema. The app is development-only,
  with no production deployment or users; schema-1 compatibility, migration, and
  legacy regression coverage are out of scope. Test the new target contracts.
- No phase requires backward compatibility with the code, development storage,
  backups, settings, routes, or behavior that predates this roadmap's target
  implementation. Reuse existing code only where it serves the target contracts;
  no migration or behavior-parity work is required for that baseline. Keep continuity
  between roadmap steps: later phases must honor earlier accepted contracts and
  protect target data, recovery, and released artifacts created under them.
- Provide a settings menu.
- Future work: login similar to `temp/dayplan`, authenticated storage through
  Prisma ORM with Prisma Postgres, and synchronization across tabs and browsers.
- Future downloadable resumes provide a PDF URL for a specified or latest version.
- Durable routes and explicit entry/form Save/Cancel are accepted. Preview is
  manual by default; optional automatic refresh uses committed output changes.

## Accepted decisions and remaining work

This document is the self-contained source for accepted product and technical
contracts, the test specification, and ordered implementation work. The accepted
contracts below are part of the requirements, not delivered behavior. README.md
continues to describe the current application.

Phase 0 is complete as a decision specification. Implementation, transaction
verification, capacity checks, and measurements remain outstanding. Future account
implementation and public-release policies still require their respective phase
activation. This documentation update does not start phase 1.

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
  requirement. Protect schema-2 content through explicit backup/recovery,
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

## Accepted product and technical contracts

These contracts complete phase 0. Tests described here are implementation
obligations; their inclusion does not claim execution or acceptance. Form-draft
boundaries and dirty-route guards accompany their first interactive slices.

### Accepted target model

- Each resume has one user-selected language and independent selection, field
  visibility, order, wording, and layout. Career details own shared records and
  stable identities. No mandatory language pair or count.
- The interface remains English. Content languages are extensible; this milestone
  verifies English and Portuguese PDF output. Other languages can be edited and
  backed up, but PDF output must be disabled until labels, date/region formatting,
  fonts, hyphenation/direction, metadata, and text extraction are verified. No extra
  language is added solely to demonstrate extensibility.
- Translation tracking and resume groups are deferred entirely. Do not implement
  directional relationships, translation acknowledgments, counterpart flags, or
  translation-review queues. Selected-output readiness remains in scope.
- Use purpose-built fields for experience, education, projects, skills, and
  certifications, plus custom sections using supported fields. User-defined field
  types and a generic form designer are deferred.
- Shared facts include dates, URLs, and credential values. Reusable display wording
  includes summaries, achievements, headings, titles, organization/location names,
  and link labels. A resume can customize any display wording without copying the
  career record or changing its facts.
- Text inherits Career details until explicitly customized. Shared changes update
  inheriting resumes; customized text stays unchanged. **Use career wording** removes
  the customization. Labels distinguish editing shared wording from editing this
  resume. No shared-wording acknowledgment workflow is required.
- Layout presets contain appearance only. Starters copy empty section structure,
  section order, field visibility defaults, and layout. Neither contains selected
  jobs, achievements, or personal wording. Duplicate resume handles content reuse.
  Applying a preset/starter copies configuration; subsequent changes or deletion
  cannot mutate existing resumes through live inheritance.

Rationale: independent applications can differ without duplicating facts. Shared
wording supports corrections across resumes while explicit overrides support
tailoring. Omitting tracking/groups and custom field definitions limits unnecessary
workflow and rendering complexity.

### Language lifecycle

- Deactivation hides a language from new-resume creation choices and retains all
  career wording, overrides, and existing resumes. Reactivation restores the choice.
  Existing resumes remain editable and do not appear disabled or invalid because
  their language is inactive. Activation status, English interface language, and
  verified PDF support are separate concerns; deactivation does not revoke verified
  output support, and activation does not grant it.
- **Create copy in another language** creates an independent resume using the same
  career identities, selection, and order, with destination-language career wording.
  Keep the original resume and its custom wording intact. Missing destination
  wording remains missing; there is no automatic translation or silent fallback to
  source-language wording.
- Preserve compatible layout settings in the copy. Warn when the destination
  language requires different fonts or rendering support. Never promise identical
  appearance across languages; PDF availability still requires verified support.
- In-place resume language changes and permanent erasure of a language's wording
  are deferred from this local milestone.

### Archive, restore, and deletion

- Shared career content supports archive/restore only in this milestone. Archiving
  hides it from new-selection lists without removing its existing resume selections
  or changing their rendered appearance. Restore makes it available for selection again.
- Existing resume selections show an **Archived** label in the editor and allow
  removal from that resume. The label is editing metadata, not resume output content.
  Archive status alone does not invalidate selected output.
- Defer permanent deletion of shared career content until affected references,
  customized wording, and durable recovery have defined behavior. Undo alone is
  not durable recovery.
- Resume deletion remains a separate action with confirmation. Deleting a resume
  must never delete its shared career content.

### Navigation, editing, saving, and preview

- Durable routes cover Career details, individual sections, the resume collection,
  resume Content/Wording/Layout views, and Settings. Deep links, reload, and browser
  Back/Forward restore the destination. Use IDs, never resume text or secrets, in
  URLs. Missing resources have useful recovery navigation. Dialogs, typing, and
  preview zoom remain local state.
- Explicit Save/Cancel operates on one editing scope: a career entry including its
  achievements and links; profile; summary; section properties; resume wording;
  resume content/order; or layout/settings form. Each shows unsaved state. Selection
  and sorting remain drafts until Save; Cancel restores them together.
- Typing does not commit workspace changes, write to the account database, compile PDFs, or
  add committed workspace undo steps. Local draft recovery is a separate boundary.
  Each successful form Save commits one validated edit and one workspace undo step.
  Explicit create/archive/restore and permitted delete commands remain distinct
  from ordinary typing.
- Save preserves incomplete progress, including missing titles, dates, or wording.
  Entered malformed values such as invalid dates or unsafe links fail with specific
  messages and leave the draft intact. Output readiness is distinct from saveability.
- Leaving a dirty scope offers **Save**, **Discard**, or **Stay**. Save navigates only
  after validation and commit succeed; Discard removes pending changes; Stay keeps
  editing. Apply this to internal navigation and Back/Forward. Browser close/reload
  uses best-effort native warnings and recoverable local drafts, not a promised
  custom three-choice close dialog. No multi-form draft manager.
- Recovered drafts are distinguishable from saved workspace content and require
  explicit restoration. Save failures retain drafts; no false saved status.
  Session-memory-only commits require an explicit choice. Preserve conflict
  protection and undo; recovery storage and retention are defined below.
- While a form is dirty, keyboard undo/redo stays within the draft. Exhausting
  field/draft history never falls through to committed workspace history.
- Invoking workspace Undo/Redo with a dirty form requires resolving the draft with
  **Save**, **Discard**, or **Stay**. Explain that resolution does not execute the
  pending history action: after Save or Discard, the user invokes workspace
  Undo/Redo separately. Stay keeps editing. In particular, workspace Undo after a
  successful Save would undo that newly saved edit.
- One successful Save creates one atomic workspace history step. Cancel/Discard
  creates none. Recovery restoration opens an uncommitted draft and creates no
  workspace history step; only a subsequent successful Save commits it.
- Preview defaults to manual **Refresh preview**, shows when outdated, and remains
  independent of saving. Optional automatic refresh responds only to committed,
  output-affecting changes, never unsaved forms. Export validates only the selected
  resume and its language; unused incomplete career records cannot block it.
- Keep a labeled last successful preview on failure. Bound queued/active work and
  release obsolete resources. Measure input responsiveness, storage, history, and
  preview/rendering separately; explicit Save alone is not evidence of lower delay
  or memory use. The acceptance budgets below require representative measurements.

### Draft conflicts and interrupted saves

- Recovery records retain the editing scope, its baseline values, the starting
  committed revision, and the uncommitted draft. A revision change elsewhere in
  the workspace does not by itself make this form conflict; compare the relevant
  scope and baseline while preserving unrelated committed changes.
- Another tab's save never discards a dirty local draft. Changes affecting its
  scope flag a conflict. Restoring a stale draft never silently overwrites current
  committed content.
- Offer **Compare**, **Reconcile**, **Discard recovered draft**, or **Export recovery**.
  Preserve the recovered and committed versions until resolution succeeds. Explicit
  discard resolves the recovered draft without changing committed content; export
  alone does not discard it. Reconciliation remains an uncommitted draft until Save.
- Recheck current state atomically with the Save commit; an earlier comparison or
  reconciliation view may already be stale. A conflict or failed reconciliation
  leaves the draft recoverable and current committed content intact.
- Give each Save a stable operation ID. Check an interrupted response against
  committed operation state, or retry the same operation without creating another
  commit or workspace history step. Preserve the operation identity across recovery
  and retries; do not interpret a missing response as proof that the Save failed.

### Draft recovery retention

- Unresolved drafts have no automatic expiry. Retain them across reloads and browser
  restarts until successfully saved or explicitly discarded. Exporting recovery
  does not resolve or remove the draft.
- Retention is an application policy, not a guarantee of recovery: browser storage
  may be cleared or evicted outside the app's control. Show recovery-write failures
  promptly, explain when newer edits lack durable recovery, and offer export.
- Never silently evict unresolved drafts to free space. Cleanup of resolved drafts
  and Save operation records must not remove unresolved work or undermine pending
  interrupted-save checks/retries.
- Remove resolved draft recovery content immediately after confirmed Save or explicit
  Discard; retry failed cleanup on the next workspace load. Cleanup targets the exact
  resolved draft version and must not delete newer edits created while Save was
  pending. Clear saved draft recovery only after confirming its corresponding commit.
- Retain completed Save operation records using configurable defaults of **30 days
  or 1,000 completed operations per workspace, whichever limit is reached first**.
  Prune oldest eligible records first. Pending or uncertain operations remain
  protected until resolved; unresolved work is never silently removed by cleanup.
- Missing operation history means **unknown**, not **never committed**. Beyond
  retained history, compare with current content and reconcile before retrying;
  never blindly replay the operation as a new Save. These cleanup defaults are
  accepted policy, not measured storage-capacity claims.

### Backup and recovery export boundaries

- Workspace backups contain committed career content, content languages and their
  activation status, resumes, starters, presets, and document/layout defaults.
  When unsaved drafts exist, clearly label backup/export **saved workspace only**
  and provide a separate recovery-export action.
- Interface appearance, preview zoom, automatic-preview preference, and compiler/
  cache preferences are device-only. Workspace import preserves these preferences.
- Recovery exports use their own versioned format with draft scope identities and
  baseline context for reconciliation. Import restores uncommitted drafts for
  reconciliation; it never commits them automatically. Export does not discard
  unresolved recovery. The recovery-format envelope is defined below.
- Workspace replacement preserves recovery separately. If a draft's original
  records no longer exist, offer explicit **Restore as new** or **Export recovery**;
  never silently drop the draft or attach it to unrelated records. Restore as new
  remains an uncommitted draft until an explicit successful Save.
- Account and public-release credentials must never appear in either workspace
  backups or recovery exports.

### Replacement, rollback, and schema policy

- Prepare and validate a replacement before changing the active workspace. Preserve
  the destination's committed snapshot and unresolved recovery separately; recheck
  its current revision atomically at adoption. Intervening changes require renewed
  review, not silent replacement.
- Atomically adopt the incoming workspace and preserve the outgoing committed
  workspace as the new rollback snapshot. A recoverable implementation protocol
  must verify these all-or-nothing guarantees: if either cannot be preserved, abort
  without changing either the active workspace or existing snapshot.
- Rollback restores a retained snapshot as a new revision after review of newer
  work. Apply the same validation, conflict checks, and recovery protection as any
  replacement; never silently rewind or discard subsequent edits.
- A successful replacement or rollback invalidates pending saves and stale preview
  results. Late work must not overwrite the new workspace or appear as its current
  preview. Preserve unresolved drafts under the recovery rules above.
- Retain one durable rollback snapshot per workspace, with no automatic expiry.
  Describe it as **one previous workspace**, never version history. Durable means
  retained across reloads/restarts as browser storage permits, not protection
  against browser clearing or eviction.
- Before replacement or rollback, identify the snapshot that will be replaced and
  offer export. Export is optional. Export failure or cancellation leaves the
  operation uncommitted; the user can retry or explicitly continue without exporting.
- Rollback also preserves the outgoing committed workspace as the new snapshot,
  permitting a return to the workspace that existed immediately before rollback.
  Keep unresolved recovery separate from this rotating snapshot.
- Schema 2 is the only supported workspace schema for the target application.
  The app is development-only, with no production deployment or users. This
  supersedes all earlier schema-1 migration, compatibility, original-byte retention,
  mandatory backup-download, candidate-selection, and conversion-test requirements.
- Do not implement a schema-1 reader/converter, dual-schema editor, old-to-new ID
  mapping, legacy layout flattening, or compatibility regression fixtures. Start
  the target application with a clean schema-2 workspace; old development storage
  is not loaded or translated. No browser data is cleared by this documentation change.
- Reject schema-1 and other unsupported workspace imports without changing the
  active workspace. Keep target-schema validation, round-trip, recovery, conflict,
  replacement, rollback, and output tests; legacy behavior is not their contract.

### Baseline evidence and phase-1 test specification

The audit read the current model, wording/review derivation, layout resolution,
renderer, navigation contracts, workspace controller/persistence, backup parser,
compiler hook, README, runner configuration, and relevant application skills.

| Baseline                                                                         | Consequence for target work                                                       |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Schema 1 fixes en-US/pt-BR and shares variant selections/order                   | Replace fixed-pair contracts with independent output ownership                    |
| Overrides cover summary/achievements; edits flag counterparts                    | Expand display overrides; retire compulsory review metadata                       |
| Global review includes unused/archive content                                    | Replace with focused selected-output readiness                                    |
| Renderer hardcodes labels and language numbers                                   | Add explicit locale capability data; editing alone does not establish PDF support |
| Four-level layout resolution                                                     | Replace inheritance with the accepted layout model                                |
| Tab-local navigation; 500 ms autosave; 100-step in-memory history                | Introduce routes and form drafts without confusing recovery with committed state  |
| Conditional Web Lock writes compare reviewed bytes and guard late work           | Preserve these safety contracts or verify equivalent replacements                 |
| Session-only replacement and one session recovery copy                           | Implement the specified recovery and previous-workspace contracts                 |
| One Playwright scaffold test asserts a Next.js logo; no Vitest projects          | Establish target-contract coverage alongside implementation                       |
| Compiler hook serializes requests and tracks stale output; downloads revoke URLs | Existing cleanup is reusable evidence, not proof of bounded long sessions         |

Phase 0 defines tests only. At the **start of phase 1 and alongside target implementation**:

1. Inspect installed/runtime versions; select compatible Vitest tooling without
   incidental framework upgrades. Configure Node with real tests under
   `tests/unit/**/*.unit.test.ts`; expose non-watch `test:unit`. Preserve Playwright
   `tests/e2e/**/*.spec.ts` and `test:e2e`. Add Browser Mode with real interactive
   coverage under `tests/browser/**/*.browser.test.tsx` and `test:browser` when the
   first form/draft slice begins. These are planned commands, not available today.
2. Establish independent schema-2 fixtures for backup round trips, malformed and
   unsupported formats, duplicate/dangling IDs, selected and hidden content,
   inherited/custom wording, extensible languages, and independent resume layout.
   Test schema-1 rejection as an unsupported format, not legacy parsing/conversion.
   No baseline tests are required for retired schema-1 behavior.
3. Test target persistence through controlled transaction boundaries: stale scope
   baselines, superseded generations, validation/storage failure, operation retries,
   exact-version cleanup, session-only behavior, and recovery retention. Add real
   browser IndexedDB checks; mocked boundaries alone do not prove transaction behavior.
4. Replace the scaffold smoke assertion with actual workspace load/reload behavior;
   add isolated-origin import/replacement and two-tab conflict flows. Keep browser
   storage, timers, workers, and listeners isolated; never touch valuable user data.
5. With target implementation, add schema-2 round-trip and no-write-on-rejection
   tests, Save/Cancel and dirty-navigation tests, recovery-versus-save tests, and
   preview stale-result/resource tests. Confirm file/test/pass/fail/skip counts.
   Retain manual PDF visual/text/font/link checks and measured long-session checks.

No runner installation, tests, application checks, schema implementation, or resource
measurements were performed in this documentation session.

### Target formats and browser storage

- Workspace JSON envelope: `format: "verso.workspace"`, `schemaVersion: 2`,
  `exportedAt` (UTC timestamp), `workspaceId`, and `document`. The document contains
  career facts/wording, languages/activation, independent resumes with explicit
  template identities, starters, presets, and portable defaults. IDs are opaque,
  stable strings; language keys are canonical language tags, not a fixed enum.
  Validate unique IDs, references, values, and supported template identities.
- Recovery JSON envelope: `format: "verso.recovery"`, `schemaVersion: 1`,
  `exportedAt`, `sourceWorkspaceId`, and `drafts`. Each draft includes `draftId`,
  `draftVersion`, scope kind/resource IDs, baseline values, baseline revision and
  workspace generation, draft values, and any pending operation ID and immutable
  request fingerprint. Imported receipts are never evidence of a local commit.
  Preserve malformed draft field values for editing, while validating the envelope,
  structural bounds, and safe rendering. Missing targets use restore-as-new/export.
- Both exports use UTF-8 JSON without executable templates or embedded compiler/PDF
  assets. Neither exports credentials, local operation ledgers, or device preferences.
  Reject unknown versions without writes; keep the source available for export.
  Exported IDs identify lineage, not permission to overwrite a local destination;
  replacement always requires the destination's own reviewed revision.
- Use one IndexedDB database, `verso-local`, initial database version 1, with stores
  for workspace heads, previous workspaces, drafts, operations, and device preferences. Database version is independent of portable schema versions.
  Keep committed workspace snapshots initially; do not introduce a normalized account
  database or a new React state library for this decision.
- Use a single readwrite transaction across all affected stores for guest Save or
  local replacement. Read current generation/revision, compare scope baselines, apply the
  validated patch to current content, and write the new revision plus operation
  receipt together. Include exact-version draft cleanup if applicable. Replacement
  additionally swaps the previous-workspace snapshot and increments generation.
  Prepare expensive parsing/hashing outside the transaction, then recheck inside it;
  abort and reprepare if dependent data changed. No network/compiler work in transactions.
- IndexedDB supplies the atomic boundary; request strict durability where supported
  and acknowledge only transaction completion, not individual request success.
  Browser clearing/eviction remains possible. This design relies on the
  [IndexedDB transaction contract](https://www.w3.org/TR/IndexedDB/#transaction-concept),
  and must still be verified in actual browsers.
- Before dispatch, persist an immutable operation request with a fresh random ID,
  draft version, scope/baseline, generation, and payload fingerprint. A retry reuses
  that ID and identical request; ID reuse with different content is rejected.
  A completed receipt returns its prior outcome without another mutation. Missing
  history requires reconciliation and explicit new Save, not automatic replay.
- Generation checks reject late saves after replacement/rollback, including work
  from other tabs. Tag preview jobs with generation, resume ID, and output fingerprint;
  invalidate results on mismatch. Notify tabs through BroadcastChannel, with focus/
  visibility rechecks as fallback; notifications are hints, transactions authoritative.
- Debounce draft recovery writes by 500 ms, with a 2-second maximum wait during
  continuous editing. Flush on scope exit when possible; page-close flushing remains
  best effort. Track acknowledged draft versions and promptly expose write failures.
  Recovery storage is separate from Save and never drives preview or workspace undo.
- If IndexedDB cannot open/write, retain memory drafts and offer exports. A session-only
  commit requires explicit choice and truthful status; it must not overwrite durable
  records. Durable replacement is unavailable when its preservation
  guarantees cannot be met. Do not silently fall back to localStorage writes.

### Guest and future account persistence

- Use IndexedDB for guest committed workspace content, draft recovery, Save operation
  records, and the one previous workspace. Guest Save commits its scope locally in
  a transaction; success means that local transaction completed.
- Future authenticated workspaces use PostgreSQL as the authoritative account store,
  with account/workspace-isolated IndexedDB draft recovery and immutable pending Save
  operations. Typing writes recovery locally only; it never sends account mutations.
  Login does not silently merge guest data into an account.
- Authenticated explicit Save validates the scope, preserves the operation locally,
  and sends it immediately. Do not copy Dayplan's 10-second inactivity / 60-second
  maximum-delay autosave policy or debounce multiple explicit Saves for speculative
  billing savings. Preserve each Save's atomic scope and history semantics.
- Report account-save success and complete a Save-triggered navigation only after
  server acknowledgment. Local recovery is not account-save confirmation. Offline,
  rejected, or uncertain saves remain recoverable and visibly pending/unconfirmed;
  retries reuse the same immutable operation ID. An explicit local-only continuation
  must disclose that account saving has not completed.
- The server verifies ownership and atomically compares current scope baselines,
  preserves unrelated changes, commits the patch/revision, and records its receipt.
  IndexedDB and PostgreSQL cannot form one transaction: persist the request before
  sending, let the server commit content and receipt atomically, then reconcile the
  acknowledgment locally. Never claim cross-store atomicity. Cleanup only the exact
  acknowledged draft version; retain newer edits and uncertain operations.
- Reuse Dayplan's architectural patterns for owner isolation, local recovery,
  serialized writes, immutable retry IDs, and stale-response guards. Its guest
  localStorage and global-revision whole-workspace conflict rules do not meet these
  target contracts unchanged. Unrelated changes must not automatically conflict.
- Measure reads, writes, retry checks, authentication queries, and refresh queries
  when accounts are implemented. One HTTP request does not imply one billable database
  operation. Prisma's current billing FAQ describes bulk queries and array transactions
  as possible operation reductions, while interactive transaction queries count
  separately. Reverify pricing and the selected connection/driver at implementation;
  never weaken validation, ownership, conflicts, or receipt atomicity for batching.
  See the [Prisma Postgres billing FAQ](https://www.prisma.io/docs/postgres/faq).
- Avoid redundant refetches after acknowledged saves, use local cross-tab notifications,
  and bound/coalesce remote refresh on focus/reconnect/visibility. Server checks remain
  authoritative. Set the exact remote freshness bound in phase 9 and measure its
  operation cost; do not copy Dayplan's timing as a new product requirement.
- Phases 8 and 9 implement and verify these future account/sync contracts. No auth
  packages, database provisioning, or account adapters are authorized by this decision.

### Capacity and failure boundaries

- Limit target workspaces to 120 resumes, 100 sections, 10,000 career entries total,
  300 entries per section, 100 achievements and 30 links per entry, and 30 profile
  links. Permit 100 starters and 100 presets. No fixed language-count cap: language
  content is bounded by serialized size. These are safety ceilings, not recommended
  resume lengths. Validate field lengths and rich-text bounds from the target model;
  the old schema does not impose minimum compatible capacities.
- Limit a target workspace JSON file/document to 64 MiB of UTF-8 bytes
  (1 MiB = 1,048,576 bytes). Validate count and byte boundaries with schema-2
  fixtures; reject oversized imports or saves explicitly without truncation or
  changing committed content. The 120-resume limit is a target capacity choice,
  not a legacy conversion obligation.
- Recovery exports/imports are bounded to 256 MiB per file and 64 MiB per draft
  including baseline context. Split larger recovery collections into independently
  versioned files, with a manifest of included draft IDs; never truncate. If one draft
  cannot fit, keep it in memory, explain the limit, and allow raw recovery export in
  explicit chunks rather than claiming it is durably recoverable.
- Do not impose a count/age eviction cap on unresolved drafts, uncertain operations,
  or their recovery context. Storage exhaustion blocks the new write and offers
  export/explicit resolution; it never purges protected data. Check estimated storage
  headroom when available, but only a completed transaction establishes success.
  Replacement must accommodate incoming, outgoing, recovery, and database
  overhead. Never promise a browser quota or use a size estimate as a preservation guarantee.
- Bound in-memory workspace undo to 100 successful steps or 32 MiB of retained
  serialized inverse/forward patches, whichever comes first. Drop oldest steps with
  a visible history-boundary indication; oversized individual saves remain valid but
  disclose unavailable undo. Undo is never a backup. Replacement starts a new history
  generation; the previous-workspace snapshot provides the explicit return path.

### Performance and resource acceptance plan

These are initial acceptance targets, not measurements or universal browser promises.
Failure requires profiling and correction or an explicitly recorded budget revision;
do not mark a phase passed merely because a build succeeds.

- Measure production builds on a recorded reference desktop (OS, CPU, RAM, browser
  version), with normal and 4x CPU-throttled runs reported separately. Use the same
  fixtures/build for comparisons. Browser coverage: Chromium, Firefox, and WebKit
  for storage/navigation; retain actual Safari/manual PDF limitations until verified.
- Fixtures: small (20 entries/3 resumes), representative (300 entries/30 resumes),
  multi-resume (60 independent schema-2 resumes with hidden/custom wording),
  and capacity (120 resumes plus near-byte/count-limit data). Include supported English/
  Portuguese output, long URLs/titles, and incomplete unused records. Target-schema
  tests include maximum supported field shapes and byte-limit inputs.
- On the unthrottled reference desktop, target p95 input-to-paint and draft selection/
  reorder latency <=100 ms; Guest Save click to local committed acknowledgment <=500 ms for
  representative data and <=2 seconds for capacity data. Target workspace open <=2
  seconds representative / <=5 seconds capacity, excluding compiler initialization.
  Measure at least 100 interactions and 30 saves/opens per fixture; report p50, p95,
  max, failures, and sample counts. Keep typing independent of whole-workspace scans.
- Target recovery acknowledgment within 3 seconds of an edit during continuous input,
  subject to the stated failure path. Announce storage failures within 1 second of
  detection. Capacity import preview targets <=5 seconds with progress
  indication after 500 ms; parsing must not introduce recurring main-thread tasks
  above 50 ms. Use workers/chunking if measurements require them.
- Keep compiler initialization timeout 120 seconds and compilation timeout 30 seconds
  as configurable defaults; preserve the current 1,000,000-byte source bound. Target
  warm compilation <=5 seconds and cold initialization plus compilation <=20 seconds
  on the reference desktop with local assets cached, using 1–3-page representative
  resumes (10 warm and 5 cold runs). Report uncached download timing separately.
- Allow at most one active compilation and one replaceable latest queued request per
  workspace; one compiler instance/worker pair per tab. Retain one last successful
  PDF and one in-flight result; release replaced URLs, PDF documents, canvases, and
  workers when obsolete. Timeout terminates the worker pair before retry.
- Exercise 30 minutes/100 preview refreshes plus editing, navigation, failures,
  replacement, and retries. After cleanup, no monotonic growth in owned workers,
  listeners, timers, or blob URLs; counts return to declared steady-state bounds.
  Where comparable heap instrumentation exists, target retained JS heap growth
  <=20 MiB after warm-up and settled cleanup. Record WASM/renderer memory separately;
  do not claim a portable hard process-memory limit or fabricate unavailable metrics.
- Verify real IndexedDB abort/quota failures, interrupted acknowledgments, exact-draft
  cleanup races, two-tab unrelated/same-scope saves, replacement generation rejection,
  repeated rollback swaps, protected-record cleanup, and restart/recovery import in
  isolated browser origins. Node mocks alone do not prove transactional storage.

## Phase 0 - Decisions and implementation plan

Status: complete as a specification. See the accepted contracts in this document;
implementation acceptance remains outstanding.

- [x] P0.1 Audit baseline career/language/resume/review/layout, backup, navigation,
      saving, and compiler contracts; record findings without claiming runtime verification.
- [x] P0.2 Accept independent one-language resumes; defer groups and translation tracking.
- [x] P0.3 Accept English UI and extensible content languages with verified
      English/Portuguese PDFs. Deactivation only hides creation choices; retain wording
      and usable existing resumes. Use Create copy in another language with compatible
      layout and rendering warnings; defer in-place changes and permanent wording erasure.
- [x] P0.4 Accept built-in fields/custom sections, structure-only starters, appearance-only
      presets, copy-on-apply semantics, and duplication for content-bearing reuse.
- [x] P0.4a Accept archive/restore only for shared career content. Preserve existing
      resume selections/output with an Archived editor label and per-resume removal.
      Defer permanent shared-content deletion until references, customized wording,
      and durable recovery are defined. Confirm resume deletion without deleting career content.
- [x] P0.5 Accept durable career/resume/settings destinations, deep links, reload,
      Back/Forward, and local transient controls; apply dirty-form guards.
- [x] P0.6 Explicit form Save/Cancel, incomplete saves, dirty-exit choices, separate
      recovery, and committed-only preview inputs are accepted. Dirty-form keyboard
      undo/redo stays within the draft; workspace history requires resolving the
      draft and then a separate invocation. Save creates one atomic step;
      Cancel/Discard and recovery restoration create none. Accept scope/baseline-aware
      conflicts, atomic Save rechecks, preservation of both versions through resolution,
      and stable Save operation IDs for idempotent retries. Unresolved drafts never
      expire automatically; browser eviction/clearing remains possible. Report recovery
      failures promptly and offer export. Resolved-draft cleanup targets the exact
      version after confirmed Save or explicit Discard. Completed-operation cleanup
      defaults to 30 days or 1,000 per workspace, whichever comes first, configurable;
      pending/uncertain operations stay protected. Missing history means unknown and
      requires comparison/reconciliation before retry. Select transactional IndexedDB storage as defined in the accepted contracts below.
- [x] P0.7 Accept schema 2 as the only workspace format, recovery format 1,
      and IndexedDB transactions. No schema-1 reader, conversion, original-byte
      retention, or mandatory original-download workflow is required. Define
      the real-browser verification plan for atomic replacement. Require
      snapshot preservation before replacement, validation and atomic revision rechecks,
      and the same safeguards for rollback as a new revision. Retain one previous
      workspace with no automatic expiry, subject to browser clearing/eviction.
      Identify the snapshot being replaced and offer optional export; failed/canceled
      export leaves adoption uncommitted pending retry or explicit continuation without
      export. Atomically adopt incoming and preserve outgoing; failure changes neither
      active workspace nor snapshot. Keep recovery separate from the previous workspace.
      Successful replacement/
      rollback invalidates pending saves and stale previews. Backup boundaries are accepted: committed workspace only,
      device preferences separate, recovery retained through replacement and imported
      as drafts. Missing draft targets require explicit restore-as-new or export;
      never silently drop or reattach them. Exclude credentials from both exports.
- [x] P0.8 Supersede the old bilingual candidate-conversion requirement. Define
      120-resume/64-MiB capacity for schema 2 and verify target-schema limits without
      truncation. No 60-candidate migration proof or legacy regression suite is required.
- [x] P0.9 Reconcile accepted decisions with guidance and skills; distinguish current
      implementation. Final technical contracts are included in this document.
- [x] P0.10 Audit scaffold coverage and define target tests, boundaries, discovery,
      isolation, and planned commands. Executing target coverage moves to P1.0;
      no runner configuration or test implementation belongs in this session.

Exit met as specification: local decisions, schema/recovery contracts, capacity
limits, and performance targets are recorded. Transaction proofs and measurements
belong to implementation; no application behavior is claimed delivered.

## Phase 1 — Career information and language contracts

- [ ] P1.0 Establish this document's target-contract test tooling and coverage.
      Verify runner/runtime compatibility, configure Node with real cases, and repair
      the stale Playwright smoke assertion. Record file/test counts. Add Browser Mode
      with the first interactive slice.
- [ ] P1.0a Introduce form drafts and Save/Cancel alongside the first changed editors.
      Separate recovery from committed workspace, undo, persistence, and preview;
      do not defer these editing boundaries to phase 6. Dirty-form keyboard undo/redo
      never falls through to workspace history, even when field history is exhausted.
      Workspace Undo/Redo requires Save/Discard/Stay resolution, followed by a
      separate invocation; explain that Save then Undo undoes the newly saved edit.
      Each successful Save creates one atomic workspace step; Cancel/Discard creates
      none, and recovery restores an uncommitted draft.
- [ ] P1.1 Career details own available sections, fields, facts, and reusable wording.
      Resume selection and layout do not define which career information can exist.
- [ ] P1.2 Preserve stable section/entry/field/achievement/link identities through
      rename, reorder, archive, and localization; duplication creates
      independent identities where appropriate.
- [ ] P1.2a Archive/restore shared career content; hide archived content from
      new-selection lists while preserving its appearance in existing resumes.
      Label existing selections Archived in the editor and allow removal from that
      resume. Restore availability without changing identity. No permanent deletion
      of shared career content in this milestone; undo is not durable recovery.
- [ ] P1.3 Represent active content languages explicitly. One is sufficient; adding
      another does not require translating the entire library. Remove fixed-pair
      assumptions from accepted new contracts.
- [ ] P1.4 Separate facts from localized display wording. Audit organizations,
      degrees/titles, locations, headings, and link labels without duplicating records.
- [ ] P1.5 Define field types/validation from the target information model, reusing
      existing rules where they fit. Use built-in fields and custom sections using supported fields. User-defined
      fields and an unrestricted form designer are deferred.
- [ ] P1.6 Keep interface language, activation status, and verified PDF support
      separate. Deactivation hides creation choices and retains wording/overrides;
      existing resumes remain editable and exportable where PDF support is verified,
      without appearing disabled or invalid. Reactivation restores creation choices.
- [ ] P1.7 Implement schema-2 factories, validation, and backup import/export
      together. Manually and automatically round-trip schema-2 fixtures on disposable
      workspaces. Cover malformed/unsupported formats, references, customizations,
      capacity, and no mutation on rejected input. Schema 1 is unsupported; do not
      implement legacy parsing, conversion, or regression coverage.

Exit: single-language data works without a counterpart; extra languages and
schema-2 backup/recovery handling have explicit, safe contracts.

## Phase 2 — Independent resumes and output fields

These criteria implement the accepted independent one-language resume model.

- [ ] P2.1 Create/name/duplicate/open/delete resumes with a language visible in their
      collection cards and active header. Confirm deletion; deleting a resume never
      deletes shared career content.
- [ ] P2.2 Independently select/order sections, entries, achievements, contact fields,
      and relevant career-entry fields. Language resumes can differ without copied facts.
- [ ] P2.3 Distinguish excluded, empty, required, and unsupported fields. Explain
      structural minimums; hiding optional values retains their career data.
- [ ] P2.4 Allow all display wording to inherit Career details or be explicitly
      customized. Shared edits update inheriting resumes; customized text stays unchanged.
      **Use career wording** removes customization. Label scope; no acknowledgment queues.
- [ ] P2.5 Support creating a copy in another language using shared career identities
      and copied selection/order with independent presentation. Use destination-language
      career wording; leave missing wording missing, without translation or silent
      fallback. Preserve the original and its custom wording. Copy compatible layout
      settings and warn about different font/rendering requirements; never promise
      identical appearance. Defer in-place language changes.
- [ ] P2.6 Show names and language labels; defer groups. Comparisons show effective
      content; downloads identify the exact committed snapshot.

Exit: demonstrate English-only use and English/Portuguese resumes with differing
fields, achievements, ordering, and layout.

## Phase 3 - Focused output readiness

- [ ] P3.1 Remove compulsory counterpart tasks and translation confirmations.
      Additional languages create no review debt or equivalence promise.
- [ ] P3.2 Defer directional translation tracking and acknowledgment UI; remove
      obsolete baseline dependencies rather than implementing the former proposal.
- [ ] P3.3 Keep customized wording unchanged after shared edits, with clear source
      labels and Use career wording; no shared-wording acknowledgment workflow.
- [ ] P3.4 Save valid incomplete records. Reject malformed entered values with specific
      messages and retain drafts; saveability does not mean export readiness.
- [ ] P3.5 Validate only selected resume content and language. Hidden fields, unused
      entries, and inactive languages do not block that output. Selected archived
      content continues rendering; archive status alone does not invalidate output.
- [ ] P3.6 Provide active-resume readiness issues and editor navigation. Retire
      translation-review queues; intentional adaptations create no review tasks.

Exit: valid partial work saves; only selected-output errors block export.

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
      Use supported built-in fields; user-defined field definitions are deferred.
- [ ] P4.4 Keep selected jobs/achievements/custom wording in Duplicate resume;
      content-bearing starters are deferred.
- [ ] P4.5 Copy settings on application. Editing/deleting starters does not mutate
      existing resumes or add live inheritance/review obligations.
- [ ] P4.6 Offer starters in Create resume and presets in Layout. Include them in
      backup/recovery/undo. Reuse useful appearance controls where they fit the target
      model; do not migrate baseline settings or recreate four-scope inheritance for parity.

Exit: reusable structure/appearance never owns career data or unexpectedly changes resumes.

## Phase 5 — Settings and navigation

- [ ] P5.1 Discoverable settings menu covers appearance, content languages, editing/
      preview, data/backups, and defaults. Account controls wait for account implementation.
- [ ] P5.2 Distinguish local preferences, document configuration, and future account
      settings; state backup/sync scope. Consolidate controls without losing recovery or diagnostics.
- [ ] P5.3 Implement accepted durable routes supporting deep links, reload, Back/Forward,
      validated IDs, and useful missing-resource states. Never expose resume text/secrets in URLs.
- [ ] P5.4 Establish coherent workspace/controller ownership and compiler lifecycle;
      protect edits, focus,
      scroll, issue links, narrow-screen access, and dirty-edit policy across navigation.
      Keep transient controls local; dirty forms use Save/Discard/Stay guards.

Exit: settings/navigation consistently follow the recorded policy.

## Phase 6 — Saving and bounded PDF resources

Saving less often does not prove lower PDF memory use. Persistence, history,
compilation, and rendering consume different resources.

- [ ] P6.1 Measure extended sessions: compilers, pending work, retained PDFs, viewer
      documents/workers/canvases, object URLs, and history bounds where inspectable.
- [ ] P6.2 Follow P0.6 with distinct truthful recovery, save, preview, backup, and
      future release statuses.
- [ ] P6.3 Manual refresh is independent of saving. Optional automatic refresh
      compiles only committed, active output-affecting changes. Manual refresh is default.
- [ ] P6.4 Bound concurrent/pending work, supersede stale requests, reject late results,
      release obsolete PDF/worker/canvas/URL resources, and define hidden-preview behavior.
- [ ] P6.5 Preserve a labeled last successful preview on failure, identifying revision,
      stale state, diagnostics, and retry.
- [ ] P6.6 Complete and verify accepted Save/Cancel, recovery, dirty
      navigation, validation, undo, and conflicts. Save without compile is possible;
      refresh/export identify committed snapshot use. Unsaved form drafts never compile.
- [ ] P6.7 Ensure coordinated conditional guest writes/replacements, session-only
      recovery, and other-tab conflict protection regardless of save mode. Reuse
      Web Locks/reviewed tokens or replace them with verified equivalent safeguards;
      the safety contract matters more than preserving implementation details.
- [ ] P6.8 Manually verify rapid edits/switches, hidden previews, failures/timeouts,
      and long sessions against recorded resource bounds.

Exit: deliberate saving behavior and evidenced bounded preview resources.

## Phase 7 — Local acceptance and documentation

- [ ] P7.1 Verify one-language onboarding/editing/export, independent language resumes,
      visibility/order, shared facts, custom wording, and no compulsory translation review.
- [ ] P7.2 Verify each added output language's labels, dates/regions, fonts, hyphenation/
      direction where applicable, metadata, links, selectable/searchable text, and layout.
      Clearly disable unsupported PDF output instead of silently using wrong labels/glyphs.
- [ ] P7.3 Verify approved presets/starters, settings, routing, save/preview, undo,
      keyboard access, and narrow layouts.
- [ ] P7.4 Restore schema-2 workspace backups and recovery exports on disposable origins; verify identities,
      wording, order/selection, appearance, and recovery. Invalid imports preserve current
      work; imports never publish anything.
- [ ] P7.5 Inspect actual PDFs with accents/special characters, long titles/URLs,
      optional omissions, and page overflow; exercise failure/stale results. Page counts
      do not prove clipping detection, PDF/UA, or universal ATS compatibility.
- [ ] P7.6 Run required static checks/build, record manual evidence/limitations, update
      README/applicable guidance and all other affected project artifacts.
- [ ] P7.7 Run relevant Node, browser-component, and application-flow suites with
      actual file/test/pass/fail/skip counts. Cover single-language use, independent
      selection, Save/Cancel draft boundaries, persistence conflicts/recovery, stale compiler
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
- [ ] P8.4 Persist validated user-owned career data, resumes, starters/presets, and applicable settings. Choose snapshot versus normalized storage from
      actual consistency/query needs.
- [ ] P8.5 Send explicit Saves immediately after durable local request preparation;
      confirm account saving only after server acknowledgment. Use scope-aware atomic
      checks and receipts, safe retries, exact-version cleanup, and truthful offline/
      pending status. Measure database operations, including auth and refresh reads;
      no typing-triggered cloud writes or cross-Save debounce.
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
formal PDF/UA; automatic public release of drafts; translation tracking; resume
groups; user-defined field types; content-bearing starters.

These are not prerequisites for the local-editor or public-PDF-link milestones.
