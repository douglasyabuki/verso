import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyScope,
  careerDocumentSchema,
  createCareerDocument,
  createEntry,
  parsePortable,
  readScope,
  sectionPropertiesSchema,
  validateDocument,
} from "@/lib/career/model";
import { renderCareerResume } from "@/lib/career/output";
import { recoveryFiles } from "@/lib/career/recovery-export";
import {
  copyResume,
  createResume,
  resumeComparisonRows,
  resumeFactFields,
  resumeWordingFields,
} from "@/lib/career/resumes";
import { CareerController } from "@/stores/career/controller";
import * as persistence from "@/stores/career/persistence";
import type { CareerDraft, CareerSection } from "@/types-and-constants/career";
import { sectionIconIds } from "@/types-and-constants/section-icons";

function fixture() {
  const document = createCareerDocument();
  document.profile.fields[0].wording["en-US"] = "Ana";
  const sections: CareerSection[] = ["heart-handshake", "flask-conical"].map(
    (icon, index) => ({
      id: `custom-${index}`,
      kind: "custom",
      icon: icon as CareerSection["icon"],
      name: `Custom ${index}`,
      heading: { "en-US": `Heading ${index}` },
      archived: false,
      entries: [createEntry("custom"), createEntry("custom")],
    }),
  );
  document.sections.push(...sections);
  return { document: validateDocument(document), sections };
}

const controllers: CareerController[] = [];

afterEach(() => {
  controllers.forEach((controller) => controller.dispose());
  controllers.length = 0;
  vi.restoreAllMocks();
});

/** Use the explicit session-only path to test controller behavior without claiming IndexedDB verification. */
async function sessionController() {
  vi.spyOn(persistence, "openCareerStorage").mockRejectedValue(
    new Error("Storage unavailable"),
  );
  const controller = new CareerController();
  controllers.push(controller);
  await controller.initialize();
  const properties = {
    id: "custom",
    kind: "custom",
    icon: "file-text",
    name: "Research",
    heading: {},
    archived: false,
  };
  controller.open("new-section/custom");
  controller.change(properties);
  expect(await controller.save(true)).toBe(true);
  return { controller, properties };
}

describe("shared custom-section icons", () => {
  it("requires catalog icons and fixed built-in icons in sections and starter structure", () => {
    expect(
      createCareerDocument().sections.map((section) => section.icon),
    ).toEqual([
      "briefcase-business",
      "folder-kanban",
      "graduation-cap",
      "code-2",
      "award",
    ]);
    const { document, sections } = fixture();
    const properties = readScope(
      document,
      `section/${sections[0].id}`,
    ) as object;
    for (const icon of sectionIconIds)
      expect(sectionPropertiesSchema.parse({ ...properties, icon }).icon).toBe(
        icon,
      );
    expect(
      sectionPropertiesSchema.safeParse({ ...properties, icon: "unknown" })
        .success,
    ).toBe(false);
    const { icon: omitted, ...missing } = { ...sections[0] };
    expect(omitted).toBe("heart-handshake");
    expect(
      careerDocumentSchema.safeParse({ ...document, sections: [missing] })
        .success,
    ).toBe(false);
    expect(() =>
      applyScope(document, `section/${document.sections[0].id}`, {
        ...(readScope(
          document,
          `section/${document.sections[0].id}`,
        ) as object),
        icon: "rocket",
      }),
    ).toThrow(/default icon/);
    document.starters = [
      {
        id: "starter",
        name: "Research",
        template: "yabuki-reference@1.0.3",
        summaryIncluded: false,
        sections: [
          {
            id: "custom-slot",
            label: "Custom",
            hidden: false,
            kind: "custom",
            icon: "flask-conical",
            visibleFields: ["title"],
          },
          {
            id: "experience-slot",
            label: "Experience",
            hidden: false,
            kind: "experience",
            icon: "briefcase-business",
            visibleFields: ["title"],
          },
        ],
        layout: { ...document.defaults },
      },
    ];
    expect(validateDocument(document).starters[0].sections[0].icon).toBe(
      "flask-conical",
    );
    document.starters[0].sections[1].icon = "rocket";
    expect(() => validateDocument(document)).toThrow(/default icon/);
  });

  it("carries each section's distinct icon through wording, shared facts, and comparison", () => {
    const { document, sections } = fixture();
    const resume = createResume(document, "en-US");
    for (const section of sections) {
      for (const entry of section.entries) {
        entry.achievements.push({
          id: `achievement-${entry.id}`,
          archived: false,
          wording: {},
        });
        entry.links.push({
          id: `link-${entry.id}`,
          archived: false,
          label: {},
          url: "https://example.com",
        });
      }
    }
    document.sections.splice(-2, 2, ...sections);
    const wording = resumeWordingFields(document, "en-US");
    const facts = resumeFactFields(document);
    const compared = resumeComparisonRows(document, resume);
    for (const section of sections) {
      const entries = new Set(
        section.entries.map((entry) => `entry/${entry.id}`),
      );
      const owned = wording.filter(
        (row) =>
          row.destination === `section/${section.id}` ||
          entries.has(row.destination),
      );
      expect(owned.length).toBeGreaterThan(1);
      expect(owned.every((row) => row.icon === section.icon)).toBe(true);
      expect(
        facts
          .filter((row) => entries.has(row.destination))
          .every((row) => row.icon === section.icon),
      ).toBe(true);
      for (const row of owned)
        expect(compared.find((item) => item.id === row.id)?.icon).toBe(
          section.icon,
        );
      expect(
        compared.find((row) => row.id === `order:entries:${section.id}`)?.icon,
      ).toBe(section.icon);
      expect(
        compared.find(
          (row) => row.id === `order:details:${section.entries[0].id}`,
        )?.icon,
      ).toBe(section.icon);
    }
  });

  it("includes icons in properties conflicts while keeping entry order independent", () => {
    const { document, sections } = fixture();
    const section = sections[0];
    const scope = `section/${section.id}`;
    const before = readScope(document, scope) as object;
    const order = readScope(document, `entries/${section.id}`);
    const edited = applyScope(document, scope, { ...before, icon: "rocket" });
    expect(persistence.sameScope(readScope(edited, scope), before)).toBe(false);
    expect(readScope(edited, `entries/${section.id}`)).toEqual(order);
    const reordered = applyScope(
      edited,
      `entries/${section.id}`,
      [...section.entries].reverse().map((entry) => entry.id),
    );
    expect(readScope(reordered, scope)).toEqual({ ...before, icon: "rocket" });
    expect(
      applyScope(reordered, scope, {
        ...before,
        icon: "rocket",
        archived: true,
      }).sections.at(-2)?.icon,
    ).toBe("rocket");
  });

  it("round-trips committed icons and recoverable malformed icon values separately", () => {
    const { document, sections } = fixture();
    document.starters.push({
      id: "starter",
      name: "Custom",
      template: "yabuki-reference@1.0.3",
      summaryIncluded: false,
      sections: [
        {
          id: "custom-slot",
          label: "Custom",
          hidden: false,
          kind: "custom",
          icon: "rocket",
          visibleFields: [],
        },
      ],
      layout: document.defaults,
    });
    const envelope = {
      format: "verso.workspace",
      schemaVersion: 2,
      workspaceId: "workspace",
      exportedAt: "2026-11-04T12:00:00Z",
      document,
    };
    expect(parsePortable(JSON.stringify(envelope), "workspace")).toEqual(
      envelope,
    );
    const baseline = readScope(document, `section/${sections[0].id}`) as object;
    const draft: CareerDraft = {
      draftId: "draft",
      draftVersion: 2,
      workspaceId: "workspace",
      generation: 0,
      baselineRevision: 1,
      scope: `section/${sections[0].id}`,
      baseline,
      values: { ...baseline, icon: "not-yet-valid" },
    };
    const exported = recoveryFiles([draft], "workspace").next().value!;
    const restored = parsePortable(exported.content, "recovery");
    expect(restored.format === "verso.recovery" && restored.drafts[0]).toEqual(
      draft,
    );
    const before = structuredClone(document);
    expect(() =>
      parsePortable(
        JSON.stringify({
          ...envelope,
          document: {
            ...document,
            sections: [{ ...sections[0], icon: "unknown" }],
          },
        }),
        "workspace",
      ),
    ).toThrow();
    expect(document).toEqual(before);
  });

  it("does not alter PDF source at the same revision or introduce icon readiness requirements", () => {
    const { document, sections } = fixture();
    const section = document.sections.find(
      (item) => item.id === sections[0].id,
    )!;
    const entry = section.entries[0];
    entry.fields[0].wording["en-US"] = "Mentor";
    const resume = createResume(document, "en-US");
    resume.selection = [
      {
        sectionId: section.id,
        entryIds: [entry.id],
        fieldIds: [entry.fields[0].id],
        achievementIds: [],
        linkIds: [],
      },
    ];
    document.resumes.push(resume);
    const source = renderCareerResume(document, resume.id, 7);
    const next = applyScope(document, `section/${section.id}`, {
      ...(readScope(document, `section/${section.id}`) as object),
      icon: "rocket",
    });
    expect(renderCareerResume(next, resume.id, 7)).toBe(source);
    expect(renderCareerResume(next, resume.id, 8)).not.toBe(source);
    const copy = copyResume(resume);
    expect(copy.selection).toEqual(resume.selection);
    expect(
      next.sections.find((item) => item.id === copy.selection[0].sectionId)
        ?.icon,
    ).toBe("rocket");
  });

  it("isolates draft icons, retains failed Saves, and commits exactly one history step on retry", async () => {
    const { controller, properties } = await sessionController();
    const undoCount = controller.getSnapshot().undoCount;
    controller.open("section/custom");
    controller.change({ ...properties, icon: "rocket" });
    expect(controller.getSnapshot().head!.document.sections.at(-1)?.icon).toBe(
      "file-text",
    );
    expect(await controller.save()).toBe(false);
    const pending = controller.getSnapshot().draft!;
    expect(pending.operationId).toBeTruthy();
    expect(pending.values).toEqual({ ...properties, icon: "rocket" });
    expect(await controller.save()).toBe(false);
    expect(controller.getSnapshot().draft?.operationId).toBe(
      pending.operationId,
    );
    expect(controller.getSnapshot().draft?.fingerprint).toBe(
      pending.fingerprint,
    );
    expect(await controller.save(true)).toBe(true);
    expect(controller.getSnapshot().undoCount).toBe(undoCount + 1);
    expect(controller.getSnapshot().head!.document.sections.at(-1)?.icon).toBe(
      "rocket",
    );
    await controller.cancel();
    expect(await controller.history("undo")).toBe(true);
    expect(controller.getSnapshot().head!.document.sections.at(-1)?.icon).toBe(
      "file-text",
    );
    expect(await controller.history("redo")).toBe(true);
    expect(controller.getSnapshot().head!.document.sections.at(-1)?.icon).toBe(
      "rocket",
    );
    controller.open("section/custom");
    controller.change({ ...properties, icon: "flask-conical" });
    await controller.cancel();
    expect(controller.getSnapshot().head!.document.sections.at(-1)?.icon).toBe(
      "rocket",
    );
    expect(controller.getSnapshot().undoCount).toBe(undoCount + 1);
  });
  it("saves icon properties without resolving or rebasing the independent entry-order draft", async () => {
    const { controller, properties } = await sessionController();
    const entries = [createEntry("custom"), createEntry("custom")];
    for (const entry of entries) {
      controller.open(`new-entry/custom/${entry.id}`);
      controller.change(entry);
      expect(await controller.save(true)).toBe(true);
    }
    controller.open("entries/custom", "order");
    controller.change(entries.map((entry) => entry.id).reverse(), "order");
    const orderDraft = controller.getSnapshot().orderDraft;
    const undoCount = controller.getSnapshot().undoCount;
    controller.open("section/custom");
    controller.change({ ...properties, icon: "flask-conical" });
    expect(await controller.save(true)).toBe(true);
    expect(controller.getSnapshot().orderDraft).toBe(orderDraft);
    expect(
      controller
        .getSnapshot()
        .head!.document.sections.at(-1)
        ?.entries.map((entry) => entry.id),
    ).toEqual(entries.map((entry) => entry.id));
    expect(await controller.save(true, "order")).toBe(true);
    const section = controller.getSnapshot().head!.document.sections.at(-1)!;
    expect(section.icon).toBe("flask-conical");
    expect(section.entries.map((entry) => entry.id)).toEqual(
      entries.map((entry) => entry.id).reverse(),
    );
    expect(controller.getSnapshot().undoCount).toBe(undoCount + 2);
  });
});
