import { createEmptyDocument } from "@/lib/resume/factories";
import { semanticallyEqual } from "@/lib/workspace/semantic";
import type { WorkspaceState } from "@/types-and-constants/workspace";

/** Compose copy from independent tab/browser effects rather than operation names alone.
 * @param state Current workspace and reviewed pending operation.
 * @returns {object | null} Dialog heading, confirmation, summary label and applicable messages; null without a pending operation.
 * @example const dialog = operationDialog(state);
 */
export function operationDialog(state: WorkspaceState) {
  const pending = state.pending;
  if (!pending) return null;
  const { kind, sessionOnly, snapshot, review, writeTarget } = pending;
  const tab =
    (writeTarget === "tab" || writeTarget === "both") &&
    !semanticallyEqual(state.document, snapshot.document);
  const browser = writeTarget === "browser" || writeTarget === "both";
  const browserContent =
    browser &&
    (!review?.snapshot ||
      !semanticallyEqual(review.snapshot.document, snapshot.document));
  const meaningfulTab = !semanticallyEqual(
    state.document,
    createEmptyDocument(),
  );
  const meaningfulBrowser =
    !!review?.snapshot &&
    !semanticallyEqual(review.snapshot.document, createEmptyDocument());
  const labels = {
    import: [
      "Restore this backup?",
      "Restore backup",
      "Load the career details, resumes, and workspace settings from this JSON backup.",
      "Backup to restore",
    ],
    example: [
      "Load fictional example?",
      "Load example",
      "Load fictional career details and example resumes with their workspace settings.",
      "Example workspace",
    ],
    recovery: [
      "Restore previous work?",
      "Restore previous work",
      "Restore the previous workspace kept in this tab.",
      "Previous workspace",
    ],
    clear: [
      sessionOnly
        ? "Clear workspace data in this tab?"
        : "Clear workspace data?",
      sessionOnly ? "Clear this tab" : "Clear data",
      `Delete your career details and resumes${sessionOnly ? " in this tab" : ""}, reset PDF and compiler settings, and discard backup records, editing history, and previous work kept for recovery. Your theme and panel layout are kept. This cannot be undone.${sessionOnly ? " Data saved in this browser stays unchanged." : ""}`,
      "",
    ],
    "resume-saving": [
      "Start saving in this browser?",
      "Start saving",
      "Save the workspace open in this tab to this browser.",
      "",
    ],
    overwrite: [
      "Use this tab’s version?",
      "Use this tab’s version",
      "Save the workspace open in this tab to this browser.",
      "",
    ],
    "load-saved": [
      "Load the saved browser version?",
      "Load saved version",
      "Load the saved browser version shown below into this tab. The saved browser version will not be changed.",
      "Saved browser version",
    ],
    session: [
      "Continue in this tab only?",
      "Continue in this tab",
      "Keep working without saving changes in this browser. Download a JSON backup before closing this tab to keep your work.",
      "",
    ],
  };
  const [title, confirmLabel, main, summary] = labels[kind];
  const messages = [main];
  if (kind === "clear") {
    if (!sessionOnly)
      messages.push(
        "This clears the workspace open in this tab and resets its saved browser version.",
      );
  } else if (!tab && !browserContent && pending.backupOrigin) {
    messages.push(
      sessionOnly
        ? "Your workspace content will not change. Only its backup record in this tab will be updated."
        : "Your workspace content will not change. Only its backup record will be updated.",
    );
  } else if (browser && !tab) {
    if (meaningfulBrowser && browserContent)
      messages.push(
        "This replaces the saved browser version shown below with this tab’s workspace. The workspace open in this tab stays unchanged.",
      );
  } else if (tab && !browser && meaningfulTab) {
    messages.push(
      "This replaces the workspace open in this tab. The version saved in this browser stays unchanged.",
    );
  } else if (
    tab &&
    browser &&
    meaningfulTab &&
    meaningfulBrowser &&
    browserContent
  ) {
    messages.push(
      "This replaces the workspace open in this tab and the saved browser version shown below.",
    );
  } else if (tab && browser && meaningfulTab) {
    messages.push(
      "This replaces the workspace open in this tab and saves the result in this browser.",
    );
  } else if (tab && browser && meaningfulBrowser && browserContent) {
    messages.push(
      "This loads the selected workspace into this tab and replaces the saved browser version shown below.",
    );
  } else if (tab) {
    messages.push("This loads the selected workspace into this tab.");
    if (browser) messages.push("It will also be saved in this browser.");
  }
  if (browser && review?.error)
    messages.push(
      "The saved browser data cannot be opened. Continuing will overwrite that unreadable data.",
    );
  if (kind !== "clear" && tab && meaningfulTab) {
    messages.push(
      "You can restore one previous workspace while this tab stays open.",
    );
    if (state.recovery)
      messages.push(
        "The current workspace will become your recovery copy. The older recovery copy will be discarded.",
      );
  }
  const tabRisk = meaningfulTab && (tab || kind === "clear");
  const browserRisk = browserContent && meaningfulBrowser;
  if (tabRisk) {
    if (!state.backupFingerprint)
      messages.push("No JSON backup is recorded for your current work.");
    else if (state.currentFingerprint)
      messages.push(
        state.currentFingerprint === state.backupFingerprint
          ? "A JSON backup matching your current work is recorded."
          : "Your latest recorded JSON backup does not include your current changes.",
      );
  }
  if (
    browserRisk &&
    review?.snapshot &&
    (!tabRisk ||
      review.documentFingerprint !== state.currentFingerprint ||
      review.snapshot.backupFingerprint !== state.backupFingerprint)
  ) {
    const baseline = review.snapshot.backupFingerprint;
    const risk = !baseline
      ? "No JSON backup is recorded for your current work."
      : review.documentFingerprint
        ? review.documentFingerprint === baseline
          ? "A JSON backup matching your current work is recorded."
          : "Your latest recorded JSON backup does not include your current changes."
        : null;
    if (risk) messages.push(`Saved browser version: ${risk}`);
  }
  if (kind === "clear" && (tabRisk || browserRisk))
    messages.push(
      "Download a JSON backup first if you want to keep your work.",
    );
  if (sessionOnly && kind !== "session")
    messages.push(
      "Download a JSON backup before closing this tab to keep your changes.",
    );
  return { title, confirmLabel, summary, messages };
}
