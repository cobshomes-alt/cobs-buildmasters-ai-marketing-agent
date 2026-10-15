import { expect, test } from "@playwright/test";
import { waitForOwnerWorkspace } from "./workspace";
import { decodePlan } from "../../lib/creative-plan";

test("creative director plans, reloads, hands off to Draft and fits mobile (mock services only)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const owner = "11111111-1111-4111-8111-111111111111";
  const posts: Record<string, any>[] = [];
  await page.addInitScript(
    ({ owner }) => {
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
    else if (url.pathname.includes("cobs_posts")) {
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
  await expect(
    page.getByRole("button", { name: "Generate live AI plan" }),
  ).toBeDisabled();
  await page
    .getByRole("combobox", { name: "Campaign", exact: true })
    .selectOption("campaign");
  await page
    .getByRole("combobox", { name: "Calendar", exact: true })
    .selectOption("month");
  await page.getByRole("button", { name: "Create sample plan" }).click();
  await page
    .getByRole("checkbox", { name: /Site or factory introduction/ })
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
    page.getByRole("checkbox", { name: /Site or factory introduction/ }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Ideas & calendar" }).click();
  await expect(page.locator(".creative-table tbody tr")).toHaveCount(12);
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
  await page.screenshot({
    path: ".tools/screenshots/creative-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Scripts & captions" }).click();
  await page
    .getByRole("button", { name: "Create review draft" })
    .first()
    .click();
  await expect(page.getByText(/Review draft created/)).toBeVisible();
  expect(posts).toHaveLength(2);
  expect(posts[1].status).toBe("Draft");
  expect(decodePlan(posts[0].body)?.outputPostId).toBe(posts[1].id);
  await page
    .getByRole("button", { name: "Content Calendar", exact: true })
    .click();
  await expect(
    page.getByText("I want to film my concrete block factory", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
