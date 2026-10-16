import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
const state = vi.hoisted(() => ({
  role: "owner",
  post: null as any,
  client: {} as any,
}));
vi.mock("../lib/server-auth", async (original) => {
  const auth = await original<typeof import("../lib/server-auth")>();
  return {
    ...auth,
    requireOwner: async () => {
      if (state.role !== "owner")
        throw new auth.HttpError(
          state.role === "anon" ? 401 : 403,
          "Owner required",
        );
      return {
        user: { id: "11111111-1111-4111-8111-111111111111" },
        client: state.client,
      };
    },
  };
});
process.env.COBS_RENDER_ROOT = resolve(".tools/operations-api-" + randomUUID());
const { GET, POST } = await import("../app/api/marketing-operations/route");
const request = (body: unknown) =>
  new Request("http://localhost/api/marketing-operations", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  state.role = "owner";
  state.post = {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Synthetic",
    body: "Verified copy",
    status: "Approved",
    updated_at: "2026-10-15T00:00:00Z",
    approved_by: "11111111-1111-4111-8111-111111111111",
    approved_at: "2026-10-15T00:00:00Z",
  };
  state.client = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: state.post, error: null }),
        }),
        order: () => ({
          limit: async () => ({ data: [state.post], error: null }),
        }),
        limit: async () => ({
          data: table === "cobs_campaigns" ? [] : [],
          error: null,
        }),
      }),
    }),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw Error("External request forbidden");
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());
test.each(["anon", "member"])(
  "%s cannot access operational reads or writes",
  async (role) => {
    state.role = role;
    expect((await GET(new Request("http://localhost"))).status).toBe(
      role === "anon" ? 401 : 403,
    );
    expect((await POST(request({ action: "task" }))).status).toBe(
      role === "anon" ? 401 : 403,
    );
    expect(fetch).not.toHaveBeenCalled();
  },
);
test("prepare/review/retry remain blocked and make no external requests; GET has unavailable analytics", async () => {
  const body = {
    action: "prepare",
    postId: state.post.id,
    platforms: ["Instagram"],
    captions: { Instagram: "Owner-adapted caption" },
    mode: "now",
  };
  const a = await POST(request(body));
  expect(a.status).toBe(200);
  let j = (await a.json()).results[0].job;
  expect(j.state).toBe("awaiting_review");
  expect((await (await POST(request(body))).json()).results[0].duplicate).toBe(
    true,
  );
  j = (
    await (
      await POST(request({ action: "review", id: j.id, revision: j.revision }))
    ).json()
  ).job;
  expect(j.state).toBe("blocked_provider");
  expect(
    (await POST(request({ action: "review", id: j.id, revision: 1 }))).status,
  ).toBe(409);
  const read = await (await GET(new Request("http://localhost"))).json();
  expect(read.analytics.impressions).toBeNull();
  expect(
    read.integrations.every((i: any) => !i.connected && !i.liveVerified),
  ).toBe(true);
  state.post.status = "Draft";
  expect(
    (
      await POST(
        request({
          action: "report",
          id: j.id,
          revision: j.revision,
          url: "https://instagram.com/p/test",
        }),
      )
    ).status,
  ).toBe(409);
  expect(fetch).not.toHaveBeenCalled();
});
test("rejects unsupported channels, past scheduling, absent captions and oversized requests", async () => {
  const base = {
    action: "prepare",
    postId: state.post.id,
    platforms: ["FakePlatform"],
    captions: {},
    mode: "now",
  };
  expect((await POST(request(base))).status).toBe(400);
  expect(
    (
      await POST(
        request({
          ...base,
          platforms: ["Instagram"],
          captions: { Instagram: "Copy" },
          mode: "schedule",
          scheduleAt: "2000-01-01",
        }),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await POST(
        request({
          action: "task",
          objective: " ",
          template: "local",
          campaignId: null,
        }),
      )
    ).status,
  ).toBe(400);
  expect((await POST(request({ large: "x".repeat(16000) }))).status).toBe(413);
});
