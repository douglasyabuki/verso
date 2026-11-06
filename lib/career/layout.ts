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
