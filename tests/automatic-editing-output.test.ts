import { test, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  mkdirSync,
  readFileSync,
  copyFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { moveClip } from "../lib/timeline";
const state = vi.hoisted(() => ({ assets: [] as any[] }));
vi.mock("../lib/server-auth", async (original) => {
  const auth = await original<typeof import("../lib/server-auth")>();
  return {
    ...auth,
    requireOwner: async () => ({
      user: { id: "11111111-1111-4111-8111-111111111111" },
      client: {
        from: () => ({
          select: () => ({
            in: async () => ({ data: state.assets, error: null }),
          }),
        }),
        storage: {
          from: () => ({
            createSignedUrl: async (path: string) => ({
              data: {
                signedUrl: `https://cobs-local-test.supabase.co/private/${path.split("/").at(-1)}`,
              },
              error: null,
            }),
          }),
        },
      },
    }),
  };
});
test("local owner plan API inspects six actual originals, validates edits and hands off to real capture/render API", async () => {
  vi.stubEnv(
    "COBS_RENDER_ROOT",
    resolve(".tools/automatic-api-" + randomUUID()),
  );
  vi.stubEnv("COBS_LOCAL_RENDER_ENABLED", "1");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://cobs-local-test.supabase.co");
  const worker = await import("../lib/render-worker.mjs");
  const { POST: plan } = await import("../app/api/studio/plan/route"),
    { POST: sequence } = await import("../app/api/studio/sequence/route");
  const dir = resolve(process.env.COBS_RENDER_ROOT!, "fixtures");
  mkdirSync(dir, { recursive: true });
  const colors = ["red", "yellow", "green", "purple", "blue", "cyan"],
    files = new Map<string, string>();
  let db: ReturnType<typeof worker.database> | undefined;
  try {
    for (let i = 0; i < 6; i++) {
      const id = randomUUID(),
        name = `${id}.${i % 2 ? "png" : "mp4"}`,
        file = resolve(dir, name);
      await worker.command(resolve(".tools/ffmpeg/ffmpeg.exe"), [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        `color=c=${colors[i]}:s=160x120:r=25:d=4`,
        ...(i % 2
          ? ["-frames:v", "1"]
          : ["-t", "4", "-c:v", "libx264", "-pix_fmt", "yuv420p"]),
        file,
      ]);
      files.set(name, file);
      state.assets.push({
        id,
        storage_path: `11111111-1111-4111-8111-111111111111/${name}`,
        original_name: `SYNTHETIC LOCAL API ${i}`,
        mime_type: i % 2 ? "image/png" : "video/mp4",
        size_bytes: statSync(file).size,
        project: "Synthetic test only",
        product: "",
        deletion_pending: false,
      });
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL | string) => {
        const u = new URL(String(url));
        if (u.origin !== "https://cobs-local-test.supabase.co")
          throw Error("Network forbidden in synthetic test");
        return new Response(
          readFileSync(files.get(u.pathname.split("/").at(-1)!)!),
        );
      }),
    );
    const brief = {
      instructions: "Create a professional factory promotion",
      mediaIds: state.assets.map((a) => a.id),
      priorityIds: [],
      platforms: ["Instagram", "TikTok"],
      duration: 12,
      aspect: "9:16",
      style: "professional",
      companyInfo: "",
      narration: "",
      captions: true,
      branding: true,
      starts: {},
    };
    const response = await plan(
      new Request("http://localhost/api/studio/plan", {
        method: "POST",
        body: JSON.stringify(brief),
      }),
    );
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(
      result.plan.media.filter((m: any) => m.duration !== null),
    ).toHaveLength(3);
    expect(
      result.plan.media.every((m: any) => m.width === 160 && m.height === 120),
    ).toBe(true);
    const doc = moveClip(
      result.plan.timeline,
      result.plan.timeline.clips[0].id,
      1,
    );
    doc.clips[0].recipe.duration = 2.5;
    doc.clips[0].recipe.captions = [
      { start: 0, end: 2.5, text: "OWNER EDITED SYNTHETIC PLAN" },
    ];
    db = worker.database();
    await worker.tick(db, "automatic-api-worker");
    const submitted = await sequence(
      new Request("http://localhost/api/studio/sequence", {
        method: "POST",
        body: JSON.stringify(doc),
      }),
    );
    expect(submitted.status).toBe(202);
    const { job } = await submitted.json();
    await worker.tick(db, "automatic-api-worker");
    const completed = worker.findJob(
      db,
      "11111111-1111-4111-8111-111111111111",
      job.id,
    )!;
    expect(completed.state).toBe("completed");
    const output = worker.outputPath(completed),
      info = await worker.probe(output);
    expect([info.streams[0].width, info.streams[0].height]).toEqual([
      720, 1280,
    ]);
    expect(Number(info.streams[0].nb_frames)).toBeGreaterThanOrEqual(312);
    expect(Math.abs(Number(info.format.duration) - 12.5)).toBeLessThan(0.3);
    await worker.command(resolve(".tools/ffmpeg/ffmpeg.exe"), [
      "-v",
      "error",
      "-xerror",
      "-i",
      output,
      "-f",
      "null",
      "-",
    ]);
    const delivery = resolve(".tools/delivery/media-studio");
    mkdirSync(delivery, { recursive: true });
    copyFileSync(
      output,
      resolve(delivery, "synthetic-automatic-api-vertical.mp4"),
    );
    writeFileSync(
      resolve(delivery, "automatic-api-verification.json"),
      JSON.stringify(
        {
          scope:
            "Actual local plan and render APIs, real FFmpeg metadata/output; mocked owner auth and private transfers, no hosted writes",
          plan: result.plan,
          edited: doc,
          duration: Number(info.format.duration),
          dimensions: [720, 1280],
          fullDecode: "passed",
        },
        null,
        2,
      ),
    );
  } finally {
    db?.close();
    state.assets = [];
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
}, 180000);
