/** Why a Save did not commit. Each reason has its own user guidance. */
export type SaveFailureReason =
  /** The scope changed in another Save; compare and reconcile. */
  | "conflict"
  /** The workspace was replaced or rolled back after the draft started. */
  | "replaced"
  /** The outcome is unknown; compare current content before a new Save. */
  | "uncertain"
  /** Browser storage rejected or aborted the write (for example quota). */
  | "storage"
  /** The request or values were rejected before any write. */
  | "invalid";

/** Committed-workspace Save status. Recovery, preview, and backup status are
 * reported separately and never share this value. No release status exists:
 * public releases are future scope. */
export type SaveStatus =
  | { kind: "opening" }
  | { kind: "saving" }
  | { kind: "saved"; revision: number }
  /** Another tab committed a newer revision that this tab now shows. */
  | { kind: "remote-update"; revision: number }
  /** Committed in this tab's memory only; durable storage is unchanged. */
  | { kind: "session"; revision: number }
  /** The commit succeeded; only receipt cleanup needs a retry on next load. */
  | { kind: "cleanup-retry"; revision: number }
  | { kind: "failed"; reason: SaveFailureReason }
  | { kind: "unavailable"; reason: "storage" | "unsupported" };

/** Where Saves are committed for this tab. */
export type StorageMode =
  /** Explicit Saves commit to IndexedDB. */
  | "durable"
  /** The user explicitly chose tab-only Saves; durable storage is unchanged. */
  | "session"
  /** IndexedDB could not be opened; only explicit session Saves are possible. */
  | "unavailable";

/** Short toolbar text for a Save status.
 * @param status Typed Save status.
 * @returns Human-readable text; failures never claim a commit.
 * @example describeSaveStatus({ kind: "saved", revision: 3 }) // "Saved locally · revision 3"
 */
export function describeSaveStatus(status: SaveStatus): string {
  switch (status.kind) {
    case "opening":
      return "Opening saved workspace…";
    case "saving":
      return "Saving…";
    case "saved":
      return `Saved locally · revision ${status.revision}`;
    case "remote-update":
      return `Updated from another tab · revision ${status.revision}`;
    case "session":
      return "Saved in this tab only · durable workspace unchanged";
    case "cleanup-retry":
      return `Saved locally · revision ${status.revision} · cleanup retries on next load`;
    case "unavailable":
      return status.reason === "unsupported"
        ? "Not saved: unsupported development workspace"
        : "Not saved · browser storage unavailable";
    case "failed":
      return {
        conflict:
          "Save not confirmed · changed in another save · draft retained",
        replaced: "Save not confirmed · workspace replaced · draft retained",
        uncertain: "Save outcome unknown · draft retained",
        storage: "Save not confirmed · browser storage failed · draft retained",
        invalid: "Save not confirmed · draft retained",
      }[status.reason];
  }
}
