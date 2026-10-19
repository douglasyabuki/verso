---
name: vitest-testing
description: Author, review, and debug Vitest Node and real-browser component tests, and choose Playwright application checks for a Next.js app. Use for behavior, persistence, account, async, and UI regression coverage.
---

# Testing

Read applicable agent instructions and the application's actual scripts, test globs, fixtures, and installed versions. Existing application conventions take precedence. Detailed references describe Vitest 5 and vitest-browser-react 2.3.0. Recheck them against installed declarations after version changes.

## Choose a boundary

- Node tests: domain rules, validation, adapters, controlled asynchronous races. Use a real isolated database when constraints, ownership, transactions, or query correctness are the contract.
- Vitest Browser Mode: rendered UI, providers, focus, storage, and browser events. Use `vitest-browser-react` to mount the relevant behavior.
- Playwright runner: full navigation, reload persistence, auth screens, and complete application flows. Vitest's browser `page` is a different API from Playwright's `Page`.

Use independent expected values derived from requirements. Do not generate expectations with the production algorithm under test. Prefer demonstrating the behavioral failure before fixing a reproducible bug. An import error, zero-test run, or broken harness is not a demonstrated regression.

## Isolation and interactions

Read [async isolation](references/isolation.md) for mocks, module timing, cleanup, timers, and race control, and [browser guidance](references/browser.md) for component lifetimes, accessible interactions, and async assertions. Those references are source-version notes, not proof of the destination's configuration; inspect active config for clearing, tracing, and browser selection. Optional mocking libraries must be checked in the destination manifest.

Prefer typed fixtures and real fast implementations. Mock external boundaries when needed, leaving the subject real. Await actions and retrying assertions; use controlled promises to reproduce stale responses and cancellation. Test through roles/labels and native interaction when keyboard/focus behavior is the contract. Unmount before clearing resources that mounted effects still use. Close owned listeners, timers, storage, database connections, and test servers after failures too.

Database tests must use isolated test infrastructure and separate accounts. Never reset a shared/production database. Mocked routes do not prove live OAuth or database behavior. Keep live-provider checks separate from deterministic tests.

## Run and report

Use targeted non-watch project commands and confirm that the intended files/tests executed. This application provides `npm run test:e2e -- <file>`. Node and Browser Mode projects are not currently configured; check the manifest before using additional test commands. List discovery when a filter unexpectedly finds nothing; collection alone is not execution.

Run types for changed TypeScript; Vitest transformation does not prove compiler correctness. Run a production build when framework/server boundaries need it; the supplied E2E runner already builds. Keep screenshots, traces, coverage, and reports out of commits. Review snapshots deliberately. Do not weaken assertions, add skips, or add retries to hide a failure. Report passed/failed/skipped counts and blocked infrastructure accurately. Trivial or documentation-only edits need proportionate checks rather than new tests.
