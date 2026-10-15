import { beforeEach, afterEach, test, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { defaultRecipe } from "../lib/studio-model.mjs";
const state = vi.hoisted(() => ({
  role: "owner",
  client: {} as any,
  row: null as any,
  duplicate: false,
  recipe: null as any,
  root: "",
  reserved: 0,
  workerVersion: 2,
}));
vi.mock("../lib/server-auth", async (original) => {
  const auth = await original<typeof import("../lib/server-auth")>();
  return {
    ...auth,
    requireOwner: async () => {
      if (state.role !== "owner")
        throw new auth.HttpError(
          state.role === "anon" ? 401 : 403,
          "Owner access required.",
        );
      return {
        user: { id: "11111111-1111-4111-8111-111111111111" },
        client: state.client,
      };
    },
  };
});
vi.mock("../lib/render-worker.mjs", () => ({
  readiness: () => true,
  database: () => ({
    prepare: () => ({
      get: () => ({
        version: state.workerVersion,
        token: "test-worker",
        capability_token: "test-worker",
        heartbeat: Date.now(),
      }),
    }),
    close: () => {},
  }),
  reserve: (_db: unknown, _owner: string, _key: string, recipe: unknown) => {
    state.reserved++;
    state.recipe = recipe;
    return { row: state.row, duplicate: state.duplicate };
  },
  renderKey: () => "stable",
  publicJob: (_db: unknown, row: unknown) => row,
  findJob: () => state.row,
  setState: (
    _db: unknown,
    _id: string,
    next: string,
    _error: unknown,
    expected: string,
  ) => {
    if (state.row.state === expected) state.row.state = next;
  },
  sequenceInputPath: (_id: string, index: number) =>
    join(state.root, `input-${index}`),
}));
import { POST } from "../app/api/studio/sequence/route";
const owner = "11111111-1111-4111-8111-111111111111",
  media = "22222222-2222-4222-8222-222222222222";
let assets: any[], doc: any;
const request = (body = JSON.stringify(doc)) =>
  new Request("http://localhost/api/studio/sequence", { method: "POST", body });
beforeEach(() => {
  state.role = "owner";
  state.root = resolve(".tools/sequence-api-" + randomUUID());
  mkdirSync(state.root, { recursive: true });
  state.duplicate = false;
  state.reserved = 0;
  state.workerVersion = 2;
  state.row = { id: randomUUID(), owner, state: "receiving", kind: "video" };
  assets = [
    {
      id: media,
      storage_path: `${owner}/${media}.png`,
      mime_type: "image/png",
      size_bytes: 4,
    },
  ];
  doc = {
    version: 1,
    id: randomUUID(),
    title: "Synthetic only",
    campaignId: null,
    aspect: "1:1",
    clips: [
      {
        id: randomUUID(),
        mediaId: media,
        kind: "image",
        label: "Synthetic",
        recipe: { ...defaultRecipe(), aspect: "1:1", duration: 1 },
      },
    ],
  };
  state.client = {
    from: vi.fn(() => ({
      select: () => ({ in: async () => ({ data: assets, error: null }) }),
    })),
    storage: {
      from: () => ({
        createSignedUrl: vi.fn(async () => ({
          data: {
            signedUrl:
              "https://example.supabase.co/storage/v1/object/sign/cobs-media/test?token=mock",
          },
          error: null,
        })),
      }),
    },
  };
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("data")),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
test.each([2, 3])(
  "timed captions require worker v3 (actual simulated version %s)",
  async (version) => {
    state.workerVersion = version;
    doc.clips[0].recipe.captions = [
      { start: 0, end: 1, text: "Synthetic cue" },
    ];
    expect((await POST(request())).status).toBe(version === 3 ? 202 : 503);
  },
);
test("an old worker is rejected before metadata lookup or reservation", async () => {
  state.workerVersion = 1;
  expect((await POST(request())).status).toBe(503);
  expect(state.client.from).not.toHaveBeenCalled();
  expect(state.reserved).toBe(0);
});
test("an oversized declared body is rejected without locking its stream", async () => {
  const req = new Request("http://localhost/api/studio/sequence", {
    method: "POST",
    headers: { "content-length": "48001" },
    body: "{}",
  });
  expect((await POST(req)).status).toBe(413);
  expect(req.body?.locked).toBe(false);
});
test("captures each unique source once and queues only sanitized snapshots", async () => {
  doc.clips.push({
    ...doc.clips[0],
    id: randomUUID(),
    recipe: { ...doc.clips[0].recipe, secret: "not-for-queue" },
  });
  const response = await POST(request());
  expect(response.status).toBe(202);
  expect(state.row.state).toBe("pending");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(readFileSync(join(state.root, "input-0"), "utf8")).toBe("data");
  expect(JSON.stringify(state.recipe)).not.toContain("not-for-queue");
  expect(fetch).toHaveBeenCalledWith(
    expect.any(URL),
    expect.objectContaining({
      redirect: "error",
      cache: "no-store",
      signal: expect.any(AbortSignal),
    }),
  );
});
test.each(["anon", "member"])(
  "%s cannot enqueue or read original metadata",
  async (role) => {
    state.role = role;
    const response = await POST(request());
    expect(response.status).toBe(role === "anon" ? 401 : 403);
    expect(state.client.from).not.toHaveBeenCalled();
    expect(state.reserved).toBe(0);
  },
);
test.each([
  "foreign-path",
  "missing",
  "deleted",
  "wrong-kind",
  "too-large",
  "zero",
])("rejects %s before capturing any source", async (reason) => {
  if (reason === "foreign-path")
    assets[0].storage_path = `${media}/${media}.png`;
  if (reason === "missing") assets = [];
  if (reason === "deleted") assets[0].deletion_pending = true;
  if (reason === "wrong-kind") assets[0].mime_type = "video/mp4";
  if (reason === "too-large") assets[0].size_bytes = 50 * 1024 * 1024 + 1;
  if (reason === "zero") assets[0].size_bytes = 0;
  expect((await POST(request())).status).toBeGreaterThanOrEqual(400);
  expect(state.reserved).toBe(0);
  expect(fetch).not.toHaveBeenCalled();
});
test("signed URL origin cannot redirect capture to another host", async () => {
  state.client.storage.from = () => ({
    createSignedUrl: async () => ({
      data: { signedUrl: "https://evil.invalid/private" },
      error: null,
    }),
  });
  expect((await POST(request())).status).toBe(502);
  expect(fetch).not.toHaveBeenCalled();
  expect(state.row.state).toBe("failed");
});
test.each(["short", "long", "failed"])(
  "partial or failed %s capture never becomes pending",
  async (mode) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            mode === "short" ? "x" : mode === "long" ? "extra-data" : "",
            { status: mode === "failed" ? 403 : 200 },
          ),
      ),
    );
    expect((await POST(request())).status).toBe(502);
    expect(state.row.state).toBe("failed");
  },
);
test("duplicate snapshot does not download again", async () => {
  state.duplicate = true;
  state.row.state = "pending";
  expect((await POST(request())).status).toBe(200);
  expect(fetch).not.toHaveBeenCalled();
  expect(existsSync(join(state.root, "input-0"))).toBe(false);
});
test("cancellation during capture cannot be overwritten by pending", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      state.row.state = "cancelled";
      return new Response("data");
    }),
  );
  expect((await POST(request())).status).toBe(202);
  expect(state.row.state).toBe("cancelled");
});
test("oversized requests and invalid timelines are rejected before reservation", async () => {
  expect((await POST(request("x".repeat(48001)))).status).toBe(413);
  doc.clips[0].mediaId = "file:///private";
  expect((await POST(request())).status).toBe(400);
  expect(state.reserved).toBe(0);
});
