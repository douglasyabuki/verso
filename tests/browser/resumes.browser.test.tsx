import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";

import { CareerOverview } from "@/components/career/career-overview";
import { CareerWorkspace } from "@/components/career/career-workspace";
import { CareerWorkspaceShell } from "@/components/career/career-workspace-shell";
import {
  ResumeComparison,
  ResumeContentEditor,
  ResumeWordingEditor,
} from "@/components/career/resume-workspace";
import { EntrySearch } from "@/components/content/entry-search";
import {
  createCareerDocument,
  createEntry,
  readScope,
} from "@/lib/career/model";
import { createResume, type ResumeContent } from "@/lib/career/resumes";
import { CareerController } from "@/stores/career/controller";
import { CareerStorage, openCareerStorage } from "@/stores/career/persistence";
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
    controller.dispose();
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
  it("preserves narrow PDF selection when an issue request clears and reveals Editor for a new request", async () => {
    await page.viewport(390, 844);
    const { document, resume } = fixture();
    const renderShell = (editorRequest: object | null) => (
      <CareerWorkspaceShell
        document={document}
        destination={`resume-wording/${resume.id}`}
        navigate={vi.fn()}
        addSection={vi.fn()}
        addResume={vi.fn()}
        resumeActions={{
          create: vi.fn(),
          edit: vi.fn(),
          duplicate: vi.fn(),
          copy: vi.fn(),
          delete: vi.fn(),
        }}
        language="en-US"
        setLanguage={vi.fn()}
        status="Saved locally"
        history={{
          undo: vi.fn(),
          redo: vi.fn(),
          canUndo: false,
          canRedo: false,
        }}
        editorRequest={editorRequest}
        output={(visible) => <p data-visible={visible}>Saved PDF surface</p>}
      >
        <p>Wording editor surface</p>
      </CareerWorkspaceShell>
    );
    const screen = await render(renderShell({ fieldId: "name" }));
    const pdfTab = page.getByRole("tab", { name: "PDF preview", exact: true });
    const editorTab = page.getByRole("tab", { name: "Editor", exact: true });
    await pdfTab.click();
    await expect
      .element(page.getByText("Saved PDF surface", { exact: true }))
      .toBeVisible();
    await screen.rerender(renderShell(null));
    await expect.element(pdfTab).toHaveAttribute("aria-selected", "true");
    await expect
      .element(page.getByText("Saved PDF surface", { exact: true }))
      .toBeVisible();
    await screen.rerender(renderShell({ fieldId: "name" }));
    await expect.element(editorTab).toHaveAttribute("aria-selected", "true");
    await expect
      .element(page.getByText("Wording editor surface", { exact: true }))
      .toBeVisible();
  });

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
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect.poll(() => controller.getSnapshot().saving).toBe(false);
    expect(controller.getSnapshot().head).toEqual(saved);
    expect(controller.getSnapshot().draft?.values).toEqual(invalid);
    expect(controller.getSnapshot().draft?.scope).toBe(`entry/${entry.id}`);
    expect(controller.getSnapshot().undoCount).toBe(0);
    expect(controller.getSnapshot().error).toMatch(/valid.*date/);
    await page
      .getByRole("dialog", { name: "Unsaved form" })
      .getByRole("button", { name: "Cancel", exact: true })
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
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect
      .element(
        page.getByRole("group", { name: "Profile · Full name", exact: true }),
      )
      .toHaveFocus();
    expect(controller.getSnapshot().draft?.scope).toBe(
      `resume-wording/${resume.id}`,
    );
    expect(controller.getSnapshot().undoCount).toBe(1);
  });

  it("keeps readiness committed-only and guards issue navigation before focusing the exact Wording card", async () => {
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
    await guard.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(controller.getSnapshot().draft?.scope).toBe(
      `resume-content/${resume.id}`,
    );
    expect(controller.isDirty()).toBe(true);
    await readiness
      .getByRole("button", { name: "Edit wording", exact: true })
      .click();
    await guard.getByRole("button", { name: "Discard", exact: true }).click();
    const card = page.getByRole("group", {
      name: "Profile · Full name",
      exact: true,
    });
    await expect.element(card).toHaveFocus();
    await card.getByRole("button", { name: "Customize", exact: true }).click();
    await card
      .getByRole("textbox", { name: "Profile · Full name", exact: true })
      .fill("Ana");
    await expect
      .element(readiness.getByText("1 blocking", { exact: true }))
      .toBeVisible();
    await readiness
      .getByRole("button", { name: "Edit wording", exact: true })
      .click();
    await expect.element(card).toHaveFocus();
    expect(controller.isDirty()).toBe(true);
    const historyLength = window.history.length;
    const historyIndex = window.history.state.versoIndex;
    await page
      .getByRole("region", { name: "Editing form" })
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect
      .element(readiness.getByText("Ready for PDF", { exact: true }))
      .toBeVisible();
    expect(window.history.length).toBe(historyLength);
    expect(window.history.state.versoIndex).toBe(historyIndex);
    expect(controller.getSnapshot().undoCount).toBe(1);
    await card
      .getByRole("button", { name: "Use career wording", exact: true })
      .click();
    expect(controller.isDirty()).toBe(true);
  });

  it("shows shared facts read-only in Wording and navigates to their career owner", async () => {
    const { document, resume, entry } = fixture();
    entry.fields.find((field) => field.key === "start")!.fact = "2024-01";
    const navigate = vi.fn();
    const change = vi.fn();
    await render(
      <ResumeWordingEditor
        document={document}
        resume={resume}
        values={{}}
        onChange={change}
        navigate={navigate}
      />,
    );
    await page
      .getByRole("button", { name: "Shared facts read only", exact: true })
      .click();
    await expect
      .element(page.getByText("2024-01", { exact: true }))
      .toBeVisible();
    expect(page.getByRole("textbox").elements()).toHaveLength(0);
    await page
      .getByRole("button", {
        name: "Open Career details · Experience · Engineer · Start date",
        exact: true,
      })
      .click();
    expect(navigate).toHaveBeenCalledWith(`entry/${entry.id}`);
    expect(change).not.toHaveBeenCalled();
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
  it("commits independent Content and Wording scopes but rejects competing same-scope saves", async () => {
    const { document, resume } = fixture();
    const first = await owner(document);
    const second = await owner();
    first.open(`resume-content/${resume.id}`);
    first.change({
      selection: [],
      profileSelection: [document.profile.fields[1].id],
      summaryIncluded: false,
    });
    second.open(`resume-wording/${resume.id}`);
    second.change({ [document.profile.fields[0].id]: "Custom Ana" });
    expect(await first.save()).toBe(true);
    expect(await second.save()).toBe(true);
    expect(second.getSnapshot().head!.document.resumes[0]).toMatchObject({
      profileSelection: [document.profile.fields[1].id],
      overrides: { [document.profile.fields[0].id]: "Custom Ana" },
    });
    await first.refresh();
    first.open(`resume-details/${resume.id}`);
    second.open(`resume-details/${resume.id}`);
    first.change({ name: "First", color: "rose" });
    second.change({ name: "Second", color: "sky" });
    expect(await first.save()).toBe(true);
    expect(await second.save()).toBe(false);
    expect(second.getSnapshot().draft?.values).toEqual({
      name: "Second",
      color: "sky",
    });
    expect(second.getSnapshot().error).toContain("scope changed");
  });

  it("checks a committed creation receipt before retrying and creates one history step", async () => {
    const controller = await owner();
    const document = controller.getSnapshot().head!.document;
    const resume = createResume(document, "en-US");
    const original = CareerStorage.prototype.commit;
    let interrupted = false;
    vi.spyOn(CareerStorage.prototype, "commit").mockImplementation(
      async function (this: CareerStorage, id: string) {
        const result = await original.call(this, id);
        if (!interrupted) {
          interrupted = true;
          throw new Error("Interrupted acknowledgment");
        }
        return result;
      },
    );
    expect(await controller.command(`resume/${resume.id}`, resume)).toBe(false);
    const operationId = controller.getSnapshot().draft!.operationId;
    await controller.refresh();
    expect(controller.getSnapshot().head!.document.resumes).toHaveLength(1);
    expect(await controller.save()).toBe(true);
    expect(controller.getSnapshot().head!.revision).toBe(1);
    expect(controller.getSnapshot().undoCount).toBe(1);
    expect(operationId).toBeTruthy();
    expect(await controller.history("undo")).toBe(true);
    expect(controller.getSnapshot().head!.document.resumes).toEqual([]);
    expect(await controller.history("redo")).toBe(true);
    expect(controller.getSnapshot().head!.document.resumes[0].id).toBe(
      resume.id,
    );
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

  it("creates, renames and cancels a resume through the collection and dedicated details page", async () => {
    const controller = await owner();
    window.history.replaceState({}, "", "?scope=resumes");
    await render(<CareerWorkspace controller={controller} />);
    await page
      .getByRole("region", { name: "Resume collection" })
      .getByRole("button", { name: "Create resume", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Create resume",
      exact: true,
    });
    await dialog
      .getByRole("textbox", { name: "Resume name" })
      .fill("My application");
    await dialog
      .getByRole("button", { name: "Create resume", exact: true })
      .click();
    await expect
      .element(
        page.getByRole("heading", {
          name: "My application",
          exact: true,
          level: 1,
        }),
      )
      .toBeVisible();
    expect(
      controller.getSnapshot().head!.document.resumes[0].profileSelection,
    ).toEqual([]);
    await page
      .getByRole("navigation", { name: "Workspace navigation" })
      .getByRole("button", { name: "Resumes", exact: true })
      .click();
    await page
      .getByRole("region", { name: "Resume collection" })
      .getByRole("button", { name: "Actions for My application" })
      .click();
    await page.getByRole("menuitem", { name: "Edit name & color" }).click();
    const rename = page.getByRole("main");
    await rename
      .getByRole("textbox", { name: "Resume name" })
      .fill("Changed name");
    await rename.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect
      .element(
        page.getByRole("heading", {
          name: "My application",
          exact: true,
          level: 1,
        }),
      )
      .toBeVisible();
    expect(controller.getSnapshot().head!.document.resumes[0].name).toBe(
      "My application",
    );
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

it("distinguishes empty nested choices from available but excluded links", async () => {
  const { document, resume, entry } = fixture();
  entry.links = [];
  const values: ResumeContent = {
    profileSelection: [],
    summaryIncluded: false,
    selection: [
      {
        sectionId: document.sections[0].id,
        entryIds: [entry.id],
        fieldIds: entry.fields.map((field) => field.id),
        achievementIds: [],
        linkIds: [],
      },
    ],
  };
  const props = { document, resume, values, onChange: vi.fn() };
  const screen = await render(<ResumeContentEditor {...props} />);
  await page
    .getByRole("button", { name: "Experience entries", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Fields, achievements, and links",
      exact: true,
    })
    .click();
  const links = page.getByRole("group", { name: "Links", exact: true });
  await expect
    .element(links.getByText("No links available.", { exact: true }))
    .toBeVisible();
  const updated = structuredClone(document);
  updated.sections[0].entries[0].links = [
    {
      id: "available-link",
      archived: false,
      url: "https://example.com",
      label: { "en-US": "Portfolio" },
    },
  ];
  await screen.rerender(<ResumeContentEditor {...props} document={updated} />);
  await expect
    .element(
      links.getByRole("checkbox", { name: "Include Link 1", exact: true }),
    )
    .not.toBeChecked();
  expect(
    links.getByText("No links available.", { exact: true }).elements(),
  ).toHaveLength(0);
  expect(props.onChange).not.toHaveBeenCalled();
});

it("opens a read-only overview from the resume tree and edits details through the guarded page", async () => {
  await page.viewport(1440, 900);
  const { document, resume } = fixture();
  resume.color = "rose";
  const controller = await owner(document);
  window.history.replaceState({}, "", `?scope=resume-overview/${resume.id}`);
  await render(<CareerWorkspace controller={controller} />);
  const navigation = page.getByRole("navigation", {
    name: "Workspace navigation",
  });
  const main = page.getByRole("main");
  await expect
    .element(
      main.getByRole("heading", { name: "Resume overview", exact: true }),
    )
    .toBeVisible();
  expect(controller.getSnapshot().draft).toBeNull();
  const overview = navigation.getByRole("button", {
    name: "Overview",
    exact: true,
  });
  await expect.element(overview).toHaveAttribute("aria-current", "page");
  await expect
    .element(main.getByRole("tab", { name: "Overview", exact: true }))
    .toHaveAttribute("aria-selected", "true");
  await expect
    .element(main.getByRole("tabpanel", { name: "Overview", exact: true }))
    .toBeVisible();
  await expect
    .element(navigation.getByRole("button", { name: "Resumes", exact: true }))
    .not.toHaveAttribute("aria-current");
  expect(
    main.element().querySelector('header[aria-label="Workspace controls"]')
      ?.textContent,
  ).toMatch(/Resumes\s*Application\s*Overview/);
  const heading = main.getByRole("heading", {
    name: "Application",
    level: 1,
    exact: true,
  });
  await expect.element(heading).toBeVisible();
  expect(
    heading
      .element()
      .parentElement!.querySelector("svg")
      ?.getAttribute("data-resume-color"),
  ).toBe("rose");
  expect(
    main.getByRole("button", { name: "All resumes", exact: true }).elements(),
  ).toHaveLength(0);
  expect(main.getByText("Color", { exact: true }).elements()).toHaveLength(0);
  expect(
    main
      .getByRole("button", { name: "Content & order", exact: true })
      .elements(),
  ).toHaveLength(0);
  expect(
    main.getByRole("button", { name: "Wording", exact: true }).elements(),
  ).toHaveLength(0);
  await expect
    .element(
      navigation.getByRole("button", { name: "Content & order", exact: true }),
    )
    .toBeVisible();
  await navigation
    .getByRole("button", { name: "Actions for Application", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Edit name & color", exact: true })
    .click();
  await expect
    .element(
      main.getByRole("button", { name: "Back to overview", exact: true }),
    )
    .toBeVisible();
  expect(
    main.getByRole("tablist", { name: "Resume views" }).elements(),
  ).toHaveLength(0);
  expect(
    main.element().querySelector('header[aria-label="Workspace controls"]')
      ?.textContent,
  ).toMatch(/Resumes\s*Application\s*Name & color/);
  expect(
    main
      .getByRole("button", { name: "Compare resumes", exact: true })
      .elements(),
  ).toHaveLength(0);
  await expect
    .element(main.getByRole("button", { name: "Save", exact: true }))
    .toBeDisabled();
  await main
    .getByRole("textbox", { name: "Resume name", exact: true })
    .fill("Reviewed application");
  await main
    .getByRole("button", { name: "Back to overview", exact: true })
    .click();
  const guard = page.getByRole("dialog", { name: "Unsaved form", exact: true });
  await guard.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect
    .element(main.getByRole("textbox", { name: "Resume name", exact: true }))
    .toHaveValue("Reviewed application");
  expect(controller.getSnapshot().head!.document.resumes[0].name).toBe(
    "Application",
  );
  await main.getByRole("button", { name: "Save", exact: true }).click();
  await expect
    .element(
      main.getByRole("heading", { name: "Resume overview", exact: true }),
    )
    .toBeVisible();
  expect(controller.getSnapshot().draft).toBeNull();
  expect(controller.getSnapshot().undoCount).toBe(1);
  await navigation
    .getByRole("button", { name: "Wording", exact: true })
    .click();
  await expect
    .element(navigation.getByRole("button", { name: "Wording", exact: true }))
    .toHaveAttribute("aria-current", "page");
  await navigation
    .getByRole("button", { name: "Reviewed application (en-US)", exact: true })
    .click();
  await expect.element(overview).toHaveAttribute("aria-current", "page");
  expect(controller.getSnapshot().draft).toBeNull();
});

it("clears entry search with a conditional inline action and restores input focus", async () => {
  const change = vi.fn();
  const props = {
    query: "",
    onQuery: change,
    showArchived: false,
    onArchived: vi.fn(),
    count: 1,
    total: 2,
  };
  const screen = await render(<EntrySearch {...props} />);
  expect(
    page
      .getByRole("button", { name: "Clear search entries", exact: true })
      .elements(),
  ).toHaveLength(0);
  await screen.rerender(<EntrySearch {...props} query=" " />);
  await page
    .getByRole("button", { name: "Clear search entries", exact: true })
    .click();
  expect(change).toHaveBeenCalledWith("");
  await expect
    .element(page.getByRole("textbox", { name: "Search entries", exact: true }))
    .toHaveFocus();
  expect(
    page.getByRole("button", { name: "Clear", exact: true }).elements(),
  ).toHaveLength(0);
});

it("aligns choice checkboxes with the first title line, including wrapped labels", async () => {
  await page.viewport(500, 900);
  const { document, resume } = fixture();
  document.sections[0].name =
    "A long experience section heading that wraps onto multiple lines in a narrow editor";
  await render(
    <div style={{ width: 300 }}>
      <ResumeContentEditor
        document={document}
        resume={resume}
        values={{
          selection: [],
          profileSelection: [document.profile.fields[1].id],
          summaryIncluded: false,
        }}
        onChange={vi.fn()}
      />
    </div>,
  );
  const checkbox = page
    .getByRole("checkbox", {
      name: `Include ${document.sections[0].name}`,
      exact: true,
    })
    .element();
  const label = checkbox.closest("label")!;
  const title = label.querySelector("span.min-w-0")!;
  const range = window.document.createRange();
  range.selectNodeContents(title.firstChild!);
  const firstLine = range.getClientRects()[0];
  const box = checkbox.getBoundingClientRect();
  expect(
    Math.abs(box.top + box.height / 2 - (firstLine.top + firstLine.height / 2)),
  ).toBeLessThanOrEqual(2);
});

it("allocates untransformed sidebar heights without unnecessary scrollbars or wrapping labels", async () => {
  await page.viewport(1440, 900);
  const { document, resume } = fixture();
  document.sections.push({
    ...structuredClone(document.sections[0]),
    id: "community",
    name: "Community",
    entries: [],
  });
  resume.name =
    "A very long resume name that must remain on one line in the navigation";
  document.resumes.push({
    ...structuredClone(resume),
    id: "second",
    name: "Second resume",
  });
  const controller = await owner(document);
  window.history.replaceState({}, "", `?scope=resume-content/${resume.id}`);
  await render(<CareerWorkspace controller={controller} />);
  const navigation = page.getByRole("navigation", {
    name: "Workspace navigation",
  });
  await expect
    .element(navigation.getByRole("button", { name: "Community", exact: true }))
    .toBeVisible();
  const overflowing = () =>
    [
      ...window.document.querySelectorAll<HTMLElement>(
        "[data-collection-viewport]",
      ),
    ].filter((node) => node.scrollHeight > node.clientHeight + 1).length;
  await expect.poll(overflowing).toBe(0);
  const parent = navigation
    .getByRole("button", { name: `${resume.name} (en-US)`, exact: true })
    .element();
  expect(
    getComputedStyle(parent.querySelector("span.truncate")!).whiteSpace,
  ).toBe("nowrap");
  await page.viewport(1440, 360);
  await expect.poll(overflowing).toBeGreaterThan(0);
  await page.viewport(1440, 1000);
  await expect.poll(overflowing).toBe(0);
});

it("keeps distinct custom-section icons in overview, Content, Wording, references, and comparison", async () => {
  const { document, resume } = fixture();
  document.sections.push(
    {
      id: "service",
      kind: "custom",
      icon: "heart-handshake",
      name: "Service",
      heading: {},
      archived: false,
      entries: [createEntry("custom")],
    },
    {
      id: "research",
      kind: "custom",
      icon: "flask-conical",
      name: "Research",
      heading: {},
      archived: false,
      entries: [createEntry("custom")],
    },
  );
  document.resumes.push({ ...structuredClone(resume), id: "second-resume" });
  await render(
    <>
      <section aria-label="Career icon overview">
        <CareerOverview document={document} navigate={vi.fn()} />
      </section>
      <section aria-label="Content icons">
        <ResumeContentEditor
          document={document}
          resume={resume}
          values={{ selection: [] }}
          onChange={vi.fn()}
        />
      </section>
      <section aria-label="Wording icons">
        <ResumeWordingEditor
          document={document}
          resume={resume}
          values={{}}
          onChange={vi.fn()}
          navigate={vi.fn()}
        />
      </section>
      <section aria-label="Comparison icons">
        <ResumeComparison document={document} />
      </section>
    </>,
  );
  for (const region of [
    "Career icon overview",
    "Content icons",
    "Wording icons",
    "Comparison icons",
  ]) {
    const surface = page.getByRole("region", { name: region }).element();
    expect(surface.querySelector("svg.lucide-heart-handshake")).not.toBeNull();
    expect(surface.querySelector("svg.lucide-flask-conical")).not.toBeNull();
  }
  await page
    .getByRole("region", { name: "Wording icons" })
    .getByRole("button", { name: "Shared facts read only", exact: true })
    .click();
  const facts = page
    .getByRole("region", { name: "Wording icons" })
    .element()
    .querySelector('[data-slot="collapsible-content"]');
  expect(facts).not.toBeNull();
  expect(facts!.querySelector("svg.lucide-heart-handshake")).not.toBeNull();
  expect(facts!.querySelector("svg.lucide-flask-conical")).not.toBeNull();
});
