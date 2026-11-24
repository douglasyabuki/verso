import { z } from "zod";

import {
  compilerTimeouts,
  devicePreferenceDefaults,
  type DevicePreferences,
} from "@/types-and-constants/settings";

export const devicePreferencesSchema = z.strictObject({
  automaticRefresh: z.boolean(),
});

const storedDevicePreferencesSchema = z.strictObject({
  version: z.literal(1),
  values: z.object({
    automaticRefresh: z
      .boolean()
      .default(devicePreferenceDefaults.automaticRefresh),
  }),
});

/** Read a versioned browser preference record without writing defaults on load.
 * @param value Untrusted stored record.
 * @returns Valid preferences or a fresh copy of app defaults for invalid/unknown records.
 * @example readDevicePreferences({ version: 1, values: devicePreferenceDefaults })
 */
export function readDevicePreferences(value: unknown): DevicePreferences {
  const parsed = storedDevicePreferencesSchema.safeParse(value);
  return parsed.success ? parsed.data.values : { ...devicePreferenceDefaults };
}

/** Encode the preview preference in the shape older builds can read.
 * @param preferences Current preview preference.
 * @returns Version-1 record with the legacy numeric fields set to defaults.
 * @example writeDevicePreferences({ automaticRefresh: true })
 */
export function writeDevicePreferences(preferences: DevicePreferences) {
  return {
    version: 1,
    values: {
      ...compilerTimeouts,
      completedOperationDays: 30,
      completedOperationCount: 1000,
      automaticRefresh: preferences.automaticRefresh,
    },
  };
}
