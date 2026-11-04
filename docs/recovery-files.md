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
