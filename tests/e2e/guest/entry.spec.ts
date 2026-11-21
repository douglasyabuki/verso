import { expect, type Page, test } from "@playwright/test";

const welcomeHeading = (page: Page) =>
  page.getByRole("heading", {
    level: 1,
    name: "One career record. Every tailored resume.",
  });

test("the welcome page links to the workflow and both account paths", async ({
  page,
}) => {
  await page.goto("/");
  const banner = page.getByRole("banner");
  await expect(banner.getByRole("link", { name: "Workflow" })).toHaveCount(0);
  await expect(banner.getByRole("link", { name: "Languages" })).toHaveCount(0);
  const accountNav = page.getByRole("navigation", { name: "Account" });
  const hero = page.getByRole("region", { name: /One career record/ });
  const signIn = accountNav.getByRole("link", { name: "Sign in" });
  const signUp = accountNav.getByRole("link", { name: "Sign up" });

  await expect(
    hero.getByRole("link", { name: "Continue as guest" }),
  ).toHaveAttribute("href", "/app");
  await expect(signUp).toHaveAttribute("href", "/sign-up");
  const storyLink = hero.getByRole("link", { name: "See how it works" });
  await storyLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/#tailoring$/);

  await page.goBack();
  await hero.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(
    page.getByRole("heading", { name: "Create your Verso account" }),
  ).toBeVisible();

  await page.goBack();
  await signIn.click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});

test("the fictional example can be explored with the keyboard and resets on reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const front = page.getByRole("button", { name: "Frontend", exact: true });
  const systems = page.getByRole("button", {
    name: "Design systems",
    exact: true,
  });
  const diagram = page.locator("#welcome-diagram");
  const figures = diagram.getByRole("figure");
  const selection = page
    .getByRole("status")
    .filter({ hasText: "uses experience" });

  await expect(front).toHaveAttribute("aria-pressed", "true");
  await expect(figures.nth(0)).toContainText("Cut dashboard load time by 35%");
  await expect(figures.nth(1)).toContainText("Transit Companion");
  await diagram.evaluate(async (node) => {
    await Promise.all(
      node
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished),
    );
  });

  const replay = await diagram.evaluateHandle((node) => {
    const experience = node
      .querySelector("[data-route='source'] [data-flow='frontend'] path")
      ?.getAttribute("d");
    const branch = node.querySelector(
      "[data-route='desktop'] [data-flow='systems'] path",
    )!;
    const timing = { started: false };
    const observePaper = (id: string) => {
      const paper = node.querySelector(`[data-document="${id}"]`)!;
      const phase: Record<string, "drawing" | "arrived"> = {};
      paper.addEventListener("transitionstart", (event) => {
        if (!(event instanceof TransitionEvent)) return;
        const when =
          parseFloat(getComputedStyle(branch).strokeDashoffset) === 0
            ? "arrived"
            : "drawing";
        if (event.propertyName === "translate") phase.lift = when;
        if (event.propertyName === "color") phase.caption = when;
        if (event.propertyName === "background-color") {
          if (event.pseudoElement === "::before") phase.marker = when;
          else phase.surface = when;
        }
      });
      return phase;
    };
    const outgoing = observePaper("frontend");
    const incoming = observePaper("systems");
    node.addEventListener("animationstart", (event) => {
      const path = event.target;
      if (
        event instanceof AnimationEvent &&
        event.animationName === "welcome-trace-selection" &&
        event.elapsedTime === 0 &&
        path instanceof SVGPathElement &&
        path.closest("[data-example='systems']") &&
        path.closest("[data-route='source'] [data-flow='systems']") &&
        path.getAttribute("d") === experience
      ) {
        timing.started = true;
      }
    });
    return { timing, outgoing, incoming };
  });
  await front.focus();
  await page.keyboard.press("ArrowRight");
  await expect(systems).toBeFocused();
  await page.keyboard.press("Space");
  await expect(front).toHaveAttribute("aria-pressed", "false");
  await expect(systems).toHaveAttribute("aria-pressed", "true");
  await expect(selection).toHaveText(
    "Design systems leads with the Transit Companion project and also uses experience.",
  );
  await expect(figures.nth(0)).toBeVisible();
  await expect(figures.nth(1)).toBeVisible();
  await expect
    .poll(() => replay.jsonValue())
    .toEqual({
      timing: { started: true },
      outgoing: {
        lift: "drawing",
        surface: "drawing",
        marker: "drawing",
        caption: "drawing",
      },
      incoming: {
        lift: "arrived",
        surface: "arrived",
        marker: "arrived",
        caption: "arrived",
      },
    });
  await replay.dispose();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await front.click();
  await expect(front).toHaveAttribute("aria-pressed", "true");
  expect(
    await diagram.evaluate(
      (node) => node.getAnimations({ subtree: true }).length,
    ),
  ).toBe(0);

  await systems.click();
  await page.reload();
  await expect(front).toHaveAttribute("aria-pressed", "true");
});

test("navbar Appearance works by keyboard at a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  const banner = page.getByRole("banner");
  const appearance = banner.getByRole("button", { name: "Appearance" });
  const bounds = await appearance.boundingBox();
  const account = await banner
    .getByRole("navigation", { name: "Account" })
    .boundingBox();
  const contentWidth = await page
    .locator("html")
    .evaluate((root) => root.clientWidth);
  expect(bounds!.x + bounds!.width / 2).toBeCloseTo(contentWidth / 2, 0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(account!.x);
  await appearance.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu");
  await expect(
    menu.getByRole("menuitemradio", { name: "System", checked: true }),
  ).toBeVisible();
  const dark = menu.getByRole("menuitemradio", { name: "Dark", exact: true });
  await dark.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme-preference",
    "dark",
  );
  await expect(menu).toBeHidden();
  await expect(appearance).toBeFocused();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme-preference",
    "dark",
  );
  await appearance.focus();
  await page.keyboard.press("Enter");
  await expect(dark).toHaveAttribute("aria-checked", "true");
});

test.describe("welcome page without motion or JavaScript", () => {
  test.use({ javaScriptEnabled: false, reducedMotion: "reduce" });

  test("keeps the complete story at a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/");
    await expect(welcomeHeading(page)).toBeVisible();
    const diagram = page.locator("#welcome-diagram");
    await expect(diagram.getByText("Northstar Studio").first()).toBeVisible();
    await expect(diagram.getByRole("figure")).toHaveCount(2);
    expect(
      await diagram.evaluate(
        (node) => node.getAnimations({ subtree: true }).length,
      ),
    ).toBe(0);
    expect(
      await page.evaluate(() => {
        const { scrollWidth, clientWidth } = document.documentElement;
        return scrollWidth - clientWidth;
      }),
    ).toBe(0);

    for (const step of [
      "Capture once.",
      "Compose intentionally.",
      "Produce a document.",
    ]) {
      await expect(page.getByRole("heading", { name: step })).toBeVisible();
    }
    const languages = page.locator("#languages");
    await expect(languages.getByText("English", { exact: true })).toBeVisible();
    await expect(languages.getByText("Português do Brasil")).toBeVisible();
    await expect(
      languages
        .locator("[lang=pt-BR]")
        .filter({ hasText: "biblioteca de componentes acessíveis" })
        .first(),
    ).toBeVisible();
  });
});

test("the welcome page stays visible with guest data, and Continue as guest opens the workspace", async ({
  page,
}) => {
  await page.goto("/app");
  await expect(
    page.getByRole("heading", { name: /Career details.*Overview/ }),
  ).toBeVisible();

  await page.goto("/");
  await expect(welcomeHeading(page)).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("link", { name: "Continue as guest" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("heading", { name: /Career details.*Overview/ }),
  ).toBeVisible();
});

test("workspace deep links survive reload and legacy links redirect to paths", async ({
  page,
}) => {
  await page.goto("/app/settings/data");
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(settings).toBeVisible();
  await page.reload();
  await expect(settings).toBeVisible();
  await expect(page).toHaveURL(/\/app\/settings\/data$/);

  await page.goto("/?scope=settings%2Faccount");
  await expect(page).toHaveURL(/\/app\/settings\/account$/);
  await expect(settings).toBeVisible();
});

test("a session cookie routes / to the workspace without rendering the welcome page", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([
      { name: "better-auth.session_token", value: "stale", url: baseURL! },
    ]);
  const response = await page.request.get("/", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toMatch(/\/app$/);
});

test("auth pages explain a guest-only deployment and keep the guest path", async ({
  page,
}) => {
  await page.goto("/sign-in?next=%2Fapp%2Fresumes");
  await expect(
    page.getByRole("heading", { level: 1, name: "Welcome back" }),
  ).toBeVisible();
  await expect(
    page.getByText("Accounts are not enabled on this deployment."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/sign-up\?next=%2Fapp%2Fresumes$/);
  await page.getByRole("link", { name: "Continue as guest" }).click();
  await expect(page).toHaveURL(/\/app\/resumes$/);
});
