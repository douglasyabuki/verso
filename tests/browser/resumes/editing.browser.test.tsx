import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";

import { CareerWorkspace } from "@/components/career/career-workspace";
import { ResumeContentEditor } from "@/components/career/resume-workspace";
import {
  createCareerDocument,
  createEntry,
  readScope,
} from "@/lib/career/model";
import { createResume, type ResumeContent } from "@/lib/career/resumes";
import { CareerController } from "@/stores/career/controller";
import { openCareerStorage } from "@/stores/career/persistence";
import type { CareerDocument } from "@/types-and-constants/career";

const controllers: CareerController[] = [];
const initialUrl = window.location.href;

function fixture() {
  const document = createCareerDocument();
  document.languages.push({ tag: "pt-BR", active: true });
  document.profile.fields[0].wording = { "en-US": "Ana", "pt-BR": "Ana" };
  const entry = createEntry("experience");
  entry.name = "Engineer";
  entry.fields[0].wording["en-US"] = "Engineer";
  document.sections[0].entries = [entry];
  const resume = createResume(document, "en-US");
  resume.name = "Application";
  document.resumes = [resume];
  return { document, resume, entry };
}

async function owner(document?: CareerDocument) {
  if (document) {
    const storage = await openCareerStorage();
    await storage.load(document);
    storage.close();
  }
  const controller = new CareerController();
  controllers.push(controller);
  await controller.initialize();
  return controller;
}

afterEach(async () => {
  await cleanup();
  for (const controller of controllers) {
    await controller.flushRecovery();
    await controller.dispose();
  }
  controllers.length = 0;
  vi.restoreAllMocks();
  await new Promise<void>((resolve, reject) => {
    const deletion = indexedDB.deleteDatabase("verso-local");
    deletion.onsuccess = () => resolve();
    deletion.onerror = () => reject(deletion.error);
  });
  window.history.replaceState({}, "", initialUrl);
});

describe("resume editing and transactional lifecycle", () => {
  it("retains a malformed entry when saving from an issue guard fails, then navigates after a valid incomplete Save", async () => {
    await page.viewport(1440, 900);
    const { document, resume, entry } = fixture();
    document.profile.fields[0].wording = {};
    const controller = await owner(document);
    window.history.replaceState({}, "", `?scope=entry/${entry.id}`);
    await render(<CareerWorkspace controller={controller} />);
    const invalid = structuredClone(entry);
    invalid.fields.find((field) => field.key === "start")!.fact = "2023-02-29";
    controller.change(invalid);
    const saved = controller.getSnapshot().head;
    const readiness = page.getByRole("region", {
      name: "Active resume readiness",
    });
    await readiness
      .getByRole("button", { name: "Issues (1)", exact: true })
      .click();
    await readiness
      .getByRole("button", { name: "Edit wording", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Unsaved form" })
      .getByRole("button", { name: "Save and go", exact: true })
      .click();
    await expect.poll(() => controller.getSnapshot().saving).toBe(false);
    expect(controller.getSnapshot().head).toEqual(saved);
    expect(controller.getSnapshot().draft?.values).toEqual(invalid);
    expect(controller.getSnapshot().draft?.scope).toBe(`entry/${entry.id}`);
    expect(controller.getSnapshot().undoCount).toBe(0);
    expect(controller.getSnapshot().error).toMatch(/valid.*date/);
    await page
      .getByRole("dialog", { name: "Unsaved form" })
      .getByRole("button", { name: "Keep editing", exact: true })
      .click();
    const valid = structuredClone(invalid);
    valid.fields.find((field) => field.key === "start")!.fact = "";
    valid.name = "Incomplete but saved";
    controller.change(valid);
    await readiness
      .getByRole("button", { name: "Edit wording", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Unsaved form" })
      .getByRole("button", { name: "Save and go", exact: true })
      .click();
    await expect
      .element(
        page
          .getByRole("group", { name: "Profile · Full name", exact: true })
          .getByRole("button", { name: "Customize", exact: true }),
      )
      .toHaveFocus();
    expect(controller.getSnapshot().draft?.scope).toBe(
      `resume-wording/${resume.id}`,
    );
    expect(controller.getSnapshot().undoCount).toBe(1);
  });

  it("guards cross-editor issues, then focuses the inherited or customized wording control", async () => {
    await page.viewport(1440, 900);
    const { document, resume } = fixture();
    document.profile.fields[0].wording = {};
    const controller = await owner(document);
    window.history.replaceState({}, "", `?scope=resume-content/${resume.id}`);
    await render(<CareerWorkspace controller={controller} />);
    await page
      .getByRole("checkbox", { name: "Include Profile · email", exact: true })
      .click();
    const readiness = page.getByRole("region", {
      name: "Active resume readiness",
    });
    await readiness
      .getByRole("button", { name: "Issues (1)", exact: true })
      .click();
    await readiness
      .getByRole("button", { name: "Edit wording", exact: true })
      .click();
    const guard = page.getByRole("dialog", { name: "Unsaved form" });
    await guard
      .getByRole("button", { name: "Keep editing", exact: true })
      .click();
    expect(controller.getSnapshot().draft?.scope).toBe(
      `resume-content/${resume.id}`,
    );
    expect(controller.isDirty()).toBe(true);
    await readiness
      .getByRole("button", { name: "Edit wording", exact: true })
      .click();
    await guard
      .getByRole("button", { name: "Save and go", exact: true })
      .click();
    const card = page.getByRole("group", {
      name: "Profile · Full name",
      exact: true,
    });
    const customize = card.getByRole("button", {
      name: "Customize",
      exact: true,
    });
    await expect.element(customize).toHaveFocus();
    await customize.click();
    const field = card.getByRole("textbox", {
      name: "Profile \u00b7 Full name",
      exact: true,
    });
    await expect
      .element(readiness.getByText("1 blocking", { exact: true }))
      .toBeVisible();
    const issues = readiness.getByRole("button", {
      name: "Issues (1)",
      exact: true,
    });
    if (issues.element().getAttribute("aria-expanded") === "false")
      await issues.click();
    await readiness
      .getByRole("button", { name: "Edit wording", exact: true })
      .click();
    await expect.element(field).toHaveFocus();
    await expect.element(field).toHaveAttribute("aria-invalid", "true");
    await field.fill("Ana");
    expect(controller.isDirty()).toBe(true);
    const historyLength = window.history.length;
    const historyIndex = window.history.state.versoIndex;
    await page
      .getByRole("region", { name: "Editing form" })
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect
      .poll(
        () =>
          controller.getSnapshot().head?.document.resumes[0].overrides[
            document.profile.fields[0].id
          ],
      )
      .toBe("Ana");
    expect(window.history.length).toBe(historyLength);
    expect(window.history.state.versoIndex).toBe(historyIndex);
    expect(controller.getSnapshot().undoCount).toBe(2);
    await card
      .getByRole("button", { name: "Use career wording", exact: true })
      .click();
    expect(controller.isDirty()).toBe(true);
  });

  it("undoes and redoes a Content Save after schema normalization without a false conflict", async () => {
    const { document, resume, entry } = fixture();
    const controller = await owner(document);
    controller.open(`resume-content/${resume.id}`);
    controller.change({
      selection: [
        {
          sectionId: document.sections[0].id,
          entryIds: [entry.id],
          fieldIds: [entry.fields[0].id],
          achievementIds: [],
          linkIds: [],
          hidden: false,
          hiddenEntryIds: [],
        },
      ],
      profileSelection: [],
      summaryIncluded: false,
    });
    expect(await controller.save()).toBe(true);
    expect(await controller.history("undo")).toBe(true);
    expect(
      controller.getSnapshot().head!.document.resumes[0].selection,
    ).toEqual([]);
    expect(await controller.history("redo")).toBe(true);
    expect(
      controller.getSnapshot().head!.document.resumes[0].selection[0].entryIds,
    ).toEqual([entry.id]);
    expect(controller.getSnapshot().undoCount).toBe(1);
  });

  it("moves a contact with a real pointer drag while leaving committed choices unchanged", async () => {
    const { document, resume } = fixture();
    const email = document.profile.fields.find(
      (field) => field.key === "email",
    )!.id;
    const phone = document.profile.fields.find(
      (field) => field.key === "phone",
    )!.id;
    const update = vi.fn();
    await page.viewport(1440, 900);
    await render(
      <ResumeContentEditor
        document={document}
        resume={resume}
        values={{
          selection: [],
          profileSelection: [email, phone],
          summaryIncluded: false,
        }}
        onChange={update}
      />,
    );
    await expect
      .poll(
        () =>
          window.document
            .getAnimations()
            .filter(
              (animation) =>
                animation.playState === "running" || animation.pending,
            ).length,
      )
      .toBe(0);
    await userEvent.dragAndDrop(
      page.getByRole("button", {
        name: "Reorder Profile · phone",
        exact: true,
      }),
      page.getByRole("button", {
        name: "Reorder Profile · email",
        exact: true,
      }),
    );
    await expect
      .poll(() => update.mock.calls.at(-1)?.[0]?.profileSelection)
      .toEqual([phone, email]);
    expect(document.resumes[0].profileSelection).toEqual([]);
  });

  it("confirms deletion against reviewed content and retains career data through undo/redo", async () => {
    const { document, resume, entry } = fixture();
    const controller = await owner(document);
    const reviewed = structuredClone(resume);
    expect(
      await controller.command(`resume-details/${resume.id}`, {
        name: "Renamed",
        color: "rose",
      }),
    ).toBe(true);
    expect(
      await controller.command(`resume/${resume.id}`, null, reviewed),
    ).toBe(false);
    expect(controller.getSnapshot().head!.document.resumes).toHaveLength(1);
    const current = controller.getSnapshot().head!.document.resumes[0];
    expect(await controller.command(`resume/${resume.id}`, null, current)).toBe(
      true,
    );
    expect(controller.getSnapshot().head!.document.resumes).toEqual([]);
    expect(
      controller.getSnapshot().head!.document.sections[0].entries[0].id,
    ).toBe(entry.id);
    expect(await controller.history("undo")).toBe(true);
    expect(controller.getSnapshot().head!.document.resumes[0]).toEqual(current);
    expect(await controller.history("redo")).toBe(true);
    expect(controller.getSnapshot().head!.document.resumes).toEqual([]);
  });

  it("retains missing-resume recovery and explicitly restores a valid Content scope as new", async () => {
    const { document, resume, entry } = fixture();
    const first = await owner(document);
    const second = await owner();
    first.open(`resume-content/${resume.id}`);
    first.change({
      selection: [
        {
          sectionId: document.sections[0].id,
          entryIds: [entry.id],
          fieldIds: [entry.fields[0].id],
          achievementIds: [],
          linkIds: [],
        },
      ],
      profileSelection: [],
      summaryIncluded: false,
    });
    await first.flushRecovery();
    const originalDraftId = first.getSnapshot().draft!.draftId;
    expect(await second.command(`resume/${resume.id}`, null)).toBe(true);
    await first.refresh();
    expect(await first.save()).toBe(false);
    expect(await first.restoreResumeAsNew("pt-BR")).toBe(true);
    expect(first.getSnapshot().draft!.scope).not.toBe(`resume/${resume.id}`);
    expect(first.getSnapshot().draft!.baseline).toBe(null);
    expect(await first.save()).toBe(true);
    expect(first.getSnapshot().head!.document.resumes[0]).toMatchObject({
      language: "pt-BR",
      selection: [{ entryIds: [entry.id] }],
    });
    const storage = await openCareerStorage();
    expect(
      (await storage.drafts()).some(
        (draft) => draft.draftId === originalDraftId,
      ),
    ).toBe(true);
    storage.close();
  });

  it("keeps Content unsaved through view-switch cancellation and commits one Save", async () => {
    const { document, resume } = fixture();
    const controller = await owner(document);
    window.history.replaceState({}, "", `?scope=resume-content/${resume.id}`);
    await render(<CareerWorkspace controller={controller} />);
    await page
      .getByRole("checkbox", { name: "Include Profile · email", exact: true })
      .click();
    expect(
      controller.getSnapshot().head!.document.resumes[0].profileSelection,
    ).toEqual([]);
    await page
      .getByRole("main")
      .getByRole("tab", { name: "Wording", exact: true })
      .click();
    const guard = page.getByRole("dialog", { name: "Unsaved form" });
    await guard.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect
      .element(page.getByRole("tab", { name: "Content & order", exact: true }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .element(page.getByRole("tab", { name: "Wording", exact: true }))
      .toHaveAttribute("aria-selected", "false");
    await expect
      .element(
        page.getByRole("checkbox", {
          name: "Include Profile · email",
          exact: true,
        }),
      )
      .toBeChecked();
    await page
      .getByRole("region", { name: "Editing form" })
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect
      .poll(
        () =>
          controller.getSnapshot().head!.document.resumes[0].profileSelection,
      )
      .toEqual([document.profile.fields[1].id]);
    expect(controller.getSnapshot().undoCount).toBe(1);
  });

  it("includes a newly selected entry's details in one Save that undoes in one step", async () => {
    const { document, resume, entry } = fixture();
    entry.achievements = [
      { id: "kept", archived: false, wording: { "en-US": "Shipped" } },
      { id: "retired", archived: true, wording: { "en-US": "Old" } },
    ];
    const controller = await owner(document);
    window.history.replaceState({}, "", `?scope=resume-content/${resume.id}`);
    await render(<CareerWorkspace controller={controller} />);
    await page
      .getByRole("checkbox", { name: "Include Experience", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Experience entries", exact: true })
      .click();
    await page
      .getByRole("checkbox", { name: "Include Engineer", exact: true })
      .click();
    expect(
      controller.getSnapshot().head!.document.resumes[0].selection,
    ).toEqual([]);
    const details = page.getByRole("button", {
      name: /^Fields, achievements, and links/,
    });
    await expect
      .element(details)
      .toHaveTextContent(
        `${entry.fields.length + 1} of ${entry.fields.length + 1} included`,
      );
    await details.click();
    await expect
      .element(
        page.getByRole("checkbox", { name: "Include Title", exact: true }),
      )
      .toBeChecked();
    await expect
      .element(
        page.getByRole("checkbox", {
          name: "Include Achievement 1",
          exact: true,
        }),
      )
      .toBeChecked();
    await expect
      .element(
        page.getByRole("checkbox", {
          name: "Include Achievement 2",
          exact: true,
        }),
      )
      .not.toBeInTheDocument();
    await page
      .getByRole("region", { name: "Editing form" })
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect
      .poll(() => controller.getSnapshot().head!.document.resumes[0].selection)
      .toMatchObject([
        {
          sectionId: document.sections[0].id,
          entryIds: [entry.id],
          fieldIds: entry.fields.map((field) => field.id),
          achievementIds: ["kept"],
          linkIds: [],
        },
      ]);
    // Wait for the Save to settle, then close the still-open Content form
    // before invoking a separate history operation.
    await expect.poll(() => controller.getSnapshot().saving).toBe(false);
    expect(controller.getSnapshot().undoCount).toBe(1);
    await controller.cancel();
    expect(await controller.history("undo")).toBe(true);
    expect(
      controller.getSnapshot().head!.document.resumes[0].selection,
    ).toEqual([]);
  });

  it("reorders selected contacts with keyboard alternatives without committing or moving excluded rows", async () => {
    const { document, resume } = fixture();
    const ids = document.profile.fields
      .filter((field) => ["email", "phone", "city"].includes(field.key))
      .map((field) => field.id);
    let values: ResumeContent = {
      selection: [],
      profileSelection: ids,
      summaryIncluded: false,
    };
    const update = vi.fn((next: ResumeContent) => {
      values = next;
    });
    const screen = await render(
      <ResumeContentEditor
        document={document}
        resume={resume}
        values={values}
        onChange={update}
      />,
    );
    await page
      .getByRole("button", { name: "Move Profile · city up", exact: true })
      .click();
    expect(values.profileSelection).toEqual([ids[0], ids[2], ids[1]]);
    expect(resume.profileSelection).toEqual([]);
    await screen.rerender(
      <ResumeContentEditor
        document={document}
        resume={resume}
        values={values}
        onChange={update}
      />,
    );
    page
      .getByRole("button", { name: "Reorder Profile · city", exact: true })
      .element()
      .focus();
    await userEvent.keyboard("{Space}{ArrowUp}{Escape}");
    expect(values.profileSelection).toEqual([ids[0], ids[2], ids[1]]);
    expect(
      page
        .getByRole("button", { name: "Reorder Profile · country", exact: true })
        .elements(),
    ).toHaveLength(0);
    expect(readScope(document, `resume-content/${resume.id}`)).toMatchObject({
      profileSelection: [],
    });
  });
});
