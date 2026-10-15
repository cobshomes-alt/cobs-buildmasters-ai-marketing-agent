// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import CreativeDirector, {
  type StudioPost,
} from "../app/components/creative-director";
import {
  decodePlan,
  encodePlan,
  samplePlan,
  type Brief,
} from "../lib/creative-plan";

const brief: Brief = {
  topic: "Factory filming",
  project: "",
  evidence: "",
  period: "week",
  style: "Educational",
  length: "15–30 seconds",
  platforms: ["Instagram"],
  startDate: "2026-10-15",
};
let rows: StudioPost[];
let fail: boolean;
let failWrite: number;
let writes: Array<{ action: string; values: any; conditions: any[] }>;
const session = {
  user: { id: "owner" },
  access_token: "mock-owner-token",
} as any;
const client = {
  auth: { getSession: async () => ({ data: { session } }) },
  from: () => {
    const record = { action: "", values: {} as any, conditions: [] as any[] };
    const builder: any = {
      insert(values: any) {
        record.action = "insert";
        record.values = values;
        return builder;
      },
      update(values: any) {
        record.action = "update";
        record.values = values;
        return builder;
      },
      eq(key: string, value: any) {
        record.conditions.push([key, value]);
        return builder;
      },
      select() {
        return builder;
      },
      async single() {
        writes.push(record);
        if (fail || writes.length === failWrite)
          return { data: null, error: { message: "conflict" } };
        const old =
          record.action === "update"
            ? rows.find((row) =>
                record.conditions.every(
                  ([key, value]) => row[key as keyof StudioPost] === value,
                ),
              )
            : undefined;
        if (record.action === "update" && !old)
          return { data: null, error: { message: "stale" } };
        const row = {
          ...old,
          id: old?.id || `post-${rows.length + 1}`,
          ...record.values,
          updated_at: `revision-${writes.length}`,
        } as StudioPost;
        rows = [row, ...rows.filter((r) => r.id !== row.id)];
        return { data: row, error: null };
      },
    };
    return builder;
  },
} as any;
function Workspace() {
  const [posts, setPosts] = useState(rows);
  return (
    <CreativeDirector
      client={client}
      session={session}
      campaigns={[{ id: "campaign", name: "Factory campaign" }]}
      posts={posts}
      assets={[
        {
          id: "media",
          storage_path: "owner/synthetic.png",
          original_name: "Synthetic reference.png",
          mime_type: "image/png",
          size_bytes: 100,
          project: "Factory",
          product: "",
          campaign_id: "campaign",
          url: "https://example.invalid/mock-signed-image",
        },
      ]}
      onSaved={(post) =>
        setPosts((current) => [
          post,
          ...current.filter((p) => p.id !== post.id),
        ])
      }
      navigate={vi.fn()}
    >
      <p>Existing post tools</p>
    </CreativeDirector>
  );
}
beforeEach(() => {
  rows = [];
  writes = [];
  fail = false;
  failWrite = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ configured: false })),
  );
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
test("sample planning saves campaign, checklist and media choice then reopens from database records", async () => {
  const user = userEvent.setup();
  render(<Workspace />);
  await user.click(screen.getByRole("button", { name: "Production brief" }));
  await screen.findByText(/Live AI unavailable/);
  expect(
    (
      screen.getByRole("button", {
        name: "Generate live AI plan",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await user.selectOptions(screen.getByLabelText("Campaign"), "campaign");
  await user.click(screen.getByRole("button", { name: "Create sample plan" }));
  await screen.findByText("SAMPLE TEMPLATE · NOT AI-GENERATED");
  await user.click(
    screen.getByRole("checkbox", { name: /Site or factory introduction/ }),
  );
  await user.click(
    screen.getByRole("button", { name: "Save production plan" }),
  );
  await screen.findByText(
    "Production plan and checklist saved to the campaign.",
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].campaign_id).toBe("campaign");
  expect(decodePlan(rows[0].body)?.checked).toEqual([0]);
  expect(rows[0].source).toBe("starter");
  expect(rows[0].status).toBe("Draft");
  cleanup();
  render(<Workspace />);
  await user.click(screen.getByRole("button", { name: "Production brief" }));
  await user.click(screen.getByRole("button", { name: /Production plan:/ }));
  expect(
    (
      screen.getByRole("checkbox", {
        name: /Site or factory introduction/,
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
});
test("review draft is explicit, remains Draft, links back and cannot be duplicated from the open plan", async () => {
  const user = userEvent.setup();
  rows = [
    {
      id: "plan",
      title: "Production plan: Factory",
      body: encodePlan({
        version: 1,
        brief,
        plan: samplePlan(brief),
        source: "starter",
        checked: [],
        stage: "Filming Plan",
        outputPostId: null,
      }),
      status: "Draft",
      source: "starter",
      campaign_id: "campaign",
      updated_at: "revision-0",
    },
  ];
  render(<Workspace />);
  await user.click(screen.getByRole("button", { name: "Production brief" }));
  await user.click(
    screen.getByRole("button", { name: "Production plan: Factory" }),
  );
  await user.click(screen.getByRole("button", { name: "Original media" }));
  await user.selectOptions(
    screen.getByLabelText("Original media attachment"),
    "media",
  );
  expect(
    screen.getByAltText("Synthetic reference.png").getAttribute("src"),
  ).toContain("mock-signed-image");
  await user.click(screen.getByRole("button", { name: "Scripts & captions" }));
  await user.click(
    screen.getAllByRole("button", { name: "Create review draft" })[0],
  );
  await screen.findByText(/Review draft created/);
  const plan = rows.find((r) => r.id === "plan")!;
  const output = rows.find((r) => r.id !== "plan")!;
  expect(decodePlan(plan.body)?.outputPostId).toBe(output.id);
  expect(output.status).toBe("Draft");
  expect(output.campaign_id).toBe("campaign");
  expect(output.media_id).toBe("media");
  expect(plan.media_id).toBe("media");
  expect(writes.filter((w) => w.action === "insert")).toHaveLength(1);
  expect(
    writes
      .filter((w) => w.action === "update")
      .every((w) => w.conditions.some((c) => c[0] === "updated_at")),
  ).toBe(true);
  expect(
    screen
      .getAllByRole("button", { name: "Create review draft" })
      .every((b) => (b as HTMLButtonElement).disabled),
  ).toBe(true);
});
test("failed plan save retains unsaved edits and does not create a review draft", async () => {
  const user = userEvent.setup();
  render(<Workspace />);
  await user.click(screen.getByRole("button", { name: "Production brief" }));
  await user.selectOptions(screen.getByLabelText("Campaign"), "campaign");
  await user.click(screen.getByRole("button", { name: "Create sample plan" }));
  await screen.findByText("SAMPLE TEMPLATE · NOT AI-GENERATED");
  await user.click(screen.getByRole("button", { name: "Scripts & captions" }));
  fail = true;
  await user.click(
    screen.getAllByRole("button", { name: "Create review draft" })[0],
  );
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain(
      "Plan could not be saved",
    ),
  );
  expect(rows).toHaveLength(0);
  expect(writes).toHaveLength(1);
});

test("a failed link update preserves the created draft and allows explicit repair without duplication", async () => {
  const user = userEvent.setup();
  render(<Workspace />);
  await user.click(screen.getByRole("button", { name: "Production brief" }));
  await user.selectOptions(screen.getByLabelText("Campaign"), "campaign");
  await user.click(screen.getByRole("button", { name: "Create sample plan" }));
  await screen.findByText("SAMPLE TEMPLATE · NOT AI-GENERATED");
  await user.click(screen.getByRole("button", { name: "Scripts & captions" }));
  await user.selectOptions(
    screen.getByLabelText("Review draft copy"),
    "description",
  );
  failWrite = 3;
  await user.click(
    screen.getAllByRole("button", { name: "Create review draft" })[0],
  );
  await screen.findByText(/was created, but its plan link could not be saved/);
  expect(rows).toHaveLength(2);
  const draft = rows.find((row) => !decodePlan(row.body))!;
  expect(draft.body).toContain("Summarise genuine footage");
  expect(
    screen
      .getAllByRole("button", { name: "Create review draft" })
      .every((b) => (b as HTMLButtonElement).disabled),
  ).toBe(true);
  await user.click(
    screen.getByRole("button", { name: "Save production plan" }),
  );
  await screen.findByText(
    "Production plan and checklist saved to the campaign.",
  );
  expect(
    decodePlan(rows.find((row) => row.id !== draft.id)!.body)?.outputPostId,
  ).toBe(draft.id);
  expect(rows).toHaveLength(2);
});

test("guided brief, storyboard, on-site notes and copy studio preserve edits across section navigation", async () => {
  const user = userEvent.setup();
  render(<Workspace />);
  await user.click(screen.getByRole("button", { name: "Production brief" }));
  await user.selectOptions(screen.getByLabelText("Campaign"), "campaign");
  await user.type(screen.getByLabelText("Target audience"), "Site supervisors");
  await user.type(
    screen.getByLabelText("Specific filming instructions"),
    "Film from the visitor area",
  );
  await user.click(screen.getByRole("checkbox", { name: "Demoulding" }));
  await user.click(screen.getByRole("button", { name: "Create sample plan" }));
  await screen.findByRole("heading", { name: "Visual storyboard" });
  expect(
    screen.getByRole("navigation", { name: "Creative Director sections" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("list", { name: "Recommended scene order" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "Stacking and curing" }),
  ).toBeNull();
  await user.click(screen.getByRole("button", { name: "Filming checklist" }));
  await user.click(
    screen.getByRole("checkbox", { name: /Record scene 2: Demoulding/ }),
  );
  await user.type(
    screen.getAllByLabelText("Retake notes")[1],
    "Reduce wind noise",
  );
  await user.click(screen.getByRole("button", { name: "Creative dashboard" }));
  expect(screen.getByText(/1 remaining|2 remaining/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Scripts & captions" }));
  const clipboard = vi.spyOn(navigator.clipboard, "writeText");
  await user.click(screen.getAllByRole("button", { name: "Copy hook" })[0]);
  expect(clipboard).toHaveBeenCalled();
  await user.click(screen.getAllByText("Preview this script")[0]);
  await user.click(
    screen.getByRole("button", { name: "Save production plan" }),
  );
  await screen.findByText(
    "Production plan and checklist saved to the campaign.",
  );
  const doc = decodePlan(rows[0].body)!;
  expect(doc.checked).toEqual([1]);
  expect(doc.plan.shots[1].retake).toBe("Reduce wind noise");
  expect(doc.brief.audience).toContain("Site supervisors");
  expect(doc.brief.instructions).toBe("Film from the visitor area");
  await user.click(screen.getByRole("button", { name: "Production workflow" }));
  expect(screen.getByText(/manual handoff; no editing engine/)).toBeTruthy();
});

test("oversized manual content is rejected without replacing a saved plan", async () => {
  const user = userEvent.setup();
  rows = [
    {
      id: "existing",
      title: "Existing plan",
      body: encodePlan({
        version: 1,
        brief,
        plan: samplePlan(brief),
        source: "starter",
        checked: [],
        stage: "Filming Plan",
        outputPostId: null,
      }),
      status: "Draft",
      source: "starter",
      campaign_id: "campaign",
      updated_at: "revision-0",
    },
  ];
  const original = rows[0].body;
  render(<Workspace />);
  await user.click(screen.getByRole("button", { name: "Production brief" }));
  await user.click(screen.getByRole("button", { name: "Existing plan" }));
  await user.click(screen.getByRole("button", { name: "Production brief" }));
  fireEvent.change(screen.getByLabelText("Verified evidence and constraints"), {
    target: { value: "e".repeat(1200) },
  });
  await user.click(screen.getByRole("button", { name: "Scripts & captions" }));
  fireEvent.change(screen.getAllByLabelText("Voice-over / video script")[0], {
    target: { value: "v".repeat(1200) },
  });
  fireEvent.change(
    screen.getAllByLabelText("Facebook & Instagram caption")[0],
    { target: { value: "c".repeat(900) } },
  );
  fireEvent.change(
    screen.getAllByLabelText("TikTok & YouTube description")[0],
    { target: { value: "d".repeat(900) } },
  );
  await user.click(
    screen.getByRole("button", { name: "Save production plan" }),
  );
  await screen.findByText(/10,000-character workspace limit/);
  expect(rows[0].body).toBe(original);
  expect(writes).toHaveLength(0);
}, 30000);

test("failed AI regeneration retains the saved storyboard and never writes a sample fallback", async () => {
  const user = userEvent.setup();
  const original = encodePlan({
    version: 1,
    brief,
    plan: samplePlan(brief),
    source: "starter",
    checked: [0],
    stage: "Shot Checklist",
    outputPostId: null,
  });
  rows = [
    {
      id: "existing",
      title: "Saved original",
      body: original,
      status: "Draft",
      source: "starter",
      campaign_id: "campaign",
      updated_at: "revision-0",
    },
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options?: RequestInit) =>
      options?.method === "POST"
        ? Response.json(
            { error: "OpenAI credentials were rejected." },
            { status: 502 },
          )
        : Response.json({ configured: true }),
    ),
  );
  render(<Workspace />);
  await user.click(screen.getByRole("button", { name: "Saved original" }));
  await user.click(screen.getByRole("button", { name: "Production brief" }));
  await screen.findByText(/Live AI configured/);
  await user.click(
    screen.getByRole("button", { name: "Generate live AI plan" }),
  );
  await screen.findByText("OpenAI credentials were rejected.");
  await user.click(screen.getByRole("button", { name: "Storyboard" }));
  expect(
    (
      screen.getByRole("checkbox", {
        name: /Site or factory introduction/,
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
  expect(rows[0].body).toBe(original);
  expect(writes).toHaveLength(0);
});
