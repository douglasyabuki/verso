# Verso

Next.js 16.4.2 / React 19.3 application using TypeScript, Tailwind CSS 4, npm, and the root `app/` directory. This repository currently contains the starter application with adopted development tooling. Product implementation is deferred.

Use Node.js 20.19+ and npm 11.3.0. Install the lockfile with `npm ci`, then run `npm run dev` and open http://localhost:3000.

| Command                | Purpose                                                        |
| ---------------------- | -------------------------------------------------------------- |
| `npm run lint`         | Next.js/TypeScript lint and import sorting                     |
| `npm run lint:fix`     | Apply available ESLint fixes                                   |
| `npm run format`       | Format supported files, including Tailwind class ordering      |
| `npm run format:check` | Check formatting                                               |
| `npm run typecheck`    | Generate Next.js route types, then run TypeScript              |
| `npm test`             | Build/start the production app and run Chromium smoke coverage |
| `npm run build`        | Build the production app                                       |
| `npm start`            | Serve the built app                                            |

Install Playwright's managed Chromium browser before the first test run, using the same workspace-local path as `playwright.config.ts`:

```powershell
# PowerShell, from the repository root
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PWD '.cache/ms-playwright'
npx --no-install playwright install chromium
npm test
```

```sh
# POSIX shell, from the repository root
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npx --no-install playwright install chromium
npm test
```

Tests build and start a fresh production server on `localhost:3100`; keep that port free. The current app and tests require no credentials. Builds fetch the scaffold's Geist fonts from Google.

Active configurations live at the repository root and reusable skills live under `.agents/skills/`. Existing Next.js agent instructions are preserved in [AGENTS.md](AGENTS.md).
