# Recovery exports

Workspace backups contain saved content only. Recovery exports preserve unsaved
form and entry-order versions, including their baseline context. Export never
discards a draft. Keep the downloaded files until restoration and an explicit
Save have succeeded.

Normal `verso.recovery` format-1 files are independently importable through
Data & backups. Files are limited to 256 MiB, with each draft limited to 64 MiB
including its baseline and metadata. Larger collections are split into normal
files. Versioned manifest pages list filenames and draft IDs/versions; a filename
can appear on multiple manifest pages with disjoint draft lists. Manifests are
inventories, not importable recovery files.

An oversized draft remains in memory and requires an explicit **Export raw
recovery chunks** choice. These `verso.recovery.raw` files preserve JSON-text
fragments; they are not normal imports or a claim of durable browser recovery.
Keep every chunk for that draft version. Reassemble a single matching version:

```sh
node tools/reassemble-recovery.mjs recovered-draft.json chunk-1.json chunk-2.json
```

Pass all chunk paths, in any order. The tool rejects missing, duplicate, mixed,
or unsupported chunks and refuses to overwrite an existing destination. It joins
fragments before UTF-8 encoding so Unicode characters split at a chunk edge
survive. The result is a raw draft for manual salvage/reconciliation, not an
importable file. Retain the originals; oversized or malformed values still need
resolution within normal recovery limits.

Workspace JSON files have their own 64-MiB ceiling including envelope metadata.
A document at its independent 64-MiB ceiling may exceed the backup-file ceiling;
export reports this explicitly instead of downloading a file the app cannot import.
No export contains device preferences, local operation ledgers, or credentials.

Workspace appearance-default drafts use the exact `defaults` scope. They retain
the complete flat appearance as baseline and editable values, without nested
resume baseline metadata. Their explicit Save participates in atomic scope checks,
receipts, recovery cleanup, and workspace Undo/Redo. Malformed recovered values stay
editable and block Save until corrected. Changing workspace defaults never modifies
existing resumes or their frozen layout defaults. Workspace schema 2 and recovery
format 1 remain unchanged. Device theme, compiler timeouts, and receipt-retention
preferences are not workspace drafts and are excluded from both exports.

Resume drafts use `resume-details/<id>` for name/icon color,
`resume-content/<id>` for visibility/order/contact/summary configuration, and
`resume-wording/<id>` for display overrides. Nullable `resume/<id>` requests
represent one creation or deletion. Earlier schema-2 `selection/<id>` drafts and
prepared requests remain valid; their payloads and retry fingerprints are never
rewritten to the newer scopes. The portable envelope versions remain unchanged.

Deleting a resume does not delete its career records or unresolved recovery.
Restore as new requires an explicit active language and valid existing shared
references. It opens a fresh resume creation draft without committing it and
retains the original recovery separately. Dangling references or malformed values
require reconciliation/export rather than attaching a draft to another resume.
Imported operation IDs never prove a local commit. Locally prepared uncertain
creation/deletion requests reuse their exact operation identity and check the
receipt before attempting the mutation again.

## Section icon data

Current workspace schema-2 sections require a catalog `icon` ID. Custom sections
may use any supported ID; built-in sections require their fixed default. Starter
section definitions also include an icon. Earlier development files without
these fields are unsupported and are not converted or silently reseeded.

Section-properties recovery retains the icon in both baseline and draft values.
Malformed draft icon values remain recoverable for correction; workspace imports
reject invalid icons without adoption. Restore remains uncommitted, and the
properties form's Save/Cancel resolves the icon together with other properties.
Prepared requests keep their exact operation identity and fingerprint on retry.
Icons participate in section-property conflicts and history; entry-order scopes
remain IDs only. Workspace backups, the one previous workspace, and rollback
preserve committed icon choices. Recovery uses format 1 and workspace backups use
schema 2; no compatibility format or migration is added.

## Layout, presets, starters, and atomic creation

Workspace envelopes remain `verso.workspace`, schemaVersion 2, with `exportedAt`,
`workspaceId`, and `document`. Documents include full resume layout, independent
appearance presets, empty starters, and workspace defaults. Every resume, preset,
and starter pins `yabuki-reference@1.0.3`. Earlier development layouts/templates
are rejected, never converted or silently reset. The current complete layout is
required even when library collections are empty.

Resume layout additionally allows `defaults`: a complete flat appearance snapshot
with no nested `defaults` member. Blank creation copies workspace appearance into
both values and defaults; starters and loaded presets copy their appearance into
both. Presets and starters never contain resume baseline metadata, and capture
copies appearance only. Library edits/deletion have no live effect on resumes.
Duplicating a resume preserves an independent baseline copy.

An otherwise-supported resume without this optional member uses its saved
appearance as defaults. Opening, importing, and rendering do not rewrite it;
the next successful layout Save records its baseline. This is the only baseline
initialization allowance, not support for earlier templates, schema 1, or
incomplete appearance models. Existing immutable requests/fingerprints remain
unchanged. A request without baseline metadata preserves an existing baseline
or initializes from pre-edit committed appearance. Recovered edits must not
become their own defaults.

The exact `resume-layout/<id>` scope includes appearance and defaults together.
Save, conflicts, recovery, history, workspace backup, previous-workspace
replacement, and rollback preserve that pair. Loading an identical appearance
with different defaults is a meaningful draft change. Baseline-only metadata
does not alter generated layout commands; revision metadata may stale a preview.
Malformed recovered baseline metadata remains recoverable and blocks Save until
corrected. Workspace/recovery envelope versions and template identity are unchanged.

Layout contains paper/font identities, bounded typography/margins/spacing/colors,
numbering and its warning threshold, and contact-row configuration. Contact rows
use automatic wrapping, a fixed count from one to four, or positive custom row
sizes up to 60 items/60 rows; row gaps allow 0-24 pt. Custom overflow forms another
wrapping row and unused rows are ignored. Layout never selects profile records.
Presets contain only ID, name, template, and layout. Starter sections have fresh
structural row IDs, labels, built-in kind/custom icon, visibility, and supported
field-key defaults. Starters also contain summary visibility and layout. They
carry no entry identities, language wording, achievements, or personal values.
Copied field defaults are stored with a resume's empty section selections and
apply only to newly selected entries. Created-section provenance on a resume
supports atomic creation history; duplicates clear it.

Recovery envelopes remain `verso.recovery`, schemaVersion 1, with `exportedAt`,
`sourceWorkspaceId`, and `drafts`. Exact editing scopes include
`resume-layout/<id>`, `preset/<id>`, and `starter/<id>`. Values and baselines remain
separate; malformed field values are preserved for editing. Layout/library drafts
use the existing scheduling, immutable operation IDs, exact-version cleanup,
comparison/reconciliation, and non-expiring unresolved retention contracts.

`starter-create/<resumeId>` holds one prepared composite request: the new resume,
missing empty sections with preallocated IDs, and reviewed metadata for reused
Career sections. The transaction rechecks reviewed metadata and all capacity and
reference constraints before committing any content. Retries retain the same
IDs and request identity. A lost response does not prove failure. Confirm the
receipt or reconcile before creating another operation. Undo archives created
sections and removes the resume; reused sections remain untouched. Recovery
exports retain this prepared request separately from saved workspace backups.
Importing recovery never commits it or treats imported receipts as proof of a
local commit. Library/resume layout and structural defaults survive the one
previous workspace and rollback; device preferences and compiler/PDF bytes do not
enter either portable format.
