import { layoutSchema, resumeLayoutSchema } from "@/lib/career/model";
import { settingsSchema } from "@/lib/output/schema";
import type { CareerResume } from "@/types-and-constants/career";
import type { TemplateSettings } from "@/types-and-constants/output";

/** Resolve active appearance into the template's schema-independent settings.
 * @param layout Validated resume appearance.
 * @returns {TemplateSettings} All template controls with mapped paper/font identifiers.
 * @example templateSettings(resume.layout)
 */
export function templateSettings(
  layout: CareerResume["layout"],
): TemplateSettings {
  return settingsSchema.parse({
    ...Object.fromEntries(
      Object.entries(layout).filter(([key]) => key in settingsSchema.shape),
    ),
    pageSize: layout.paper,
    fontFamily:
      layout.font === "inter"
        ? "inter"
        : layout.font === "source-sans"
          ? "source-sans-3"
          : "source-serif-4",
  });
}

/** Group emitted nonempty contacts using portable positional row sizes.
 * @param contacts Already filtered contact items in output order.
 * @param layout Resume appearance.
 * @returns {T[][]} Nonempty rows; custom overflow occupies a final wrapping row.
 * @example contactRows(["email", "phone", "city"], {...layout, contactRows:"2"})
 */
export function contactRows<T>(
  contacts: T[],
  layout: CareerResume["layout"],
): T[][] {
  if (!contacts.length) return [];
  if (layout.contactRows === "auto") return [contacts];
  const sizes =
    layout.contactRows === "custom"
      ? layout.contactRowSizes
      : Array.from(
          { length: Math.ceil(contacts.length / Number(layout.contactRows)) },
          () => Number(layout.contactRows),
        );
  const rows: T[][] = [];
  let index = 0;
  for (const size of sizes) {
    const row = contacts.slice(index, index + size);
    if (row.length) rows.push(row);
    index += size;
  }
  if (index < contacts.length) rows.push(contacts.slice(index));
  return rows;
}

/** Copy only renderable appearance, excluding resume reset metadata.
 * @param layout Valid appearance with optional resume metadata.
 * @returns Flat validated appearance suitable for presets and starters.
 * @example layoutAppearance(resume.layout)
 */
export function layoutAppearance(layout: CareerResume["layout"]) {
  const { defaults: _defaults, ...appearance } = layout;
  void _defaults;
  return layoutSchema.parse(appearance);
}

/** Resolve optional appearance values to their prior behavior without storing them.
 * @param layout Validated flat appearance.
 * @returns Appearance with explicit optional values, so comparisons ignore omission.
 * @example withResolvedOptions(preset.layout).contactLocation
 */
function withResolvedOptions<T extends { contactLocation?: string }>({
  contactLocation,
  ...layout
}: T) {
  // Re-append so key order is stable whether the value was stored or omitted.
  return { ...layout, contactLocation: contactLocation ?? "separate" };
}

/** Copy appearance as both the current layout and its frozen reset baseline.
 * @param layout Appearance supplied by a preset, starter, or workspace.
 * @returns Independent values and defaults with no live library reference.
 * @example layoutFromPreset(preset.layout)
 */
export function layoutFromPreset(
  layout: CareerResume["layout"],
): CareerResume["layout"] {
  const appearance = layoutAppearance(layout);
  return { ...appearance, defaults: structuredClone(appearance) };
}

/** Resolve defaults without writing or inferring them from modified draft values.
 * @param layout Committed layout or the original editing baseline.
 * @returns Frozen defaults, or saved appearance for records without baseline metadata.
 * @example layoutDefaults(draft.baseline)
 */
export function layoutDefaults(layout: unknown) {
  const parsed = resumeLayoutSchema.parse(layout);
  return parsed.defaults ?? layoutAppearance(parsed);
}

/** Compare effective layout values and reset behavior, including baseline-only changes.
 * @param left First validated resume layout.
 * @param right Second validated resume layout.
 * @returns True when appearance and frozen defaults are equal.
 * @example sameLayout(resume.layout, layoutFromPreset(preset.layout))
 */
export function sameLayout(left: unknown, right: unknown): boolean {
  const a = resumeLayoutSchema.safeParse(left);
  const b = resumeLayoutSchema.safeParse(right);
  if (!a.success || !b.success) return false;
  return (
    JSON.stringify({
      ...withResolvedOptions(layoutAppearance(a.data)),
      defaults: withResolvedOptions(layoutDefaults(a.data)),
    }) ===
    JSON.stringify({
      ...withResolvedOptions(layoutAppearance(b.data)),
      defaults: withResolvedOptions(layoutDefaults(b.data)),
    })
  );
}

/** Compare appearance only, allowing malformed drafts without throwing during rendering.
 * @param left First layout or draft.
 * @param right Second layout or draft.
 * @returns True when both have valid, identical appearance regardless of defaults.
 * @example sameAppearance(preset.layout, draft.values)
 */
export function sameAppearance(left: unknown, right: unknown): boolean {
  const appearance = (value: unknown) => {
    if (!value || typeof value !== "object")
      return layoutSchema.safeParse(value);
    const { defaults: _defaults, ...rest } = value as Record<string, unknown>;
    void _defaults;
    return layoutSchema.safeParse(rest);
  };
  const a = appearance(left);
  const b = appearance(right);
  return (
    a.success &&
    b.success &&
    JSON.stringify(withResolvedOptions(a.data)) ===
      JSON.stringify(withResolvedOptions(b.data))
  );
}
