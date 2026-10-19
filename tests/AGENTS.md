# Tests

Read the `vitest-testing` skill in the application's root `.agents/skills/` before authoring tests or choosing regression checks. Resolve the relative path from the actual test directory, especially with a `src/` layout.

- Follow the active runner globs. Playwright flows live under `tests/e2e/` as `*.spec.ts`. If Vitest is configured later, use `tests/unit/` for `*.unit.test.ts(x)` and `tests/browser/` for `*.browser.test.tsx` unless existing conventions take precedence.
- Assert observable behavior and independent expectations. Prefer typed fixtures and isolate accounts, storage, listeners, timers, and databases. Mocked persistence is not evidence of database correctness.
- Run targeted non-watch checks and confirm test counts. Check changed TypeScript separately. Report failures and blocked checks; do not add skips or retries to conceal failures.
