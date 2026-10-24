# Verso brand identity

Verso is a quiet bilingual editing studio. Graphite provides structure; teal identifies primary actions, selection, and focus. The app identity never changes the typography or colors of exported resumes.

## Palette roles

| Semantic role                     | Light     | Dark      |
| --------------------------------- | --------- | --------- |
| Workspace background              | `#F5F7F6` | `#191D1E` |
| Cards, editing surfaces, overlays | `#FFFFFF` | `#222829` |
| Main text                         | `#202827` | `#EDF2F1` |
| Primary action and focus          | `#1F6258` | `#8DCCBF` |
| Primary action text               | `#FFFFFF` | `#18201F` |
| Selected surface                  | `#DEEEEA` | `#263D39` |
| Muted text                        | `#586762` | `#AFBDB8` |
| Primary hover                     | `#174C44` | `#A7DDCF` |
| Fine borders and rules            | `#D4DEDA` | `#44514D` |
| Essential control borders         | `#7B8D88` | `#82958E` |
| PDF surround                      | `#E2E7E5` | `#121617` |

Use semantic Tailwind tokens from `app/globals.css`, such as `bg-card`, `text-muted-foreground`, `border-input`, and `bg-accent`. Fine borders separate surfaces; input borders identify controls. Primary buttons use the exact hover token. Disabled controls use neutral surfaces and reduced emphasis. Error, warning, and success tokens retain their own meanings. Resume color tokens remain user selections, including rose; they are not app branding.

## Typography and spacing

Geist Sans is self-hosted through `next/font` in `app/layout.tsx`, with Latin and Latin Extended subsets for English and Portuguese. Use weight 500 for page and section headings and navigation emphasis. Page headings are 32px on desktop and 28px below 768px, section headings 20px, body and editable text 16px, controls 14px, and metadata 12�13px. Geist Mono remains for source and diagnostics.

Use a 4px spacing scale. Overview pages use 32�40px desktop padding, 24px on tablets, and 16px on phones. Editing screens use 16�24px padding and compact section spacing. Controls have 6px radii; cards and dialogs have 10px radii. Overlays use restrained shadows; cards use fine rules.

## Logo

`components/brand/geometry.json` is the canonical 32-unit geometry: two angular pages form a V around a narrow central fold. `BrandMark` renders these paths directly. `BrandLockup` pairs the mark with lowercase `verso` in Geist Sans Medium, without punctuation. The mark inherits `currentColor`, allowing monochrome use; the normal lockup uses the primary token for the mark and main text for the wordmark.

Keep at least 8 units of clear space around the mark at its normal 32px size. The horizontal lockup uses a 10px gap between mark and wordmark. Do not stretch, rotate, add a dot, introduce pink, or alter the fold. Use the lockup in the navigation header and the standalone mark in the workspace header whenever navigation is hidden. Decorative mark instances are hidden from assistive technology; the lockup has one accessible name.

Exported assets live in `public/brand/`: horizontal and standalone versions for light, dark, and monochrome use. Horizontal SVGs embed Geist, so the wordmark does not depend on the recipient having the font installed. `node tools/brand/generate.mjs` rebuilds these assets, `app/icon.svg`, `app/favicon.ico` (16, 24, and 32px PNG entries), and the 180px Apple touch icon from the shared geometry. It uses existing toolchain dependencies, with no new runtime dependency. The SVG icon adapts to system appearance; the ICO uses dark teal on transparency, and the Apple icon uses white on teal.

## Workspace components

The 56px utility rail remains separate from the 256px navigation sidebar at widths of 768px and above. It contains data/backup and appearance controls, without an avatar. Below 768px the off-canvas navigation exposes the same controls. Selected navigation receives a teal-tinted surface, medium text, and a slim teal marker.

`WorkspaceHeader` owns both header rows. `WorkspaceToolbar` composes navigation context, history, local-save status, and preview controls into the first row. Contextual controls occupy the second row: resume selection and output language where applicable, JSON backup freshness, and downloads. Local-save status and backup freshness remain independent. Groups wrap without a horizontal header scroller. Save/recovery feedback remains a separate visible region below the header.

Below 1024px retain the editor/PDF switch; desktop retains the saved preview split and resizable panes. Keep PDF pages white on `bg-preview-surface`. Use the existing menu, dialog, field, card, review, and feedback primitives so tokens and keyboard interactions remain consistent.
