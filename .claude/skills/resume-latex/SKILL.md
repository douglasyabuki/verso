---
name: resume-latex
description: Adapt or maintain Verso's supported LaTeX resume template, pinned browser compiler, fonts, or package bundle. Use for resume rendering and PDF output changes, not ordinary UI-only edits.
---

# Verso LaTeX maintenance

Read `docs/compilation-proof.md` before changing the compiler or bundle and
`lib/career/output.ts` before changing active generated source, plus
`lib/output/template.ts` and `lib/output/encoding.ts` for template assembly and
escaping. The reference is the
owner's Overleaf project/PDF pairs under `temp/`, not a newly designed template.

- The active application uses workspace schema 2, one language per resume, and
  extensible content languages. Schema-1 modules are unmounted reference assets;
  no schema-1 conversion or legacy regression coverage is required. Preserve
  content/IDs and safe encoding; never make raw LaTeX an editable field.
- Verify English/Portuguese PDFs through the same capability mechanism as future
  languages. Editable content does not imply verified PDF output; disable unsupported
  output rather than silently substituting labels, glyphs, or hyphenation.
- Preview/export consumes committed snapshots, never unsaved form drafts.
  Save does not imply compile; manual refresh is default and automatic refresh opt-in.
- Keep the template identity in the model and generated compiler manifest in
  sync. Changing supported template behavior or resources requires an explicit
  template version and backup compatibility decision; do not substitute unknown
  versions on import.
- `npm run compiler:prepare` verifies archives/resources in
  `tools/compiler-proof/resources.lock.json`, builds local assets, and extracts
  reference inputs. `npm run compiler:proof` serves the independent demonstration
  on localhost:3199. Workers must never fall back to remote package/font fetching.
- The pinned format is rebuilt for LaTeX2e 2021-11-15 / L3 2022-02-24; the upstream
  2020 format is incompatible. Preserve the format hash and build transcript.
  See the proof report for the supported Inter weights and XeTeX adjustments.
- After template/font/package/worker changes, compile both full reference
  languages and representative structured drafts. Render and visually inspect
  every page for clipping, overlaps, unwanted blank pages, and detached headings.
  Inspect extracted text, Portuguese accents, embedded fonts, all hyperlinks,
  title/author/language metadata, and page count. Check near-boundary content,
  long titles/URLs, empty optional sections, emphasis, and LaTeX special characters.
- Repeat browser initialization, first/warm compilation, timeout/retry, and
  external-request inspection. Record observations rather than assuming browser
  compatibility. Safari is currently unverified; icons have documented extraction
  limitations. Do not claim PDF/UA or universal ATS compatibility.
- Keep fonts/packages' redistribution notices with source exports. Generated
  PDFs and `.tex` files never mark the workspace as JSON-backed-up.
- Automated behavior/regression tests are authorized. Read vitest-testing and test
  deterministic rendering, selected-output validation, and stale compiler behavior.
  Retain static checks and manual browser/PDF review. Use the configured Node,
  Chromium component, and production E2E suites for affected behavior; report
  automated evidence separately from owner visual/PDF acceptance.
