import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DatabaseSync } from "node:sqlite";
import {
  operationsTables,
  jobs,
  tasks,
  prepareJob,
  updateJob,
  reconcileJobs,
  createTask,
  reportStep,
} from "../../lib/marketing-operations";
import {
  CHANNELS,
  analyticsContract,
  type MarketingPost,
} from "../../lib/marketing-contracts";
import { waitForOwnerWorkspace, openWorkspaceSection } from "./workspace";
test("publishing preparation and central task planning persist locally, preserve approval gates and fit mobile (mocked hosted services)", async ({
  page,
}) => {
  test.setTimeout(120000);
  const owner = "11111111-1111-4111-8111-111111111111",
    db = new DatabaseSync(":memory:");
  operationsTables(db);
  const post: MarketingPost = {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Synthetic owner-approved factory post",
    body: "Verified synthetic copy",
    status: "Approved",
    updated_at: "2026-10-15T00:00:00Z",
    approved_by: owner,
    approved_at: "2026-10-15T00:00:00Z",
  };
  let external = 0;
  page.on("request", (r) => {
    if (/graph\.facebook|api\.tiktok|googleapis|api\.openai/.test(r.url()))
      external++;
  });
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
  await page.route("https://cobs-test.supabase.co/**", (route) =>
    route.fulfill({
      json: route.request().url().includes("cobs_profiles")
        ? { role: "owner" }
        : route.request().url().includes("cobs_posts")
          ? [post]
          : [],
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.route("**/api/marketing-operations", async (route) => {
    try {
      if (route.request().method() === "GET")
        return route.fulfill({
          json: {
            posts: [post],
            campaigns: [],
            leadRecordsLoaded: 0,
            publishing: reconcileJobs(db, owner, [post]),
            tasks: tasks(db, owner),
            renderJobs: [],
            usage: { jobs: 0, reservedBytes: 0 },
            analytics: analyticsContract(),
            integrations: CHANNELS.map((platform) => ({
              platform,
              connected: false,
              liveVerified: false,
              reason: "Official connector not configured.",
            })),
            scope:
              "Synthetic mocked hosted reads with actual local ledger model.",
          },
        });
      const b = route.request().postDataJSON();
      let result;
      if (b.action === "prepare")
        result = {
          results: b.platforms.map((p: any) =>
            prepareJob(db, owner, post, p, b.captions[p], b.mode, b.scheduleAt),
          ),
        };
      else if (b.action === "task")
        result = { task: createTask(db, owner, b.objective, b.template, null) };
      else if (b.action === "step")
        result = {
          task: reportStep(db, owner, b.id, b.revision, b.index, b.evidence),
        };
      else
        result = {
          job: updateJob(db, owner, b.id, b.revision, b.action, post, b.url),
        };
      return route.fulfill({ json: result });
    } catch (e) {
      return route.fulfill({
        status: 409,
        json: { error: e instanceof Error ? e.message : "Failed" },
      });
    }
  });
  try {
    await page.goto("/");
    await waitForOwnerWorkspace(page);
    await openWorkspaceSection(page, "Publishing Centre");
    await page
      .getByRole("combobox", { name: "Existing content", exact: true })
      .selectOption(post.id);
    await page
      .getByRole("textbox", { name: "Instagram caption", exact: true })
      .fill("Owner-reviewed platform adaptation");
    await page
      .getByRole("button", { name: "Prepare selected platforms" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Instagram · awaiting review" }),
    ).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Approve platform copy" }).click();
    await expect(
      page.getByRole("heading", { name: "Instagram · blocked provider" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Recheck readiness" }).click();
    await expect(
      page.getByText(
        "Connector still unavailable. No API publish request was attempted.",
        { exact: true },
      ),
    ).toBeVisible();
    post.status = "Draft";
    post.updated_at = "changed";
    post.approved_at = null;
    post.approved_by = null;
    await page.getByRole("button", { name: "Refresh operations" }).click();
    await expect(
      page.getByRole("heading", { name: "Instagram · awaiting approval" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Approve platform copy" }),
    ).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".tools/screenshots/publishing-centre-mobile.png",
      fullPage: true,
    });
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await openWorkspaceSection(page, "Marketing Operations");
    await page
      .getByRole("textbox", { name: "Marketing objective", exact: true })
      .fill("COBS SYNTHETIC LOCAL EDUCATION");
    await page
      .getByRole("combobox", { name: "Workflow template", exact: true })
      .selectOption("education");
    await page.getByRole("button", { name: "Create local workflow" }).click();
    await expect(
      page.getByRole("heading", {
        name: "COBS SYNTHETIC LOCAL EDUCATION",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("textbox", {
        name: "Evidence for COBS SYNTHETIC LOCAL EDUCATION, step 1",
        exact: true,
      })
      .fill(
        "Owner inspected the synthetic original; no real company record changed.",
      );
    await page
      .getByRole("button", { name: "Record owner evidence" })
      .first()
      .click();
    await expect(
      page.getByText("Owner planning · owner reported", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await waitForOwnerWorkspace(page);
    await openWorkspaceSection(page, "Marketing Operations");
    await expect(
      page.getByText(
        "Owner evidence: Owner inspected the synthetic original; no real company record changed.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByText(/Impressions: Unavailable/)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".tools/screenshots/marketing-operations-mobile.png",
      fullPage: true,
    });
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(external).toBe(0);
  } finally {
    db.close();
  }
});
