import { beforeEach, afterEach, test, expect, vi } from "vitest";
import { POST as generate } from "../app/api/generate/route";
import {
  POST as creative,
  GET as creativeStatus,
} from "../app/api/creative-director/route";
import { samplePlan, type Brief } from "../lib/creative-plan";
import { POST as media } from "../app/api/media/route";
import { matchesSignature, validateMedia, MAX_MEDIA_BYTES } from "../lib/media";
import {
  extractGeneratedText,
  splitGeneratedPost,
} from "../lib/generated-post";

const mocks = vi.hoisted(() => ({
  role: "owner",
  valid: true,
  client: {} as any,
  profile: {} as any,
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => mocks.client }));
const uid = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon");
  vi.stubEnv("OPENAI_API_KEY", "");
  mocks.role = "owner";
  mocks.valid = true;
  mocks.client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: mocks.valid ? { id: uid } : null },
        error: null,
      })),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { role: mocks.role },
            error: null,
          }),
        }),
      }),
    }),
    storage: {
      from: () => ({
        createSignedUploadUrl: async (path: string) => ({
          data: { path, token: "signed-token" },
          error: null,
        }),
      }),
    },
  };
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const request = (body: unknown, auth = true) =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: "Bearer owner-token" } : {}),
    },
    body: JSON.stringify(body),
  });

const planningBrief: Brief = {
  topic: "Film factory",
  project: "",
  evidence: "",
  period: "week",
  style: "Educational",
  length: "15–30 seconds",
  platforms: ["Instagram"],
  startDate: "2026-10-15",
};
test("creative director enforces owner authentication and reports missing AI honestly", async () => {
  expect((await creative(request(planningBrief, false))).status).toBe(401);
  mocks.role = "member";
  expect((await creative(request(planningBrief))).status).toBe(403);
  expect((await creativeStatus(request({}))).status).toBe(403);
  mocks.role = "owner";
  expect(await (await creativeStatus(request({}))).json()).toEqual({
    configured: false,
  });
  expect((await creative(request(planningBrief))).status).toBe(503);
  expect(
    (await creative(request({ ...planningBrief, platforms: [] }))).status,
  ).toBe(400);
});
test("creative AI uses server-side structured output and rejects malformed or failed responses", async () => {
  vi.stubEnv("OPENAI_API_KEY", "fake-test-key");
  const provider = vi.fn(async () =>
    Response.json({ output_text: JSON.stringify(samplePlan(planningBrief)) }),
  );
  vi.stubGlobal("fetch", provider);
  const result = await creative(request(planningBrief));
  expect(result.status).toBe(200);
  expect((await result.json()).source).toBe("ai");
  const options = provider.mock.calls[0] as unknown as [string, RequestInit];
  const payload = JSON.parse(options[1].body as string);
  expect(payload.store).toBe(false);
  expect(payload.text.format.strict).toBe(true);
  expect(payload.max_output_tokens).toBe(3500);
  provider.mockImplementation(async () =>
    Response.json({ output_text: "not a plan" }),
  );
  expect((await creative(request(planningBrief))).status).toBe(502);
  provider.mockImplementation(async () => Response.json({}, { status: 401 }));
  const rejected = await creative(request(planningBrief));
  expect(await rejected.text()).not.toContain("fake-test-key");
  expect(rejected.status).toBe(502);
});

test("creative AI rejects calendar mismatch and incomplete output without substituting a sample", async () => {
  vi.stubEnv("OPENAI_API_KEY", "fake-test-key");
  const provider = vi.fn(async () =>
    Response.json({
      output_text: JSON.stringify(
        samplePlan({ ...planningBrief, period: "month" }),
      ),
    }),
  );
  vi.stubGlobal("fetch", provider);
  expect((await creative(request(planningBrief))).status).toBe(502);
  provider.mockImplementation(async () =>
    Response.json({ status: "incomplete" }),
  );
  expect((await creative(request(planningBrief))).status).toBe(502);
  provider.mockImplementation(async () => Response.json({}, { status: 429 }));
  expect(await (await creative(request(planningBrief))).text()).toContain(
    "quota or rate limit",
  );
});

test("creative AI guards overlapping owner requests and releases the guard after completion", async () => {
  vi.stubEnv("OPENAI_API_KEY", "fake-test-key");
  let complete!: (response: Response) => void;
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      started();
      return new Promise<Response>((resolve) => {
        complete = resolve;
      });
    }),
  );
  const first = creative(request(planningBrief));
  await ready;
  expect((await creative(request(planningBrief))).status).toBe(429);
  complete(
    Response.json({ output_text: JSON.stringify(samplePlan(planningBrief)) }),
  );
  expect((await first).status).toBe(200);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ output_text: JSON.stringify(samplePlan(planningBrief)) }),
    ),
  );
  expect((await creative(request(planningBrief))).status).toBe(200);
});
test("API denies anonymous, expired and nonowner sessions", async () => {
  expect((await generate(request({}, false))).status).toBe(401);
  expect((await media(request({}, false))).status).toBe(401);
  mocks.valid = false;
  expect((await generate(request({}))).status).toBe(401);
  mocks.valid = true;
  mocks.role = "member";
  expect((await generate(request({}))).status).toBe(403);
  expect((await media(request({}))).status).toBe(403);
});
test("missing configuration and malformed requests are clear", async () => {
  expect((await generate(request([]))).status).toBe(400);
  expect((await media(request([]))).status).toBe(400);
  expect((await generate(request({ topic: 23 }))).status).toBe(400);
  const missing = await generate(request({ topic: "Blocks" }));
  expect(missing.status).toBe(503);
  expect((await missing.json()).error).toContain("not configured");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  expect((await generate(request({}))).status).toBe(503);
});
test("AI uses authenticated server provider request and parses actual output", async () => {
  vi.stubEnv("OPENAI_API_KEY", "secret-test-key");
  const fetchMock = vi.fn(async () =>
    Response.json({
      output: [
        {
          content: [
            {
              type: "output_text",
              text: "Title: Strong foundations\nCaption: Build with COBS.",
            },
          ],
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const result = await generate(request({ topic: "Concrete blocks" }));
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({
    title: "Strong foundations",
    body: "Build with COBS.",
    source: "ai",
  });
  const options = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(JSON.parse(options[1].body as string).store).toBe(false);
});
test.each([401, 429, 500])(
  "provider failure %s never returns a fake success",
  async (status) => {
    vi.stubEnv("OPENAI_API_KEY", "test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: { message: "sensitive provider detail" } },
          { status },
        ),
      ),
    );
    const response = await generate(request({}));
    const payload = await response.json();
    expect(response.status).toBe(502);
    expect(payload.source).toBeUndefined();
    expect(payload.error).not.toContain("sensitive");
  },
);
test("empty provider output and network failure are handled", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ output: [] })),
  );
  expect((await generate(request({}))).status).toBe(502);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("offline");
    }),
  );
  expect((await generate(request({}))).status).toBe(503);
});
test("upload validation enforces type, size, owner path and file signatures", async () => {
  expect(validateMedia("x.jpg", "image/jpeg", MAX_MEDIA_BYTES)).toBeNull();
  expect(
    validateMedia("x.jpg", "image/jpeg", MAX_MEDIA_BYTES + 1),
  ).toBeTruthy();
  expect(validateMedia("x.svg", "image/svg+xml", 100)).toBeTruthy();
  expect(
    matchesSignature(new Uint8Array([255, 216, 255, 0]), "image/jpeg"),
  ).toBe(true);
  expect(
    matchesSignature(new Uint8Array([60, 115, 118, 103]), "image/jpeg"),
  ).toBe(false);
  const prepared = await media(
    request({
      action: "prepare",
      name: "blocks.jpg",
      type: "image/jpeg",
      size: 100,
    }),
  );
  expect(prepared.status).toBe(200);
  expect((await prepared.json()).path).toMatch(new RegExp(`^${uid}/.*\\.jpg$`));
  expect(
    (
      await media(
        request({ action: "prepare", name: "x", type: "text/html", size: 100 }),
      )
    ).status,
  ).toBe(400);
  expect(
    (await media(request({ action: "complete", path: "../other.jpg" }))).status,
  ).toBe(400);
});
test("text parser rejects unusable captions", () => {
  expect(validateMedia("x", "constructor", 100)).toBeTruthy();
  expect(splitGeneratedPost("only one line")).toBeNull();
  expect(extractGeneratedText({ output: [] })).toBe("");
});

test("media completion checks stored metadata and bytes before registering", async () => {
  const from = mocks.client.from;
  const insert = vi.fn(() => ({
    select: () => ({
      single: async () => ({ data: { id: "asset-1" }, error: null }),
    }),
  }));
  mocks.client.from = (table: string) =>
    table === "cobs_profiles" ? from(table) : { insert };
  const info = vi.fn(async () => ({
    data: { size: 4, contentType: "image/jpeg" },
    error: null,
  }));
  mocks.client.storage.from = () => ({
    info,
    createSignedUrl: async () => ({
      data: { signedUrl: "https://storage.test/file" },
      error: null,
    }),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Uint8Array([255, 216, 255, 0]))),
  );
  const body = {
    action: "complete",
    path: `${uid}/33333333-3333-4333-8333-333333333333.jpg`,
    name: "blocks.jpg",
    type: "image/jpeg",
    size: 4,
    project: "Factory",
    product: "Blocks",
  };
  const result = await media(request(body));
  expect(result.status).toBe(200);
  expect(insert).toHaveBeenCalledWith(
    expect.objectContaining({
      created_by: uid,
      project: "Factory",
      product: "Blocks",
      size_bytes: 4,
    }),
  );
  insert.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Uint8Array([60, 115, 118, 103]))),
  );
  expect((await media(request(body))).status).toBe(400);
  expect(insert).not.toHaveBeenCalled();
  expect((await media(request({ ...body, size: 5 }))).status).toBe(400);
  expect(insert).not.toHaveBeenCalled();
});
