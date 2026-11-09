import type { CareerDocument } from "@/types-and-constants/career";
import {
  type SettingsPanel,
  settingsPanels,
} from "@/types-and-constants/settings";

const opaqueId = "[A-Za-z0-9_-]{1,120}";
const resourceRoute = new RegExp(
  `^(list|entry|section|entries|selection|new-section|resume|resume-overview|resume-details|resume-content|resume-wording|resume-layout|preset|starter|starter-create)/${opaqueId}$|^new-entry/${opaqueId}/${opaqueId}$`,
);
const views = new Set([
  "overview",
  "profile",
  "summary",
  "sections",
  "resumes",
  "resume-compare",
  "library",
  "presets",
  "starters",
]);

/** Normalize supported URL aliases and reject malformed destinations.
 * @param input Untrusted scope query value.
 * @returns Canonical destination or `unavailable`; never returns private input on rejection.
 * @example parseDestination("backups") // "settings/data"
 */
export function parseDestination(input: unknown): string {
  if (typeof input !== "string" || /[^A-Za-z0-9_/-]/.test(input))
    return "unavailable";
  if (input === "settings") return "settings/appearance";
  if (input === "languages") return "settings/languages";
  if (input === "defaults") return "settings/defaults";
  if (input === "backups") return "settings/data";
  if (settingsPanel(input) || views.has(input) || resourceRoute.test(input))
    return input.replace(/^selection\//, "resume-content/");
  return "unavailable";
}

/** Identify a validated Settings destination.
 * @param destination Canonical URL scope.
 * @returns Selected panel, or null outside Settings.
 * @example settingsPanel("settings/data") // "data"
 */
export function settingsPanel(destination: string): SettingsPanel | null {
  return (
    settingsPanels.find((panel) => destination === `settings/${panel.id}`)
      ?.id ?? null
  );
}

/** Map view destinations to exact workspace editing scopes.
 * @param destination Canonical destination.
 * @returns Scope to open, or null for a non-editing view.
 * @example destinationScope("settings/defaults") // "defaults"
 */
export function destinationScope(destination: string): string | null {
  if (destination === "settings/languages") return "languages";
  if (destination === "settings/defaults") return "defaults";
  if (["profile", "summary", "sections"].includes(destination))
    return destination;
  return resourceRoute.test(destination) &&
    !/^(list|resume-overview)\//.test(destination)
    ? destination
    : null;
}

/** Check resource existence without creating nullable lifecycle records.
 * @param document Current committed workspace.
 * @param destination Canonical destination.
 * @param draftScope Existing creation draft, if any.
 * @returns Whether the destination has a usable resource or creation draft.
 * @example destinationExists(document, "library")
 */
export function destinationExists(
  document: CareerDocument,
  destination: string,
  draftScope?: string,
): boolean {
  if (destination === "unavailable") return false;
  if (views.has(destination) || settingsPanel(destination)) return true;
  if (
    draftScope === destination ||
    (destination.startsWith("resume-content/") &&
      draftScope === destination.replace(/^resume-content\//, "selection/"))
  )
    return true;
  const [kind, id] = destination.split("/");
  if (["new-entry", "new-section", "starter-create"].includes(kind))
    return false;
  if (kind === "preset") return document.presets.some((item) => item.id === id);
  if (kind === "starter")
    return document.starters.some((item) => item.id === id);
  if (kind.startsWith("resume") || kind === "selection")
    return document.resumes.some((item) => item.id === id);
  if (kind === "entry")
    return document.sections.some((section) =>
      section.entries.some((entry) => entry.id === id),
    );
  return document.sections.some((section) => section.id === id);
}
