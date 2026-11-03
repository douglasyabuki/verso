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
