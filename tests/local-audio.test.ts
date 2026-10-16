import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
const state = vi.hoisted(() => ({ role: "owner" }));
vi.mock("../lib/server-auth", async (original) => {
  const auth = await original<typeof import("../lib/server-auth")>();
  return {
    ...auth,
    requireOwner: async () => {
      if (state.role !== "owner")
        throw new auth.HttpError(
          state.role === "anon" ? 401 : 403,
          "Owner only",
        );
      return {
        user: { id: "11111111-1111-4111-8111-111111111111" },
        client: {},
      };
    },
  };
});
process.env.COBS_RENDER_ROOT = resolve(".tools/audio-tests-" + randomUUID());
process.env.COBS_LOCAL_RENDER_ENABLED = "1";
const { POST } = await import("../app/api/studio/audio/route");
const worker = await import("../lib/render-worker.mjs");
const { resolveAudio, audioFile } = await import("../lib/local-audio");
const request = (body: Buffer | string, type = "audio/wav") =>
  new Request("http://localhost/api/studio/audio", {
    method: "POST",
    headers: {
      "Content-Type": type,
      "X-Audio-Name": "Synthetic%20licensed.wav",
    },
    body: typeof body === "string" ? body : Uint8Array.from(body),
  });
beforeEach(() => {
  state.role = "owner";
});
afterEach(() => vi.unstubAllGlobals());
test.each(["anon", "member"])("%s cannot capture audio", async (role) => {
  state.role = role;
  expect((await POST(request("not audio"))).status).toBe(
    role === "anon" ? 401 : 403,
  );
});
test("actual WAV capture is private, owner scoped, bounded and expires without modifying the input original", async () => {
  mkdirSync(worker.ROOT, { recursive: true });
  const fixture = join(worker.ROOT, "synthetic.wav");
  await worker.command(resolve(".tools/ffmpeg/ffmpeg.exe"), [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=220:sample_rate=48000:duration=1",
    fixture,
  ]);
  const original = readFileSync(fixture),
    r = await POST(request(original));
  expect(r.status).toBe(200);
  const result = await r.json();
  expect(result.duration).toBeCloseTo(1);
  const db = worker.database(),
    tracks = [
      {
        id: result.id,
        kind: "music" as const,
        volume: 0.2,
        offset: 0,
        fade: 0.2,
        loop: true,
      },
    ];
  expect(
    resolveAudio(db, "11111111-1111-4111-8111-111111111111", tracks),
  ).toHaveLength(1);
  expect(() => resolveAudio(db, "foreign-owner", tracks)).toThrow(
    /unavailable/,
  );
  db.prepare("UPDATE local_audio SET created=0 WHERE id=?").run(result.id);
  expect(() =>
    resolveAudio(db, "11111111-1111-4111-8111-111111111111", tracks),
  ).toThrow(/expired/);
  worker.cleanup(db);
  expect(existsSync(audioFile(result.id))).toBe(false);
  const mp3 = join(worker.ROOT, "synthetic.mp3");
  await worker.command(resolve(".tools/ffmpeg/ffmpeg.exe"), [
    "-v",
    "error",
    "-i",
    fixture,
    "-c:a",
    "libmp3lame",
    mp3,
  ]);
  const mp3Response = await POST(request(readFileSync(mp3), "audio/mpeg"));
  expect(mp3Response.status).toBe(200);
  const mp3Info = await mp3Response.json();
  expect(mp3Info.duration).toBeGreaterThan(0.9);
  expect(mp3Info.duration).toBeLessThan(1.2);
  expect(readFileSync(fixture)).toEqual(original);
  db.close();
});
test("invalid payloads, unsupported MIME and oversized audio fail without registering originals", async () => {
  expect(
    (await POST(request("invalid", "application/octet-stream"))).status,
  ).toBe(400);
  expect((await POST(request("not a wave"))).status).toBe(400);
  expect((await POST(request(Buffer.alloc(10 * 1024 * 1024 + 1)))).status).toBe(
    400,
  );
});
