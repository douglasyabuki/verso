import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";

import { expect, test } from "@playwright/test";

import { installHarness } from "./career-harness";

for (const cpuRate of [1, 4])
  for (const fixture of [
    "small",
    "representative",
    "multi-resume",
    "capacity",
    "compiler",
  ])
    test(`records production ${fixture} at ${cpuRate}x CPU`, async ({
      page,
      context,
      browser,
    }) => {
      test.setTimeout(720_000);
      page.setDefaultTimeout(15_000);
      const cdp = await context.newCDPSession(page);
      const results: unknown[] = [];
      for (const rate of [cpuRate]) {
        await cdp.send("Emulation.setCPUThrottlingRate", { rate });
        for (const [label, entries, resumes] of [
          ["small", 20, 3],
          ["representative", 300, 30],
          ["multi-resume", 600, 60],
          ["capacity", 10_000, 120],
        ] as const) {
          if (label !== fixture) continue;
          console.log(`Measuring ${label} at ${rate}x CPU`);
          await page.goto("/");
          await installHarness(page);
          const measurement = await page.evaluate(
            async ({ label, entries, resumes }) => {
              const api = window.careerHarness;
              const document = api.createCareerDocument();
              document.sections = [];
              document.profile.fields[0].wording["en-US"] = "Reference desktop";
              for (let i = 0; i < entries; i++) {
                if (i % 300 === 0)
                  document.sections.push({
                    id: `section-${i}`,
                    name: `Section ${i}`,
                    kind: "experience",
                    icon: "briefcase-business",
                    archived: false,
                    heading: {},
                    entries: [],
                  });
                const entry = api.createEntry("experience");
                entry.name = `Entry ${i}`;
                entry.fields[0].wording["en-US"] = `Engineer ${i}`;
                document.sections.at(-1)!.entries.push(entry);
              }
              document.resumes = Array.from({ length: resumes }, (_, i) => ({
                id: `resume-${i}`,
                name: `Resume ${i}`,
                language: "en-US",
                template: "yabuki-reference@1.0.2" as const,
                selection: [],
                overrides: {},
                layout: { ...document.defaults },
              }));
              if (label === "multi-resume") {
                document.languages.push({ tag: "pt-BR", active: true });
                document.profile.fields[0].wording["pt-BR"] = "Ana Silva";
                for (const [index, section] of document.sections.entries()) {
                  for (const [i, entry] of section.entries.entries()) {
                    entry.fields[0].wording["pt-BR"] =
                      `Engenheira ${index}-${i}`;
                    entry.archived = i % 17 === 0;
                    entry.achievements = [
                      {
                        id: `achievement-${index}-${i}`,
                        archived: false,
                        wording: {
                          "en-US": "Reusable systems & delivery",
                          "pt-BR": "Sistemas seguros e ação",
                        },
                      },
                    ];
                  }
                }
                document.resumes = document.resumes.map((resume, i) => {
                  const section =
                    document.sections[i % document.sections.length];
                  const chosen = section.entries.slice(i, i + 3);
                  return {
                    ...resume,
                    language: i % 2 ? "pt-BR" : "en-US",
                    selection: [
                      {
                        sectionId: section.id,
                        entryIds: chosen.map((e) => e.id),
                        fieldIds: chosen.map((e) => e.fields[0].id),
                        achievementIds: chosen.flatMap((e) =>
                          e.achievements.map((a) => a.id),
                        ),
                        linkIds: [],
                      },
                    ],
                    overrides: {
                      [chosen[0].fields[0].id]: `Independent title ${i}`,
                    },
                    layout: {
                      ...resume.layout,
                      fontSize: 10 + (i % 3),
                      paper: i % 2 ? "letter" : "a4",
                    },
                  };
                });
              }
              if (label === "capacity") {
                let remaining =
                  63 * 1024 * 1024 -
                  new TextEncoder().encode(JSON.stringify(document)).byteLength;
                for (const entry of document.sections.flatMap(
                  (s) => s.entries,
                )) {
                  const old = entry.fields[0].wording["en-US"];
                  const extra = Math.min(20_000 - old.length, remaining);
                  entry.fields[0].wording["en-US"] += "x".repeat(extra);
                  remaining -= extra;
                }
              }
              const storage = await api.openCareerStorage();
              try {
                await storage.replace(await storage.load(), document);
              } finally {
                storage.close();
              }
              const json = JSON.stringify({
                format: "verso.workspace",
                schemaVersion: 2,
                exportedAt: new Date().toISOString(),
                workspaceId: "measurement",
                document,
              });
              const longTasks: number[] = [];
              const observer = new PerformanceObserver((list) =>
                longTasks.push(...list.getEntries().map((e) => e.duration)),
              );
              observer.observe({ type: "longtask", buffered: false });
              const start = performance.now();
              api.parsePortable(json, "workspace");
              const importPreviewMs = performance.now() - start;
              await new Promise((resolve) => setTimeout(resolve, 0));
              observer.disconnect();
              const opens: number[] = [],
                saves: number[] = [];
              for (let i = 0; i < 30; i++) {
                const controller = new api.CareerController();
                const began = performance.now();
                await controller.initialize();
                opens.push(performance.now() - began);
                controller.open("profile");
                const profile = structuredClone(
                  controller.getSnapshot().head!.document.profile,
                );
                profile.fields[0].wording["en-US"] = `Reference ${i}`;
                controller.change(profile);
                const saving = performance.now();
                if (!(await controller.save()))
                  throw new Error(controller.getSnapshot().error);
                saves.push(performance.now() - saving);
                controller.dispose();
              }
              return {
                bytes: new TextEncoder().encode(json).byteLength,
                opens,
                saves,
                importPreviewMs,
                longTasks,
              };
            },
            { label, entries, resumes },
          );
          console.log(`${label}: controller samples complete`);
          const applicationOpens: number[] = [];
          for (let i = 0; i < 30; i++) {
            const began = performance.now();
            await page.goto("/?scope=profile");
            await expect(
              page.getByRole("textbox", { name: "Full name", exact: true }),
            ).toBeVisible();
            applicationOpens.push(performance.now() - began);
          }
          console.log(`${label}: application-open samples complete`);
          const input = page.getByRole("textbox", {
            name: "Full name",
            exact: true,
          });
          await expect(input).toBeVisible();
          const typing: number[] = [];
          let lastEdit = 0;
          for (let i = 0; i < 60; i++) {
            if (i % 10 === 0) console.log(`${label}: typing ${i}/60`);
            await page.evaluate(() => {
              (window as Window & { painted?: Promise<number> }).painted =
                new Promise((resolve, reject) => {
                  const timer = setTimeout(
                    () => reject(new Error("Input did not paint")),
                    5000,
                  );
                  document.addEventListener(
                    "input",
                    () => {
                      const start = performance.now();
                      requestAnimationFrame(() =>
                        requestAnimationFrame(() => {
                          clearTimeout(timer);
                          resolve(performance.now() - start);
                        }),
                      );
                    },
                    { once: true },
                  );
                });
            });
            lastEdit = Date.now();
            await input.fill(`Input sample ${i}`);
            typing.push(
              await page.evaluate(
                () =>
                  (window as Window & { painted?: Promise<number> }).painted!,
              ),
            );
          }
          await expect(
            page.getByText(/Recovery stored.*workspace not saved/).first(),
          ).toBeVisible({ timeout: 10_000 });
          const recoveryAckMs = Date.now() - lastEdit;
          console.log(`${label}: typing samples complete`);
          await page
            .getByRole("button", { name: "Cancel", exact: true })
            .click();
          await expect(
            page.getByRole("heading", { name: /Career details.*Overview/ }),
          ).toBeVisible();
          await page
            .getByRole("button", { name: "Section 0", exact: true })
            .click();
          console.log(`${label}: section opened`);
          const reordering: number[] = [],
            selection: number[] = [];
          for (let i = 0; i < 40; i++) {
            if (i % 10 === 0) console.log(`${label}: list action ${i}/40`);
            await page.evaluate(() => {
              (window as Window & { painted?: Promise<number> }).painted =
                new Promise((resolve, reject) => {
                  const timer = setTimeout(
                    () => reject(new Error("Action did not paint")),
                    5000,
                  );
                  document.addEventListener(
                    "click",
                    () => {
                      const start = performance.now();
                      requestAnimationFrame(() =>
                        requestAnimationFrame(() => {
                          clearTimeout(timer);
                          resolve(performance.now() - start);
                        }),
                      );
                    },
                    { once: true },
                  );
                });
            });
            if (i < 20)
              await page
                .getByRole("button", {
                  name: `Move Entry 1 ${i % 2 ? "down" : "up"}`,
                  exact: true,
                })
                .click();
            else
              await page
                .getByRole("button", {
                  name: `Edit Entry ${i % 2}`,
                  exact: true,
                })
                .click();
            const elapsed = await page.evaluate(
              () => (window as Window & { painted?: Promise<number> }).painted!,
            );
            (i < 20 ? reordering : selection).push(elapsed);
          }
          await page
            .getByRole("button", { name: "Data & backups", exact: true })
            .click();
          console.log(`${label}: selection/reorder samples complete`);
          // Twenty inverse moves leave clean drafts; overview closes only those clean scopes.
          await page
            .getByRole("button", { name: "Career details", exact: true })
            .click();
          await expect(
            page.getByRole("heading", { name: /Career details.*Overview/ }),
          ).toBeVisible();
          await page
            .getByRole("button", { name: "Data & backups", exact: true })
            .click();
          await installHarness(page);
          const workerImport = await page.evaluate(async () => {
            const owner = await window.careerHarness.openCareerStorage();
            const head = await owner.load();
            owner.close();
            const file = new File(
              [
                JSON.stringify({
                  format: "verso.workspace",
                  schemaVersion: 2,
                  exportedAt: new Date().toISOString(),
                  workspaceId: head.workspaceId,
                  document: head.document,
                }),
              ],
              "measured.json",
              { type: "application/json" },
            );
            const transfer = new DataTransfer();
            transfer.items.add(file);
            const input =
              document.querySelector<HTMLInputElement>("#workspace-import")!;
            const tasks: number[] = [];
            const observer = new PerformanceObserver((list) =>
              tasks.push(...list.getEntries().map((e) => e.duration)),
            );
            observer.observe({ type: "longtask", buffered: false });
            const start = performance.now();
            let progressMs: number | null = null;
            return await new Promise<{
              elapsedMs: number;
              progressMs: number | null;
              longTasks: number[];
            }>((resolve, reject) => {
              const timer = setTimeout(() => {
                mutation.disconnect();
                observer.disconnect();
                reject(new Error("Import measurement timed out"));
              }, 30_000);
              const mutation = new MutationObserver(() => {
                if (
                  progressMs === null &&
                  document.body.textContent?.includes("Validating import")
                )
                  progressMs = performance.now() - start;
                if (
                  [...document.querySelectorAll('[role="dialog"]')].some(
                    (dialog) =>
                      dialog.textContent?.includes(
                        "Review workspace replacement",
                      ),
                  )
                ) {
                  clearTimeout(timer);
                  mutation.disconnect();
                  setTimeout(() => {
                    observer.disconnect();
                    resolve({
                      elapsedMs: performance.now() - start,
                      progressMs,
                      longTasks: tasks,
                    });
                  }, 0);
                }
              });
              mutation.observe(document.body, {
                childList: true,
                subtree: true,
              });
              input.files = transfer.files;
              input.dispatchEvent(new Event("change", { bubbles: true }));
            });
          });
          await page
            .getByRole("button", { name: "Cancel replacement" })
            .click();
          results.push({
            rate,
            label,
            ...measurement,
            typing,
            selection,
            reordering,
            recoveryAckMs,
            workerImport,
            applicationOpens,
          });
          await mkdir(".cache/performance", { recursive: true });
          await writeFile(
            `.cache/performance/performance-partial-${fixture}-${rate}.json`,
            JSON.stringify(
              {
                platform: os.platform(),
                cpu: os.cpus()[0]?.model,
                ramGiB: os.totalmem() / 1024 ** 3,
                browser: browser.version(),
                results,
              },
              null,
              2,
            ),
          );
        }
        if (fixture !== "compiler") continue;
        await page.goto("/");
        await installHarness(page);
        const compilation = await page.evaluate(async () => {
          const api = window.careerHarness;
          const document = api.createCareerDocument();
          document.languages.push({ tag: "pt-BR", active: true });
          document.profile.fields[0].wording = {
            "en-US": "Ana Silva",
            "pt-BR": "Ana Silva",
          };
          const section = document.sections[0];
          for (let i = 0; i < 12; i++) {
            const entry = api.createEntry("experience");
            entry.fields[0].wording = {
              "en-US": `Systems engineer ${i}`,
              "pt-BR": `Engenheira ${i}`,
            };
            entry.achievements = [
              {
                id: `achievement-${i}`,
                archived: false,
                wording: {
                  "en-US":
                    "Delivered reliable systems and reusable components.",
                  "pt-BR": "Sistemas seguros e componentes reutilizáveis.",
                },
              },
            ];
            section.entries.push(entry);
          }
          document.resumes = ["en-US", "pt-BR"].map((language, i) => ({
            id: `resume-${i}`,
            name: "Measured application",
            language,
            template: "yabuki-reference@1.0.2",
            selection: [
              {
                sectionId: section.id,
                entryIds: section.entries.map((e) => e.id),
                fieldIds: section.entries.flatMap((e) =>
                  e.fields.map((f) => f.id),
                ),
                achievementIds: section.entries.flatMap((e) =>
                  e.achievements.map((a) => a.id),
                ),
                linkIds: [],
              },
            ],
            overrides: {},
            layout: { ...document.defaults },
          }));
          const cold: number[] = [],
            warm: number[] = [];
          let firstInitialization: {
            initializationMs: number;
            compilationMs: number;
          } | null = null;
          for (let i = 0; i < 6; i++) {
            const compiler = new api.BrowserCompiler({
              assetBase: "/compiler/",
            });
            try {
              const resume = document.resumes[i % 2];
              const result = await compiler.compile({
                source: api.renderCareerResume(document, resume.id, 0),
                snapshotId: `cold-${i}`,
                locale: resume.language,
              });
              if (i === 0)
                firstInitialization = {
                  initializationMs: result.initializationMs,
                  compilationMs: result.compilationMs,
                };
              else cold.push(result.initializationMs + result.compilationMs);
              if (i === 5)
                for (let j = 0; j < 10; j++) {
                  const active = document.resumes[j % 2];
                  const result = await compiler.compile({
                    source: api.renderCareerResume(document, active.id, j + 1),
                    snapshotId: `warm-${j}`,
                    locale: active.language,
                  });
                  warm.push(result.compilationMs);
                }
            } finally {
              compiler.close();
            }
          }
          return { cold, warm, firstInitialization };
        });
        results.push({ rate, label: "compilation", ...compilation });
      }
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      await cdp.detach();
      const report = {
        buildId: (await readFile(".next/BUILD_ID", "utf8")).trim(),
        recordedAt: new Date().toISOString(),
        platform: os.platform(),
        release: os.release(),
        cpu: os.cpus()[0]?.model,
        ramGiB: os.totalmem() / 1024 ** 3,
        browser: browser.version(),
        results,
      };
      await mkdir(".cache/performance", { recursive: true });
      await writeFile(
        `.cache/performance/performance-${fixture}-${cpuRate}.json`,
        JSON.stringify(report, null, 2),
      );
      await test.info().attach("production-measurements", {
        body: JSON.stringify(report),
        contentType: "application/json",
      });
    });
