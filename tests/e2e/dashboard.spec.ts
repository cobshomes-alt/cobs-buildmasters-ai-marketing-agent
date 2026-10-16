import { test, expect } from "@playwright/test";
import { waitForOwnerWorkspace, openWorkspaceSection } from "./workspace";
import { EDIT_PREFIX } from "../../lib/studio-model.mjs";

test("owner dashboard saves drafts and renders without mobile overflow (mocked Supabase)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const owner = "11111111-1111-4111-8111-111111111111";
  const posts: Record<string, unknown>[] = [];
  await page.addInitScript(
    ({ owner }) => {
      const payload = btoa(
        JSON.stringify({
          sub: owner,
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      );
      localStorage.setItem(
        "sb-cobs-test-auth-token",
        JSON.stringify({
          access_token: `e30.${payload}.signature`,
          refresh_token: "mock-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
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
  await page.route("https://cobs-test.supabase.co/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (
      req.method() === "GET" &&
      url.pathname.includes("/storage/v1/object/sign/")
    ) {
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
          "base64",
        ),
      });
      return;
    }
    let body: unknown = [];
    if (url.pathname.includes("cobs_profiles")) body = { role: "owner" };
    else if (url.pathname.includes("cobs_posts")) {
      if (req.method() === "POST") {
        const values = req.postDataJSON();
        const row = {
          id: "post-1",
          status: "Draft",
          updated_at: new Date().toISOString(),
          ...values,
        };
        posts.unshift(row);
        body = row;
      } else body = posts;
    } else if (url.pathname.includes("cobs_media_assets")) {
      body = [
        {
          id: "22222222-2222-4222-8222-222222222222",
          storage_path: `${owner}/33333333-3333-4333-8333-333333333333.png`,
          original_name: "Synthetic local preview.png",
          mime_type: "image/png",
          size_bytes: 68,
          project: "Synthetic test",
          product: "",
          campaign_id: null,
        },
      ];
    } else if (url.pathname.includes("/storage/v1/object/sign/")) {
      body = { signedURL: "/object/sign/cobs-media/synthetic.png?token=fake" };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.route("**/api/studio", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ready: false, jobs: [] }),
    }),
  );
  await page.goto("/");
  await waitForOwnerWorkspace(page);
  const logo = page.getByRole("img", { name: /COBS BUILDMASTERS LTD/ });
  await expect(logo).toBeVisible();

  await expect
    .poll(() =>
      logo.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBe(1280);
  expect(
    await logo.evaluate((image) => {
      const bounds = image.getBoundingClientRect();
      return (
        Math.abs(bounds.width - bounds.height) < 1 &&
        getComputedStyle(image).objectFit === "contain"
      );
    }),
  ).toBe(true);
  await expect(
    page.getByRole("heading", {
      name: "What would you like to create?",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: ".tools/screenshots/dashboard-desktop.png",
    fullPage: true,
  });
  await openWorkspaceSection(page, "Content Calendar");
  await page.getByLabel("Post title").fill("Factory block production");
  await page
    .getByLabel("Post copy")
    .fill("Our original factory production update.");
  await page.getByRole("button", { name: "Save as draft" }).click();
  await expect(
    page.getByText("Content saved securely.", { exact: false }),
  ).toBeVisible();
  expect(posts).toHaveLength(1);
  await page.reload();
  await openWorkspaceSection(page, "Content Calendar");
  await expect(
    page.getByText("Factory block production", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await logo.evaluate((image) => {
      const bounds = image.getBoundingClientRect();
      return (
        bounds.left >= 0 &&
        bounds.right <= innerWidth &&
        Math.abs(bounds.width - bounds.height) < 1
      );
    }),
  ).toBe(true);
  await expect(
    page.getByRole("heading", { name: "My Posts", exact: true }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".tools/screenshots/dashboard-mobile.png",
    fullPage: true,
  });
  await openWorkspaceSection(page, "Media Library");
  await expect(
    page.getByRole("heading", { name: "Project media library" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".tools/screenshots/media-mobile.png",
    fullPage: true,
  });
  await openWorkspaceSection(page, "Media Studio");
  await page.getByRole("button", { name: "Photo editor", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Project title", exact: true })
    .fill("Synthetic editor recipe");
  await page
    .getByRole("combobox", { name: "Original media", exact: true })
    .selectOption("22222222-2222-4222-8222-222222222222");
  await page
    .getByRole("textbox", { name: "Branded headline", exact: true })
    .fill("Verified local planning");
  await page
    .getByRole("button", { name: "Save editing project", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Editing recipe saved" }),
  ).toBeVisible();
  expect(
    posts.filter((p) => String(p.body).startsWith(EDIT_PREFIX)),
  ).toHaveLength(1);
  await expect(
    page.getByRole("button", { name: "Render saved project" }),
  ).toBeDisabled();
  await page.screenshot({
    path: ".tools/screenshots/media-studio-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await waitForOwnerWorkspace(page);
  await openWorkspaceSection(page, "Media Studio");
  await page.getByRole("button", { name: "Photo editor", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Saved editing project", exact: true })
    .selectOption(
      String(posts.find((p) => String(p.body).startsWith(EDIT_PREFIX))!.id),
    );
  await expect(
    page.getByRole("textbox", { name: "Branded headline", exact: true }),
  ).toHaveValue("Verified local planning");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: ".tools/screenshots/media-studio-desktop.png",
    fullPage: true,
  });
  await page
    .locator(".editor-grid > div")
    .last()
    .screenshot({ path: ".tools/screenshots/premium-export-panel.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await openWorkspaceSection(page, "Content Calendar");
  await expect(
    page.getByText("Synthetic editor recipe", { exact: true }),
  ).toHaveCount(0);
  await page.getByText("Preview social post", { exact: true }).click();
  for (const platform of [
    "Instagram Feed",
    "Instagram Reels",
    "Instagram Stories",
    "Facebook Feed",
    "Facebook Reels",
    "TikTok",
    "YouTube Shorts",
    "YouTube standard video",
    "X",
    "Snapchat",
    "Google Business Profile",
  ]) {
    await page
      .getByRole("combobox", { name: "Preview platform", exact: true })
      .selectOption(platform);
    await expect(
      page.getByText(`${platform} · Draft preview`, { exact: true }),
    ).toBeVisible();
  }
  await page.screenshot({
    path: ".tools/screenshots/premium-social-preview.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("original JPEG branding loads without cropping on the mobile sign-in page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sign in to your workspace" }),
  ).toBeVisible();
  const logo = page.getByRole("img", { name: /COBS BUILDMASTERS LTD/ });
  await expect
    .poll(() =>
      logo.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBe(1280);
  expect(
    await logo.evaluate((image) => {
      const bounds = image.getBoundingClientRect();
      return (
        Math.abs(bounds.width - bounds.height) < 1 &&
        getComputedStyle(image).objectFit === "contain" &&
        bounds.right <= innerWidth
      );
    }),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".tools/screenshots/branding-sign-in-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: ".tools/screenshots/premium-login.png",
    fullPage: true,
  });
});
