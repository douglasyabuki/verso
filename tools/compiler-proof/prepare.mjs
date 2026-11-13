/**
 * Run the compiler asset preparation (prepare.py) with an available Python 3.
 *
 * Tries `python3`, then `python`, then the Windows `py -3` launcher, and requires
 * Python 3.10 or newer. On Vercel (`VERCEL` is set) downloads are cached under
 * `.next/cache`, which the Next.js build cache restores between deployments.
 * Arguments are forwarded unchanged and the exit code is propagated.
 *
 * @example
 * node tools/compiler-proof/prepare.mjs --assets-only --if-needed
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

const candidates = [
  ["python3", []],
  ["python", []],
  ["py", ["-3"]],
];

const probe = "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)";

const python = candidates.find(([command, prefix]) => {
  const result = spawnSync(command, [...prefix, "-c", probe], {
    stdio: "ignore",
  });

  return result.status === 0;
});

if (!python) {
  console.error(
    "Compiler preparation needs Python 3.10+ on PATH (python3, python, or py -3).",
  );
  process.exit(1);
}

const env = { ...process.env };

if (env.VERCEL && !env.VERSO_COMPILER_CACHE) {
  env.VERSO_COMPILER_CACHE = path.join(
    root,
    ".next/cache/verso-compiler-downloads",
  );
}

const [command, prefix] = python;

const result = spawnSync(
  command,
  [...prefix, path.join(here, "prepare.py"), ...process.argv.slice(2)],
  { cwd: root, env, stdio: "inherit" },
);

process.exit(result.status ?? 1);
