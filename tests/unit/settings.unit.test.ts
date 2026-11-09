import { describe, expect, it } from "vitest";

import {
  devicePreferencesSchema,
  readDevicePreferences,
} from "@/lib/career/device-preferences";
import {
  applyScope,
  createCareerDocument,
  parsePortable,
  readScope,
} from "@/lib/career/model";
import {
  destinationExists,
  destinationScope,
  parseDestination,
  settingsPanel,
} from "@/lib/career/navigation";
import { createResume } from "@/lib/career/resumes";
import { devicePreferenceDefaults } from "@/types-and-constants/settings";

describe("validated workspace and Settings destinations", () => {
  it.each([
    ["backups", "settings/data"],
    ["languages", "settings/languages"],
    ["defaults", "settings/defaults"],
    ["settings", "settings/appearance"],
    ["selection/application", "resume-content/application"],
    ["settings/editing-preview", "settings/editing-preview"],
    ["library", "library"],
    ["preset/compact", "preset/compact"],
    ["starter/empty", "starter/empty"],
    ["new-entry/section/entry", "new-entry/section/entry"],
    ["settings/account", "unavailable"],
    ["resume-layout/private name", "unavailable"],
    ["entry/a/b", "unavailable"],
    ["settings/data/extra", "unavailable"],
    ["https://example.com", "unavailable"],
    ["resume/", "unavailable"],
    ["entry/a\n", "unavailable"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(parseDestination(input)).toBe(expected);
  });

  it("rejects non-text history metadata without exposing or interpreting its contents", () => {
    for (const value of [null, {}, 7])
      expect(parseDestination(value)).toBe("unavailable");
  });

  it("maps panel navigation to exact editing scopes without conflating views", () => {
    expect(settingsPanel("settings/data")).toBe("data");
    expect(settingsPanel("settings/unknown")).toBeNull();
    expect(destinationScope("settings/languages")).toBe("languages");
    expect(destinationScope("settings/defaults")).toBe("defaults");
    expect(destinationScope("settings/data")).toBeNull();
    expect(destinationScope("resume-overview/application")).toBeNull();
    expect(destinationScope("resume-layout/application")).toBe(
      "resume-layout/application",
    );
  });

  it("requires resources or explicit creation drafts without seeding nullable records", () => {
    const document = createCareerDocument();
    document.resumes = [
      { ...createResume(document, "en-US"), id: "application" },
    ];
    expect(destinationExists(document, "resume-overview/application")).toBe(
      true,
    );
    expect(destinationExists(document, "resume-content/missing")).toBe(false);
    expect(destinationExists(document, "preset/missing")).toBe(false);
    expect(destinationExists(document, "starter/missing")).toBe(false);
    expect(destinationExists(document, "new-section/new")).toBe(false);
    expect(
      destinationExists(document, "new-section/new", "new-section/new"),
    ).toBe(true);
    expect(destinationExists(document, "settings/data")).toBe(true);
    expect(
      destinationExists(
        document,
        "resume-content/missing",
        "selection/missing",
      ),
    ).toBe(true);
    expect(destinationExists(document, "unavailable")).toBe(false);
  });
});

describe("browser preference boundaries", () => {
  it("uses independent defaults for missing, malformed, and unknown-version records", () => {
    for (const input of [
      undefined,
      null,
      { version: 2, values: devicePreferenceDefaults },
      {
        version: 1,
        values: { ...devicePreferenceDefaults, completedOperationDays: -1 },
      },
    ]) {
      const result = readDevicePreferences(input);
      expect(result).toEqual({
        initializationTimeoutMs: 120000,
        compilationTimeoutMs: 30000,
        completedOperationDays: 30,
        completedOperationCount: 1000,
      });
      expect(result).not.toBe(devicePreferenceDefaults);
    }
  });

  it("accepts compiler bounds and zero eligible-receipt retention", () => {
    const values = {
      initializationTimeoutMs: 100,
      compilationTimeoutMs: 600000,
      completedOperationDays: 0,
      completedOperationCount: 0,
    };
    expect(readDevicePreferences({ version: 1, values })).toEqual(values);
  });

  it.each([
    { initializationTimeoutMs: 99 },
    { compilationTimeoutMs: 600001 },
    { compilationTimeoutMs: Infinity },
    { completedOperationDays: 0.5 },
    { completedOperationCount: Number.MAX_SAFE_INTEGER + 1 },
    { completedOperationCount: -1 },
  ])("rejects invalid device preference %j", (patch) => {
    expect(
      devicePreferencesSchema.safeParse({
        ...devicePreferenceDefaults,
        ...patch,
      }).success,
    ).toBe(false);
  });
});

describe("workspace Resume defaults", () => {
  it("changes only the defaults scope and preserves existing frozen resume layouts", () => {
    const document = createCareerDocument();
    const original = createResume(document, "en-US");
    document.resumes = [original];
    const changed = applyScope(document, "defaults", {
      ...document.defaults,
      paper: "letter",
      fontSize: 12,
    });
    expect(changed.defaults.paper).toBe("letter");
    expect(changed.defaults.fontSize).toBe(12);
    expect(changed.resumes[0].layout).toEqual(original.layout);
    expect(document.defaults.paper).toBe("a4");
    const next = createResume(changed, "en-US");
    expect(next.layout.paper).toBe("letter");
    expect(next.layout.defaults?.fontSize).toBe(12);
    expect(readScope(changed, "defaults")).toEqual(changed.defaults);
    expect(applyScope(changed, "defaults", document.defaults).defaults).toEqual(
      document.defaults,
    );
  });

  it("rejects malformed and recursive defaults without changing committed values", () => {
    const document = createCareerDocument();
    expect(() =>
      applyScope(document, "defaults", { ...document.defaults, fontSize: -1 }),
    ).toThrow();
    expect(() =>
      applyScope(document, "defaults", {
        ...document.defaults,
        defaults: document.defaults,
      }),
    ).toThrow();
    expect(document.defaults.fontSize).toBe(10);
  });

  it("round trips defaults recovery with malformed editable values and stable pending identity", () => {
    const document = createCareerDocument();
    const draft = {
      draftId: "draft",
      draftVersion: 2,
      operationId: "operation",
      fingerprint: "immutable-request",
      workspaceId: "workspace",
      scope: "defaults",
      baseline: document.defaults,
      baselineRevision: 1,
      generation: 0,
      values: { ...document.defaults, fontSize: "repair me" },
    };
    const parsed = parsePortable(
      JSON.stringify({
        format: "verso.recovery",
        schemaVersion: 1,
        exportedAt: "2026-11-07T00:00:00.000Z",
        sourceWorkspaceId: "workspace",
        drafts: [draft],
      }),
      "recovery",
    );
    expect("drafts" in parsed && parsed.drafts[0]).toEqual(draft);
  });
});
