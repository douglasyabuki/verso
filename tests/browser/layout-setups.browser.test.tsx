import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";

import { CareerWorkspace } from "@/components/career/career-workspace";
import { LayoutFields } from "@/components/career/layout-editor";
import { PresetPicker } from "@/components/career/setup-library";
import { layoutAppearance, layoutFromPreset } from "@/lib/career/layout";
import { createCareerDocument, readScope } from "@/lib/career/model";
import { createResume } from "@/lib/career/resumes";
import { captureStarter, prepareStarterResume } from "@/lib/career/starters";
import { CareerController } from "@/stores/career/controller";
import { CareerStorage, openCareerStorage } from "@/stores/career/persistence";
import type { CareerDocument } from "@/types-and-constants/career";

const controllers: CareerController[] = [];
const connections: CareerStorage[] = [];
const initialUrl = window.location.href;
const initialState = window.history.state;

function AppearanceForm({
  initial,
  resume = true,
}: {
  initial: CareerDocument["resumes"][number]["layout"];
  resume?: boolean;
}) {
  const [values, setValues] = useState<unknown>(initial);
  return (
    <>
      <LayoutFields
        values={values}
        defaults={initial.defaults ?? initial}
        resumeLayout={resume}
        contacts={["Email", "City", "Website"]}
        onChange={setValues}
      />
      <output aria-label="Draft appearance">{JSON.stringify(values)}</output>
    </>
  );
}
function fixture() {
  const document = createCareerDocument();
  const resume = createResume(document, "en-US");
  resume.name = "Application";
  document.resumes = [resume];
  return { document, resume };
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
  for (const controller of controllers.splice(0)) {
    await controller.flushRecovery();
    controller.dispose();
  }
  connections.splice(0).forEach((storage) => storage.close());
  vi.restoreAllMocks();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("verso-local");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Test connections still open"));
  });
  window.history.replaceState(initialState, "", initialUrl);
});

it("resets only one group to copied preset defaults, including retained hidden fields", async () => {
  const { document } = fixture();
  const initial = layoutFromPreset({
    ...document.defaults,
    marginLeft: 18,
    sectionDivider: "off",
    dividerThickness: 0.5,
  });
  initial.marginLeft = 20;
  initial.fontSize = 11;
  initial.dividerThickness = 1.5;
  await render(<AppearanceForm initial={initial} />);
  await expect
    .element(
      page.getByRole("textbox", {
        name: "Divider thickness (pt)",
        exact: true,
      }),
    )
    .not.toBeInTheDocument();
  await page
    .getByRole("button", {
      name: "Reset Typography to layout defaults",
      exact: true,
    })
    .click();
  await expect
    .element(page.getByRole("textbox", { name: "Text size (pt)", exact: true }))
    .toHaveValue("10");
  await expect
    .element(
      page.getByRole("textbox", { name: "Left margin (mm)", exact: true }),
    )
    .toHaveValue("20");
  await page
    .getByRole("checkbox", { name: "Section divider", exact: true })
    .click();
  await expect
    .element(
      page.getByRole("textbox", {
        name: "Divider thickness (pt)",
        exact: true,
      }),
    )
    .toHaveValue("0.5");
  await page
    .getByRole("button", {
      name: "Reset Page & margins to layout defaults",
      exact: true,
    })
    .click();
  await expect
    .element(
      page.getByRole("textbox", { name: "Left margin (mm)", exact: true }),
    )
    .toHaveValue("18");
  await expect
    .element(
      page.getByRole("button", {
        name: "Reset Page & margins to layout defaults",
        exact: true,
      }),
    )
    .toBeDisabled();
});

it("retains automatic dimension semantics on focus and reveals invalid disabled values", async () => {
  const { resume } = fixture();
  await render(<AppearanceForm initial={resume.layout} />);
  const title = page.getByRole("textbox", {
    name: "Title / organization size (pt)",
    exact: true,
  });
  await expect.element(title).toHaveValue("Body text size");
  await title.click();
  await page
    .getByRole("textbox", { name: "Text size (pt)", exact: true })
    .click();
  expect(
    JSON.parse(
      page.getByRole("status", { name: "Draft appearance" }).element()
        .textContent!,
    ).entryTitleSize,
  ).toBe("template-default");
  await title.fill("bad");
  await expect.element(title).toHaveAttribute("aria-invalid", "true");
  await title.fill("12");
  await expect.element(title).toHaveValue("12");
  const thickness = page.getByRole("textbox", {
    name: "Divider thickness (pt)",
    exact: true,
  });
  await thickness.fill("bad");
  await page
    .getByRole("checkbox", { name: "Section divider", exact: true })
    .click();
  await expect.element(thickness).toBeVisible();
  await expect.element(thickness).toHaveAttribute("aria-invalid", "true");
  await thickness.fill("1");
  await expect.element(thickness).not.toBeInTheDocument();
});

it("reveals page numbering and custom rows only when enabled, retaining their values", async () => {
  const { resume } = fixture();
  await render(<AppearanceForm initial={resume.layout} />);
  const numbering = page.getByRole("checkbox", {
    name: "Show page numbers",
    exact: true,
  });
  expect(
    page
      .getByRole("group", { name: "Numbering alignment", exact: true })
      .elements(),
  ).toHaveLength(0);
  await numbering.click();
  await page
    .getByRole("button", { name: "Numbering alignment: right", exact: true })
    .click();
  await numbering.click();
  await numbering.click();
  expect(
    JSON.parse(
      page.getByRole("status", { name: "Draft appearance" }).element()
        .textContent!,
    ).pageNumberAlignment,
  ).toBe("right");
  await page
    .getByRole("button", { name: "Header & contacts", exact: true })
    .click();
  const rows = page.getByRole("combobox", {
    name: "Contacts per row",
    exact: true,
  });
  await rows.click();
  await page.getByRole("option", { name: "Custom rows", exact: true }).click();
  const sizes = page.getByRole("textbox", {
    name: "Custom row sizes",
    exact: true,
  });
  await sizes.fill("2, 1");
  await rows.click();
  await page
    .getByRole("option", { name: "Automatic wrapping", exact: true })
    .click();
  await expect.element(sizes).not.toBeInTheDocument();
  await rows.click();
  await page.getByRole("option", { name: "Custom rows", exact: true }).click();
  await expect.element(sizes).toHaveValue("2, 1");
});

it.each([720, 1000])(
  "keeps neighboring fields anchored when dependent controls expand at %i px",
  async (width) => {
    const { resume } = fixture();
    await render(
      <div style={{ width }}>
        <AppearanceForm initial={resume.layout} />
      </div>,
    );
    const divider = page.getByRole("checkbox", {
      name: "Section divider",
      exact: true,
    });
    const thickness = page.getByRole("textbox", {
      name: "Divider thickness (pt)",
      exact: true,
    });
    const titleSize = page.getByRole("textbox", {
      name: "Title / organization size (pt)",
      exact: true,
    });
    const typography = page.getByRole("button", {
      name: "Typography",
      exact: true,
    });
    const titleBefore = {
      top:
        titleSize.element().getBoundingClientRect().top -
        typography.element().getBoundingClientRect().top,
      left:
        titleSize.element().getBoundingClientRect().left -
        typography.element().getBoundingClientRect().left,
    };
    expect(thickness.element().getBoundingClientRect().top).toBeGreaterThan(
      divider.element().getBoundingClientRect().bottom,
    );
    expect(thickness.element().getBoundingClientRect().left).toBeLessThan(
      titleSize.element().getBoundingClientRect().left,
    );
    await divider.click();
    await expect.element(thickness).not.toBeInTheDocument();
    expect(
      titleSize.element().getBoundingClientRect().top -
        typography.element().getBoundingClientRect().top,
    ).toBeCloseTo(titleBefore.top, 0);
    expect(
      titleSize.element().getBoundingClientRect().left -
        typography.element().getBoundingClientRect().left,
    ).toBeCloseTo(titleBefore.left, 0);
    await divider.click();
    const threshold = page.getByRole("textbox", {
      name: "Page warning threshold (pages)",
      exact: true,
    });
    const thresholdBefore = {
      top: threshold.element().getBoundingClientRect().top + window.scrollY,
      left: threshold.element().getBoundingClientRect().left + window.scrollX,
    };
    const numbering = page.getByRole("checkbox", {
      name: "Show page numbers",
      exact: true,
    });
    await numbering.click();
    const thresholdAfter = threshold.element().getBoundingClientRect();
    expect(thresholdAfter.top + window.scrollY).toBeCloseTo(
      thresholdBefore.top,
      0,
    );
    expect(thresholdAfter.left + window.scrollX).toBeCloseTo(
      thresholdBefore.left,
      0,
    );
    const alignment = page.getByRole("group", {
      name: "Numbering alignment",
      exact: true,
    });
    const format = page.getByRole("group", {
      name: "Numbering format",
      exact: true,
    });
    expect(alignment.element().getBoundingClientRect().top).toBeGreaterThan(
      numbering.element().getBoundingClientRect().bottom,
    );
    expect(format.element().getBoundingClientRect().left).toBeLessThan(
      thresholdAfter.left,
    );

    await page
      .getByRole("button", { name: "Header & contacts", exact: true })
      .click();
    const gap = page.getByRole("textbox", {
      name: "Between contact rows (pt)",
      exact: true,
    });
    const separator = page.getByRole("group", {
      name: "Contact separator",
      exact: true,
    });
    const beforeGap = {
      top: gap.element().getBoundingClientRect().top + window.scrollY,
      left: gap.element().getBoundingClientRect().left + window.scrollX,
    };
    const beforeSeparator =
      separator.element().getBoundingClientRect().top + window.scrollY;
    await page
      .getByRole("combobox", { name: "Contacts per row", exact: true })
      .click();
    await page
      .getByRole("option", { name: "Custom rows", exact: true })
      .click();
    expect(
      gap.element().getBoundingClientRect().top + window.scrollY,
    ).toBeCloseTo(beforeGap.top, 0);
    expect(
      gap.element().getBoundingClientRect().left + window.scrollX,
    ).toBeCloseTo(beforeGap.left, 0);
    expect(
      separator.element().getBoundingClientRect().top + window.scrollY,
    ).toBeCloseTo(beforeSeparator, 0);
    const breaks = page.getByRole("group", {
      name: "Start a new row before",
      exact: true,
    });
    await expect
      .element(breaks.getByRole("checkbox", { name: "City", exact: true }))
      .toBeVisible();
    await expect
      .element(breaks.getByRole("checkbox", { name: "Website", exact: true }))
      .toBeVisible();
  },
);

it("puts the warning explanation in the label's info hint", async () => {
  const { resume } = fixture();
  await render(<AppearanceForm initial={resume.layout} />);
  const explanation =
    "Warning threshold only; content is never removed or automatically fitted.";
  await expect
    .element(page.getByText(explanation, { exact: true }))
    .not.toBeInTheDocument();
  const hint = page.getByRole("button", {
    name: "About Page warning threshold",
    exact: true,
  });
  await hint.click();
  await expect
    .element(page.getByRole("tooltip"))
    .toHaveTextContent(explanation);
  await expect.element(hint).toHaveAccessibleDescription(explanation);
  await userEvent.keyboard("{Escape}");
  await expect.element(page.getByRole("tooltip")).not.toBeInTheDocument();
  await expect.element(hint).not.toHaveAttribute("aria-describedby");
});

it("selects a named draft color and dismisses its popover without an enclosing Save", async () => {
  const { resume } = fixture();
  await render(<AppearanceForm initial={resume.layout} />);
  await page.getByRole("button", { name: "Colors", exact: true }).click();
  await page
    .getByRole("button", { name: "Section color: Sepia", exact: true })
    .click();
  await page.getByRole("button", { name: "Dark teal", exact: true }).click();
  const trigger = page.getByRole("button", {
    name: "Section color: Dark teal",
    exact: true,
  });
  await expect.element(trigger).toHaveFocus();
  expect(resume.layout.headingColor).toBe("template-default");
  await trigger.click();
  await userEvent.keyboard("{Escape}");
  await expect.element(trigger).toHaveFocus();
  expect(
    JSON.parse(
      page.getByRole("status", { name: "Draft appearance" }).element()
        .textContent!,
    ).headingColor,
  ).toBe("dark-teal");
});

it("places paper before the guide and restores the focused margin after hovering another edge", async () => {
  const { resume } = fixture();
  await render(<AppearanceForm initial={resume.layout} />);
  const image = page.getByRole("img", { name: /^A4,/ });
  const paper = page.getByRole("group", { name: "Paper", exact: true });
  expect(
    paper.element().compareDocumentPosition(image.element()) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  const top = page.getByRole("textbox", {
    name: "Top margin (mm)",
    exact: true,
  });
  const bottom = page.getByRole("textbox", {
    name: "Bottom margin (mm)",
    exact: true,
  });
  await top.click();
  expect(
    image
      .element()
      .querySelector('[data-margin-edge="top"]')
      ?.classList.contains("opacity-0"),
  ).toBe(false);
  await bottom.hover();
  expect(
    image
      .element()
      .querySelector('[data-margin-edge="bottom"]')
      ?.classList.contains("opacity-0"),
  ).toBe(false);
  expect(
    image
      .element()
      .querySelector('[data-margin-edge="top"]')
      ?.classList.contains("opacity-0"),
  ).toBe(true);
  await bottom.unhover();
  expect(
    image
      .element()
      .querySelector('[data-margin-edge="top"]')
      ?.classList.contains("opacity-0"),
  ).toBe(false);
  await page
    .getByRole("button", { name: "Paper: US Letter", exact: true })
    .click();
  await expect
    .element(page.getByRole("img", { name: /^US Letter,/ }))
    .toBeVisible();
  await page
    .getByRole("textbox", { name: "Text size (pt)", exact: true })
    .fill("bad");
  await expect
    .element(page.getByRole("img", { name: /^US Letter,/ }))
    .toBeVisible();
});

it.each(["preset", "starter"] as const)(
  "uses app defaults when editing %s appearance",
  async (kind) => {
    const { resume } = fixture();
    const initial = { ...layoutAppearance(resume.layout), fontSize: 11 };
    const item =
      kind === "preset"
        ? {
            id: "reset-preset",
            name: "Reset preset",
            template: resume.template,
            layout: initial,
          }
        : {
            id: "reset-starter",
            name: "Reset starter",
            template: resume.template,
            layout: initial,
            sections: [],
            summaryIncluded: false,
          };
    const document = fixture().document;
    if (kind === "preset")
      document.presets = [item as CareerDocument["presets"][number]];
    else document.starters = [item as CareerDocument["starters"][number]];
    const controller = await libraryWorkspace(document, `${kind}/${item.id}`);
    await page
      .getByRole("button", {
        name: "Reset Typography to app defaults",
        exact: true,
      })
      .click();
    await expect
      .element(
        page.getByRole("textbox", { name: "Text size (pt)", exact: true }),
      )
      .toHaveValue("10");
    const record =
      kind === "preset"
        ? controller.getSnapshot().head!.document.presets[0]
        : controller.getSnapshot().head!.document.starters[0];
    expect(record.layout.fontSize).toBe(11);
  },
);

it("keeps invalid layout values visible and reveals their group", async () => {
  const { document } = fixture();
  function Form() {
    const [values, setValues] = useState<unknown>(document.defaults);
    return <LayoutFields values={values} onChange={setValues} />;
  }
  await render(<Form />);
  const margin = page.getByRole("textbox", {
    name: "Left margin (mm)",
    exact: true,
  });
  await margin.fill("bad");
  await expect.element(margin).toHaveValue("bad");
  await expect.element(margin).toHaveAttribute("aria-invalid", "true");
  await margin.fill("18");
  await expect.element(margin).toHaveAttribute("aria-invalid", "false");
  await page
    .getByRole("button", { name: "Header & contacts", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Contacts per row", exact: true })
    .click();
  await page.getByRole("option", { name: "Custom rows", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Custom row sizes", exact: true })
    .fill("3, 2");
  await expect
    .element(
      page.getByRole("textbox", { name: "Custom row sizes", exact: true }),
    )
    .toHaveValue("3, 2");
});

/** Supply saved reusable configurations without coupling UI expectations to their implementation. */
function libraryFixture() {
  const { document, resume } = fixture();
  document.presets = [
    {
      id: "compact",
      name: "Compact",
      template: resume.template,
      layout: { ...layoutAppearance(resume.layout), marginLeft: 18 },
    },
  ];
  const starter = captureStarter(document, resume);
  starter.name = "Project focused";
  starter.layout.paper = "letter";
  document.starters = [starter];
  return { document, resume, starter };
}

/** Open a durable destination with a desktop sidebar and an isolated real controller. */
async function libraryWorkspace(document: CareerDocument, scope: string) {
  await page.viewport(1440, 900);
  const controller = await owner(document);
  window.history.replaceState({}, "", `?scope=${scope}`);
  await render(<CareerWorkspace controller={controller} />);
  return controller;
}

it("keeps both empty library destinations visible with the matching location and selection", async () => {
  await libraryWorkspace(createCareerDocument(), "presets");
  const navigation = page.getByRole("navigation", {
    name: "Workspace navigation",
  });
  await expect
    .element(
      navigation.getByRole("button", { name: "Layout presets", exact: true }),
    )
    .toHaveAttribute("aria-current", "page");
  await expect
    .element(page.getByRole("navigation", { name: "Location" }))
    .toHaveTextContent(/Library.*Layout presets/);
  await navigation
    .getByRole("button", { name: "Resume starters", exact: true })
    .click();
  await expect
    .element(page.getByRole("navigation", { name: "Location" }))
    .toHaveTextContent(/Library.*Resume starters/);
  await expect
    .element(page.getByText("No saved starters yet", { exact: true }))
    .toBeVisible();
  await navigation
    .getByRole("button", { name: "Layout presets", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create preset", exact: true })
    .click();
  await expect
    .element(page.getByRole("navigation", { name: "Location" }))
    .toHaveTextContent(/Library.*Layout presets.*New preset/);
});

it.each(["library", "presets", "starters"] as const)(
  "isolates %s navigation without remounting, expanding, selecting or animating resume rows",
  async (destination) => {
    const { document, resume } = libraryFixture();
    await libraryWorkspace(document, `resume-overview/${resume.id}`);
    const navigation = page.getByRole("navigation", {
      name: "Workspace navigation",
    });
    const row = navigation
      .getByRole("button", { name: "Collapse Application pages", exact: true })
      .element()
      .closest("li");
    const animate = vi.spyOn(Element.prototype, "animate");
    await navigation
      .getByRole("button", {
        name:
          destination === "library"
            ? "Library"
            : destination === "presets"
              ? "Layout presets"
              : "Resume starters",
        exact: true,
      })
      .click();
    await expect
      .element(page.getByRole("navigation", { name: "Location" }))
      .toHaveTextContent(
        destination === "library"
          ? /^Library$/
          : destination === "presets"
            ? /Library.*Layout presets/
            : /Library.*Resume starters/,
      );
    const expand = navigation.getByRole("button", {
      name: "Expand Application pages",
      exact: true,
    });
    await expect.element(expand).toHaveAttribute("aria-expanded", "false");
    expect(expand.element().closest("li")).toBe(row);
    expect(
      navigation
        .element()
        .querySelector('[data-sidebar-collection="Resumes"] [data-active]'),
    ).toBeNull();
    expect(
      animate.mock.contexts.filter(
        (element) =>
          element instanceof Element &&
          element.closest('[data-sidebar-collection="Resumes"]'),
      ),
    ).toHaveLength(0);
    expect(
      page.getByRole("tablist", { name: "Resume views" }).elements(),
    ).toHaveLength(0);
    expect(
      page
        .getByText("Editing career wording language", { exact: true })
        .elements(),
    ).toHaveLength(0);
    if (destination === "presets") {
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await expect
        .element(
          page.getByRole("textbox", { name: "Preset name", exact: true }),
        )
        .toBeVisible();
      expect(
        page
          .getByRole("button", { name: "Back to Career details", exact: true })
          .elements(),
      ).toHaveLength(0);
      expect(
        animate.mock.contexts.filter(
          (element) =>
            element instanceof Element &&
            element.closest('[data-sidebar-collection="Resumes"]'),
        ),
      ).toHaveLength(0);
      expect(expand.element().closest("li")).toBe(row);
    }
  },
);

it("loads a library preset only into a chosen resume draft and preserves committed content until Save", async () => {
  const { document, resume } = libraryFixture();
  const controller = await libraryWorkspace(document, "presets");
  await page
    .getByRole("button", { name: "Apply preset…", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect
    .element(dialog.getByRole("button", { name: "Load into layout" }))
    .toBeDisabled();
  await dialog.getByRole("combobox", { name: "Resume", exact: true }).click();
  await page.getByRole("option", { name: "Application", exact: true }).click();
  await dialog.getByRole("button", { name: "Load into layout" }).click();
  await expect
    .element(
      page.getByRole("textbox", { name: "Left margin (mm)", exact: true }),
    )
    .toHaveValue("18");
  await expect
    .element(
      page.getByRole("button", {
        name: "Layout presets (optional)",
        exact: true,
      }),
    )
    .toHaveAttribute("aria-expanded", "false");
  await expect
    .element(
      page.getByText(
        "Preset loaded into unsaved layout. Save to keep these changes.",
        { exact: true },
      ),
    )
    .toBeVisible();
  expect(controller.getSnapshot().head?.document).toEqual(document);
  expect(controller.getSnapshot().undoCount).toBe(0);
  await expect
    .element(page.getByRole("navigation", { name: "Location" }))
    .toHaveTextContent(/Resumes.*Application.*Layout/);
  await page
    .getByRole("region", { name: "Editing form" })
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect
    .poll(
      () =>
        controller.getSnapshot().head?.document.resumes[0].layout.marginLeft,
    )
    .toBe(18);
  expect(controller.getSnapshot().head?.document.resumes[0].selection).toEqual(
    resume.selection,
  );
  expect(controller.getSnapshot().undoCount).toBe(1);
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await expect.element(undo).toBeEnabled();
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("button", { name: "Library", exact: true })
    .click();
  await expect
    .element(page.getByRole("heading", { name: "Library", exact: true }))
    .toBeVisible();
  await undo.click();
  await expect
    .poll(() => controller.getSnapshot().head?.document.resumes[0].layout)
    .toEqual(resume.layout);
  expect(controller.getSnapshot().undoCount).toBe(0);
});

it.each(["Library", "Layout presets"])(
  "retains dirty layout on canceled %s navigation and blocks navigation when Save fails",
  async (label) => {
    const { document, resume } = libraryFixture();
    const controller = await libraryWorkspace(
      document,
      `resume-layout/${resume.id}`,
    );
    const margin = page.getByRole("textbox", {
      name: "Left margin (mm)",
      exact: true,
    });
    await margin.fill("invalid");
    const link = page
      .getByRole("navigation", { name: "Workspace navigation" })
      .getByRole("button", { name: label, exact: true });
    await link.click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect.element(margin).toHaveValue("invalid");
    await link.click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save", exact: true })
      .click();
    expect(window.location.search).toContain(`resume-layout/${resume.id}`);
    expect(controller.isDirty()).toBe(true);
    expect(controller.getSnapshot().head?.document).toEqual(document);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Discard", exact: true })
      .click();
    await expect
      .element(page.getByRole("heading", { name: label, exact: true }))
      .toBeVisible();
  },
);

it("keeps library editors selected and guards their parent location link", async () => {
  const { document } = libraryFixture();
  const controller = await libraryWorkspace(document, "preset/compact");
  const location = page.getByRole("navigation", { name: "Location" });
  await expect
    .element(location)
    .toHaveTextContent(/Library.*Layout presets.*Compact/);
  await expect
    .element(
      page
        .getByRole("navigation", { name: "Workspace navigation" })
        .getByRole("button", { name: "Layout presets", exact: true }),
    )
    .toHaveAttribute("data-active");
  await page
    .getByRole("textbox", { name: "Preset name", exact: true })
    .fill("Changed");
  await location
    .getByRole("button", { name: "Layout presets", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  expect(controller.isDirty()).toBe(true);
  expect(window.location.search).toContain("preset/compact");
});

it.each(["preset", "resume"] as const)(
  "does not apply a preset when the selected %s disappears before confirmation",
  async (missing) => {
    const { document, resume } = libraryFixture();
    const controller = await libraryWorkspace(document, "presets");
    await page
      .getByRole("button", { name: "Apply preset…", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("combobox", { name: "Resume", exact: true })
      .click();
    await page
      .getByRole("option", { name: "Application", exact: true })
      .click();
    // Leave another resume so the dialog retains its target selector and confirmation.
    const other = createResume(document, "en-US");
    expect(await controller.command(`resume/${other.id}`, other)).toBe(true);
    expect(
      await controller.command(
        missing === "resume" ? `resume/${resume.id}` : "preset/compact",
        null,
        missing === "resume" ? resume : document.presets[0],
      ),
    ).toBe(true);
    const committed = structuredClone(controller.getSnapshot().head);
    const undoCount = controller.getSnapshot().undoCount;
    const load = page
      .getByRole("dialog")
      .getByRole("button", { name: "Load into layout" });
    if (missing === "resume") {
      // Base UI clears a value whose option disappears. Loading must remain
      // unavailable until the user explicitly selects another existing resume.
      await expect.element(load).toBeDisabled();
      await page
        .getByRole("dialog")
        .getByRole("combobox", { name: "Resume", exact: true })
        .click();
      expect(
        page
          .getByRole("option", { name: "Application", exact: true })
          .elements(),
      ).toHaveLength(0);
      await page
        .getByRole("option", { name: "Untitled resume", exact: true })
        .click();
      await expect.element(load).toBeEnabled();
    } else {
      await load.click();
      await expect
        .element(
          page
            .getByRole("alert")
            .filter({ hasText: "preset or resume is unavailable" }),
        )
        .toBeVisible();
    }
    expect(controller.getSnapshot().head).toEqual(committed);
    expect(controller.getSnapshot().draft).toBeNull();
    expect(controller.getSnapshot().undoCount).toBe(undoCount);
    expect(window.location.search).toContain("scope=presets");
  },
);

it("does not create an unsaved change or history step when a library preset already matches", async () => {
  const { document, resume } = libraryFixture();
  document.presets[0].layout = layoutAppearance(resume.layout);
  const controller = await libraryWorkspace(document, "presets");
  await page
    .getByRole("button", { name: "Apply preset…", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Resume", exact: true })
    .click();
  await page.getByRole("option", { name: "Application", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Load into layout" })
    .click();
  await expect
    .element(
      page
        .getByRole("region", { name: "Editing form" })
        .getByRole("button", { name: "Save", exact: true }),
    )
    .toBeDisabled();
  expect(controller.isDirty()).toBe(false);
  expect(controller.getSnapshot().undoCount).toBe(0);
});

it("opens the ordinary creation flow when a preset has no target resumes", async () => {
  const { document } = libraryFixture();
  document.resumes = [];
  const controller = await libraryWorkspace(document, "presets");
  await page
    .getByRole("button", { name: "Apply preset…", exact: true })
    .click();
  await expect
    .element(page.getByText("Create a resume before using a preset."))
    .toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create resume…", exact: true })
    .click();
  await expect
    .element(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Blank resume", exact: true }),
    )
    .toHaveAttribute("aria-pressed", "true");
  expect(controller.getSnapshot().head?.document.resumes).toEqual([]);
});

it("preselects a library starter and reviews its structure without creating until confirmation", async () => {
  const { document, starter } = libraryFixture();
  const controller = await libraryWorkspace(document, "starters");
  await page
    .getByRole("button", { name: "Create resume…", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect
    .element(dialog.getByRole("button", { name: "From starter", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  await expect
    .element(dialog.getByRole("combobox", { name: "Starter", exact: true }))
    .toHaveTextContent(starter.name);
  await expect
    .element(dialog.getByText(/Section order and field defaults/))
    .toBeVisible();
  expect(controller.getSnapshot().head?.document.resumes).toHaveLength(1);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(controller.getSnapshot().head?.document.resumes).toHaveLength(1);
});

it("blocks starter creation when the chosen starter is deleted while reviewing", async () => {
  const { document, starter } = libraryFixture();
  const controller = await libraryWorkspace(document, "starters");
  await page
    .getByRole("button", { name: "Create resume…", exact: true })
    .click();
  expect(await controller.command(`starter/${starter.id}`, null, starter)).toBe(
    true,
  );
  await expect
    .element(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Create resume", exact: true }),
    )
    .toBeDisabled();
  await expect
    .element(
      page.getByRole("alert").filter({ hasText: "starter is unavailable" }),
    )
    .toBeVisible();
  expect(controller.getSnapshot().head?.document.resumes).toHaveLength(1);
});
it("loads a preset into a draft without changing committed layout or selections", async () => {
  const { document, resume } = fixture();
  document.presets = [
    {
      id: "compact",
      name: "Compact",
      template: resume.template,
      layout: { ...layoutAppearance(resume.layout), paper: "letter" },
    },
  ];
  document.presets.push({
    ...document.presets[0],
    id: "other",
    name: "Other preset",
  });
  function Form() {
    const [values, setValues] = useState<unknown>(resume.layout);
    return (
      <>
        <PresetPicker
          document={document}
          values={values}
          onChange={setValues}
          navigate={() => {}}
          capture={() => {}}
        />
        <output>{JSON.stringify(values)}</output>
      </>
    );
  }
  await render(<Form />);
  await page
    .getByRole("button", { name: "Layout presets (optional)", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Layout preset", exact: true })
    .click();
  await expect
    .element(page.getByRole("option", { name: "Other preset", exact: true }))
    .toBeVisible();
  await page.getByRole("option", { name: "Compact", exact: true }).click();
  await expect
    .element(page.getByRole("status").filter({ hasText: '"paper"' }))
    .toHaveTextContent(/"paper":"a4"/);
  await page
    .getByRole("button", { name: "Load into layout", exact: true })
    .click();
  await expect
    .element(page.getByRole("status").filter({ hasText: '"paper"' }))
    .toHaveTextContent(/"paper":"letter"/);
  expect(resume.layout.paper).toBe("a4");
  expect(resume.selection).toEqual([]);
});
it("uses the Layout route guard for Cancel, Discard, and Save without compiling", async () => {
  const { document, resume } = fixture();
  const controller = await owner(document);
  window.history.replaceState({}, "", `?scope=resume-layout/${resume.id}`);
  await render(<CareerWorkspace controller={controller} />);
  await page
    .getByRole("textbox", { name: "Left margin (mm)", exact: true })
    .fill("18");
  await page.getByRole("tab", { name: "Wording", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect
    .element(
      page.getByRole("textbox", { name: "Left margin (mm)", exact: true }),
    )
    .toHaveValue("18");
  await page.getByRole("tab", { name: "Wording", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect
    .poll(
      () =>
        controller.getSnapshot().head?.document.resumes[0].layout.marginLeft,
    )
    .toBe(18);
  await page.getByRole("tab", { name: "Layout", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Left margin (mm)", exact: true })
    .fill("19");
  await page.getByRole("tab", { name: "Wording", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Discard", exact: true })
    .click();
  expect(
    controller.getSnapshot().head?.document.resumes[0].layout.marginLeft,
  ).toBe(18);
});
it("rechecks reviewed mappings inside real IndexedDB without partially creating sections", async () => {
  const { document, resume } = fixture();
  const first = await owner(document);
  const other = await owner();
  const starter = {
    id: "starter",
    name: "Structure",
    template: resume.template,
    layout: layoutAppearance(resume.layout),
    summaryIncluded: false,
    sections: [
      {
        id: "work-slot",
        label: "Work",
        kind: "experience" as const,
        icon: "briefcase-business" as const,
        hidden: false,
        visibleFields: ["title"],
      },
      {
        id: "extra-slot",
        label: "Extra",
        kind: "custom" as const,
        icon: "file-text" as const,
        hidden: false,
        visibleFields: ["title"],
      },
    ],
  };
  const prepared = prepareStarterResume(
    document,
    starter,
    [document.sections[0].id, "new"],
    "en-US",
  );
  const section = document.sections[0];
  expect(
    await other.command(`section/${section.id}`, {
      ...(readScope(document, `section/${section.id}`) as object),
      name: "Changed in another tab",
    }),
  ).toBe(true);
  first.open(`starter-create/${prepared.resume.id}`);
  first.change(prepared);
  expect(await first.save()).toBe(false);
  const storage = await openCareerStorage();
  connections.push(storage);
  const head = await storage.load();
  expect(head.document.resumes).toHaveLength(1);
  expect(head.document.sections).toHaveLength(document.sections.length);
  expect(first.getSnapshot().draft?.values).toEqual(prepared);
});
it("retries an interrupted composite acknowledgment once and survives restart after undo and redo", async () => {
  const { document, resume } = fixture();
  const controller = await owner(document);
  const starter = {
    id: "starter",
    name: "Structure",
    template: resume.template,
    layout: layoutAppearance(resume.layout),
    summaryIncluded: false,
    sections: [
      {
        id: "extra-slot",
        label: "Extra",
        kind: "custom" as const,
        icon: "file-text" as const,
        hidden: false,
        visibleFields: ["title"],
      },
    ],
  };
  const prepared = prepareStarterResume(document, starter, ["new"], "en-US");
  controller.open(`starter-create/${prepared.resume.id}`);
  controller.change(prepared);
  const original = CareerStorage.prototype.commit;
  const fault = vi
    .spyOn(CareerStorage.prototype, "commit")
    .mockImplementationOnce(async function (this: CareerStorage, id) {
      await original.call(this, id);
      throw new Error("Acknowledgment lost");
    });
  expect(await controller.save()).toBe(false);
  const operation = controller.getSnapshot().draft?.operationId;
  fault.mockRestore();
  expect(await controller.save()).toBe(true);
  expect(controller.getSnapshot().head?.revision).toBe(1);
  expect(controller.getSnapshot().undoCount).toBe(1);
  expect(operation).toBeTruthy();
  await controller.cancel();
  expect(await controller.history("undo")).toBe(true);
  expect(
    controller.getSnapshot().head?.document.sections.at(-1)?.archived,
  ).toBe(true);
  expect(await controller.history("redo")).toBe(true);
  const restarted = await owner();
  expect(restarted.getSnapshot().head?.document.resumes.at(-1)?.id).toBe(
    prepared.resume.id,
  );
  expect(
    restarted.getSnapshot().head?.document.sections.at(-1)?.entries,
  ).toEqual([]);
});
it("rejects a real transaction write failure with neither resume nor section committed", async () => {
  const { document, resume } = fixture();
  const controller = await owner(document);
  const starter = {
    id: "starter",
    name: "Structure",
    template: resume.template,
    layout: layoutAppearance(resume.layout),
    summaryIncluded: false,
    sections: [
      {
        id: "extra-slot",
        label: "Extra",
        kind: "custom" as const,
        icon: "file-text" as const,
        hidden: false,
        visibleFields: [],
      },
    ],
  };
  const prepared = prepareStarterResume(document, starter, ["new"], "en-US");
  const original = IDBObjectStore.prototype.put;
  const fault = vi
    .spyOn(IDBObjectStore.prototype, "put")
    .mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "heads") {
        this.transaction.abort();
        throw new DOMException("Injected quota failure", "QuotaExceededError");
      }
      return original.apply(this, args);
    });
  controller.open(`starter-create/${prepared.resume.id}`);
  controller.change(prepared);
  expect(await controller.save()).toBe(false);
  fault.mockRestore();
  const storage = await openCareerStorage();
  connections.push(storage);
  expect((await storage.load()).document).toEqual(document);
  expect(controller.getSnapshot().draft?.values).toEqual(prepared);
});

it("round-trips saved setups and separate layout recovery through replacement and rollback", async () => {
  const { document, resume } = fixture();
  document.presets = [
    {
      id: "preset",
      name: "Saved appearance",
      template: resume.template,
      layout: { ...layoutAppearance(resume.layout), contactRows: "3" },
    },
  ];
  const controller = await owner(document);
  controller.open(`resume-layout/${resume.id}`);
  controller.change({ ...resume.layout, marginLeft: "unfinished" });
  await controller.flushRecovery();
  const storage = await openCareerStorage();
  connections.push(storage);
  const before = await storage.load();
  const drafts = await storage.drafts();
  const replacement = await storage.replace(before, createCareerDocument());
  expect(replacement.document.presets).toEqual([]);
  const rolledBack = await storage.replace(replacement);
  expect(rolledBack.document.presets).toEqual(document.presets);
  expect(
    (await storage.drafts()).find((item) => item.draftId === drafts[0].draftId)
      ?.values,
  ).toMatchObject({ marginLeft: "unfinished" });
  await expect(storage.replace(before, document)).rejects.toThrow(
    /changed since review/,
  );
  expect((await storage.load()).document.presets).toEqual(document.presets);
});

it("opens the Library overview with icon cards and guarded Edit destinations", async () => {
  await libraryWorkspace(createCareerDocument(), "library");
  const navigation = page.getByRole("navigation", {
    name: "Workspace navigation",
  });
  await expect
    .element(navigation.getByRole("button", { name: "Library", exact: true }))
    .toHaveAttribute("aria-current", "page");
  await expect
    .element(page.getByRole("heading", { name: "Library", exact: true }))
    .toBeVisible();
  for (const label of ["Layout presets", "Resume starters"]) {
    const heading = page
      .getByRole("heading", { name: label, exact: true })
      .element();
    expect(heading.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  }
  expect(
    page.getByText(/\d+ saved (presets|starters)/).elements(),
  ).toHaveLength(0);
  expect(page.getByRole("combobox").elements()).toHaveLength(0);
  expect(
    page.getByRole("group", { name: "PDF preview controls" }).elements(),
  ).toHaveLength(0);
  await page.getByRole("button", { name: "Edit", exact: true }).nth(0).click();
  expect(window.location.search).toContain("scope=presets");
  await page
    .getByRole("navigation", { name: "Location" })
    .getByRole("button", { name: "Library", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit", exact: true }).nth(1).click();
  expect(window.location.search).toContain("scope=starters");
});

it.each(["presets", "starters"] as const)(
  "keeps %s creation above cards and Delete last without search",
  async (destination) => {
    const { document } = libraryFixture();
    await libraryWorkspace(document, destination);
    const create = page.getByRole("button", {
      name: destination === "presets" ? "Create preset" : "Create starter",
      exact: true,
    });
    const heading = page
      .getByRole("heading", {
        name: destination === "presets" ? "Layout presets" : "Resume starters",
        exact: true,
      })
      .element();
    expect(
      heading.parentElement?.querySelector('svg[aria-hidden="true"]'),
    ).not.toBeNull();
    const edit = page.getByRole("button", { name: "Edit", exact: true });
    expect(create.element().closest('[data-slot="card"]')).toBeNull();
    expect(
      heading.parentElement?.parentElement?.parentElement?.contains(
        create.element(),
      ),
    ).toBe(true);
    expect(
      create.element().compareDocumentPosition(edit.element()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(page.getByRole("textbox").elements()).toHaveLength(0);
    const footer = edit.element().closest('[data-slot="card-footer"]')!;
    expect(
      [...footer.querySelectorAll("button")].map((button) =>
        button.textContent?.trim(),
      ),
    ).toEqual([
      "Edit",
      "Duplicate",
      destination === "presets" ? "Apply preset…" : "Create resume…",
      "Delete",
    ]);
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    const dialog = page.getByRole("dialog");
    expect(
      dialog
        .getByRole("button")
        .elements()
        .map((button) => button.textContent?.trim()),
    ).toEqual(["Cancel", "Delete"]);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  },
);

it.each(["Cancel", "Discard", "Save"] as const)(
  "guards the Library parent breadcrumb with %s",
  async (choice) => {
    const { document } = libraryFixture();
    const controller = await libraryWorkspace(document, "preset/compact");
    await page
      .getByRole("textbox", { name: "Preset name", exact: true })
      .fill("Revised preset");
    await page
      .getByRole("navigation", { name: "Location" })
      .getByRole("button", { name: "Library", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: choice, exact: true })
      .click();
    if (choice === "Cancel") {
      await expect
        .element(
          page.getByRole("textbox", { name: "Preset name", exact: true }),
        )
        .toHaveValue("Revised preset");
      expect(controller.isDirty()).toBe(true);
      expect(window.location.search).toContain("preset/compact");
    } else {
      await expect
        .element(page.getByRole("heading", { name: "Library", exact: true }))
        .toBeVisible();
      expect(controller.getSnapshot().head?.document.presets[0].name).toBe(
        choice === "Save" ? "Revised preset" : "Compact",
      );
      expect(controller.getSnapshot().undoCount).toBe(
        choice === "Save" ? 1 : 0,
      );
    }
  },
);

it("edits and saves layout without choosing a preset and keeps load announcements outside the disclosure", async () => {
  const { document, resume } = libraryFixture();
  const controller = await libraryWorkspace(
    document,
    `resume-layout/${resume.id}`,
  );
  const disclosure = page.getByRole("button", {
    name: "Layout presets (optional)",
    exact: true,
  });
  await expect.element(disclosure).toHaveAttribute("aria-expanded", "false");
  expect(
    page
      .getByRole("combobox", { name: "Layout preset", exact: true })
      .elements(),
  ).toHaveLength(0);
  await page
    .getByRole("textbox", { name: "Left margin (mm)", exact: true })
    .fill("19");
  await page
    .getByRole("region", { name: "Editing form" })
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect
    .poll(
      () =>
        controller.getSnapshot().head?.document.resumes[0].layout.marginLeft,
    )
    .toBe(19);
  await disclosure.click();
  expect(
    page
      .getByRole("textbox", { name: "Search presets", exact: true })
      .elements(),
  ).toHaveLength(0);
  await page
    .getByRole("combobox", { name: "Layout preset", exact: true })
    .click();
  await page.getByRole("option", { name: "Compact", exact: true }).click();
  expect(controller.isDirty()).toBe(false);
  await page
    .getByRole("button", { name: "Load into layout", exact: true })
    .click();
  await disclosure.click();
  await expect
    .element(
      page.getByText(
        "Preset loaded into unsaved layout. Save to keep these changes.",
        { exact: true },
      ),
    )
    .toBeVisible();
  expect(
    controller.getSnapshot().head?.document.resumes[0].layout.marginLeft,
  ).toBe(19);
});

it("offers direct layout editing and an explanatory empty optional preset disclosure", async () => {
  const { document, resume } = fixture();
  await libraryWorkspace(document, `resume-layout/${resume.id}`);
  await page
    .getByRole("button", { name: "Layout presets (optional)", exact: true })
    .click();
  await expect
    .element(page.getByText("No saved presets yet", { exact: true }))
    .toBeVisible();
  expect(
    page
      .getByRole("combobox", { name: "Layout preset", exact: true })
      .elements(),
  ).toHaveLength(0);
  await expect
    .element(
      page.getByRole("textbox", { name: "Left margin (mm)", exact: true }),
    )
    .toBeVisible();
});
