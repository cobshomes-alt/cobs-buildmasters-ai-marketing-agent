import { test, expect } from "vitest";
import { resolve } from "node:path";
import {
  copyFileSync,
  readFileSync,
  writeFileSync,
  statSync,
  existsSync,
} from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { defaultRecipe, DIMENSIONS } from "../lib/studio-model.mjs";
// All inputs and queue state are synthetic and isolated under ignored local tools.
process.env.COBS_RENDER_ROOT = resolve(".tools/render-test-" + randomUUID());
process.env.COBS_LOCAL_RENDER_ENABLED = "1";
const worker = await import("../lib/render-worker.mjs");
const ffmpeg = resolve(".tools/ffmpeg/ffmpeg.exe");
const db = worker.database(),
  owner = "11111111-1111-4111-8111-111111111111";
test("real PNG includes edits, preserves original and exports exact dimensions", async () => {
  expect(worker.readiness()).toBe(true);
  const recipe = {
    ...defaultRecipe(),
    aspect: "1:1" as const,
    brightness: 0.2,
    contrast: 1.1,
    saturation: 0.8,
    text: "Synthetic fixture: 100% safe",
    subtitle: "Not company footage",
  };
  const { row } = worker.reserve(db, owner, randomUUID(), recipe, "image", 1);
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:s=100x100",
    "-frames:v",
    "1",
    worker.inputPath(row.id) + ".png",
  ]);
  copyFileSync(worker.inputPath(row.id) + ".png", worker.inputPath(row.id));
  const before = createHash("sha256")
    .update(readFileSync(worker.inputPath(row.id)))
    .digest("hex");
  worker.setState(db, row.id, "pending");
  expect(await worker.tick(db, "test-worker")).toBe(true);
  const result = worker.findJob(db, owner, row.id)!;
  expect(result.state).toBe("completed");
  const info = await worker.probe(worker.outputPath(result));
  expect(info.streams[0]).toMatchObject({
    codec_name: "png",
    width: 720,
    height: 720,
  });
  expect(
    createHash("sha256")
      .update(readFileSync(worker.inputPath(row.id)))
      .digest("hex"),
  ).toBe(before);
  const raw = worker.inputPath(row.id) + ".rgb";
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-i",
    worker.outputPath(result),
    "-vf",
    "crop=1:1:350:350",
    "-pix_fmt",
    "rgb24",
    "-f",
    "rawvideo",
    raw,
  ]);
  const pixel = readFileSync(raw);
  expect(pixel[0]).toBeGreaterThan(20);
  expect(pixel[2]).toBeGreaterThan(220);
  const logoPixel = worker.inputPath(row.id) + ".logo.rgb";
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-i",
    worker.outputPath(result),
    "-vf",
    "crop=1:1:585:585",
    "-pix_fmt",
    "rgb24",
    "-f",
    "rawvideo",
    logoPixel,
  ]);
  expect([...readFileSync(logoPixel)].every((channel) => channel > 250)).toBe(
    true,
  );
  expect(statSync(worker.outputPath(result)).size).toBeGreaterThan(1000);
}, 120000);

test("all four aspect ratios render real files", async () => {
  db.prepare("UPDATE worker SET heartbeat=0 WHERE id=1").run();
  for (const aspect of Object.keys(DIMENSIONS) as (keyof typeof DIMENSIONS)[]) {
    const { row } = worker.reserve(
      db,
      owner,
      randomUUID(),
      {
        ...defaultRecipe(),
        aspect,
        watermark: false,
        fit: "cover",
        position: 0,
      },
      "image",
      1,
    );
    const fixture = worker.inputPath(row.id) + ".png";
    await worker.command(ffmpeg, [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=320x240:rate=1",
      "-frames:v",
      "1",
      fixture,
    ]);
    copyFileSync(fixture, worker.inputPath(row.id));
    worker.setState(db, row.id, "pending");
    await worker.tick(db, "test-worker");
    const result = worker.findJob(db, owner, row.id)!;
    expect(result.state).toBe("completed");
    const info = await worker.probe(worker.outputPath(result));
    expect([info.streams[0].width, info.streams[0].height]).toEqual(
      DIMENSIONS[aspect],
    );
  }
}, 120000);

test("daily and monthly local usage limits can be lowered and cannot be silently raised", () => {
  process.env.COBS_RENDER_DAILY_LIMIT = "1";
  expect(() =>
    worker.reserve(db, owner, randomUUID(), defaultRecipe(), "image", 1),
  ).toThrow(/limit/);
  process.env.COBS_RENDER_DAILY_LIMIT = "999";
  expect(worker.limits().daily).toBe(20);
  delete process.env.COBS_RENDER_DAILY_LIMIT;
  process.env.COBS_RENDER_MONTHLY_BYTES = String(1024 * 1024);
  db.prepare(
    "UPDATE jobs SET bytes=? WHERE id=(SELECT id FROM jobs LIMIT 1)",
  ).run(1024 * 1024);
  expect(() =>
    worker.reserve(db, owner, randomUUID(), defaultRecipe(), "image", 1),
  ).toThrow(/limit/);
  delete process.env.COBS_RENDER_MONTHLY_BYTES;
});
test("real video trims to two seconds, crops and produces playable H264/AAC with audio fades", async () => {
  const recipe = {
    ...defaultRecipe(),
    aspect: "16:9" as const,
    fit: "cover" as const,
    start: 1,
    duration: 2,
    fade: 0.25,
    volume: 0.5,
  };
  const { row } = worker.reserve(db, owner, randomUUID(), recipe, "video", 1);
  const fixture = worker.inputPath(row.id) + ".mp4";
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=320x240:rate=25",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:sample_rate=44100",
    "-t",
    "4",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    fixture,
  ]);
  copyFileSync(fixture, worker.inputPath(row.id));
  worker.setState(db, row.id, "pending");
  await worker.tick(db, "test-worker");
  const result = worker.findJob(db, owner, row.id)!;
  expect(result.state).toBe("completed");
  const info = await worker.probe(worker.outputPath(result));
  expect(info.streams.find((s) => s.codec_type === "video")).toMatchObject({
    codec_name: "h264",
    width: 1280,
    height: 720,
  });
  expect(info.streams.some((s) => s.codec_name === "aac")).toBe(true);
  expect(Number(info.format.duration)).toBeCloseTo(2, 0);
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-i",
    worker.outputPath(result),
    "-f",
    "null",
    "-",
  ]);
}, 120000);
test("exported video audio has measured volume attenuation and fade-in", async () => {
  const row = db
    .prepare(
      "SELECT * FROM jobs WHERE kind='video' AND state='completed' LIMIT 1",
    )
    .get() as any;
  expect(row).toBeTruthy();
  const pcm = worker.inputPath(row.id) + ".pcm";
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-i",
    worker.outputPath(row),
    "-vn",
    "-ac",
    "1",
    "-ar",
    "8000",
    "-f",
    "s16le",
    pcm,
  ]);
  const samples = readFileSync(pcm);
  const rms = (start: number) =>
    Math.sqrt(
      Array.from(
        { length: 240 },
        (_, i) => samples.readInt16LE((start + i) * 2) ** 2,
      ).reduce((a, b) => a + b, 0) / 240,
    );
  expect(rms(0)).toBeLessThan(rms(4000) * 0.5);
  expect(rms(15400)).toBeLessThan(rms(4000) * 0.6);
  expect(rms(4000)).toBeGreaterThan(400);
  expect(rms(4000)).toBeLessThan(2200);
});

test("queue persists across process restart and recovers an interrupted lease", async () => {
  const { row } = worker.reserve(
    db,
    owner,
    randomUUID(),
    { ...defaultRecipe(), watermark: false },
    "image",
    1,
  );
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=red:s=20x20",
    "-frames:v",
    "1",
    worker.inputPath(row.id) + ".png",
  ]);
  copyFileSync(worker.inputPath(row.id) + ".png", worker.inputPath(row.id));
  db.prepare(
    "UPDATE jobs SET state='processing',attempts=1,updated=?,lease='dead' WHERE id=?",
  ).run(Date.now() - 30000, row.id);
  db.prepare("UPDATE worker SET heartbeat=0,token='dead' WHERE id=1").run();
  // A new operating-system process reopens the same SQLite database.
  const code =
    "import {database,tick} from './lib/render-worker.mjs';const db=database();await tick(db,'replacement');db.prepare(\"UPDATE jobs SET updated=? WHERE state='pending'\").run(Date.now()-10000);await tick(db,'replacement');db.close();";
  await new Promise<void>((ok, bad) => {
    const p = spawn(process.execPath, ["--input-type=module", "-e", code], {
      env: process.env,
      windowsHide: true,
      stdio: "pipe",
    });
    let err = "";
    p.stderr.on("data", (b) => (err += b));
    p.on("error", bad);
    p.on("close", (c) => (c === 0 ? ok() : bad(new Error(err))));
  });
  // Recovered retries wait for bounded backoff, then complete.
  db.prepare("UPDATE jobs SET updated=? WHERE id=?").run(
    Date.now() - 10000,
    row.id,
  );
  await worker.tick(db, "replacement");
  const result = worker.findJob(db, owner, row.id)!;
  expect(result.state).toBe("completed");
  expect(result.attempts).toBe(2);
  expect(
    worker.publicJob(db, result)?.history.some((e) => e.state === "pending"),
  ).toBe(true);
}, 120000);
test("duplicate submissions, owner isolation, cancellation and bounded failure recovery", async () => {
  const key = randomUUID(),
    r = worker.reserve(db, owner, key, defaultRecipe(), "image", 10);
  expect(
    worker.reserve(db, owner, key, defaultRecipe(), "image", 10).duplicate,
  ).toBe(true);
  expect(worker.findJob(db, "another-owner", r.row.id)).toBeUndefined();
  expect(worker.cancel(db, "another-owner", r.row.id)).toBeNull();
  expect(worker.cancel(db, owner, r.row.id)?.state).toBe("cancelled");
  expect(existsSync(worker.outputPath(r.row))).toBe(false);
  const failed = worker.reserve(
    db,
    owner,
    randomUUID(),
    defaultRecipe(),
    "image",
    10,
  ).row;
  writeFileSync(worker.inputPath(failed.id), "not media");
  worker.setState(db, failed.id, "pending");
  db.prepare("UPDATE worker SET heartbeat=0 WHERE id=1").run();
  await worker.tick(db, "failure-worker");
  expect(worker.findJob(db, owner, failed.id)?.state).toBe("pending");
  db.prepare("UPDATE jobs SET updated=? WHERE id=?").run(
    Date.now() - 10000,
    failed.id,
  );
  await worker.tick(db, "failure-worker");
  expect(worker.findJob(db, owner, failed.id)?.state).toBe("failed");
  expect(worker.findJob(db, owner, failed.id)?.attempts).toBe(2);
  expect(() => worker.inputPath("../../outside")).toThrow();
}, 60000);
