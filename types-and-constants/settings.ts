export const settingsPanels = [
  { id: "appearance", label: "Appearance" },
  { id: "languages", label: "Content languages" },
  { id: "editing-preview", label: "Editing & preview" },
  { id: "data", label: "Data & backups" },
  { id: "defaults", label: "Resume defaults" },
] as const;

export type SettingsPanel = (typeof settingsPanels)[number]["id"];

export type DevicePreferences = {
  initializationTimeoutMs: number;
  compilationTimeoutMs: number;
  completedOperationDays: number;
  completedOperationCount: number;
};

export const devicePreferenceDefaults: DevicePreferences = {
  initializationTimeoutMs: 120_000,
  compilationTimeoutMs: 30_000,
  completedOperationDays: 30,
  completedOperationCount: 1000,
};
