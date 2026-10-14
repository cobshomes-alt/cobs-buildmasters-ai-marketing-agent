// @vitest-environment jsdom
import { beforeEach, afterEach, test, expect, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Page from "../app/page";

const mock = vi.hoisted(() => ({
  session: null as any,
  role: "owner",
  failSave: false,
  rows: [] as any[],
  campaigns: [] as any[],
  insert: vi.fn(),
  client: {} as any,
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => mock.client }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  mock.session = {
    user: { id: "owner", email: "cobshomes@gmail.com" },
    access_token: "owner-token",
  };
  mock.role = "owner";
  mock.failSave = false;
  mock.rows = [];
  mock.campaigns = [];
  mock.insert.mockReset();
  mock.client = {
    auth: {
      getSession: async () => ({ data: { session: mock.session } }),
      onAuthStateChange: () => ({
        data: { listener: null, subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn(),
    },
    from: (table: string) => {
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        order: () =>
          Promise.resolve({
            data:
              table === "cobs_posts"
                ? [...mock.rows]
                : table === "cobs_campaigns"
                  ? [...mock.campaigns]
                  : [],
            error: null,
          }),
        maybeSingle: async () => ({ data: { role: mock.role }, error: null }),
        insert: (value: any) => {
          mock.insert(table, value);
          builder.value = value;
          return builder;
        },
        single: async () => {
          if (mock.failSave)
            return { data: null, error: { message: "Database unavailable" } };
          const row = {
            id: "post-1",
            status: "Draft",
            updated_at: "2026-10-14",
            ...builder.value,
          };
          if (table === "cobs_posts") mock.rows.push(row);
          else mock.campaigns.push(row);
          return { data: row, error: null };
        },
      };
      return builder;
    },
    storage: {
      from: () => ({
        createSignedUrl: async () => ({
          data: { signedUrl: "https://example.test/image" },
        }),
      }),
    },
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
async function workspace() {
  render(<Page />);
  await screen.findByRole("heading", { name: "Overview" });
}
test("missing configuration displays sign in and an actionable status", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  render(<Page />);
  expect(
    await screen.findByText("Supabase environment variables need attention.", {
      exact: false,
    }),
  ).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Sign in to your workspace" }),
  ).toBeTruthy();
});
test("nonowner cannot open dashboard", async () => {
  mock.role = "member";
  render(<Page />);
  expect(
    await screen.findByText(
      "This account is not authorised for the COBS owner workspace.",
      { exact: false },
    ),
  ).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Overview" })).toBeNull();
});
test("manual draft uses database and survives a fresh workspace mount", async () => {
  const user = userEvent.setup();
  await workspace();
  await user.click(screen.getByRole("button", { name: "Content Calendar" }));
  await user.click(screen.getByRole("button", { name: "Save as draft" }));
  await waitFor(() =>
    expect(mock.insert).toHaveBeenCalledWith(
      "cobs_posts",
      expect.objectContaining({ created_by: "owner", source: "manual" }),
    ),
  );
  await screen.findByText(
    "Content saved securely. Changed content requires a fresh owner approval.",
    { exact: false },
  );
  cleanup();
  await workspace();
  await user.click(screen.getByRole("button", { name: "Content Calendar" }));
  expect(
    await screen.findByText("Build stronger with COBS concrete blocks"),
  ).toBeTruthy();
});
test("AI generation never claims saved when database rejects the draft", async () => {
  mock.failSave = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        title: "Generated title",
        body: "Generated body",
        source: "ai",
      }),
    ),
  );
  const user = userEvent.setup();
  await workspace();
  await user.click(screen.getByRole("button", { name: "Creative Studio" }));
  await user.click(screen.getByRole("button", { name: "Generate AI post" }));
  expect(await screen.findByText(/Draft could not be saved/)).toBeTruthy();
  expect(
    screen.queryByText("AI post generated and saved as a draft.", {
      exact: false,
    }),
  ).toBeNull();
});
test("media library is accessible and shows an empty state", async () => {
  const user = userEvent.setup();
  await workspace();
  await user.click(screen.getByRole("button", { name: "Media Library" }));
  expect(
    await screen.findByRole("heading", { name: "Project media library" }),
  ).toBeTruthy();
  expect(screen.getByRole("heading", { name: "No media found" })).toBeTruthy();
});

test("campaigns are inserted into database and loaded after remount", async () => {
  const user = userEvent.setup();
  await workspace();
  await user.click(screen.getByRole("button", { name: "Campaign Planner" }));
  await user.type(
    screen.getByLabelText("Campaign name"),
    "Property development",
  );
  await user.click(screen.getByRole("button", { name: "Add campaign" }));
  expect(await screen.findByText("Property development")).toBeTruthy();
  expect(mock.insert).toHaveBeenCalledWith("cobs_campaigns", {
    name: "Property development",
    created_by: "owner",
  });
  cleanup();
  await workspace();
  await user.click(screen.getByRole("button", { name: "Campaign Planner" }));
  expect(await screen.findByText("Property development")).toBeTruthy();
});
