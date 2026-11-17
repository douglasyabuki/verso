# Tests

Read the `vitest-testing` skill in the application's root `.agents/skills/` before authoring tests or choosing regression checks. Resolve the relative path from the actual test directory, especially with a `src/` layout.

- Organize by runner, then feature: `unit/`, `db/`, `browser/`, and `e2e/{guest,accounts}/`. Use `.unit.test.ts`, `.db.test.ts`, `.browser.test.tsx`, and `.spec.ts` respectively. Name files for behavior rather than implementation phases. Keep optional production measurements in `measurements/`.
- Give each contract one primary layer: pure rules in unit tests, server transactions/security in isolated database tests, browser storage/interactions in browser tests, and a few complete journeys in E2E. Keep a second layer only when it verifies a distinct integration boundary. Avoid cosmetic assertions and repeating every editor permutation.
- Keep single-suite helpers beside their tests; shared runner-specific setup belongs in `support/{db,browser,e2e}/`, and reusable static inputs in `fixtures/`. Install lifecycle hooks explicitly and preserve resource cleanup when splitting suites.
- `npm test` runs all core layers with Chromium E2E. Use `test:e2e:all` and `test:e2e:accounts:all` for the optional three-engine matrix; use `test:measure` separately. Browser transactions, quota failures, and compiler/PDF output still require their real boundaries.
- Assert observable behavior and independent expectations. Prefer typed fixtures and isolate accounts, storage, listeners, timers, and databases. Mocked persistence is not evidence of database correctness.
- Run targeted non-watch checks and confirm test counts. Check changed TypeScript separately. Report failures and blocked checks; do not add skips or retries to conceal failures.
