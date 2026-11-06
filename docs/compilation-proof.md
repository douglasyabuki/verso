# Browser compilation milestone

The independent demonstration server can be started separately from the editor:

```sh
npm ci
npm run compiler:prepare
npm run compiler:proof
```

Open <http://127.0.0.1:3199>. Python 3.12+ prepares assets using its standard
library. The browser runtime uses no compilation server, Docker, package proxy,
or third-party font/package requests. The local Node process only serves files.

The reference comparison requires private inputs that are not distributed with
this repository. A fresh checkout can prepare the compiler assets and run the
editor with fictional content, but cannot reproduce that comparison alone.

## Inputs and template adaptation

Private English and Portuguese LaTeX projects and their PDFs were used as source
and visual references during local development. Their content is not committed
or embedded as starter data. Both references have three
A4 pages. The supported design keeps Inter Regular/Bold/Black, Font Awesome 5,
sepia uppercase headings with rules, the centered contact header, and original
margins and section hierarchy.

`adaptReferenceSource` only guards the pdfTeX-specific `pdfgentounicode`
primitive, chooses the XeTeX color driver, maps the Type 1 weight aliases to
explicit Inter weights, and adds author/language metadata. It does not replace
the design. XeTeX and pdfTeX do not produce pixel-identical line wrapping.

## Pinned self-hosted bundle

`tools/compiler-proof/resources.lock.json` records every archive URL, archive
SHA-256, selected member, and member SHA-256. Preparation fails on changed bytes.
The Inter mirror URL is mutable: a changed mirror archive will be rejected;
retain the verified `.cache/compiler-proof/downloads` cache for reproducibility.

The engine is SwiftLaTeX release `v20022022`, XeTeX WebAssembly 0.3.0, followed
by its XDV-to-PDF worker. The upstream prebuilt 2020 format is incompatible with
the package snapshot. `format.fmt.gz` contains the browser-rebuilt format using
LaTeX2e 2021-11-15 patch 1 and L3 2022-02-24. It has English and Portuguese
hyphenation patterns; the build transcript and format digest are included.

The resource set has 108 files totaling 31,836,898 bytes before encoding. The
compressed bundle is 11,325,183 bytes; engine JS/WASM adds 3,940,776 bytes. The
generated manifest records exact sizes and hashes. PDF.js assets are additional
and come from the pinned npm dependency.

Preparation replaces the workers' package resolver with a lookup into preloaded
MEMFS. Missing resources return “not found”; there is no network fallback.
Both workers receive the same local resources. The demonstration also sends a
Content Security Policy limiting script, worker, and connection origins to self.
Preparation removes unconditional BibTeX execution because resumes have no
bibliography. Logs retain the remaining upstream warnings.

The final bundle uses the exact template identity exported by
`lib/resume/model.ts` and mirrored in `tools/compiler-proof/prepare.py`.
Page-boundary review added
the pinned `needspace` package to keep section/entry headings with their details.
Both reference outputs were rechecked in all three available browsers afterward.

## Template color settings

The structured renderer supports heading and body color presets using the already
bundled `xcolor` and `hyperref` packages. The initial document format uses
`yabuki-reference@1.0.0` with template-default colors and scoped layout overrides.

Template identity is stored in `manifest.json`, outside `resources.bundle`.
When only that identity changes, refresh metadata without rebuilding payloads:

```sh
npm run compiler:prepare -- --manifest-only
```

This path verifies asset sizes/hashes, compressed bundle integrity, resource
metadata, and the current compiler source in both prepared and public locations
before writing either manifest. It requires the current template identity. Missing or invalid assets require full preparation. Worker,
font, package, and bundle bytes remain unchanged by a manifest-only refresh.

For the color-settings implementation, manifest-only preparation completed with
bundle SHA-256 `ff88716cbb2b4bf2ed2b33d6a92fa326492599183cec7af810aa877733193c6a`
unchanged. Browser and bilingual PDF review were left to the owner at their
request; historical observations do not establish acceptance of the current renderer.

## Layout and fonts

A later time-bounded continuation fixed Hollow circle markers requesting
unbundled math fonts. They now use the existing regular Font Awesome circle
for both the label and its measured width. Twelve A4 manual specimens compiled
across all three fonts, both languages and default/explicit list spacing, with
correct totals and no off-page text spans. Four complete three-page contact
sheets were visually reviewed. Full manual acceptance remains incomplete.
No automated tests were run.

The scoped inspector and renderer support pinned static Source
Sans 3 and Source Serif 4 faces. Both fonts include regular, bold, black and
matching italics with OFL notices. The rebuilt bundle contains 120 resources,
34,831,218 uncompressed bytes and 13,422,161 compressed bytes, SHA-256
`3c210a9f96146a123f48e0839e62cf6b2db19bc5f0bd905296938b466748e40e`.
The engine and format are unchanged. Manifest-only refresh now also compares the
prepared resource lock with the repository lock; resource changes require full
preparation.

Default structured output was pixel-identical to the captured baseline in both languages.
Twelve extreme font/paper/language combinations compiled in Chrome, plus two
oversized-heading cases. These observations do not establish complete acceptance.
A further continuation corrected first-list heading reservations, first-detail
link spacing, and a long Portuguese Letter heading overflow. Default bilingual
PDFs remained pixel-identical to the captured baseline outputs. Twelve additional
oversized font/paper/language cases compiled with all six real faces for each
family embedded, including regular, bold and black italics.
The historical browser matrix below does not verify subsequent renderer changes.

Final continuation checks: `npm run format:check`, `npm run lint`,
`npm run typecheck` and `npm run build` all passed after the renderer and
autosave corrections. No automated tests were added or run. The final manual compiler pass
completed all 35 prepared cases, including both full private references;
compatibility defaults again matched all six captured baseline pages exactly.

## Observed browser results — October 19, 2026

These are historical local observations, not production performance guarantees
or verification performed by checking out this repository. The private inputs,
generated PDFs, and browser inspection evidence are not included. Each run
started fresh workers and an uncached bundle response, compiled English, then
Portuguese, then English again. Compilation includes two TeX passes and PDF
conversion. Initialization includes bundle loading, decompression, verification,
and worker population.

| Browser on Windows   | Initialization | First English | Portuguese | Repeated English | Result                                       |
| -------------------- | -------------: | ------------: | ---------: | ---------------: | -------------------------------------------- |
| Chrome 155.0.8059.82 |         2.43 s |        3.06 s |     2.62 s |           2.77 s | Both PDFs and extraction work                |
| Edge 155.0.4283.62   |         2.37 s |        2.78 s |     2.54 s |           2.52 s | Both PDFs and extraction work                |
| Firefox 158.0        |         1.65 s |        2.50 s |     2.39 s |           2.51 s | Both PDFs and extraction work                |
| Safari               |            n/a |           n/a |        n/a |              n/a | Unverified; unavailable on this Windows host |

Chrome/Edge inspections blocked nonlocal requests. A Chrome built-in PDF-viewer
extension stylesheet was blocked; no remote TeX/font resource was requested.
Firefox ran under the same self-only CSP and network-free package resolver.
The WebAssembly proof passed in these installed browsers; mobile browsers and
assistive technologies have not been evaluated.

The configurable defaults are 120 seconds for initialization and 30 seconds
for compilation. These deliberately exceed the measured local maxima to allow
slower hardware and first downloads. They are not validated universal limits.
Timeout terminates both workers; retry creates fresh instances. At most one job
runs per compiler instance, and source input is limited to 1 MB. WebAssembly
memory remains bounded by the upstream engine's compiled limits; no portable
browser-level memory quota is claimed.

## PDF inspection and limits

Generated PDFs from the local review are ignored and are not included in the
repository. The following findings describe that review. Both generated
documents have three A4 pages, embedded Inter Regular/Bold/Black and Font Awesome
fonts, the correct document language and author, and all 21 reference link
targets unchanged. Portuguese headings, accents, and technology names survive
extraction without replacement characters. All six pages were rendered and
visually compared with the references; the design is preserved, with some
different line breaks from the XeTeX/OpenType path.

Font Awesome's decorative glyphs produce imperfect extracted characters because
the upstream converter lacks their ToUnicode mappings. The adjacent contact
text/URLs remain readable. The diagnostics expose this rather than hiding it.
The upstream converter also reports absent default font maps and unsupported
configuration/version specials; these did not prevent the embedded-font PDFs
from rendering or preserve fewer links. No PDF/UA, screen-reader, or universal
ATS conformance is claimed. Safari and assistive-technology review remain open.

No automated test suite was added or executed. Browser inspections used the
demonstration interactively through browser control/console APIs; PDF inspection
used PDF.js and local PyMuPDF/pypdf tooling.

## Licenses and maintenance

Third-party notices are in `tools/compiler-proof/licenses/`. SwiftLaTeX's
repository is AGPL-3.0; the worker modifications are in the preparation script.
Inter and Font Awesome Free fonts use SIL OFL 1.1. Their TeX support and the
selected LaTeX packages retain their individual headers/licenses, commonly LPPL.
PDF.js uses Apache-2.0. Exact original archives remain in the download cache.
The supplied template readme credits Rover Resume by Subidit; its Overleaf page
identifies CC BY 4.0. The source readme, attribution, and changes are retained
with source exports.
This is a local implementation; hosted deployment and redistribution packaging
are outside this pass.

After changing fonts, packages, worker patches, or the template, regenerate the
bundle and repeat both language compilations with external fetching disabled.
Review every page, fonts, links, extracted text, initialization/compile timings,
and the browser matrix before claiming compatibility with the changed bundle.

## Structured links and profile order

The structured renderer resolves shared link labels and explicit or automatic icon types
through the same pure domain helpers as the editor. Existing
Font Awesome commands, fonts, spacing and layout remain in use. Profile icons
respect contactIcons; entry links retain icons. No resources were added.

Manifest-only preparation detected stale compiler source in the local prepared
assets. Full `npm run compiler:prepare` succeeded using locked resources; bundle
SHA-256 remained `3c210a9f96146a123f48e0839e62cf6b2db19bc5f0bd905296938b466748e40e`.
The supplied reference header and Showcase pages were rendered with PDF.js and
visually inspected. Browser compilation and generated bilingual PDF acceptance
are delegated to the owner; historical checks above do not verify the current renderer.

The initial document format is schema 1 with template `yabuki-reference@1.0.2`.
Profile output follows each resume's ordered contact references. Adjacent emitted
city and country fields share a location item in their chosen order. Internal
organizational names never appear in generated resume content. Browser compilation
and generated-PDF validation of these behaviors belong to the owner.

## Explicit social link types

Template `yabuki-reference@1.0.1` added Instagram rendering via the existing
Font Awesome 5 brand font. Website / other is the default; GitHub, LinkedIn and
Instagram are explicit choices. Dedicated profile email and phone rendering
retains its envelope and mobile icons without creating social links.

The template version is mirrored in the prepared manifest. The compiler resource
bundle is unchanged: SHA-256
`3c210a9f96146a123f48e0839e62cf6b2db19bc5f0bd905296938b466748e40e`.
The locked Font Awesome mapping contains `\faInstagram` and its brands glyph.
Full compiler preparation succeeded. Browser/PDF visual review was unavailable
because browser access was disconnected; font availability does not establish
rendered-PDF acceptance. No automated tests were added or run.

Only the current template version and current link enum are accepted on
import/load. Older template versions and removed link types are rejected,
following the application's single-version policy; no migration is provided.

Template `yabuki-reference@1.0.2` expands the explicit link types to Behance,
Dribbble, GitHub, GitLab, Google Scholar, Instagram, LinkedIn, Medium, TikTok,
Website / other, X (Twitter), and YouTube. Website / other is pinned first in the
editor, followed by the platforms in alphabetical order.
Brand SVGs and the additional brands font come from Font Awesome Free 6.7.2,
pinned by archive and font SHA-256 in `resources.lock.json`. This includes the
Google Scholar, TikTok, and current X logos. The existing Font Awesome 5 fonts
continue to provide generic link, email, phone, and other template icons.
Both licenses are included in the prepared assets and LaTeX source exports.

Full compiler preparation succeeded with 121 resources, 35,394,414 uncompressed
bytes, and a 13,764,920-byte compressed bundle, SHA-256
`bb17934203d93c9cbedbed5ad34022f65c7f42487b8e17abd84d211a44ab2f3e`.
Browser access was unavailable for this change, so rendered-PDF and editor visual
acceptance remain unverified. No automated tests were added or run.

## Active career appearance template

The active career renderer uses `yabuki-reference@1.0.3`, including complete
appearance settings, contact rows/separators/icons, subtitle roles, section
casing, and committed spacing. Earlier development template/layout data is
unsupported without conversion. Appearance validation lives independently of the
retired editor model. The single-column design, safe text encoding, verified
language capability gating, and bundled fonts/packages remain.

Compiler preparation regenerated current metadata and verified the existing
121-resource bundle, SHA-256
`bb17934203d93c9cbedbed5ad34022f65c7f42487b8e17abd84d211a44ab2f3e`.
A manifest-only refresh rejected the older identity; full preparation passed.
This is asset verification, not compilation or rendered-PDF evidence. Browser
initialization/compilation and visual/text/font/link/metadata acceptance of the
current output are explicitly delegated to the owner in
[verification guidance](verification.md).

### Location icon command

The pinned Font Awesome 5 XeTeX helper exposes alternate icons through starred
commands. City/country contacts use `\faMapMarker*`; `\faMapMarkerAlt` is not
defined by that package. No font/package changes are needed for this correction.
The template remains `yabuki-reference@1.0.3`; this repairs its intended location
icon behavior without changing the workspace format or requiring another reset.

The English sample's reported status-1 failure was reproduced in the bundled
XeTeX WASM engine outside a browser, with an undefined-control-sequence error at
the location icon. The Portuguese sample reproduced the same failure. After the
correction, both samples completed both XeTeX passes with status 0. This verifies
the TeX-to-XDV stage only, not XDV-to-PDF conversion, browser integration, or
rendered layout. Those acceptance checks remain with the owner.
