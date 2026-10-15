import { expect, test } from "@playwright/test";
import { waitForOwnerWorkspace } from "./workspace";
import { decodePlan } from "../../lib/creative-plan";

test("creative director plans, reloads, hands off to Draft and fits mobile (mock services only)", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const owner = "11111111-1111-4111-8111-111111111111";
  const posts: Record<string, any>[] = [];
  await page.addInitScript(
    ({ owner }) => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async (value: string) => {
            (window as any).__copiedScript = value;
          },
        },
        configurable: true,
      });
      const expires = Math.floor(Date.now() / 1000) + 3600;
      const payload = btoa(JSON.stringify({ sub: owner, exp: expires }));
      localStorage.setItem(
        "sb-cobs-test-auth-token",
        JSON.stringify({
          access_token: `e30.${payload}.signature`,
          refresh_token: "mock-refresh",
          expires_at: expires,
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
  await page.route("**/api/creative-director", (route) =>
    route.fulfill({ json: { configured: false } }),
  );
  await page.route("https://cobs-test.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let body: unknown = [];
    if (url.pathname.includes("cobs_profiles")) body = { role: "owner" };
    else if (url.pathname.includes("cobs_campaigns"))
      body = [{ id: "campaign", name: "Factory campaign" }];
    else if (url.pathname.includes("cobs_media_assets"))
      body = [
        {
          id: "media",
          storage_path: "owner/fixture.png",
          original_name: "Synthetic UI preview.png",
          mime_type: "image/png",
          size_bytes: 68,
          project: "Factory",
          product: "Blocks",
          campaign_id: "campaign",
        },
      ];
    else if (
      url.pathname.includes("/storage/v1/object/sign/") &&
      request.method() === "POST"
    )
      body = {
        signedURL: "/object/sign/cobs-media/owner/fixture.png?token=mock",
      };
    else if (
      url.pathname.includes("/storage/v1/object/sign/") &&
      request.method() === "GET"
    ) {
      await route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
          "base64",
        ),
      });
      return;
    } else if (url.pathname.includes("cobs_posts")) {
      if (request.method() === "POST") {
        const row = {
          id: `post-${posts.length + 1}`,
          updated_at: new Date().toISOString(),
          ...request.postDataJSON(),
        };
        posts.push(row);
        body = row;
      } else if (request.method() === "PATCH") {
        const row = posts.find(
          (p) => `eq.${p.id}` === url.searchParams.get("id"),
        );
        if (
          !row ||
          `eq.${row.updated_at}` !== url.searchParams.get("updated_at")
        ) {
          await route.fulfill({ status: 409, json: { message: "conflict" } });
          return;
        }
        Object.assign(row, request.postDataJSON(), {
          updated_at: new Date().toISOString(),
        });
        body = row;
      } else body = posts;
    }
    await route.fulfill({
      json: body,
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto("/");
  await waitForOwnerWorkspace(page);
  await page
    .getByRole("button", { name: "Creative Studio", exact: true })
    .click();
  await expect(page.getByText(/Live AI unavailable/)).toBeVisible();
  await page
    .getByRole("button", { name: "Production brief", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Generate live AI plan" }),
  ).toBeDisabled();
  await page
    .getByRole("combobox", { name: "Campaign", exact: true })
    .selectOption("campaign");
  await page
    .getByRole("combobox", { name: "Calendar", exact: true })
    .selectOption("month");
  await page
    .getByRole("textbox", { name: "Target audience", exact: true })
    .fill("Builders and site supervisors");
  await page.getByRole("checkbox", { name: "Demoulding", exact: true }).check();
  await page
    .getByRole("checkbox", { name: "Finished blocks", exact: true })
    .check();
  await page.getByRole("button", { name: "Create sample plan" }).click();
  await page
    .getByRole("checkbox", { name: /Location and activity introduction/ })
    .check();
  await page.getByRole("button", { name: "Save production plan" }).click();
  await expect(
    page.getByText("Production plan and checklist saved to the campaign."),
  ).toBeVisible();
  expect(posts).toHaveLength(1);
  expect(decodePlan(posts[0].body)?.checked).toEqual([0]);
  await page.reload();
  await waitForOwnerWorkspace(page);
  await page
    .getByRole("button", { name: "Content Calendar", exact: true })
    .click();
  await expect(
    page.getByText("Production plan:", { exact: false }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Creative Studio", exact: true })
    .click();
  await page.getByRole("button", { name: /^Production plan:/ }).click();
  await expect(
    page.getByRole("checkbox", { name: /Location and activity introduction/ }),
  ).toBeChecked();
  await page
    .getByText("Direction & customisation", { exact: true })
    .first()
    .click();
  await expect(
    page.getByLabel("Camera angle", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByText("Direction & customisation", { exact: true })
    .first()
    .click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".tools/screenshots/creative-redesign-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 820, height: 1180 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".tools/screenshots/creative-redesign-tablet.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Filming checklist", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Retake notes", exact: true })
    .first()
    .fill("Capture clearer ambient audio");
  await page
    .getByRole("button", { name: "Save checklist progress", exact: true })
    .click();
  await expect(
    page.getByText("Production plan and checklist saved to the campaign."),
  ).toBeVisible();
  expect(decodePlan(posts[0].body)?.plan.shots[0].retake).toBe(
    "Capture clearer ambient audio",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".tools/screenshots/creative-redesign-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Creative dashboard", exact: true })
    .click();
  await expect(page.getByText("3 remaining", { exact: false })).toBeVisible();
  await page
    .getByRole("button", { name: "Production workflow", exact: true })
    .click();
  await expect(
    page.getByText(/manual handoff; no editing engine/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Original media", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Original media attachment", exact: true })
    .selectOption("media");
  await expect(page.getByAltText("Synthetic UI preview.png")).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByAltText("Synthetic UI preview.png")
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBe(1);
  await page.getByRole("button", { name: "Ideas & calendar" }).click();
  await expect(page.locator(".creative-table tbody tr")).toHaveCount(12);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".tools/screenshots/creative-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".tools/screenshots/creative-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Scripts & captions" }).click();
  await page
    .getByRole("button", { name: "Copy hook", exact: true })
    .first()
    .click();
  expect(
    await page.evaluate(() => (window as any).__copiedScript),
  ).toBeTruthy();
  await page.getByText("Preview this script", { exact: true }).first().click();
  await page
    .getByRole("button", { name: "Create review draft" })
    .first()
    .click();
  await expect(page.getByText(/Review draft created/)).toBeVisible();
  expect(posts).toHaveLength(2);
  expect(posts[1].status).toBe("Draft");
  expect(posts[1].media_id).toBe("media");
  expect(decodePlan(posts[0].body)?.outputPostId).toBe(posts[1].id);
  await page
    .getByRole("button", { name: "Content Calendar", exact: true })
    .click();
  await expect(
    page.getByText("I want to film my concrete block factory", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
