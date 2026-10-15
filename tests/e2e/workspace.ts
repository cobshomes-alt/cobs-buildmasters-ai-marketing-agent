import { expect, type Page } from "@playwright/test";

export async function waitForOwnerWorkspace(page: Page) {
  try {
    // This navigation is rendered only after owner/profile and workspace reads
    // complete. The current section and a mutable notice are not auth state.
    await expect(
      page.getByRole("navigation", { name: "Workspace sections" }),
    ).toBeVisible();
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
  await page.getByRole("button", { name: section, exact: true }).click();
  await expect(page.locator("h1")).toHaveText(section);
}
