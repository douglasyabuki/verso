import { describe, expect, it } from "vitest";

import { draftAge, newestFirst, recoveryForScope } from "@/lib/career/recovery";
import type { CareerDraft } from "@/types-and-constants/career";

const now = Date.parse("2026-11-20T12:00:00.000Z");

function draft(
  draftId: string,
  scope: string,
  updatedAt?: string,
): CareerDraft {
  return {
    draftId,
    draftVersion: 2,
    workspaceId: "workspace",
    scope,
    baseline: null,
    baselineRevision: 1,
    generation: 0,
    values: null,
    ...(updatedAt ? { updatedAt } : {}),
  };
}

describe("draft age", () => {
  it("describes recent, older, and unknown write times", () => {
    expect(draftAge("2026-11-20T11:59:30.000Z", now, "en")).toBe("just now");
    expect(draftAge("2026-11-20T11:55:00.000Z", now, "en")).toBe(
      "5 minutes ago",
    );
    expect(draftAge("2026-11-19T12:00:00.000Z", now, "en")).toBe("yesterday");
    expect(draftAge(undefined, now, "en")).toBe("time unknown");
    expect(draftAge("not a date", now, "en")).toBe("time unknown");
  });
});

describe("recovery ordering", () => {
  it("lists newest writes first and untimed drafts last", () => {
    const old = draft("old", "profile", "2026-11-20T10:00:00.000Z");
    const untimed = draft("untimed", "profile");
    const recent = draft("recent", "summary", "2026-11-20T11:00:00.000Z");
    expect(
      newestFirst([old, untimed, recent]).map((item) => item.draftId),
    ).toEqual(["recent", "old", "untimed"]);
  });

  it("offers the newest other draft for the open scope only", () => {
    const old = draft("old", "profile", "2026-11-20T10:00:00.000Z");
    const recent = draft("recent", "profile", "2026-11-20T11:00:00.000Z");
    const other = draft("other", "summary", "2026-11-20T11:30:00.000Z");
    expect(recoveryForScope([old, recent, other], "profile")?.draftId).toBe(
      "recent",
    );
    expect(
      recoveryForScope([old, recent, other], "profile", "recent")?.draftId,
    ).toBe("old");
    expect(recoveryForScope([other], "profile")).toBeNull();
  });
});
