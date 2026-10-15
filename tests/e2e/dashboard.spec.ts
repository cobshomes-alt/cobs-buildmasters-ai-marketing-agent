import { test, expect } from "@playwright/test";
import { waitForOwnerWorkspace } from "./workspace";

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
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto("/");
  await waitForOwnerWorkspace(page);
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: ".tools/screenshots/dashboard-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Content Calendar", exact: true })
    .click();
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
  await page
    .getByRole("button", { name: "Content Calendar", exact: true })
    .click();
  await expect(
    page.getByText("Factory block production", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page
      .getByRole("heading", { name: "Content Calendar", exact: true })
      .first(),
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
  await page
    .getByRole("button", { name: "Media Library", exact: true })
    .click();
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
  expect(errors).toEqual([]);
});
