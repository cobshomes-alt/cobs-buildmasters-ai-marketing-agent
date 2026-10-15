import { beforeEach, afterEach, test, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
const state = vi.hoisted(() => ({
  role: "owner",
  assets: [] as any[],
  origin: "https://example.supabase.co",
  probeFile: "",
  broken: false,
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
        client: {
          from: () => ({
            select: () => ({
              in: async () => ({ data: state.assets, error: null }),
            }),
          }),
          storage: {
            from: () => ({
              createSignedUrl: async () => ({
                data: { signedUrl: state.origin + "/private" },
                error: null,
              }),
            }),
          },
        },
      };
    },
  };
});
vi.mock("../lib/render-worker.mjs", () => ({
  readiness: () => true,
  probe: async (file: string) => {
    state.probeFile = file;
    if (state.broken) throw Error("Invalid original");
    return {
      streams: [
        { codec_type: "video", codec_name: "png", width: 160, height: 120 },
      ],
      format: { duration: "N/A" },
    };
  },
}));
import { POST } from "../app/api/studio/plan/route";
let brief: any;
const request = (body = JSON.stringify(brief)) =>
  new Request("http://localhost/api/studio/plan", { method: "POST", body });
beforeEach(() => {
  state.role = "owner";
  state.origin = "https://example.supabase.co";
  state.probeFile = "";
  state.broken = false;
  const id = randomUUID();
  state.assets = [
    {
      id,
      storage_path: `11111111-1111-4111-8111-111111111111/${id}.png`,
      original_name: "Synthetic",
      mime_type: "image/png",
      size_bytes: 4,
      project: "Test",
      product: "",
    },
  ];
  brief = {
    instructions: "Create a professional promotion",
    mediaIds: [id],
    priorityIds: [],
    platforms: ["Instagram"],
    duration: 3,
    aspect: "9:16",
    style: "professional",
    companyInfo: "",
    narration: "",
    captions: true,
    branding: true,
    starts: {},
  };
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", state.origin);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("data")),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
test.each(["anon", "member"])(
  "%s cannot inspect or plan media",
  async (role) => {
    state.role = role;
    expect((await POST(request())).status).toBe(role === "anon" ? 401 : 403);
    expect(fetch).not.toHaveBeenCalled();
  },
);
test("owner plan contains actual probed facts and local temporary files are removed", async () => {
  const r = await POST(request());
  expect(r.status).toBe(200);
  const { plan } = await r.json();
  expect(plan.mode).toBe("rule-based");
  expect(plan.media[0].width).toBe(160);
  expect(plan.media[0].audio).toBe(false);
  expect(existsSync(state.probeFile)).toBe(false);
  expect(JSON.stringify(plan)).not.toContain("/private");
});
test.each(["foreign", "missing", "oversize", "deleted", "effect", "spoof"])(
  "rejects %s before private download",
  async (kind) => {
    if (kind === "foreign")
      state.assets[0].storage_path = "other-owner/secret.png";
    if (kind === "missing") state.assets = [];
    if (kind === "oversize") state.assets[0].size_bytes = 51 * 1024 * 1024;
    if (kind === "deleted") state.assets[0].deletion_pending = true;
    if (kind === "effect") brief.instructions = "Add zoom";
    if (kind === "spoof") brief.metadata = { duration: 100 };
    expect((await POST(request())).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  },
);
test("rejects large streaming brief, wrong origin and changed bytes", async () => {
  expect((await POST(request(" ".repeat(12001)))).status).toBe(413);
  state.origin = "https://evil.example";
  expect((await POST(request())).status).toBe(502);
  expect(fetch).not.toHaveBeenCalled();
  state.origin = "https://example.supabase.co";
  state.assets[0].size_bytes = 5;
  expect((await POST(request())).status).toBe(502);
});
test("probe failure cleans temporary copies and releases local inspection lock", async () => {
  state.broken = true;
  expect((await POST(request())).status).toBe(500);
  expect(existsSync(state.probeFile)).toBe(false);
  state.broken = false;
  expect((await POST(request())).status).toBe(200);
});
