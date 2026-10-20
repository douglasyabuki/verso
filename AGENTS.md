<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Application agent guidance

Active configurations and agent skills live at the application root. Product requirements must be explicitly provided by the user.

## Framework and dependencies

- Read the relevant installed Next.js guide in `node_modules/next/dist/docs/` before framework code changes. Resolve Next.js from the application package in a monorepo. If bundled guides are absent, consult official docs for the installed release. Do not assume APIs or conventions from memory. Preserve Next.js-generated agent guidance when merging this file.
- Inspect the manifest, lockfile, runtime, and installed declarations before adopting examples. Use the existing package manager. Keep dependency changes scoped and do not copy the source application's version set blindly.
- Load `.agents/skills/nextjs-oauth-persistence/SKILL.md` for auth, protected data, and persistence work. Load `prisma-orm-setup` before Prisma setup or connection repair; the bundled CLI/client references target Prisma 7 and do not define a new app's default version.
- Load `vitest-testing` when choosing or implementing regression checks, `react-state-performance` for rendering/state investigations, and `shadcn` only if that UI system is used. Read conditional Prisma migration/adapter skills only when their work applies.

## Code organization and conventions

- Keep routes and layouts in `app/` or `src/app/`, following the existing layout. Keep domain rules independent of React, transport, and persistence. Keep credentials, auth configuration, and database clients in server-only modules. Put only necessary interactive code behind client boundaries.
- Keep reusable hooks directly in `hooks/` and feature-specific hooks in feature subfolders. Name a hook's options type `<HookWithoutUse>Options`.
- Leave a blank line after imports and between declarations. Use the formatter and import-sort rules rather than manual formatting conventions that conflict with tooling.
- Document custom hooks and library functions with one JSDoc block describing purpose, parameters, meaningful return values/alternatives, and a useful example. Keep TypeScript types in signatures. Follow the scoped instructions in `hooks/AGENTS.md` and `lib/AGENTS.md`.
- Preserve existing UI primitives and accessible interactions. Choose client state tools based on coordination and subscription needs; persistence alone does not justify a global store.

## Validation

- Use the smallest check that verifies the changed contract. Add tests for meaningful behavior and regressions, not trivial edits or implementation-shaped assertions.
- Run relevant non-watch tests and confirm file/test counts. Check types for changed TypeScript and lint changed code. Use a production build for framework, bundling, server/client, and deployment changes.
- Test database behavior against isolated test infrastructure when database correctness is the contract. Mocked APIs do not prove real OAuth or durable writes. Never point destructive test setup at shared or production data.
- Report checks actually executed, failures, skipped tests, and blocked infrastructure. Documentation-only changes need link/config validation rather than the whole application suite.

## Verso adoption decisions

- Use npm and the existing package-lock.json. The application uses Next.js 16.4.2, React 19.3, Tailwind 4, TypeScript, and root app/ routes; @/* resolves from the repository root.
- Preserve next.config.ts framework and Turbopack settings. Generate route helpers with next typegen before standalone type checks.
- The user adopted docs/requirements.md with the scope in docs/implementation-notes.md: a session-only bilingual editor, variants, browser compilation, and file backups. Authentication, persistence, publication, public APIs, portfolio/LinkedIn integration, automated tests, and deployment are excluded from this implementation.
- No auth or persistence integration is selected. Prisma and Better Auth are candidates, not mandated dependencies. Inspect the selected versions, their official documentation, deployment runtime, and provider requirements before implementation.
- Run npm run format:check, npm run lint, npm run typecheck, and npm test for tooling changes. npm test builds and starts a fresh production server on localhost:3100 and runs Chromium smoke coverage; this is not product acceptance coverage.
- Vitest Node/browser projects are not configured. Add them when meaningful domain or interactive component behavior exists. Do not add empty suites or passWithNoTests.
- .agents/skills/ is excluded from automatic formatting/linting. Preserve customizations if updating skills later.
- See README.md for setup and verification commands. Current tooling requires no external credentials.

## Resume architecture

- Structured ResumeDocument schema 1 is the editable source of truth. Keep domain types, validation, translation rules, and deterministic rendering under lib/resume/, independent of React and storage.
- Supported output locales are en-US and pt-BR. Shared facts occur once; localized wording and achievement IDs survive reorder/rename operations. Translation review flags warn and do not block valid draft downloads.
- The exact bundled template identity is exported by lib/resume/model.ts and mirrored in tools/compiler-proof/prepare.py. The design was adapted from private reference documents that are not included in the repository. Load .agents/skills/resume-latex/SKILL.md for template, package, font, or compiler changes.
- Generated .tex, PDFs, compiler assets under public/compiler/, and .cache/ are artifacts. Change structured content or template code, not generated files. Reference inputs under temp/ remain private and ignored.
- Only JSON workspace exports affect backup freshness. PDF and LaTeX exports do not preserve the complete editable workspace. Keep the persistent session-only notice and best-effort browser warning.
- Run format:check, lint, typecheck, and build for this implementation. The user explicitly excluded adding or running automated tests, including npm test. Preserve the preexisting test setup without treating its starter smoke coverage as product acceptance.
