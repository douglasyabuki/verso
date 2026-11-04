<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Application agent guidance

Active configurations and agent skills live at the application root. This file records lasting engineering and product contracts; README.md records current behavior, planned capabilities, and outstanding verification. Keep both current as work ships. New product scope requires user direction.

Keep maintained artifacts self-contained: state applicable behavior, contracts, limitations, and instructions directly in README.md, agent guidance, skills, and permanent reference docs. Do not rely on phase numbers or temporary requirements, evidence, or handoff files for essential context. Those planning files will be deleted after implementation; preserve lasting guidance and outstanding acceptance in maintained artifacts before removing them. Links to maintained source or permanent references may supplement that context.

## Framework and dependencies

- Read the relevant installed Next.js guide in `node_modules/next/dist/docs/` before framework code changes. Resolve Next.js from the application package in a monorepo. If bundled guides are absent, consult official docs for the installed release. Do not assume APIs or conventions from memory. Preserve Next.js-generated agent guidance when merging this file.
- Inspect the manifest, lockfile, runtime, and installed declarations before adopting examples. Use the existing package manager. Keep dependency changes scoped and preserve the application's selected versions.
- Load `.agents/skills/nextjs-oauth-persistence/SKILL.md` for auth, protected data, and persistence work. Load `prisma-orm-setup` before Prisma setup or connection repair; the bundled CLI/client references target Prisma 7 and do not define a new app's default version.
- Load `vitest-testing` when choosing or implementing regression checks, `react-state-performance` for rendering/state investigations, and `shadcn` only if that UI system is used. Read conditional Prisma migration/adapter skills only when their work applies.
- Load `.agents/skills/dnd-kit/SKILL.md` for drag-and-drop work and verify its guidance against the installed package declarations.

## Code organization and conventions

- Before working in a folder, read and follow its applicable `AGENTS.md` instructions, including those in parent folders. Root guidance applies throughout the repository; more specific folder guidance applies within its scope.
- Keep routes and layouts in `app/` or `src/app/`, following the existing layout. Keep domain rules independent of React, transport, and persistence. Keep credentials, auth configuration, and database clients in server-only modules. Put only necessary interactive code behind client boundaries.
- Keep reusable hooks directly in `hooks/` and feature-specific hooks in feature subfolders. Name a hook's options type `<HookWithoutUse>Options`.
- Leave a blank line after imports and between declarations. Use the formatter and import-sort rules rather than manual formatting conventions that conflict with tooling.
- Document custom hooks and library functions with one JSDoc block describing purpose, parameters, meaningful return values/alternatives, and a useful example. Keep TypeScript types in signatures.
- Keep observable application state and persistence in `stores/`, shared contracts and declarative defaults in `types-and-constants/`, and external-library declarations in `types/`. Keep private implementation types local and avoid runtime cycles through schema-derived contracts.
- Preserve existing UI primitives and accessible interactions. Choose client state tools based on coordination and subscription needs; persistence alone does not justify a global store.

## Validation

- Use the smallest check that verifies the changed contract. Add tests for meaningful behavior and regressions, not trivial edits or implementation-shaped assertions.
- Run relevant non-watch tests and confirm file/test counts. Check types for changed TypeScript and lint changed code. Use a production build for framework, bundling, server/client, and deployment changes.
- Test database behavior against isolated test infrastructure when database correctness is the contract. Mocked APIs do not prove real OAuth or durable writes. Never point destructive test setup at shared or production data.
- Report checks actually executed, failures, skipped tests, and blocked infrastructure. Documentation-only changes need link/config validation rather than the whole application suite.

## Verso adoption decisions

- Use npm and the existing package-lock.json. The application uses Next.js 16.4.2, React 19.3, Tailwind 4, TypeScript, and root app/ routes; @/* resolves from the repository root.
- Preserve next.config.ts framework and Turbopack settings. Generate route helpers with next typegen before standalone type checks.
- The active app provides career forms, extensible languages, separate recovery, IndexedDB Saves, schema-2 backups, and minimal imported-resume output; the former schema-1 editor is unmounted. README.md distinguishes delivered capabilities from planned work. Authentication, account persistence, publication, public APIs, portfolio/LinkedIn integration, and deployment remain future scope until activated. Automated behavior and regression tests are in scope.
- Future authenticated storage is Prisma/Postgres with Better Auth GitHub/Google. Keep this preparation conceptual; do not add empty modules or unused account adapters. Inspect the selected versions, their official documentation, deployment runtime, and provider requirements before implementation.
- Run npm run format:check, npm run lint, npm run typecheck, and npm test for tooling changes. npm test runs unit and browser suites, then builds and starts a fresh production server on localhost:3100 for Chromium, Firefox, and WebKit E2E coverage; this is not complete product acceptance coverage.
- Vitest Node/browser projects are configured with target behavior coverage. Add meaningful cases alongside changes. Do not add empty suites or passWithNoTests.
- .agents/skills/ is excluded from automatic formatting/linting. Preserve customizations if updating skills later.
- See README.md for setup and verification commands. Current tooling requires no external credentials.

## Accepted target architecture

- Preserve the contracts in this file when extending the app. Planned capabilities and deferred acceptance in README.md are not claims of delivered or verified behavior. Deferred verification does not block subsequent user-authorized development; do not silently count it as passed.
- One language per resume; English UI; extensible content languages with verified English/Portuguese PDF output. Defer translation tracking, review acknowledgments, groups, and user-defined field types. Built-in fields and custom sections remain in scope.
- Language deactivation hides creation choices while retaining wording and usable existing resumes; activation, interface language, and verified PDF support are separate. Use Create copy in another language with destination career wording, copied selection/order, compatible layout, and font/rendering warnings; no silent wording fallback or identical-appearance promise. Defer in-place language changes and permanent language-wording erasure.
- Career details own shared facts and reusable wording. All display wording can be customized per resume; shared edits never overwrite customizations. Use career wording removes the override. Starters copy empty structure/default visibility/layout; presets copy appearance, without live inheritance.
- Shared career content supports archive/restore only: hide archived content from new-selection lists, preserve existing resume output, label selections Archived in the editor, and allow per-resume removal. Defer permanent deletion until references, customizations, and durable recovery are defined; undo alone is not durable recovery. Resume deletion requires confirmation and never deletes shared career content.
- Explicit entry/form Save/Cancel includes selection and sorting. Drafts and recovery must not mutate committed workspace state, undo history, or preview inputs. Save permits incomplete content, rejects malformed values, and retains failed drafts. Dirty navigation offers Cancel/Discard/Save. Durable routes support reload and Back/Forward.
- Dirty-form keyboard undo/redo stays within the draft and never falls through to workspace history. Workspace Undo/Redo requires resolving the draft through Cancel/Discard/Save and then a separate history invocation; explain that Undo after Save undoes that save. A successful Save creates one atomic workspace step; Cancel/Discard creates none, and recovery restores an uncommitted draft.
- Draft recovery tracks scope, baseline values, and starting revision; unrelated changes alone do not cause conflicts. Offer compare/reconcile/discard recovered draft/export recovery, retaining both versions until resolution succeeds. Save atomically rechecks current state and uses a stable operation ID across interrupted-response checks/retries without duplicate commits or history steps. Conflicts and failed reconciliation retain the recoverable draft and current committed content.
- Unresolved drafts never expire automatically or get silently removed by cleanup; export does not remove them. Browser clearing/eviction can still prevent recovery. Report recovery failures promptly and offer export. Remove only the exact resolved draft version after confirmed Save or explicit Discard; retry failed cleanup on next load without deleting newer edits. Completed-operation retention defaults to 30 days or 1,000 per workspace, whichever comes first, configurable; protect pending/uncertain operations until resolved. Missing operation history means unknown, requiring comparison/reconciliation before retry, never blind replay.
- Manual preview is the default; optional automatic refresh uses only committed output-affecting changes. Saving and compilation are independent. Preserve conflicts/undo and measure responsiveness/resources separately.
- Schema 2 is the sole supported target workspace schema. This development-only app has no production deployment or users. Do not implement schema-1 compatibility, conversion, retained originals, mandatory original downloads, or legacy regression coverage. Start clean with schema 2; test its behavior, validation, backup/recovery, and safety contracts.
- Replacement validates and atomically rechecks the reviewed revision. Atomically adopt incoming and preserve outgoing committed workspace as one durable snapshot; any recoverable protocol must verify all-or-nothing behavior, with failure changing neither active workspace nor snapshot. Rollback uses the same safeguards and preserves the pre-rollback workspace. Describe this as “one previous workspace,” never version history; no automatic expiry, subject to browser clearing/eviction. Identify the snapshot being replaced and offer optional export; failure/cancellation leaves adoption uncommitted until retry or explicit continuation without export. Keep unresolved recovery separate from the previous workspace. Successful replacement/rollback invalidates pending saves and stale previews.
- Workspace backups contain committed content/configuration and say “saved workspace only” when drafts exist, with separate recovery export. Device appearance/preview/compiler preferences stay device-only and survive import. Recovery exports have a separate versioned format with scope identities/baselines; import restores uncommitted drafts. Replacement preserves recovery; missing original records require explicit restore-as-new or export, never silent dropping or attachment to unrelated records. Neither export includes account or public-release credentials.
- Establish behavior coverage alongside implementation, including real browser-component coverage for interactive slices. Name tests by behavior rather than roadmap stage.

- Guest storage uses IndexedDB transactions, workspace schema 2, and separate recovery format 1. Save atomically checks the current generation/revision and scope baseline, applies a validated patch, writes the revision/receipt, and cleans only the exact resolved draft version. Prepare immutable requests before dispatch; retry identical requests with the same operation ID. Replacement increments generation. Cross-tab notifications are hints; transaction checks are authoritative. Verify atomicity and capacity in real browsers.

- Guests commit explicit Saves to IndexedDB. Future authenticated Saves persist immutable local recovery requests and send immediately to PostgreSQL; success requires server acknowledgment. Typing remains local recovery only. Keep account/guest isolation, scope-aware server checks, atomic receipts, and safe retries; do not copy Dayplan autosave debounce or assume one HTTP request equals one database operation. Account implementation remains future scope.

## Active architecture and retained baseline

- The active root page mounts `components/career/career-workspace.tsx`. Its canonical schema-2 model and scope rules live in `lib/career/`; derived contracts live in `types-and-constants/career.ts`. `stores/career/controller.ts` owns committed state, one form draft plus an independent section entry-order draft, recovery scheduling, and bounded history. `stores/career/persistence.ts` uses IndexedDB transactions across `verso-local` stores. IndexedDB replaces the baseline Web Lock/localStorage protocol for the active application.
- Order scopes contain IDs only; independent wording changes do not change order baselines. Shared identities cannot be removed or retyped by ordinary Saves. Creation uses distinct scopes; Undo archives created content and Redo restores its identities. Whole-document replacement must use the reviewed atomic head/previous-workspace path, never an editing scope.
- Independent resumes use exact `resume-details/<id>` (name/color), `resume-content/<id>` (selection/contact order/summary visibility), and `resume-wording/<id>` (overrides) scopes. Nullable `resume/<id>` is only for single-resume creation/deletion and their history, never ordinary record replacement. Undo resume creation removes that resume; Undo deletion restores its identity/configuration without touching career content. Keep older `selection/<id>` requests executable and their fingerprints unchanged. Optional schema-2 resume configuration resolves prior defaults without load-time writes; new resumes explicitly start with no optional selections. Prepared lifecycle retries check receipts before attempting creation again. Missing-resume recovery requires explicit restore-as-new with validated references or export/reconciliation; retain original recovery separately.
- Workspace schema 2 and recovery format 1 are the sole portable formats. No schema-1 migration/compatibility. The former `lib/resume`, `stores/workspace`, and schema-1 workflow contexts remain unmounted reference assets, not active behavior or target constraints. The active career editor reuses `WorkspaceShell`, the utility rail, extracted sidebar collections/toolbar presentation, layout preferences, and responsive UI primitives through `components/career/career-workspace-shell.tsx`; do not mount schema-1 providers to use that presentation. Do not add retired features for parity.
- `lib/output/template.ts` assembles the unchanged pinned template independently of content schemas; `lib/output/encoding.ts` escapes text. `lib/career/output.ts` resolves selected schema-2 wording/facts using explicit output capabilities. Output consumes committed content only. Existing selected archived content remains rendered. Minimal output does not establish full resume-editor delivery or PDF acceptance.
- Preserve the generated Next.js blocks below and above. Keep current limitations and outstanding verification in README.md so they remain usable without temporary planning or handoff documents.
- Preserve the established presentation. Exact-version discard cleanup intents use the existing IndexedDB preferences store; completed receipts stay protected until acknowledgment, with interrupted requests available for explicit recovery. Imports validate in a disposable worker. `npm run test:measure` runs explicit production measurements separately from routine `npm test`. Owner visual/PDF and manual round-trip acceptance remain separate from automated evidence.
- Vitest Node and real Chromium Browser Mode are configured with actual cases. Run `test:unit` and `test:browser` non-watch, plus relevant Playwright checks. Preserve npm and selected framework versions. Test harness versions are Vitest 4.1.0 / vitest-browser-react 2.2.0, rather than the newer versions described by skill reference notes.

## Editing and portable-data contracts

- New workspaces start with empty Experience, Projects, Education, Skills, and Certifications sections; never reseed existing content. Rich prose belongs in summaries and achievements/details; names, headings, facts, short values, and link labels use plain controls.
- Entry forms and section entry-order drafts are independent. Sorting preserves the entry draft, selection, search/filter, scroll, and hidden-ID slots. Save/Cancel affects only its scope. Leaving a section resolves each applicable draft independently; later cancellation never undoes an earlier explicit resolution. Data & backups remains accessible without resolving drafts.
- Use Cancel / Save for forms and Cancel / Discard / Save for dirty navigation, with the primary action rightmost. Disable form actions while unchanged or saving; navigation Cancel retains the draft. Recovery discovery/restoration belongs in Data & backups, not entry-order comparison panels. Preserve shared accessible controls and narrow-screen Editor/PDF switching without closing drafts.
- Workspace envelopes use `format: "verso.workspace"`, `schemaVersion: 2`, `exportedAt`, `workspaceId`, and `document`. Recovery envelopes use `format: "verso.recovery"`, `schemaVersion: 1`, `exportedAt`, `sourceWorkspaceId`, and `drafts`. Recovery carries scope identities, draft version/values, baseline values/revision/generation, and pending immutable request context. Imported receipts never prove local commits.
- Use UTF-8 JSON with stable opaque IDs, canonical language tags, validated references, and explicit template identities. Unknown versions and rejected imports cause no writes. Validate recovery structure while preserving malformed field values for editing. Portable files exclude credentials, device preferences, local operation ledgers, and compiler/PDF assets.
- Recovery scheduling uses 500 ms inactivity and a 2-second maximum wait. Close-time flushing is best effort. If IndexedDB fails, retain drafts and offer export; session-only commits require explicit choice and never overwrite durable content. Do not silently fall back to localStorage or promise durable replacement without snapshot preservation.

## Capacity, performance, and resource targets

- Safety ceilings: 120 resumes, 100 sections, 10,000 entries total, 300 entries per section, 100 achievements and 30 links per entry, 30 profile links, 100 starters, and 100 presets. Languages are byte-bounded rather than count-bounded. Preserve field/rich-text validation in the canonical model.
- Workspace documents and backup files each have a 64-MiB UTF-8 ceiling, including the file envelope where applicable. Recovery files allow 256 MiB and individual drafts 64 MiB including baseline/metadata. Split larger collections with versioned inventories; oversized individual drafts require explicit raw-chunk export. Never truncate or evict protected recovery to make room.
- Bound in-memory undo to 100 successful steps or 32 MiB of retained serialized patches, whichever comes first. Disclose dropped history and unavailable undo for oversized Saves. Replacement starts a new history generation; undo is not a backup.
- Production measurements record OS/CPU/RAM/browser/build/fixtures, p50/p95/max, counts, and failures. Report normal and 4x CPU separately. Compare the same build/fixtures; label historical or mixed-build limitations. Use small (20 entries/3 resumes), representative (300/30), multi-resume (60 independently selected/customized resumes), and capacity (near-byte/count limits, 120 resumes) fixtures with English/Portuguese content.
- Normal-speed p95 targets: input/selection/reorder <=100 ms; Save click-to-committed acknowledgment <=500 ms representative / <=2 s capacity; workspace open <=2 s representative / <=5 s capacity excluding compiler initialization. Collect at least 100 interactions and 30 Saves/opens per data fixture. Typing must not scan the whole workspace.
- Recovery acknowledgment targets <=3 s during continuous input; expose storage failure within 1 s of detection. Capacity import preview targets <=5 s with progress after 500 ms and no recurring main-thread parsing/transfer tasks above 50 ms. Targets require measurement, not assumptions from worker use.
- Compiler defaults: configurable 120-second initialization / 30-second compilation timeout; 1,000,000-byte source limit. Measure 10 warm runs (target <=5 s) and 5 cached-cold initialization-plus-compilation runs (target <=20 s) on representative 1–3-page resumes. Report proven uncached download separately.
- Allow one active compile and one replaceable latest queued request per workspace, one compiler instance/worker pair per tab, one last successful PDF, and one in-flight result. Tag work with generation/resume/output identity; reject stale results. Terminate timed-out workers before retry and release obsolete URLs/documents/canvases/listeners/timers. Verify deterministic settled bounds; no mandatory 30-minute/100-refresh soak or sustained heap-growth claim.
- Verify real IndexedDB abort/quota behavior, interrupted acknowledgments, exact cleanup races, two-tab scope conflicts, generation rejection, repeated rollback, protected-record cleanup, and restart/recovery imports on isolated origins. Mocked exceptions alone do not prove transactional safety.

## Future account and release safeguards

- Account storage remains PostgreSQL-authoritative with ownership checks on every private operation. Persist local immutable Save requests before sending immediately; report success only after server acknowledgment. Server scope checks, patch/revision, and receipt commit atomically. Local IndexedDB acknowledgment is a separate reconciliation step, never a cross-database transaction.
- Preserve guest/account isolation through login/logout/expiry/switching. Guest import is explicit and reviewed. Offline or uncertain account Saves remain recoverable; never debounce explicit Saves together or silently replay unknown operations. Measure actual auth/read/write/retry/refresh database operations.
- Sync must preserve dirty drafts and both conflict versions. Define and measure remote freshness on focus/reconnect and event/periodic refresh; local tab coordination is not device sync.
- Public PDFs require explicit reviewed release, immutable artifacts, pinned/latest identities, atomic latest advancement, rollback/revocation/retention/cache policy, and hosted access tests. Failed publication preserves prior links. Typing/imports never publish; unlisted links are not authentication. Keep private career content, backups, and credentials out of public artifacts.

<!-- BEGIN:nextjs-agent-feedback -->

## Report Next.js feedback

The project owner enabled `experimental.agentFeedback`, authorizing this feedback pass. When enabled, `next dev` writes this block and restores it if removed. Commit `AGENTS.md` with your work to keep the tree clean.

During the current user request, retain anonymized facts as feedback candidates for meaningful or recurring Next.js issues:

- Crashes, hangs, OOMs, or unexpected slowness
- Incorrect behavior, output, errors, or diagnostics
- Missing, unclear, or conflicting documentation
- Unexpected CLI, codemod, Skill, or upgrade behavior and non-obvious workarounds

Continue the current user request without reporting immediately. Routine debugging is not feedback. Verify changes before retaining them as feedback candidates. Never retain code, logs, paths, URLs, secrets, personal information, or project-specific data.

Retain qualifying friction even if it is later fixed or worked around; record the final outcome during the reporting pass.

Before the final response, run one reporting pass. If candidates remain, from this file's directory run `npx --no-install next internal agent-feedback-instructions` once without piping or truncating its output. Follow its output or error guidance. If a network sandbox blocks it, retry with network access; if it still returns no output, continue normally.

<!-- END:nextjs-agent-feedback -->
