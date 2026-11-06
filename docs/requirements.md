# Verso — Requirements and implementation order

Updated: 2026-11-03.

This is the accepted product plan. [README](../README.md) describes delivered
behavior; [evidence](phase-1-evidence.md) records executed checks;
[handoff](phase-1-handoff.md) records the implementation stopping point.

## Direction and status

- Career details own reusable facts and wording. Independent one-language resumes
  select content; layout controls appearance. Hiding content never deletes it.
- English UI; extensible content languages; verified English/Portuguese PDF output.
  No mandatory counterpart, translation review, fixed language pair, or groups.
- Schema 2 and recovery format 1 only. No schema-1 migration or behavior parity.
  Preserve target data, recovery, identities, and safety contracts across phases.
- Preserve the established workspace shell and responsive presentation. Reuse
  existing code where useful; do not mount retired schema-1 state.
- Phase 0 decisions are complete. Phase 1 implementation is delivered with open
  verification recorded in the final follow-up list. Those items no longer block
  progression from Phase 1 and are not counted as passed acceptance.
- Phase 2 implementation adds independent resume lifecycle, Content/Wording,
  comparison, and committed output choices. Verification is recorded separately
  below; owner visual/PDF and deferred performance acceptance remain open.
  Accounts, sync, public downloads, and hosting still require explicit activation.

## Delivery rules

- Implement the ordered phases in useful slices. The final follow-up list is
  deferred work, not a prerequisite to starting every subsequent slice.
- Follow applicable AGENTS.md, installed Next.js guides, and relevant skills.
  Preserve npm, selected dependency versions, framework settings, and generated guidance.
- Keep meaningful regression coverage alongside changes. Run proportionate
  formatting, lint, route generation/typecheck, build, and non-watch tests.
  Use isolated databases/origins when real persistence is the contract.
- Record failures and limitations. Never mark unexecuted acceptance as passed.
  Documentation-only edits need formatting and local-link checks.
- Update affected requirements, usage, guidance, and format documentation.
  Keep performance measurements separate from routine regression runs.
- Whenever updating a maintained artifact, including permanent docs and skills,
  make it self-contained: state the
  applicable behavior, contracts, limitations, and instructions directly, without
  relying on phase numbers or temporary requirements, evidence, or handoff files.
  Those planning files will be removed after implementation; their removal must
  not leave missing guidance or broken references. Links to maintained source or
  permanent reference documentation may supplement, but not replace, that context.

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

### Editor presentation and direct sorting

- New workspaces start with empty Experience, Projects, Education, Skills, and
  Certifications sections; existing saved workspaces are never reseeded.
- Summaries and achievements/details support rich prose with inline links and
  emphasis. Headings, titles, degrees, names, facts, short skills, and link labels
  use plain controls. Overall typography remains a later layout concern.
- Owner visual acceptance is separate from automated behavioral and nonvisual
  PDF checks. Preserve the restored presentation while completing Phase 1.

- Dialog, popover, and card footer actions align to the end. Ordinary form actions
  are **Cancel / Save**; dirty-navigation actions are **Cancel / Discard / Save**.
  The primary action is rightmost; DOM, keyboard, and visual order agree even when
  actions wrap. Navigation Cancel dismisses the prompt and retains the draft.
- Form Save and Cancel are disabled while unchanged or saving. Navigation remains
  available to leave a clean form; navigation-dialog Cancel remains available.
- Draggable cards retain rounded, bordered semantic surfaces and padding. Compact
  section-order rows use vertical padding proportional to their smaller content.
  Selected entries use the existing moving translucent selection surface, honoring
  reduced motion and accessible focus. Card selection remains highlighted when
  switching to an order draft and through reorder Save/Cancel. The selectable
  text area has no separate hover background; Edit precedes Up/Down actions.
- Entry lists support direct handle dragging and Up/Down/Edit quick actions, with
  Duplicate and Archive/Restore in a per-entry overflow menu. No separate Edit
  entry order step is required. Section properties opens from the menu to the right
  of the section heading; shared-content clear/delete remains deferred.
- Direct sorting opens the existing entry-order draft scope in the same mounted
  list, preserving search, archive filtering, and scroll position. Save commits one
  atomic history step; Cancel restores committed order. Hidden IDs retain their
  slots. Invalid, canceled, stale, and no-op drops do not change content.
- Entry editing and the current section's entry order use independent drafts.
  Dragging does not close the entry form or clear its selection; opening an existing
  entry does not prompt solely because an order is pending. Save order/Cancel order
  affect only ordering. Save entry/Cancel entry affect only the entry. Each Save
  creates its own atomic history step, receipt, and exact-version recovery cleanup.
- Each draft retains its own baseline, recovery record, diagnostics, and retry
  identity. Saving one never rebases, commits, or discards the other. Same-section
  wording changes do not conflict with order-only scopes; real conflicts retain
  both drafts. Existing entry-order URLs use this inline editor.
- Switching between dirty entries resolves only the entry draft. Leaving the section
  resolves remaining drafts independently with Cancel/Discard/Save; successful
  resolutions remain successful if a later resolution is canceled or fails. Each
  dialog describes only its own issue, never another dialog or pending prompt.
- Data & backups can be visited without resolving either draft, so recovery export
  remains available on save failures. Returning to editing preserves both drafts.
  Replacement, rollback, creation that changes list membership, and workspace
  history still require resolving applicable drafts before proceeding.
- Do not show Compare order/Reconcile order/Export recovery controls or a comparison
  table in the entry list. Keep recovery discovery/restoration in Data & backups,
  using readable names and Restore draft actions rather than scope IDs/version
  counters. Restore remains explicit and uncommitted; no stored drafts are removed
  merely by hiding recovery UI or exporting.
- Option controls reuse the shared Select/DropdownMenu/Popover styles, including
  consistent typography, spacing, viewport-constrained widths, focus, and leading
  option icons. Action lists use DropdownMenu with keyboard navigation/dismissal.
- Visual acceptance for this correction belongs to the owner. Test changes are
  recorded separately from test execution; this correction does not establish
  completion of the outstanding Phase-1 acceptance criteria.

### Navigation, editing, saving, and preview

- Durable routes cover Career details, individual sections, the resume collection,
  resume Content/Wording/Layout views, and Settings. Deep links, reload, and browser
  Back/Forward restore the destination. Use IDs, never resume text or secrets, in
  URLs. Missing resources have useful recovery navigation. Dialogs, typing, and
  preview zoom remain local state.
- Explicit Save/Cancel operates on one editing scope: a career entry including its
  achievements and links; profile; summary; section properties; resume wording;
  resume content/order; or layout/settings form. Each shows unsaved state. Selection
  and sorting remain drafts until Save; Cancel restores the affected scope. Career
  entry editing and section entry ordering may coexist as independent scopes.
- Typing does not commit workspace changes, write to the account database, compile PDFs, or
  add committed workspace undo steps. Local draft recovery is a separate boundary.
  Each successful form Save commits one validated edit and one workspace undo step.
  Explicit create/archive/restore and permitted delete commands remain distinct
  from ordinary typing.
- Save preserves incomplete progress, including missing titles, dates, or wording.
  Entered malformed values such as invalid dates or unsafe links fail with specific
  messages and leave the draft intact. Output readiness is distinct from saveability.
- Leaving a dirty scope offers **Cancel**, **Discard**, or **Save**. Save navigates only
  after validation and commit succeed; Discard removes pending changes; Cancel keeps
  editing. Apply this to internal navigation and Back/Forward. Browser close/reload
  uses best-effort native warnings and recoverable local drafts, not a promised
  custom three-choice close dialog. Support the accepted entry/order draft pair;
  a general-purpose manager for arbitrary simultaneous form drafts remains out of scope.
- Recovered drafts are distinguishable from saved workspace content and require
  explicit restoration. Save failures retain drafts; no false saved status.
  Session-memory-only commits require an explicit choice. Preserve conflict
  protection and undo; recovery storage and retention are defined below.
- While a form is dirty, keyboard undo/redo stays within the draft. Exhausting
  field/draft history never falls through to committed workspace history.
- Invoking workspace Undo/Redo with a dirty form requires resolving the draft with
  **Cancel**, **Discard**, or **Save**. Explain that resolution does not execute the
  pending history action: after Save or Discard, the user invokes workspace
  Undo/Redo separately. Cancel keeps editing. In particular, workspace Undo after a
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
- For form drafts, offer **Compare**, **Reconcile**, **Discard recovered draft**, or
  **Export recovery**. Entry-order drafts omit comparison/reconciliation UI: retain
  pending order on conflicts, provide recovery export through Data & backups, and
  allow explicit **Cancel order** without changing committed content.
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

### Test boundaries

- Vitest Node covers domain rules, schema-2 validation, and controlled async races.
- Chromium Browser Mode covers interactive forms, drafts, recovery, and IndexedDB.
- Playwright covers production navigation, reload, conflicts, quota failure, and PDFs.
- Use isolated origins and independent fixtures. Cover malformed/unsupported input,
  dangling identities, custom wording, hidden content, independent layout, atomic
  replacement, interrupted Saves, exact cleanup, and stale preview results.
- Preserve real behavior coverage when renaming tests. Name files by behavior,
  not implementation phase. Do not add schema-1 compatibility tests.
- Report actual file/test/pass/fail/skip counts. Builds and mocks do not establish
  browser atomicity, PDF appearance, or performance acceptance.

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
- Verify bounded deterministic preview scenarios covering editing, navigation,
  failures, replacement, and retries. After settled cleanup, owned workers,
  listeners, timers, and blob URLs return to their declared steady-state bounds.
  No mandatory 30-minute/100-refresh soak or sustained heap-growth measurement
  is required. These checks do not establish long-session memory stability.
- Verify real IndexedDB abort/quota failures, interrupted acknowledgments, exact-draft
  cleanup races, two-tab unrelated/same-scope saves, replacement generation rejection,
  repeated rollback swaps, protected-record cleanup, and restart/recovery import in
  isolated browser origins. Node mocks alone do not prove transactional storage.

## Phase 0 — Decisions

Complete as a specification: the contracts above define the information model,
languages, drafts, persistence, recovery, formats, capacity, and performance targets.
This status does not claim implementation acceptance.

## Phase 1 — Career information and languages

Implementation delivered; remaining verification is deferred to the final list.
Checked items retain their previously recorded evidence, not a new test result.

- [x] P1.0 Configure real Node, browser-component, and application-flow coverage.
- [x] P1.0a Separate form/order drafts, recovery, committed Saves, history, and preview;
      guard dirty navigation and keep draft undo separate from workspace undo.
- [x] P1.1 Career details own available sections, fields, facts, and reusable wording.
- [x] P1.2 Preserve identities through edits/reordering/localization; duplicate independently.
- [x] P1.2a Archive/restore shared content; preserve existing output and label archived selections.
- [x] P1.3 Support explicit extensible content languages without compulsory translation.
- [x] P1.4 Separate shared facts from localized display wording and resume overrides.
- [x] P1.5 Provide built-in fields, supported custom sections, and typed validation.
- [x] P1.6 Separate interface language, activation, and verified PDF capability.

P1.7 factories, validation, workspace backups, and recovery are implemented.
Its outstanding round-trip acceptance remains unchecked in follow-up F3.

## Phase 2 — Independent resumes and output fields

- [x] P2.1 Create/name/duplicate/open/delete resumes; show language and confirm deletion.
      Resume deletion never deletes career content.
- [x] P2.2 Select/order sections, entries, achievements, contact fields, and entry fields independently.
- [x] P2.3 Distinguish excluded, empty, required, and unsupported fields; retain hidden data.
- [x] P2.4 Inherit or customize all display wording; shared edits preserve overrides.
      **Use career wording** removes an override; label the editing scope.
- [x] P2.5 Copy to another language using destination wording and shared identities;
      copy selection/order and compatible layout, preserve the original, warn about
      font/rendering differences, and never silently translate or fall back.
- [x] P2.6 Show resume names/languages and compare effective committed content.

Implementation preserves the `master` resume card/dialog/color/disclosure styles
inside the restored shell, with separate Content and Wording views. Existing
schema-2 defaults and pending selection operations remain supported without
schema-1 compatibility. Parent exclusion retains child configuration. Creation
and deletion use nullable single-resume scopes with transactional retries/history;
missing-resume recovery remains explicit and uncommitted.

Presentation refactor: each resume's sidebar name opens a read-only overview,
with **Overview**, **Content & order**, and **Wording** child destinations.
Selecting the resume name also selects Overview. Individual views use the resume's
colored title icon and title-row actions menu, omit All resumes, and show the
resume name in the breadcrumb. Only the collection/comparison selects Resumes.
Resume selectors include colored icons in options and selected values; the
overview card omits the color value.
The resume views use underlined Overview, Content & order, and Wording tabs with
icons, controlled by the durable destination and existing dirty-form guard.
Comparison remains a separate action; narrow tab lists scroll horizontally.
Shared actions open name/color editing on a dedicated Save/Cancel page, duplicate/copy, or confirm
deletion. Navigation remains durable and draft-guarded. Labels truncate with
ellipsis; collection sizing ignores entrance transforms and scrolls only on actual
overflow. Choice controls align to the first title line. Entry search uses a
conditional inline clear action and restores input focus.

The committed PDF viewer uses existing Verso controls around pinned PDF.js:
compact direct page entry without spinner or previous/next buttons, a compact spinner-free
percentage zoom input (25-400%, committed on Enter or blur) with separate Fit width/Fit page buttons, thumbnails, embedded
outline, button-opened search, download, and on-demand properties. Group toolbar
controls with the navigation toggle and separator at the start, the actions menu
at the far right, and the remaining controls centered between them. Allow groups
to wrap in narrow panes. Document navigation has no
visible title: a left utility rail uses Lucide Images/Summary icon tabs and the
navbar's translucent animated selection surface with its leading vertical bar.
Keep accessible vertical-tab behavior, tooltips, independently scrolling content,
a bottom Close action, and the existing narrow-pane overlay. Native browser Find
shortcuts remain
untouched; manual browser-specific acceptance remains separate. Viewer changes
preserve explicit refresh, saved-content-only output, stale-job rejection, and
last-successful-preview labeling. No schema or dependency versions change.

Before initial generation, show an illustrated document placeholder with an explicit
Generate preview action, or guidance to Issues when output is blocked. Distinguish
compiler preparation, generation, viewer loading, and first-page rendering. Announce
loading accessibly, respect reduced motion, retain the last successful PDF during
refresh, and show errors with retry guidance rather than indefinite loading.

Presentation-refactor verification on 2026-11-03: formatting, lint, generated route
types/TypeScript, 40 Node tests (9 files), 67 Chromium component tests (7 files),
and 46 production E2E cases passed across Chromium/Firefox/WebKit with a fresh
build. Suites ran sequentially; production E2E used one worker after overlapping
runs encountered host resource contention. Native desktop Find UI remains
unverified because the Computer Use helper could not connect after recovery;
the automated shortcut check proves non-interception, not native Find coverage.

Historical Phase 2 verification (before this presentation refactor):
Verification on 2026-11-03: formatting, lint, route generation/typecheck, and
`npm test` passed: 40 Node tests (9 files), 59 Chromium component tests (6 files),
and 43 production E2E cases across Chromium/Firefox/WebKit, including actual
English/Portuguese PDF checks. See [phase-2 evidence](phase-2-evidence.md) for
source/build identity, regressions resolved, and limits. Deferred F1–F7 remain
historical/open acceptance, not automatically passed by this implementation.
Owner visual/PDF, manual round-trip, and performance acceptance remain separate.

## Phase 2.5 — Custom-section icons

Implementation delivered; browser/manual acceptance remains with the owner.

This slice corrects the delivered career model and resume presentation without
changing the historical completion records above. Earlier development workspaces,
backups, drafts, and prepared operations need no backward compatibility; do not
add migration adapters, silently reseed data, or add legacy regression coverage.
Workspace schema 2 and recovery format 1 remain the development target formats.

- [x] P2.5.1 Require validated section icon IDs in the active model, factories,
      fixtures, starter definitions, and portable validators. Reuse the 25-icon
      catalog; custom sections default to file-text, and built-in icons are fixed.
- [x] P2.5.2 Edit icons in Section properties through its existing draft and
      Cancel / Save. Show draft choices only inside the properties editor;
      other views use committed icons. No independent picker Save operation.
- [x] P2.5.3 Resolve each section's saved icon consistently across Career details,
      section destinations, sidebar, resume Content & order, Wording, comparison,
      and any other existing section representation. Preserve resume identity
      colors and generic navigation/action icons; add no new representations.
- [x] P2.5.4 Include icons in scope baselines, validation, recovery, reconciliation,
      conflicts, atomic Save receipts, retries, and Undo/Redo. Preserve independent
      entry-order drafts, exact-version cleanup, archive/restore, replacement,
      rollback, and workspace/recovery round trips.
- [x] P2.5.5 Keep icons shared and language-independent, outside wording and output
      readiness. Starter structure copies icon choices; appearance presets do not
      overwrite shared icons. Starter workflows remain later layout work. Icons
      remain app-only; preserve PDF rendering and revision metadata, so an icon Save
      may mark preview stale but never automatically compiles. Subsequent settings,
      resource, and local acceptance work includes icon consistency and recovery.
- [x] P2.5.6 Run formatting, lint, route generation/typecheck, non-watch unit tests,
      and production build. Update maintained guidance and record actual results.
      Browser Mode, Playwright, computer-use, visual, and manual PDF validation
      belong to the owner and remain explicitly unverified for this slice.

Owner acceptance: verify picker keyboard/focus and narrow-screen behavior; draft
isolation and Save/Cancel; navigation/reload and recovery; and distinct custom
section icons across career and resume views. Existing deferred acceptance stays
open. No dependency upgrades, routes, per-resume icon overrides, PDF section icons,
or future starter/preset workflows are included.

Non-browser verification on 2026-11-04: formatting, lint, generated route types /
TypeScript, 58 unit tests across 10 files, and production build passed. Seven local
documentation links were checked, and requirements through Phase 2 were verified
unchanged. Controller unit checks exercise explicit session-only behavior, not
real IndexedDB atomicity. Three icon-specific browser cases were added for picker
Save/Cancel, distinct icons across views, and real persistence/retry/rollback;
these and all other browser/manual checks remain unexecuted for this slice.

## Phase 3 — Output readiness

- [x] P3.1 Remove compulsory counterpart tasks and translation confirmations.
- [x] P3.2 Remove obsolete translation tracking/review dependencies.
- [x] P3.3 Label inherited/custom wording and preserve customizations after shared edits.
- [x] P3.4 Save valid incomplete content; reject malformed values and retain failed drafts.
- [x] P3.5 Validate selected output only; unused/inactive/archived status alone never blocks it.
- [x] P3.6 Show active-resume readiness issues with editor navigation.

Implementation adds one committed-output assessment shared by rendering and the
PDF-only Issues footer. Overview has no Issues disclosure. The persistent
count/status row starts collapsed; expansion is user-controlled while mounted,
with a separately bordered scrolling body capped at 40dvh. The footer remains
available before compilation, during failures, and alongside the last successful
PDF. Repair links open exact resume Wording cards through
existing draft guards and reveal Editor on narrow screens after navigation succeeds.
Shared URL validation and checkbox presentation no longer import retired workflows.
Readiness preserves existing PDF blocking rules and does not constrain incomplete
valid Saves. Workspace schema 2 and recovery format 1 remain unchanged.

Owner visual/manual acceptance remains open: visual consistency with existing UI,
keyboard/focus, narrow layouts, dirty navigation and failed Saves, committed-only
updates, retained preview/download, and English/Portuguese PDF behavior.
Automated Browser Mode and production E2E results are recorded below.
Previous deferred acceptance is unchanged and is not counted as passed.

Initial non-browser verification on 2026-11-04: formatting, lint, generated route
types / TypeScript, 64 unit tests across 12 files, and production build passed. The initial
format check hit a sandbox directory-scan EPERM; the initial unit run hit a
subprocess EPERM. Both passed after sandbox retries. Three new Browser Mode cases
and one production E2E case were added, type-checked, and left unexecuted for the
owner. Static runtime-import inspection of the active page found no retired
review/workspace workflow imports after shared-helper extraction. No browser,
computer-use, visual, or manual PDF validation was performed.

Browser-regression follow-up on 2026-11-04: fixed three test failures caused by
implicit narrow viewports and unscoped duplicate issue text. Production checks
then exposed duplicate history entries when Save reopened the current resume
editor, plus a narrow-panel race where clearing a completed issue-focus request
could undo a manual switch to PDF. Reopening the same destination now preserves
its history entry; clearing a request preserves the selected panel, while a new
issue request still reveals Editor. Added direct history and panel regression
assertions without changing the readiness UI presentation.

Final follow-up verification: 64 unit tests across 12 files, 75 Chromium Browser
Mode tests across 7 files, and all 49 production E2E cases across
Chromium/Firefox/WebKit passed. Formatting, lint, generated route types/TypeScript,
and the fresh production build passed. E2E used one worker, separately from Browser
Mode. Initial component runs had three test-setup failures; the first production
run had three history-regression failures and the second had one narrow-panel
failure. The final run passed without skips or configured retries. This executes
the previously deferred icon-specific browser cases as well; owner visual/PDF
acceptance, manual round trips, and deferred performance/safety acceptance remain
open. Seven local documentation links were checked successfully.

Firefox shell-test follow-up on 2026-11-04: reproduced a scripted rich-text fill
inserting replacement text before existing summary text, already visible before
Data & backups navigation. The restored-shell tests now click/focus the editor,
select all with the native keyboard path, insert text, and immediately assert the
exact replacement. Existing Save/Cancel, guard, and draft-retention assertions stay
in place. No application behavior, timeout, skip, or retry settings changed.

All six shell cases (desktop/phone across Chromium/Firefox/WebKit) passed with the
normal two-worker configuration. Ten isolated Firefox phone repetitions had nine
passes and one overall 30-second timeout during a slow run, without recurrence of
the original appended-text error. The baseline had three failures out of five
attempts, including timeouts. An intermediate per-character typing experiment was
interrupted after a timeout; final input uses one text event after native selection.
Changed-test lint/format checks, generated route types/TypeScript, and fresh
production builds passed. Full unit/component/E2E suites were not rerun for this
test-only follow-up; earlier complete runs remain separate historical evidence.

## Phase 4 — Layout presets and starters

- [x] P4.1 Control positioning, typography, paper, spacing, and colors; layout changes
      preserve data/selections and explain unsupported fields.
- [x] P4.2 Save/name/apply/duplicate/delete appearance-only presets with preview/undo.
- [x] P4.3 Create structure-only starters with section/order/field defaults and layout.
- [x] P4.4 Use Duplicate resume for content-bearing reuse; defer content-bearing starters.
- [x] P4.5 Copy settings on apply; no live inheritance from starters or presets.
- [x] P4.6 Offer starters in Create resume and presets in Layout; include them in backup/undo.

Implemented Layout, appearance-only presets, editable empty starters, reviewed
atomic starter creation, and copied future-selection field defaults. Current
development data requires template `yabuki-reference@1.0.3` and the complete
layout model; no earlier layout/template compatibility or automatic reset.
Browser Mode, production E2E, visual and manual/PDF acceptance are delegated to
the owner and remain unexecuted for this implementation. Authored browser cases
are not passing evidence. See maintained README and docs/verification.md for
behavior and remaining acceptance; earlier deferred work remains open.

Non-browser verification on 2026-11-05: formatting, lint, generated route types /
TypeScript, 115 unit tests across 13 files, and production build passed. Compiler
preparation verified the unchanged font/package bundle and updated template
metadata. Initial stale-sample and schema-composition failures were fixed;
sandbox retries resolved unit-startup and formatter-scan EPERM errors. Seven new
Browser Mode cases and two desktop/phone E2E definitions were type-checked and
left unexecuted for the owner. No visual, computer-use, or manual/PDF validation
was performed. Maintained documentation links and diff whitespace were checked.

## Phase 5 — Settings and navigation

- [ ] P5.1 Provide appearance, content-language, editing/preview, data/backup, and default settings.
- [ ] P5.2 Identify device-only versus workspace settings and their backup/sync scope.
- [ ] P5.3 Provide durable validated routes, reload, Back/Forward, and missing-resource states;
      never put private text or secrets in URLs.
- [ ] P5.4 Preserve drafts, focus, scroll, issue navigation, and narrow-screen access;
      keep transient controls local and guard dirty navigation.

## Phase 6 — Saving and bounded PDF resources

- [ ] P6.1 Verify compiler, worker, PDF, canvas, URL, timer, listener, and history lifecycles.
- [ ] P6.2 Distinguish recovery, Save, preview, backup, and future release status.
- [ ] P6.3 Default to manual refresh; optional automatic refresh uses committed output changes only.
- [ ] P6.4 Bound active/queued work, reject stale results, and release obsolete resources;
      define hidden-preview behavior.
- [ ] P6.5 Retain a labeled last successful preview on failure with revision/staleness and retry.
- [ ] P6.6 Verify draft/Save/recovery/conflict/history boundaries; Save never requires compilation.
- [ ] P6.7 Verify conditional guest writes, generation checks, other-tab conflicts, and
      clearly disclosed session-only recovery when durable storage is unavailable.
- [ ] P6.8 Manually exercise rapid edits/switches, hidden previews, failures, and cleanup.

## Phase 7 — Local acceptance

- [ ] P7.1 Verify onboarding, independent language resumes, visibility/order, facts, and overrides.
- [ ] P7.2 Verify language labels, dates/regions, fonts, direction/hyphenation as applicable,
      metadata, links, selectable text, and layout; disable unsupported PDF output.
- [ ] P7.3 Verify presets/starters, settings/routes, save/preview/history, keyboard, and narrow layouts.
- [ ] P7.4 Restore workspace/recovery exports on disposable origins; rejected imports preserve work.
- [ ] P7.5 Inspect actual PDFs for accents, long text/URLs, omissions, overflow, and stale failures.
      Page counts do not establish clipping, PDF/UA, or ATS compatibility.
- [ ] P7.6 Record static/build/manual evidence and update affected documentation.
- [ ] P7.7 Run relevant unit/browser/application suites; record actual counts and limitations.

## Phase 8 — Future accounts and Prisma Postgres

Requires owner activation, approved infrastructure, and a stable local model.

- [ ] P8.1 Review Dayplan patterns and selected-version official docs; copy no credentials/versions.
- [ ] P8.2 Decide providers/access, sessions, runtime, Prisma version/driver, and connection mode.
- [ ] P8.3 Implement login/logout/expiry, settings, and ownership checks on every private operation.
- [ ] P8.4 Persist user-owned content/configuration; choose schema structure from consistency needs.
- [ ] P8.5 Prepare immutable local Save requests, send immediately, and confirm only on server
      acknowledgment; use atomic scope checks/receipts/retries and measure database operations.
- [ ] P8.6 Provide explicit reviewed guest import; login never silently merges or replaces work.
- [ ] P8.7 Isolate account/guest caches and recovery; preserve pending work on logout/switch.
- [ ] P8.8 Test real isolated-database ownership, atomicity, retries, import, and isolation;
      manually verify real provider callbacks and expiry.

## Phase 9 — Future sync

Requires authenticated shared storage; local tab coordination is not device sync.

- [ ] P9.1 Detect revisions on focus/reconnect and a documented event/periodic mechanism;
      measure freshness and preserve dirty drafts.
- [ ] P9.2 Coordinate tabs; server revision checks remain authoritative across devices.
- [ ] P9.3 Retain both conflict versions with compare/export/explicit resolution.
- [ ] P9.4 Recover offline work safely; bound eligible history without expiring unresolved recovery.
- [ ] P9.5 Verify simultaneous/offline/sleeping clients, retries, account changes, and expiry
      through automation plus actual browsers/devices. No coauthoring requirement.

## Phase 10 — Future public PDF releases

Requires accounts, hosted artifacts, and an approved latest-release policy.

- [ ] P10.1 Explicitly release reviewed content; private resumes stay private.
- [ ] P10.2 Store immutable PDFs with content, locale, template/runtime, and settings identity.
- [ ] P10.3 Provide pinned/latest URLs; latest advances through explicit release by default.
      Automatic release requires opt-in; typing never publishes.
- [ ] P10.4 Atomically advance latest after successful storage/validation; failures preserve old links.
- [ ] P10.5 Expose only intended release artifacts/metadata; unlisted URLs are not authentication.
- [ ] P10.6 Provide link/history/latest/rollback/revocation controls and retention/cache policy.
- [ ] P10.7 Serve correct PDF headers, filenames, caching, and documented latest freshness.
- [ ] P10.8 Verify anonymous/private access, pinned stability, advancement/failure, rollback,
      revocation, caches, and artifact/cost bounds on hosted infrastructure.

## Phase 11 — Future hosted readiness

- [ ] P11.1 Document hosting, secrets/callbacks, migrations, artifact access, and compiler assets.
- [ ] P11.2 Define deletion/retention/restore policy and perform a recovery exercise.
- [ ] P11.3 Bound inputs, compilation, abuse, and storage; avoid logging private content.
- [ ] P11.4 Verify HTTPS, ownership/origin checks, isolation, caches, browsers, and measured budgets.
- [ ] P11.5 Record real hosted acceptance and limitations; local tests do not prove deployment.

## Out of scope unless separately requested

Portfolio/public APIs, LinkedIn integration, AI translation/rewriting, arbitrary
LaTeX/templates, a marketplace/freeform designer, billing, coauthoring, all-script
PDF promises, formal PDF/UA, automatic draft publication, translation tracking,
groups, user-defined field types, and content-bearing starters.

## Pending follow-up — solve after Phase 1

These open acceptance items are deferred by the owner. They do not block roadmap
progression and must not be reported as passed. Preserve the contracts above;
future changes still need relevant regression checks. Resolve before claiming full
local acceptance in Phase 7, or explicitly revise that acceptance scope.

- [ ] F1 Final regression pass: formatting, lint, route generation/typecheck, unit,
      Browser Mode, and production E2E/build; record actual counts. The requested run
      was interrupted before execution; previous green runs predate the final edits.
- [ ] F2 Verify final batched import transfer and uncertain-operation discard:
      Unicode/prototype safety, cancellation/error cleanup, newer-version protection,
      receipt resolution, restart recovery, and interrupted Save/history retries.
- [ ] F3 P1.7 acceptance: reverify automatic schema-2 workspace/recovery round trips
      and obtain manual disposable-workspace sign-off. Cover identities, wording,
      overrides, selections/order, appearance, capacity, and no writes on rejected input.
- [ ] F4 Finish performance evidence: retain valid historical results, identify
      affected/missing rows, and complete the normal/4x matrix with the enriched fixture.
      Compare p50/p95/max/counts/failures against the recorded budgets; report mixed-build
      limitations or rerun comparisons on the same build. No mandatory soak.
- [ ] F5 Close measurement gaps: Save click-to-acknowledgment, recovery during continuous
      typing, storage-failure announcement latency, real import long tasks/progress,
      and cached-cold/warm compiler samples. Separate controller timings from UI timings
      and first fetch/run from proven uncached download. Evaluate budgets explicitly.
- [ ] F6 Owner review: restored presentation and English/Portuguese PDF layout/clipping;
      retain automated text/font/link/metadata evidence separately.
- [ ] F7 Reconcile final results and limitations in requirements, evidence, README,
      and handoff. Record the final source/build and remaining acceptance gaps.
