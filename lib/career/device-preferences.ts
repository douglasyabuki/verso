import { z } from "zod";

import { devicePreferenceDefaults } from "@/types-and-constants/settings";

export const devicePreferencesSchema = z.strictObject({
  initializationTimeoutMs: z.number().finite().min(100).max(600_000),
  compilationTimeoutMs: z.number().finite().min(100).max(600_000),
  completedOperationDays: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  completedOperationCount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});

/** Read a versioned browser preference record without writing defaults on load.
 * @param value Untrusted stored record.
 * @returns Valid preferences or a fresh copy of app defaults for invalid/unknown records.
 * @example readDevicePreferences({ version: 1, values: devicePreferenceDefaults })
 */
export function readDevicePreferences(value: unknown) {
  const parsed = z
    .strictObject({ version: z.literal(1), values: devicePreferencesSchema })
    .safeParse(value);
  return parsed.success ? parsed.data.values : { ...devicePreferenceDefaults };
}
