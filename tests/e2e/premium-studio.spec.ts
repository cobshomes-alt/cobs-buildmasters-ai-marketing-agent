import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { waitForOwnerWorkspace, openWorkspaceSection } from "./workspace";
import {
  generateEditingPlan,
  type MediaFacts,
} from "../../lib/automatic-editing";
test.use({ video: "on" });
test("premium mixed-media timeline arranges twenty originals, saves/reopens and fits desktop/mobile (mocked services)", async ({
  page,
}) => {
  // Two director proposals, export/download, twenty-source editing and three layouts.
  test.setTimeout(240000);
  page.setDefaultTimeout(15000);
  const owner = "11111111-1111-4111-8111-111111111111";
  let saved: any = null;
  let exportRequest: any = null;
  let exported = false;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    ({ owner }) => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      localStorage.setItem(
        "sb-cobs-test-auth-token",
        JSON.stringify({
          access_token: `e30.${btoa(JSON.stringify({ sub: owner, exp }))}.signature`,
          refresh_token: "mock-refresh",
          expires_at: exp,
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: owner,
            email: "cobshomes@gmail.com",
            aud: "authenticated",
            role: "authenticated",
          },
        }),
      );
    },
    { owner },
  );
  const assets = Array.from({ length: 20 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    storage_path: `${owner}/00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}.${i < 8 ? "png" : "mp4"}`,
    original_name: `SYNTHETIC ${i < 8 ? "photo" : "video"} ${String(i + 1).padStart(2, "0")}`,
    mime_type: i < 8 ? "image/png" : "video/mp4",
    size_bytes: 1000,
    project: "SYNTHETIC QA ONLY",
    product: "",
    campaign_id: null,
  }));
  await page.route("https://cobs-test.supabase.co/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    let body: unknown = [];
    if (url.pathname.includes("cobs_profiles")) body = { role: "owner" };
    else if (url.pathname.includes("cobs_media_assets")) body = assets;
    else if (
      url.pathname.includes("/storage/v1/object/sign/") &&
      req.method() === "POST"
    )
      body = {
        signedURL: url.pathname.replace("/storage/v1", "") + "?token=mock",
      };
    else if (
      url.pathname.includes("/storage/v1/object/sign/") &&
      req.method() === "GET"
    ) {
      await route.fulfill({
        contentType: url.pathname.endsWith(".mp4") ? "video/mp4" : "image/png",
        body: url.pathname.endsWith(".mp4")
          ? readFileSync(".tools/delivery/media-studio/synthetic-edited.mp4")
          : Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
              "base64",
            ),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      json: body,
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.route("**/api/edit-projects", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: { projects: saved ? [{ id: saved.id, title: saved.title }] : [] },
      });
      return;
    }
    const data = route.request().postDataJSON();
    if (data.action === "save") {
      saved = { ...data.document, revision: data.revision + 1 };
      await route.fulfill({
        json: {
          project: {
            id: saved.id,
            revision: saved.revision,
            updatedAt: new Date().toISOString(),
          },
        },
      });
    } else
      await route.fulfill({
        json: {
          document: saved,
          revision: saved.revision,
          updatedAt: new Date().toISOString(),
        },
      });
  });
  await page.route("**/api/studio", (route) =>
    route.fulfill({
      json: {
        ready: true,
        workerOnline: true,
        sequenceReady: true,
        timedCaptionsReady: true,
        cinematicReady: true,
        constructionReady: true,
        jobs: exported
          ? [
              {
                id: "55555555-5555-4555-8555-555555555555",
                kind: "video",
                state: "completed",
                created: Date.now(),
                history: [],
              },
            ]
          : [],
      },
    }),
  );
  await page.route("**/api/studio/sequence", (route) => {
    exportRequest = route.request().postDataJSON();
    exported = true;
    return route.fulfill({ status: 202, json: { job: { state: "pending" } } });
  });
  await page.route("**/api/studio/plan", (route) => {
    const brief = route.request().postDataJSON();
    if (brief.instructions.includes("zoom"))
      return route.fulfill({
        status: 400,
        json: { error: "Unsupported zoom effect" },
      });
    const facts: MediaFacts[] = brief.mediaIds.map((id: string) => {
      const a = assets.find((a) => a.id === id)!;
      return {
        id,
        name: a.original_name,
        mime: a.mime_type,
        bytes: a.size_bytes,
        duration: a.mime_type.startsWith("video/") ? 10 : null,
        width: 160,
        height: 120,
        audio: false,
        orientation: "landscape",
        labels: [a.project],
        thumbnail: a.mime_type.startsWith("video/")
          ? "not generated"
          : "private original",
      };
    });
    return route.fulfill({ json: { plan: generateEditingPlan(brief, facts) } });
  });
  await page.route("**/api/studio?download=**", (route) =>
    route.fulfill({
      contentType: "video/mp4",
      body: readFileSync(".tools/delivery/media-studio/synthetic-edited.mp4"),
    }),
  );
  await page.goto("/");
  await waitForOwnerWorkspace(page);
  await page.setViewportSize({ width: 1720, height: 1080 });
  await page.screenshot({
    path: ".tools/screenshots/premium-overview.png",
    fullPage: true,
  });
  await openWorkspaceSection(page, "Media Studio");
  await expect(
    page.getByRole("heading", { name: "Your editing studio" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Editor modes" })
    .getByRole("button", { name: "Create with AI", exact: true })
    .click();
  const director = page.getByRole("region", {
    name: "Automatic Editing Director",
    exact: true,
  });
  for (const i of [0, 8, 1, 9, 2, 10])
    await director
      .getByLabel(`Use ${assets[i].original_name}`, { exact: true })
      .check();
  await director
    .getByLabel("Target duration (seconds)", { exact: true })
    .fill("12");
  const instructions = director.getByRole("textbox", {
    name: "Marketing instructions",
    exact: true,
  });
  await expect(instructions).toBeEditable();
  await director
    .getByRole("textbox", { name: "Marketing instructions", exact: true })
    .fill("Add zoom");
  await director
    .getByRole("button", { name: "Generate rule-based editing plan" })
    .click();
  await expect(director.getByRole("alert")).toHaveText(
    "Unsupported zoom effect",
  );
  await director
    .getByRole("textbox", { name: "Marketing instructions", exact: true })
    .fill("Prepare a professional factory promotion");
  await director
    .getByRole("button", { name: "Generate rule-based editing plan" })
    .click();
  await expect(
    director.getByRole("heading", { name: "Review your proposed cut · 12s" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const brandGeometry = await page.locator(".product-brand").evaluate((el) => {
    const logo = el.querySelector("img")!.getBoundingClientRect(),
      label = el.querySelector(":scope > span")!.getBoundingClientRect();
    return {
      overlap: logo.right > label.left,
      ratio: logo.width / logo.height,
    };
  });
  expect(brandGeometry.overlap).toBe(false);
  expect(brandGeometry.ratio).toBeCloseTo(1, 2);
  await page.screenshot({
    path: ".tools/screenshots/automatic-director-mobile.png",
    fullPage: true,
  });
  await director
    .getByRole("button", { name: "Use plan as editable timeline" })
    .click();
  const assistant = page.getByRole("region", {
    name: "Ask COBS AI",
    exact: true,
  });
  await assistant
    .getByLabel("What would you like to change?")
    .fill("Make this video more cinematic");
  await assistant
    .getByRole("button", { name: "Propose edit", exact: true })
    .click();
  await expect(
    assistant.getByRole("heading", { name: "Proposed changes" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await assistant.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: ".tools/screenshots/milestone-c-assistant.png",
    fullPage: true,
  });
  await assistant.getByRole("button", { name: "Apply proposed edit" }).click();
  await expect(assistant.getByRole("status")).toContainText("Edit applied");
  await assistant.getByRole("button", { name: "Undo last edit" }).click();
  await expect(assistant.getByRole("status")).toContainText("restored");
  await assistant
    .getByRole("button", { name: "Cinematic Construction" })
    .click();
  await assistant.getByRole("button", { name: "Apply proposed edit" }).click();
  await page.screenshot({
    path: ".tools/screenshots/milestone-c-completed-edit.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await assistant.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".tools/screenshots/milestone-c-mobile.png",
    fullPage: true,
  });
  await assistant.getByRole("button", { name: "Undo last edit" }).click();
  const evaluation = page.getByText("Local motion graphics evaluation", {
    exact: true,
  });
  if (await evaluation.isVisible()) {
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await page
      .getByLabel("Clip title overlay", { exact: true })
      .fill("Synthetic Remotion title");
    await evaluation.click();
    await page
      .getByLabel("Preview evaluation graphics", { exact: true })
      .check();
    await page.getByLabel("Sequence playhead", { exact: true }).fill("0.8");
    await expect(page.locator(".production-frame svg")).toBeVisible();
    await expect(page.locator(".production-frame svg")).toContainText(
      "Synthetic Remotion title",
    );
    await page
      .getByLabel("Preview evaluation graphics", { exact: true })
      .uncheck();
    test.info().annotations.push({
      type: "local-remotion-evaluation-preview",
      description:
        "Owner-only mocked editor preview toggled; standard export preserved",
    });
  }
  await page.getByLabel("Clip display duration", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Move later", exact: true }).click();
  const recoveryDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download project file", exact: true })
    .click();
  const recoveryPath = await (await recoveryDownload).path();
  await page.getByLabel("Clip display duration", { exact: true }).fill("4");
  page.once("dialog", (d) => d.accept());
  await page
    .getByLabel("Open project file", { exact: true })
    .setInputFiles(recoveryPath!);
  await expect(
    page.getByRole("status").filter({ hasText: "Project file opened" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Select clip 2: SYNTHETIC photo 01",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Clip display duration", { exact: true }),
  ).toHaveValue("3");
  await page.getByRole("button", { name: "Effects", exact: true }).click();
  await page.getByLabel("Two-keyframe zoom / pan", { exact: true }).check();
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Title template", exact: true })
    .selectOption("lower-third");
  await page.getByLabel("Fade in title", { exact: true }).check();
  await page.getByRole("button", { name: "Transitions", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Outgoing transition", exact: true })
    .selectOption("fade");
  await page.getByRole("button", { name: "Graphics", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Picture-in-picture original", exact: true })
    .selectOption(assets[9].id);
  await page
    .getByRole("button", { name: "Export combined MP4", exact: true })
    .click();
  await expect.poll(() => exportRequest?.clips?.length).toBe(6);
  expect(exportRequest.clips[1].mediaId).toBe(assets[0].id);
  expect(exportRequest.clips[1].recipe.duration).toBe(3);
  expect(exportRequest.clips[1].effects.motion.toScale).toBe(1.15);
  expect(exportRequest.clips[1].effects.layer.mediaId).toBe(assets[9].id);
  expect(exportRequest.clips[1].transition.type).toBe("fade");
  expect(
    exportRequest.clips.every(
      (c: any) => c.recipe.watermark && c.recipe.captions.length === 1,
    ),
  ).toBe(true);
  await page
    .getByRole("navigation", { name: "Editor modes" })
    .getByRole("button", { name: "Create with AI", exact: true })
    .click();
  await director
    .getByRole("combobox", { name: "Cinematic preset", exact: true })
    .selectOption("art-of-building");
  await director
    .getByRole("button", { name: "Generate rule-based editing plan" })
    .click();
  await expect(
    director.getByText(
      /Original logo, centered fade-in ending; full image preserved/,
    ),
  ).toBeVisible();
  // Confirm replacing only this mocked, unsaved timeline; keep the application guard.
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Replace the current timeline");
    await dialog.accept();
  });
  await director
    .getByRole("button", { name: "Use plan as editable timeline" })
    .click();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Colour preset", exact: true }),
  ).toHaveValue("art-of-building");
  await page
    .getByRole("button", { name: "Export combined MP4", exact: true })
    .click();
  await expect
    .poll(() => exportRequest?.clips?.[0]?.effects?.grade)
    .toBe("art-of-building");
  expect(
    exportRequest.clips.filter((c: any) => c.recipe.watermark),
  ).toHaveLength(1);
  expect(exportRequest.clips.at(-1).effects.logoEnding).toBe(true);
  await page.screenshot({
    path: ".tools/screenshots/art-of-building-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "New production", exact: true })
    .click();
  exported = false;
  exportRequest = null;
  await page.setViewportSize({ width: 1720, height: 1080 });
  await page.getByRole("button", { name: "Media", exact: true }).click();
  for (let i = 0; i < 2; i++)
    await page
      .getByRole("button", {
        name: `Add ${assets[i].original_name} to timeline`,
        exact: true,
      })
      .click();
  await expect(
    page.getByRole("button", { name: "Export combined MP4", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Captions", exact: true }).click();
  await page
    .getByRole("button", { name: "Add timed caption", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Export combined MP4", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save production", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Caption 1 text", { exact: true })
    .fill("Synthetic owner caption");
  await page
    .getByRole("button", { name: "Export combined MP4", exact: true })
    .click();
  await expect(
    page.getByText("Export queued. Keep the local worker running."),
  ).toBeVisible();
  expect(exportRequest.clips.map((c: any) => c.mediaId)).toEqual(
    assets.slice(0, 2).map((a) => a.id),
  );
  expect(exportRequest.clips[1].recipe.captions).toEqual([
    { start: 0, end: 2, text: "Synthetic owner caption" },
  ]);
  if (
    !(await page
      .getByRole("button", { name: "Download MP4", exact: true })
      .isVisible())
  )
    await page.getByText("Private export jobs (1)", { exact: true }).click();
  await page
    .getByRole("button", { name: "Preview finished MP4", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .locator(".finished-preview video")
        .evaluate((v: HTMLVideoElement) => v.videoWidth),
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Close finished preview", exact: true })
    .click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download MP4", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe(
    "cobs-export-55555555-5555-4555-8555-555555555555.mp4",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "New production", exact: true })
    .click();
  const began = Date.now();
  await page.getByRole("button", { name: "Media", exact: true }).click();
  for (let i = 0; i < 12; i++)
    await page
      .getByRole("button", {
        name: `Add ${assets[i].original_name} to timeline`,
        exact: true,
      })
      .click();
  await page
    .getByRole("navigation", { name: "Production asset pages" })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  for (let i = 12; i < 20; i++)
    await page
      .getByRole("button", {
        name: `Add ${assets[i].original_name} to timeline`,
        exact: true,
      })
      .click();
  const interactionMs = Date.now() - began;
  writeFileSync(
    ".tools/premium-performance.json",
    JSON.stringify(
      {
        kind: "local Chrome with mocked services",
        sourceMetadataCount: 20,
        videoSources: 12,
        photoSources: 8,
        addTwentyItemsMilliseconds: interactionMs,
        notes:
          "Includes Playwright click overhead; not a production/network or multi-source render benchmark.",
      },
      null,
      2,
    ),
  );
  test.info().annotations.push({
    type: "20-item-interaction-ms",
    description: String(interactionMs),
  });
  await expect(page.getByRole("button", { name: /Select clip/ })).toHaveCount(
    20,
  );
  const dragFirst = page.getByRole("button", { name: /Select clip/ }).first();
  const dragSecond = page.getByRole("button", { name: /Select clip/ }).nth(1);
  await dragFirst.dragTo(dragSecond);
  await expect(
    page.getByRole("button", { name: /Select clip/ }).first(),
  ).toHaveAccessibleName(/SYNTHETIC photo 02/);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Export combined MP4", exact: true }),
  ).toBeDisabled();
  await page
    .getByText("Project settings & saved work", { exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Production title", exact: true })
    .fill("SYNTHETIC QA — mixed production");
  await page.getByRole("button", { name: "Move earlier", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Clip display duration", exact: true })
    .fill("2");
  await page
    .getByRole("button", { name: "Split at midpoint", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /Select clip/ })).toHaveCount(
    21,
  );
  await page
    .getByRole("button", { name: "Save production", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Project saved." }),
  ).toBeVisible();
  expect(saved.clips).toHaveLength(21);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: ".tools/screenshots/premium-video-editor.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: ".tools/screenshots/premium-editor-mobile.png",
    fullPage: true,
  });
  await page.reload();
  await waitForOwnerWorkspace(page);
  await openWorkspaceSection(page, "Media Studio");
  if (
    !(await page
      .getByRole("combobox", { name: "Saved production", exact: true })
      .isVisible())
  )
    await page
      .getByText("Project settings & saved work", { exact: true })
      .click();
  await page
    .getByRole("combobox", { name: "Saved production", exact: true })
    .selectOption(saved.id);
  await expect(page.getByRole("button", { name: /Select clip/ })).toHaveCount(
    21,
  );
  await page
    .getByRole("button", {
      name: "Select clip 1: SYNTHETIC photo 01",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Play sequence", exact: true })
    .click();
  await expect
    .poll(async () =>
      Number(
        (await page.locator(".transport output").innerText()).split(" / ")[0],
      ),
    )
    .toBeGreaterThan(0.2);
  await page
    .getByRole("button", { name: "Pause sequence", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Import originals", exact: false })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByLabel("Drop your original photos & videos here"),
  ).toHaveAttribute("multiple", "");
  await page.getByRole("button", { name: "Close import", exact: true }).click();
  await page.setViewportSize({ width: 1720, height: 1080 });
  await openWorkspaceSection(page, "Media Library");
  await page.screenshot({
    path: ".tools/screenshots/premium-media-library.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
