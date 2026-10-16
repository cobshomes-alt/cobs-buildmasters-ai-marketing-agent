import { expect, type Page } from "@playwright/test";

export async function waitForOwnerWorkspace(page: Page) {
  try {
    // This navigation is rendered only after owner/profile and workspace reads
    // complete. The current section and a mutable notice are not auth state.
    await expect(page.locator("#workspace-content")).toBeVisible();
  } catch (error) {
    const state = {
      headings: await page.locator("h1").allTextContents(),
      signInFormVisible: await page
        .getByRole("heading", {
          name: "Sign in to your workspace",
          exact: true,
        })
        .isVisible(),
    };
    // Never collect form values, cookies, session storage, headers or tokens.
    throw new Error(`Owner workspace not ready: ${JSON.stringify(state)}`, {
      cause: error,
    });
  }
}

export async function openWorkspaceSection(page: Page, section: string) {
  await waitForOwnerWorkspace(page);
  const labels: Record<string, string> = {
    Overview: "Home",
    "Creative Studio": "Plan Content",
    "Media Studio": "Edit Myself",
    "Content Calendar": "My Posts",
    "Campaign Planner": "Projects",
    Approvals: "Owner Review",
    Scheduler: "Scheduled Posts",
    Leads: "Customer Enquiries",
    "Marketing Operations": "Tasks & Analytics",
  };
  const nav = page.getByRole("navigation", { name: "Workspace sections" });
  if (!(await nav.isVisible()))
    await page.getByRole("button", { name: "Menu", exact: false }).click();
  const button = nav.getByRole("button", {
    name: labels[section] || section,
    exact: true,
  });
  if (!(await button.isVisible()))
    await nav.getByText("Business tools", { exact: true }).click();
  await button.click();
  await expect(page.locator("h1")).toHaveText(
    section === "Overview"
      ? "What would you like to create?"
      : section === "Media Studio"
        ? "Editing Studio"
        : labels[section] || section,
  );
}
