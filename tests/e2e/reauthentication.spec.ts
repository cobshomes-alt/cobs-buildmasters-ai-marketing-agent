import { test, expect } from "@playwright/test";
import { openWorkspaceSection, waitForOwnerWorkspace } from "./workspace";

test("owner reauthenticates from Media Library without an Overview readiness assumption (mocked Supabase)", async ({
  page,
}) => {
  const owner = "11111111-1111-4111-8111-111111111111";
  const session = {
    access_token: `e30.${Buffer.from(JSON.stringify({ sub: owner, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`,
    refresh_token: "mock-refresh",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: {
      id: owner,
      email: "cobshomes@gmail.com",
      aud: "authenticated",
      role: "authenticated",
    },
  };
  await page.addInitScript((session) => {
    localStorage.setItem("sb-cobs-test-auth-token", JSON.stringify(session));
  }, session);
  const databaseWrites: string[] = [];
  const errors: string[] = [];
  let signIns = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://cobs-test.supabase.co/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    let body: unknown = [];
    if (pathname === "/auth/v1/logout") body = {};
    else if (pathname === "/auth/v1/token") {
      signIns++;
      body = session;
    } else if (pathname === "/auth/v1/user") body = session.user;
    else if (pathname.startsWith("/rest/v1/")) {
      if (request.method() !== "GET") databaseWrites.push(pathname);
      // Simulate slower hosted reads without writing any fixture data.
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (pathname.endsWith("cobs_profiles")) body = { role: "owner" };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto("/");
  await openWorkspaceSection(page, "Media Library");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to your workspace" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Workspace sections" }),
  ).toHaveCount(0);
  await page.getByLabel("Email", { exact: true }).fill("cobshomes@gmail.com");
  await page.getByLabel("Password", { exact: true }).fill("mock-password-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await waitForOwnerWorkspace(page);
  await expect(page.locator("h1")).toHaveText("Media Library");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Secure Supabase workspace connected.", { exact: false }),
  ).toHaveCount(0);
  await openWorkspaceSection(page, "Overview");
  expect(signIns).toBe(1);
  expect(databaseWrites).toEqual([]);
  expect(errors).toEqual([]);
});
