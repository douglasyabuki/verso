import { describe, expect, it } from "vitest";

import { draftChanges } from "@/lib/career/draft-changes";
import { createEntry } from "@/lib/career/model";
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

describe("recovery changes", () => {
  const labels = { language: "en-US", sectionKind: "experience" } as const;

  it("shows a changed field using its editor label and a clear as an explicit value", () => {
    const baseline = createEntry("experience");
    baseline.fields[0].wording["en-US"] = "Engineer";
    baseline.fields[1].wording["en-US"] = "CSG";
    const values = structuredClone(baseline);
    values.fields[0].wording["en-US"] = "Senior Engineer";
    expect(
      draftChanges({ scope: "entry/role", baseline, values }, labels),
    ).toEqual([
      {
        label: "Title",
        kind: "Changed",
        before: "Engineer",
        after: "Senior Engineer",
      },
    ]);
    values.fields[0].wording["en-US"] = "";
    expect(
      draftChanges({ scope: "entry/role", baseline, values }, labels),
    ).toEqual([
      { label: "Title", kind: "Cleared", before: "Engineer", after: "Cleared" },
    ]);
  });

  it("identifies additions and removals without relisting unchanged collection items", () => {
    const unchanged = {
      id: "unchanged",
      name: "General",
      url: "https://example.com",
    };
    const baseline = {
      links: [unchanged, { id: "old", name: "Retired link" }],
    };
    const values = { links: [{ id: "new", name: "Portfolio" }, unchanged] };
    expect(
      draftChanges({ scope: "profile", baseline, values }, labels),
    ).toEqual([
      {
        label: "Links",
        kind: "Removed",
        before: "Retired link",
        after: "Removed",
      },
      {
        label: "Links",
        kind: "Added",
        before: "Not present",
        after: "Portfolio",
      },
    ]);
  });

  it("summarizes reordered entries without exposing IDs or shifted neighbors", () => {
    const names = { a: "Alpha", b: "Beta", c: "Gamma" } as Record<
      string,
      string
    >;
    expect(
      draftChanges(
        {
          scope: "entries/experience",
          baseline: ["a", "b", "c"],
          values: ["c", "a", "b"],
        },
        { ...labels, reference: (id) => names[id] },
      ),
    ).toEqual([
      {
        label: "Entry order",
        kind: "Reordered",
        before: "Gamma (position 3)",
        after: "Gamma (position 1)",
      },
    ]);
  });

  it("omits reverted wording and draft metadata", () => {
    const baseline = {
      id: "entry",
      fields: [],
      updatedAt: "old",
      name: "Same",
    };
    const values = { ...baseline, updatedAt: "new", operationId: "prepared" };
    expect(
      draftChanges({ scope: "entry/role", baseline, values }, labels),
    ).toEqual([]);
    expect(
      draftChanges(
        {
          scope: "summary",
          baseline: { wording: { "en-US": "Same" } },
          values: {
            wording: { "en-US": [{ text: "Same", emphasis: false, href: "" }] },
          },
        },
        labels,
      ),
    ).toEqual([]);
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
