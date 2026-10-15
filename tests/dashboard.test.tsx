// @vitest-environment jsdom
import { beforeEach, afterEach, test, expect, vi } from "vitest";
import { render, screen, waitFor, cleanup, act } from "@testing-library/react";
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

test("reauthentication retains navigation and a late auth response cannot overwrite connected status", async () => {
  const ownerSession = mock.session;
  let notify: (event: string, next: any) => void = () => {};
  let finishLogin!: () => void;
  mock.client.auth.onAuthStateChange = (callback: typeof notify) => {
    notify = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  };
  mock.client.auth.signOut = async () => {
    mock.session = null;
    notify("SIGNED_OUT", null);
    return { error: null };
  };
  mock.client.auth.signInWithPassword = () => {
    mock.session = ownerSession;
    notify("SIGNED_IN", ownerSession);
    return new Promise((resolve) => {
      finishLogin = () =>
        resolve({ data: { session: ownerSession }, error: null });
    });
  };
  const user = userEvent.setup();
  await workspace();
  await user.click(screen.getByRole("button", { name: "Content Calendar" }));
  await user.click(screen.getByRole("button", { name: "Sign out" }));
  await screen.findByRole("heading", { name: "Sign in to your workspace" });
  await user.type(screen.getByLabelText("Email"), "cobshomes@gmail.com");
  await user.type(screen.getByLabelText("Password"), "mock-password-only");
  await user.click(screen.getByRole("button", { name: /^Sign in$/ }));
  await screen.findByRole("navigation", { name: "Workspace sections" });
  expect(screen.queryByRole("heading", { name: "Overview" })).toBeNull();
  expect(
    screen.getAllByRole("heading", { name: "Content Calendar" }).length,
  ).toBeGreaterThan(0);
  await act(async () => finishLogin());
  expect(
    screen.getByRole("navigation", { name: "Workspace sections" }),
  ).toBeTruthy();
  expect(screen.queryByText("Secure Supabase workspace connected.")).toBeNull();
  expect(mock.insert).not.toHaveBeenCalled();
});
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

test("unsaved production brief warns before dashboard navigation and cancellation preserves local edits", async () => {
  const user = userEvent.setup();
  const confirm = vi.fn(() => false);
  vi.stubGlobal("confirm", confirm);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ configured: false })),
  );
  await workspace();
  await user.click(screen.getByRole("button", { name: "Creative Studio" }));
  await user.click(screen.getByRole("button", { name: "Production brief" }));
  await user.type(
    screen.getByLabelText("Specific filming instructions"),
    "Approved visitor area only",
  );
  await user.click(screen.getByRole("button", { name: "Overview" }));
  expect(confirm).toHaveBeenCalled();
  expect(screen.getByRole("heading", { name: "Creative Studio" })).toBeTruthy();
  expect(
    (
      screen.getByLabelText(
        "Specific filming instructions",
      ) as HTMLTextAreaElement
    ).value,
  ).toBe("Approved visitor area only");
  expect(mock.insert).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  await user.click(screen.getByRole("button", { name: "Overview" }));
  expect(screen.getByRole("heading", { name: "Overview" })).toBeTruthy();
});
