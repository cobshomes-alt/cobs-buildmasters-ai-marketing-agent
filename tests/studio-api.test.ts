import { beforeEach, test, expect, vi } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { encodeEdit, defaultRecipe } from "../lib/studio-model.mjs";
const state = vi.hoisted(() => ({
  owner: "11111111-1111-4111-8111-111111111111",
  client: {} as any,
  row: null as any,
  duplicate: false,
  root: "",
  phase: "",
  closed: 0,
}));
vi.mock("../lib/server-auth", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requireOwner: async () => ({
    user: { id: state.owner },
    client: state.client,
  }),
}));
vi.mock("../lib/render-worker.mjs", () => ({
  MAX_BYTES: 50 * 1024 * 1024,
  readiness: () => true,
  database: () => ({
    prepare: () => ({ get: () => ({ heartbeat: Date.now() }) }),
    close: () => {
      state.closed++;
    },
  }),
  listJobs: () => [],
  findJob: (_db: unknown, owner: string, id: string) =>
    state.row?.owner === owner && state.row.id === id ? state.row : undefined,
  publicJob: (_db: unknown, row: unknown) => row,
  renderKey: () => "stable-key",
  reserve: () => ({ row: state.row, duplicate: state.duplicate }),
  inputPath: () => join(state.root, "input"),
  outputPath: () => join(state.root, "output.png"),
  setState: (
    _db: unknown,
    _id: string,
    phase: string,
    _error: unknown,
    expected?: string,
  ) => {
    if (expected && state.row.state !== expected) return;
    state.row.state = phase;
    state.phase = phase;
  },
  cancel: () => null,
}));
import { POST, GET } from "../app/api/studio/route";
const projectId = "22222222-2222-4222-8222-222222222222",
  mediaId = "33333333-3333-4333-8333-333333333333";
let project: any, asset: any;
const request = () =>
  new Request("http://localhost/api/studio", {
    method: "POST",
    body: JSON.stringify({
      action: "render",
      projectId,
      updatedAt: "2026-10-15T12:00:00Z",
    }),
  });
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  state.owner = "11111111-1111-4111-8111-111111111111";
  state.root = resolve(".tools/studio-api-" + randomUUID());
  mkdirSync(state.root, { recursive: true });
  state.duplicate = false;
  state.closed = 0;
  state.row = {
    id: randomUUID(),
    owner: state.owner,
    state: "receiving",
    kind: "image",
    updated: Date.now(),
  };
  project = {
    id: projectId,
    body: encodeEdit(defaultRecipe()),
    media_id: mediaId,
    status: "Draft",
    updated_at: "2026-10-15T12:00:00Z",
  };
  asset = {
    id: mediaId,
    storage_path: `${state.owner}/${mediaId}.png`,
    size_bytes: 4,
    mime_type: "image/png",
  };
  state.client = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: table === "cobs_posts" ? project : asset,
            error: null,
          }),
        }),
      }),
    }),
    storage: {
      from: () => ({
        createSignedUrl: async () => ({
          data: {
            signedUrl:
              "https://example.supabase.co/storage/v1/object/sign/cobs-media/source?token=fake",
          },
          error: null,
        }),
      }),
    },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Uint8Array([1, 2, 3, 4]))),
  );
});
test("authorized export downloads registered private original, queues after full transfer and avoids duplicate transfers", async () => {
  const response = await POST(request());
  expect(response.status).toBe(202);
  expect(state.phase).toBe("pending");
  expect([...readFileSync(join(state.root, "input"))]).toEqual([1, 2, 3, 4]);
  expect(state.closed).toBe(1);
  state.duplicate = true;
  vi.mocked(fetch).mockClear();
  expect((await POST(request())).status).toBe(200);
  expect(fetch).not.toHaveBeenCalled();
});
test("export rejects missing recipes, mismatched owner paths, oversized media and changed transfers", async () => {
  project.body = "ordinary social post";
  expect((await POST(request())).status).toBe(400);
  project.body = encodeEdit(defaultRecipe());
  asset.storage_path = `another-owner/${mediaId}.png`;
  expect((await POST(request())).status).toBe(400);
  asset.storage_path = `${state.owner}/${mediaId}.png`;
  asset.size_bytes = 51 * 1024 * 1024;
  expect((await POST(request())).status).toBe(400);
  asset.size_bytes = 5;
  expect((await POST(request())).status).toBe(502);
  expect(state.phase).toBe("failed");
});
test("single-source route rejects timed captions rather than silently omitting them", async () => {
  project.body = encodeEdit({
    ...defaultRecipe(),
    captions: [{ start: 0, end: 1, text: "Synthetic" }],
  });
  expect((await POST(request())).status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
});
test("unexpected signed URL origin fails closed without making a network request", async () => {
  state.client.storage.from = () => ({
    createSignedUrl: async () => ({
      data: { signedUrl: "https://attacker.example/file" },
      error: null,
    }),
  });
  expect((await POST(request())).status).toBe(502);
  expect(fetch).not.toHaveBeenCalled();
});
test("render refuses a stale saved-project revision", async () => {
  project.updated_at = "2026-10-15T13:00:00Z";
  expect((await POST(request())).status).toBe(409);
  expect(fetch).not.toHaveBeenCalled();
});
test("cancellation during source transfer is not overwritten by queue acceptance", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      state.row.state = "cancelled";
      return new Response(new Uint8Array([1, 2, 3, 4]));
    }),
  );
  const response = await POST(request());
  expect(response.status).toBe(202);
  expect((await response.json()).job.state).toBe("cancelled");
});
test("oversized or malformed request is rejected before source transfer", async () => {
  expect(
    (
      await POST(
        new Request("http://localhost/api/studio", {
          method: "POST",
          body: "x".repeat(3000),
        }),
      )
    ).status,
  ).toBe(413);
  expect(
    (
      await POST(
        new Request("http://localhost/api/studio", {
          method: "POST",
          body: "{",
        }),
      )
    ).status,
  ).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
});
test("download requires matching owner and completed job and returns private no-store bytes", async () => {
  state.row.state = "completed";
  writeFileSync(join(state.root, "output.png"), "synthetic");
  const url = `http://localhost/api/studio?download=${state.row.id}`;
  const response = await GET(new Request(url));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.text()).toBe("synthetic");
  state.owner = "44444444-4444-4444-8444-444444444444";
  expect((await GET(new Request(url))).status).toBe(404);
});
