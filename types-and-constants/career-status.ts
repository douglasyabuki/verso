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
  | "invalid"
  /** The account server could not be reached or did not answer; the outcome is
   * unconfirmed and the prepared request is retried with the same operation ID. */
  | "offline"
  /** The account session expired or changed; sign in again to finish saving. */
  | "session";

/** Committed-workspace Save status. Recovery, preview, and backup status are
 * reported separately and never share this value. No release status exists:
 * public releases are future scope. */
export type SaveStatus =
  | { kind: "opening" }
  | { kind: "saving" }
  | { kind: "saved"; revision: number }
  /** Another tab (or, for accounts, another device) committed a newer revision that this tab now shows. */
  | { kind: "remote-update"; revision: number }
  /** Account only: the server was unreachable at open; this tab shows the last
   * server-confirmed head cached on this device, which may be stale. */
  | { kind: "offline-cached"; revision: number }
  /** Committed in this tab's memory only; durable storage is unchanged. */
  | { kind: "session"; revision: number }
  /** The commit succeeded; only receipt cleanup needs a retry on next load. */
  | { kind: "cleanup-retry"; revision: number }
  | { kind: "failed"; reason: SaveFailureReason }
  | { kind: "unavailable"; reason: "storage" | "unsupported" | "account" };

/** Where Saves are committed for this tab. */
export type StorageMode =
  /** Explicit Saves commit to IndexedDB. */
  | "durable"
  /** Explicit Saves commit to the signed-in account; success needs server acknowledgment. */
  | "account"
  /** The user explicitly chose tab-only Saves; durable storage is unchanged. */
  | "session"
  /** IndexedDB could not be opened; only explicit session Saves are possible. */
  | "unavailable";

/** Short toolbar text for a Save status.
 * @param status Typed Save status.
 * @param owner Where Saves commit: this browser (guest) or the signed-in account.
 * @returns Human-readable text; failures never claim a commit.
 * @example describeSaveStatus({ kind: "saved", revision: 3 }) // "Saved locally · revision 3"
 */
export function describeSaveStatus(
  status: SaveStatus,
  owner: "guest" | "account" = "guest",
): string {
  const where = owner === "account" ? "Saved to account" : "Saved locally";
  switch (status.kind) {
    case "opening":
      return "Opening saved workspace…";
    case "saving":
      return "Saving…";
    case "saved":
      return `${where} · revision ${status.revision}`;
    case "remote-update":
      return owner === "account"
        ? `Updated from another device or tab · revision ${status.revision}`
        : `Updated from another tab · revision ${status.revision}`;
    case "offline-cached":
      return `Offline · showing last synced revision ${status.revision} · Saves wait for reconnection`;
    case "session":
      return "Saved in this tab only · durable workspace unchanged";
    case "cleanup-retry":
      return `${where} · revision ${status.revision} · cleanup retries on next load`;
    case "unavailable":
      return status.reason === "unsupported"
        ? "Not saved: unsupported development workspace"
        : status.reason === "account"
          ? "Not saved · account storage unavailable · reload to retry"
          : "Not saved · browser storage unavailable";
    case "failed":
      return {
        conflict:
          "Save not confirmed · changed in another save · draft retained",
        replaced: "Save not confirmed · workspace replaced · draft retained",
        uncertain: "Save outcome unknown · draft retained",
        storage: "Save not confirmed · browser storage failed · draft retained",
        invalid: "Save not confirmed · draft retained",
        offline:
          "Not yet saved to your account · kept on this device · retry Save",
        session: "Not saved to your account · sign in again · draft retained",
      }[status.reason];
  }
}
