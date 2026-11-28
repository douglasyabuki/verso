# Save, recovery, and portable data

This reference owns transaction, recovery, replacement, and portable-file
contracts. Code paths in backticks are relative to the repository root. See
[architecture](architecture.md) for editing/output ownership and
[account storage](accounts-and-public-pdfs.md) for server-specific safeguards.

## Save and recovery protocol

Guest explicit Saves use IndexedDB transactions across affected `verso-local`
stores. Atomically recheck generation/revision and scope baseline, apply a
validated patch, and write the head and receipt. Cross-tab notifications are hints;
transaction checks are authoritative. Account Saves share the domain decision on
the server, with separate local recovery and acknowledgment rather than a
cross-database transaction.

Prepare immutable requests before dispatch. Keep operation IDs, identities,
payloads, and fingerprints stable through interrupted-response checks and retries.
A matching receipt proves the original outcome; missing operation history means
unknown, requiring comparison/reconciliation before retry, never blind replay.
Imported receipts do not prove local commits. Unrelated scope edits alone do not
cause conflicts. Retain the committed version and draft until resolution succeeds.

Recovery records scope identities, baseline values, starting revision/generation,
draft version/values, prepared request context, and the time each version was
written (`updatedAt`). It schedules after 500 ms of inactivity with a 2-second
maximum wait. Close-time flushing is best effort. Leaving a dirty form offers
Cancel / Discard / Save; recovery exists for reloads, crashes, and closed tabs.
Restoration opens an uncommitted draft, not a Save/history step, and is never
automatic: opening a form with a stored draft for the same scope only offers
Restore or Discard. Offer compare (Show changes or Preview), reconcile (Update to
current, only when a Save outcome is unknown), discard (from the form or directly
from Settings › Data, after confirmation), and export (Settings › Data, or inline
when recovery could not be stored). Missing source records require explicit
restore-as-new with valid references, or reconciliation/export, never attachment
to an unrelated record. Retain original recovery separately until resolution.

Unresolved drafts never expire automatically. Export keeps recovery available.
When recovery storage is involved, Cancel confirms once IndexedDB records an
intent for the exact draft ID and version. The controller closes the matching
draft and the preview returns to saved output. A refused or unconfirmed discard
keeps the form open. Confirmed intents exclude resolved versions from discovery
while physical removal is pending. **Recovery cleanup pending** offers a retry,
and the next load also attempts cleanup. Removal after confirmed Save or Discard
is limited to the resolved version and older versions of the same draft ID.
Protect pending, uncertain,
unacknowledged, and recovery-referenced receipts regardless of retention limits.
Eligible completed receipts are kept for up to 30 days or 1,000 per workspace,
whichever limit is reached first. If the device preference read fails, skip
pruning until preferences can be saved. Never delete protected recovery to
satisfy a limit.

Save, recovery, preview, backup, and release status are independent. The controller
publishes typed `saveStatus`, `storageMode`, and `sessionCommits` from
`types-and-constants/career-status.ts`. Toolbar text derives from Save status.
`CareerStorageError` codes are `conflict`, `replaced`, `uncertain`, `storage`, and
`invalid`; DOM/IndexedDB exceptions classify as `storage`. Use typed state rather
than message matching for close warnings/session-only choices. A confirmed commit
with failed receipt acknowledgment reports `cleanup-retry`, not failed Save.
Other-tab notifications during a local Save are applied after it settles.

Order scopes contain IDs only; independent wording edits do not change their
baselines. Ordinary Saves cannot remove or retype shared identities. Creation uses
dedicated scopes; whole-document replacement never uses an editing scope.

### Storage failures and tab-only Saves

If IndexedDB fails, retain drafts, promptly report recovery failure, and offer
export. Session-only commits require explicit choice and leave durable bytes
unchanged. Disclose tab-only Saves even if storage never opened
(`storageMode: unavailable`), and warn on close. Never silently fall back to
localStorage or promise recovery after browser clearing/eviction.

Returning to durable saving requires resolved drafts and review of the durable
head. Explicitly reload durable content or adopt this tab's workspace through the
replacement protocol. Reject adoption if the durable revision changed since review.
Identify the previous snapshot being replaced; require its export or explicit
continuation without export. Failed export retains the review and blocks adoption
until retry or that explicit choice. Discarding tab-only Saves leaves the previous
snapshot unchanged and needs no export decision.

### Replacement and rollback

Validate incoming data before writes, then atomically recheck the reviewed revision,
adopt incoming content, and preserve outgoing committed content as one previous
workspace. Failure changes neither the active workspace nor the snapshot. Rollback
uses the same checks and swaps the active and retained workspaces. The shared
review shows resume names and counts for both workspaces and requires explicit
confirmation. If replacement discards an older retained workspace, require
starting its download or explicitly continuing without it. A failed download
leaves confirmation gated until either choice succeeds. First replacement and
restore each require confirmation without an export decision.

Settings › Data offers **Restore previous workspace** when a retained workspace
exists. After confirmed replacement, **Undo workspace replacement** opens that
same review for the generation just created.

This is **one previous workspace**, not version history. It does not expire
automatically but remains subject to browser clearing/eviction. Recovery is separate
and survives replacement. Successful replacement/rollback increments generation,
invalidates pending Saves/stale previews, and begins a new history generation.
Device preferences survive. Recovery with missing source identities requires
explicit restore-as-new/reconciliation rather than silent dropping.

### Validation boundaries

Workspace imports reject unknown versions, malformed committed values, invalid
references, and unsupported template identities without writes. Recovery structure
is validated while malformed field values remain available for correction. Parsing
and validation use a disposable worker, with progress after 500 ms. Enforce UTF-8
byte limits rather than character counts; never truncate protected recovery.

Verify real-browser abort/quota behavior, interrupted acknowledgments, exact cleanup
races, two-tab scope conflicts, generation rejection, repeated rollback, protected
cleanup, and restart/import recovery on isolated origins. Mocked exceptions alone
do not prove transactional safety. No new verification is implied by this reference.

## Recovery exports

**Download workspace backup** contains saved content only. **Export unsaved
drafts** appears when there are stored drafts or active unsaved form or entry-order
edits and preserves their latest versions with baseline context. Export never
discards a draft. Keep the downloaded files until restoration and an explicit
Save have succeeded.

Normal `verso.recovery` format-1 files are independently importable through
Settings › Data. Files are limited to 32 MiB, with each draft limited to 8 MiB
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

Workspace JSON files have their own 4-MiB ceiling including envelope metadata.
A document at its independent 4-MiB ceiling may exceed the backup-file ceiling;
export reports this explicitly instead of downloading a file the app cannot import.
No export contains device preferences, local operation ledgers, or credentials.

Workspace appearance-default drafts use the exact `defaults` scope. They retain
the complete flat appearance as baseline and editable values, without nested
resume baseline metadata. Their explicit Save participates in atomic scope checks,
receipts, recovery cleanup, and workspace Undo/Redo. Malformed recovered values stay
editable and block Save until corrected. Changing workspace defaults never modifies
existing resumes or their frozen layout defaults. Workspace schema 2 and recovery
format 1 remain unchanged. Device theme and automatic preview refresh are
excluded from both exports.

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
does not alter generated layout commands. Fingerprints exclude revision metadata,
so a baseline-only Save does not stale otherwise unchanged output.
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
`sourceWorkspaceId`, and `drafts`. Each draft's `updatedAt` is optional so files
written before it existed still import; such drafts display "time unknown". Exact editing scopes include
`resume-layout/<id>`, `preset/<id>`, and `starter/<id>`. Values and baselines remain
separate; malformed field values are preserved for editing. Layout/library drafts
use the existing scheduling, immutable operation IDs, resolved-version cleanup,
comparison/reconciliation, and non-expiring unresolved retention contracts.

Schema 2 also accepts these optional members, with no envelope or template
version change:

- link `name` and `icon`;
- achievement `name`;
- language-entry `evidence`;
- selection `evidenceIds`;
- the `languages` section kind;
- a certification `score` field. Older certifications without it remain valid.

Opening or importing never adds them. Older builds reject files that contain them,
and no conversion is provided.

`language-evidence/<certificationId>` holds one prepared composite request: the
language entry ID, target certifications section, preallocated attachment ID, and
the new certification entry. Commit requires a saved language and an active
certifications section, then creates both records together. Retries keep the same
IDs. Undo archives the certification and its attachment. Redo restores them only
if the certification is unchanged. Recovery keeps the request uncommitted, like
other drafts.

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
