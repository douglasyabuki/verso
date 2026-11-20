export const settingsPanels = [
  { id: "account", label: "Account" },
  { id: "appearance", label: "Appearance" },
  { id: "data", label: "Data" },
  { id: "defaults", label: "Resume defaults" },
  { id: "languages", label: "Content languages" },
  { id: "editing-preview", label: "Editing & preview" },
  { id: "releases", label: "Public PDFs" },
] as const;

export type SettingsPanel = (typeof settingsPanels)[number]["id"];

export type DevicePreferences = {
  initializationTimeoutMs: number;
  compilationTimeoutMs: number;
  completedOperationDays: number;
  completedOperationCount: number;
  /** Optional automatic preview refresh after committed output changes; off by default. */
  automaticRefresh?: boolean;
};

export const devicePreferenceDefaults: DevicePreferences = {
  initializationTimeoutMs: 120_000,
  compilationTimeoutMs: 30_000,
  completedOperationDays: 30,
  completedOperationCount: 1000,
  automaticRefresh: false,
};
