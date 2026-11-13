/** Classify Library destinations for consistent workspace presentation.
 * @param destination Opaque workspace scope from guarded navigation.
 * @returns The overview or collection kind, or null outside Library.
 * @example libraryDestinationKind("preset/example") // "preset"
 */
export function libraryDestinationKind(destination: string) {
  if (destination === "library") return "overview";
  if (destination === "presets" || destination.startsWith("preset/"))
    return "preset";
  if (destination === "starters" || destination.startsWith("starter/"))
    return "starter";
  return null;
}
