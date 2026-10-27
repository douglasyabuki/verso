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

## Template color settings (proof.4)

The structured renderer supports heading and body color presets using the already
bundled `xcolor` and `hyperref` packages. Schema-6 documents use template
`yabuki-reference@1.0.0-proof.4`; supported schema-1 through schema-5 backups migrate
explicitly, retaining template-default colors and existing layout overrides.

Template identity is stored in `manifest.json`, outside `resources.bundle`.
When only that identity changes, refresh metadata without rebuilding payloads:

```sh
npm run compiler:prepare -- --manifest-only
```

This path verifies asset sizes/hashes, compressed bundle integrity, resource
metadata, and the current compiler source in both prepared and public locations
before writing either manifest. It accepts the preceding proof.3 identity or the
current identity. Missing or invalid assets require full preparation. Worker,
font, package, and bundle bytes remain unchanged by a manifest-only refresh.

For the color-settings implementation, manifest-only preparation completed with
bundle SHA-256 `ff88716cbb2b4bf2ed2b33d6a92fa326492599183cec7af810aa877733193c6a`
unchanged. Browser and bilingual PDF review were left to the owner at their
request; the historical observations below do not verify proof.4 output.

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
