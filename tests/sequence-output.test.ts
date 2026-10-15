import { test, expect } from "vitest";
import { resolve } from "node:path";
import {
  copyFileSync,
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
  mkdirSync,
} from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { defaultRecipe } from "../lib/studio-model.mjs";
import { sequenceSnapshot, validateSequence } from "../lib/sequence-model.mjs";
import {
  generateEditingPlan,
  validatePlanTimeline,
  type MediaFacts,
} from "../lib/automatic-editing";
import { moveClip } from "../lib/timeline";
process.env.COBS_RENDER_ROOT = resolve(".tools/sequence-tests-" + randomUUID());
const worker = await import("../lib/render-worker.mjs");
const db = worker.database(),
  owner = "synthetic-owner",
  ffmpeg = resolve(".tools/ffmpeg/ffmpeg.exe");
const clip = (mediaId: string, kind: "image" | "video", start = 0) => ({
  mediaId,
  kind,
  recipe: {
    ...defaultRecipe(),
    aspect: "1:1" as const,
    watermark: false,
    duration: 1,
    start,
    volume: 0.5,
    fade: 0.1,
  },
});
const hash = (file: string) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

test("three independently trimmed videos and three photos produce all six actual segments", async () => {
  db.prepare("UPDATE worker SET heartbeat=0").run();
  const delivery = resolve(".tools/delivery/media-studio");
  mkdirSync(delivery, { recursive: true });
  const colors = ["red", "yellow", "green", "purple", "blue", "cyan"];
  const durations = [1, 1.5, 1, 2, 1, 1.5];
  const starts = [0.5, 0, 1, 0, 1.5, 0];
  const files: string[] = [];
  const clips = colors.map((_, i) => ({
    ...clip(randomUUID(), i % 2 ? "image" : "video", starts[i]),
    recipe: {
      ...defaultRecipe(),
      aspect: "1:1" as const,
      start: starts[i],
      duration: durations[i],
      watermark: true,
      volume: i === 2 ? 0.5 : 1,
      fade: i === 2 ? 0.2 : 0,
      captions: [
        { start: 0.25, end: 0.75, text: `SYNTHETIC SEGMENT ${i + 1}` },
      ],
    },
  }));
  for (let i = 0; i < 6; i++) {
    const video = i % 2 === 0;
    const file = resolve(delivery, `six-source-${i}${video ? ".mp4" : ".png"}`);
    await worker.command(ffmpeg, [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=${colors[i]}:s=160x120:r=25:d=4`,
      ...(video
        ? [
            ...(i < 4
              ? [
                  "-f",
                  "lavfi",
                  "-i",
                  `sine=frequency=${i === 0 ? 440 : 880}:sample_rate=48000`,
                ]
              : []),
            "-vf",
            `drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='lt(t,${starts[i]})+gte(t,${starts[i] + 1})'`,
            "-t",
            "4",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            ...(i < 4 ? ["-c:a", "aac"] : ["-an"]),
          ]
        : ["-frames:v", "1"]),
      file,
    ]);
    files.push(file);
  }
  const originals = files.map(hash),
    logo = resolve("public/branding/cobs-buildmasters-logo.jpeg"),
    logoHash = hash(logo);
  const { row } = worker.reserve(
    db,
    owner,
    randomUUID(),
    sequenceSnapshot(clips),
    "video",
    files.reduce((n, f) => n + statSync(f).size, 0),
  );
  files.forEach((f, i) => copyFileSync(f, worker.sequenceInputPath(row.id, i)));
  worker.setState(db, row.id, "pending");
  await worker.tick(db, "six-source-worker");
  const result = worker.findJob(db, owner, row.id)!;
  expect(result.state).toBe("completed");
  const output = worker.outputPath(result),
    info = await worker.probe(output);
  expect([info.streams[0].width, info.streams[0].height]).toEqual([720, 720]);
  expect(info.streams[0].codec_name).toBe("h264");
  expect(Number(info.streams[0].nb_frames)).toBeGreaterThanOrEqual(200);
  expect(info.streams.some((s) => s.codec_name === "aac")).toBe(true);
  expect(Math.abs(Number(info.format.duration) - 8)).toBeLessThan(0.3);
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-xerror",
    "-i",
    output,
    "-f",
    "null",
    "-",
  ]);
  // Decode every frame at the centre: all six colour runs must be present,
  // in order, with their individual durations; white trim sentinels must be absent.
  const pixels = output + ".all.rgb";
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-y",
    "-i",
    output,
    "-vf",
    "fps=25,crop=2:2:350:350",
    "-pix_fmt",
    "rgb24",
    "-f",
    "rawvideo",
    pixels,
  ]);
  const bytes = readFileSync(pixels),
    palette = [
      [255, 0, 0],
      [255, 255, 0],
      [0, 128, 0],
      [128, 0, 128],
      [0, 0, 255],
      [0, 255, 255],
    ];
  const runs: { index: number; frames: number }[] = [];
  for (let p = 0; p < bytes.length; p += 12) {
    const rgb = [...bytes.subarray(p, p + 3)];
    const distances = palette.map((c) =>
      c.reduce((n, v, k) => n + (v - rgb[k]) ** 2, 0),
    );
    const index = distances.indexOf(Math.min(...distances));
    expect(distances[index]).toBeLessThan(2500);
    if (runs.at(-1)?.index === index) runs.at(-1)!.frames++;
    else runs.push({ index, frames: 1 });
  }
  expect(runs.map((r) => r.index)).toEqual([0, 1, 2, 3, 4, 5]);
  runs.forEach((r, i) =>
    expect(
      Math.abs(r.frames / 25 - durations[i]),
      JSON.stringify(runs),
    ).toBeLessThan(0.13),
  );
  const boundaries: number[] = [];
  let time = 0;
  for (let i = 0; i < 6; i++) {
    boundaries.push(time);
    for (const [offset, visible] of [
      [0.12, false],
      [0.5, true],
      [0.9, false],
    ] as const) {
      const crop = output + `.${i}-${offset}.caption.rgb`;
      await worker.command(ffmpeg, [
        "-v",
        "error",
        "-y",
        "-ss",
        String(time + offset),
        "-i",
        output,
        "-vf",
        "crop=720:160:0:390",
        "-frames:v",
        "1",
        "-pix_fmt",
        "rgb24",
        "-f",
        "rawvideo",
        crop,
      ]);
      const b = readFileSync(crop);
      let whites = 0;
      for (let p = 0; p < b.length; p += 3)
        if (b[p] > 190 && b[p + 1] > 190 && b[p + 2] > 190) whites++;
      expect(whites > 30).toBe(visible);
    }
    time += runs[i].frames / 25;
  }
  const audio = await Promise.all(
    boundaries.map((t) => audioRms(output, t + 0.4)),
  );
  expect(audio[0]).toBeGreaterThan(500);
  expect(audio[2] / audio[0]).toBeGreaterThan(0.35);
  expect(
    audio[2] / audio[0],
    JSON.stringify({ audio, boundaries }),
  ).toBeLessThan(0.65);
  for (const i of [1, 3, 4, 5]) expect(audio[i]).toBeLessThan(25);
  expect((await audioRms(output, 0.05)) / audio[0]).toBeGreaterThan(0.8);
  expect(
    (await audioRms(output, boundaries[2] + 0.01)) / audio[2],
  ).toBeLessThan(0.8);
  expect(
    (await audioRms(output, boundaries[2] + 0.85)) / audio[2],
  ).toBeLessThan(0.8);
  // Compare the actual burned-in logo pixels with the unchanged original resized to 120px.
  const reference = output + ".logo-reference.rgb",
    actual = output + ".logo.rgb";
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-y",
    "-i",
    logo,
    "-vf",
    "scale=120:120",
    "-frames:v",
    "1",
    "-pix_fmt",
    "rgb24",
    "-f",
    "rawvideo",
    reference,
  ]);
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-y",
    "-ss",
    "0.5",
    "-i",
    output,
    "-vf",
    "crop=120:120:580:580",
    "-frames:v",
    "1",
    "-pix_fmt",
    "rgb24",
    "-f",
    "rawvideo",
    actual,
  ]);
  const a = readFileSync(actual),
    b = readFileSync(reference);
  expect(
    a.reduce((n, v, i) => n + Math.abs(v - b[i]), 0) / a.length,
  ).toBeLessThan(8);
  expect(files.map(hash)).toEqual(originals);
  expect(hash(logo)).toBe(logoHash);
  copyFileSync(
    output,
    resolve(delivery, "synthetic-three-videos-three-photos.mp4"),
  );
  writeFileSync(
    resolve(delivery, "six-source-verification.json"),
    JSON.stringify(
      {
        scope:
          "Local FFmpeg queue/render/output verification; no hosted API or database writes",
        output: "synthetic-three-videos-three-photos.mp4",
        dimensions: [720, 720],
        duration: Number(info.format.duration),
        sources: files.map((f, i) => ({
          file: f,
          kind: clips[i].kind,
          trimStart: starts[i],
          duration: durations[i],
          sha256: originals[i],
        })),
        decodedRuns: runs,
        audioRms: audio,
        logoSha256: logoHash,
        fullDecode: "passed",
      },
      null,
      2,
    ),
  );
  // The automatic director uses actual probed metadata, then the owner edits
  // order, a photograph's duration and its caption before the SAME renderer runs.
  const facts: MediaFacts[] = [];
  for (let i = 0; i < files.length; i++) {
    const metadata = await worker.probe(files[i]);
    facts.push({
      id: clips[i].mediaId,
      name: `SYNTHETIC AUTO ${i}`,
      mime: i % 2 ? "image/png" : "video/mp4",
      bytes: statSync(files[i]).size,
      duration: i % 2 ? null : Number(metadata.format.duration),
      width: metadata.streams[0].width!,
      height: metadata.streams[0].height!,
      audio: metadata.streams.some((s) => s.codec_type === "audio"),
      orientation: "landscape",
      labels: ["Synthetic test only"],
      thumbnail: i % 2 ? "private original" : "not generated",
    });
  }
  const plan = generateEditingPlan(
    {
      instructions:
        "Create a professional promotion from these synthetic originals",
      mediaIds: facts.map((f) => f.id),
      priorityIds: [],
      platforms: ["Instagram", "TikTok"],
      duration: 6,
      aspect: "1:1",
      style: "professional",
      companyInfo: "",
      narration: "",
      captions: true,
      branding: true,
      starts: Object.fromEntries(
        facts
          .filter((f) => f.mime.startsWith("video/"))
          .map((f) => [f.id, starts[facts.indexOf(f)]]),
      ),
    },
    facts,
  );
  const edited = moveClip(plan.timeline, plan.timeline.clips[0].id, 1);
  edited.clips[0].recipe.duration = 1.5;
  edited.clips[0].recipe.captions = [
    { start: 0, end: 1.5, text: "OWNER EDITED SYNTHETIC CAPTION" },
  ];
  validatePlanTimeline(edited, facts);
  const capturedIds = [...new Set(edited.clips.map((c) => c.mediaId))];
  db.prepare("UPDATE worker SET heartbeat=0").run();
  const auto = worker.reserve(
    db,
    owner,
    randomUUID(),
    sequenceSnapshot(edited.clips),
    "video",
    facts.reduce((n, f) => n + f.bytes, 0),
  ).row;
  capturedIds.forEach((id, i) =>
    copyFileSync(
      files[clips.findIndex((c) => c.mediaId === id)],
      worker.sequenceInputPath(auto.id, i),
    ),
  );
  worker.setState(db, auto.id, "pending");
  await worker.tick(db, "automatic-director-worker");
  expect(worker.findJob(db, owner, auto.id)?.state).toBe("completed");
  const autoOutput = worker.outputPath(auto),
    autoInfo = await worker.probe(autoOutput);
  expect(Math.abs(Number(autoInfo.format.duration) - 6.5)).toBeLessThan(0.3);
  expect(Number(autoInfo.streams[0].nb_frames)).toBeGreaterThanOrEqual(162);
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-xerror",
    "-i",
    autoOutput,
    "-f",
    "null",
    "-",
  ]);
  for (const [t, index] of [
    [0.5, 1],
    [2, 0],
    [3, 2],
    [4, 3],
    [5, 4],
    [6, 5],
  ]) {
    const actual = await sample(autoOutput, t);
    expect(
      palette[index].reduce((n, v, k) => n + (v - actual[k]) ** 2, 0),
    ).toBeLessThan(2500);
  }
  copyFileSync(
    autoOutput,
    resolve(delivery, "synthetic-automatic-director.mp4"),
  );
  writeFileSync(
    resolve(delivery, "automatic-director-verification.json"),
    JSON.stringify(
      {
        mode: plan.mode,
        brief: plan.brief,
        scenes: plan.scenes,
        editedTimeline: edited,
        outputDuration: Number(autoInfo.format.duration),
        fullDecode: "passed",
        scope:
          "Actual local six-source plan, owner edits and render; no hosted writes or AI calls",
      },
      null,
      2,
    ),
  );
}, 180000);
async function sample(file: string, time: number) {
  const path = file + `.${time}.rgb`;
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-y",
    "-ss",
    String(time),
    "-i",
    file,
    "-vf",
    "crop=2:2:350:350",
    "-frames:v",
    "1",
    "-pix_fmt",
    "rgb24",
    "-f",
    "rawvideo",
    path,
  ]);
  return [...readFileSync(path).subarray(0, 3)];
}
async function audioRms(file: string, time: number) {
  const path = file + `.${time}.pcm`;
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-y",
    "-ss",
    String(time),
    "-i",
    file,
    "-t",
    "0.2",
    "-vn",
    "-ac",
    "1",
    "-ar",
    "8000",
    "-f",
    "s16le",
    path,
  ]);
  const b = readFileSync(path);
  let sum = 0;
  for (let i = 0; i < b.length; i += 2) sum += b.readInt16LE(i) ** 2;
  return Math.sqrt(sum / (b.length / 2));
}

test("real mixed multi-photo/multi-video export preserves order, trims, audio and originals", async () => {
  db.prepare("UPDATE worker SET heartbeat=0").run();
  const ids = Array.from({ length: 4 }, () => randomUUID());
  const sequence = sequenceSnapshot([
    clip(ids[0], "image"),
    clip(ids[1], "video", 1),
    clip(ids[2], "image"),
    clip(ids[3], "video"),
    clip(ids[0], "image"),
  ]);
  const { row } = worker.reserve(db, owner, randomUUID(), sequence, "video", 4);
  for (const [index, color] of [
    [0, "red"],
    [2, "blue"],
  ] as const) {
    const fixture = worker.sequenceInputPath(row.id, index) + ".png";
    await worker.command(ffmpeg, [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      `color=c=${color}:s=160x120`,
      "-frames:v",
      "1",
      fixture,
    ]);
    copyFileSync(fixture, worker.sequenceInputPath(row.id, index));
  }
  for (const index of [1, 3]) {
    const fixture = worker.sequenceInputPath(row.id, index) + ".mp4";
    await worker.command(ffmpeg, [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      `color=c=${index === 1 ? "green" : "purple"}:s=160x120:r=25:d=3`,
      ...(index === 1
        ? [
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:sample_rate=44100",
            "-vf",
            "drawbox=x=0:y=0:w=iw:h=ih:color=yellow:t=fill:enable='lt(t,1)'",
            "-c:a",
            "aac",
          ]
        : ["-an"]),
      "-t",
      "3",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      fixture,
    ]);
    copyFileSync(fixture, worker.sequenceInputPath(row.id, index));
  }
  const before = ids.map((_, i) => hash(worker.sequenceInputPath(row.id, i)));
  worker.setState(db, row.id, "pending");
  await worker.tick(db, "sequence-worker");
  const result = worker.findJob(db, owner, row.id)!;
  expect(result.state).toBe("completed");
  const output = worker.outputPath(result),
    info = await worker.probe(output);
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-xerror",
    "-i",
    output,
    "-f",
    "null",
    "-",
  ]);
  expect(Number(info.format.duration)).toBeCloseTo(5, 0);
  expect(info.streams.some((s) => s.codec_name === "aac")).toBe(true);
  const red = await sample(output, 0.3),
    green = await sample(output, 1.3),
    blue = await sample(output, 2.3),
    purple = await sample(output, 3.3),
    repeat = await sample(output, 4.3);
  expect(red[0]).toBeGreaterThan(200);
  expect(red[1]).toBeLessThan(30);
  expect(green[1]).toBeGreaterThan(90);
  expect(green[0]).toBeLessThan(30); // Yellow pre-trim source excluded.
  expect(blue[2]).toBeGreaterThan(200);
  expect(purple[0]).toBeGreaterThan(80);
  expect(purple[2]).toBeGreaterThan(80);
  expect(repeat[0]).toBeGreaterThan(200);
  expect(await audioRms(output, 0.3)).toBeLessThan(20);
  expect(await audioRms(output, 1.3)).toBeGreaterThan(300);
  expect(await audioRms(output, 3.3)).toBeLessThan(20);
  expect(ids.map((_, i) => hash(worker.sequenceInputPath(row.id, i)))).toEqual(
    before,
  );
  expect(statSync(output).size).toBeGreaterThan(1000);
  const delivery = resolve(
    ".tools/delivery/media-studio/synthetic-combined.mp4",
  );
  mkdirSync(resolve(".tools/delivery/media-studio"), { recursive: true });
  copyFileSync(output, delivery);
}, 120000);

test("photo sequence survives a separate worker process reopening the persistent queue", async () => {
  const ids = [randomUUID(), randomUUID()],
    recipe = sequenceSnapshot(ids.map((id) => clip(id, "image")));
  const { row } = worker.reserve(db, owner, randomUUID(), recipe, "video", 2);
  for (let i = 0; i < 2; i++) {
    const file = worker.sequenceInputPath(row.id, i);
    const fixture = file + ".png";
    await worker.command(ffmpeg, [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      `color=c=${i ? "blue" : "red"}:s=160x120`,
      "-frames:v",
      "1",
      fixture,
    ]);
    copyFileSync(fixture, file);
  }
  worker.setState(db, row.id, "pending");
  db.prepare("UPDATE worker SET heartbeat=0").run();
  await promisify(execFile)(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import {database,tick} from './lib/render-worker.mjs';const db=database();await tick(db,'separate-sequence-worker');db.close();",
    ],
    { windowsHide: true, timeout: 120000, env: { ...process.env } },
  );
  expect(worker.findJob(db, owner, row.id)?.state).toBe("completed");
  expect((await worker.probe(worker.outputPath(row))).streams[0].width).toBe(
    720,
  );
}, 120000);

test("sequence validation rejects unsafe/mismatched limits and strips unexpected metadata", () => {
  const id = randomUUID(),
    one = clip(id, "image");
  expect(validateSequence({ version: 2, clips: [] })).toBeTruthy();
  expect(
    validateSequence({
      version: 2,
      clips: Array.from({ length: 13 }, () => one),
    }),
  ).toBeTruthy();
  expect(
    validateSequence({
      version: 2,
      clips: Array.from({ length: 7 }, () => clip(randomUUID(), "image")),
    }),
  ).toMatch(/six/);
  expect(
    validateSequence({
      version: 2,
      clips: Array.from({ length: 3 }, () => ({
        ...one,
        recipe: { ...one.recipe, duration: 30 },
      })),
    }),
  ).toMatch(/60 seconds/);
  expect(
    validateSequence({
      version: 2,
      clips: [one, { ...one, recipe: { ...one.recipe, aspect: "9:16" } }],
    }),
  ).toMatch(/aspect/);
  expect(
    validateSequence({ version: 2, clips: [one, { ...one, kind: "video" }] }),
  ).toMatch(/types/);
  expect(
    validateSequence({
      version: 2,
      clips: [{ ...one, mediaId: "http://localhost/secret" }],
    }),
  ).toBeTruthy();
  const withUnexpectedMetadata = {
    ...one,
    recipe: { ...one.recipe, secret: "must-not-persist" },
  };
  const safe = sequenceSnapshot([withUnexpectedMetadata]);
  expect(JSON.stringify(safe)).not.toContain("must-not-persist");
  expect(() => worker.sequenceInputPath(randomUUID(), 6)).toThrow();
  expect(() => worker.sequenceInputPath("../outside", 0)).toThrow();
});

test("real combined exports support all four target aspect ratios", async () => {
  db.prepare("UPDATE worker SET heartbeat=0").run();
  for (const aspect of ["9:16", "16:9", "1:1", "4:5"] as const) {
    const one = clip(randomUUID(), "image"),
      recipe = sequenceSnapshot([
        { ...one, recipe: { ...one.recipe, aspect, watermark: true } },
        { ...one, recipe: { ...one.recipe, aspect, watermark: true } },
      ]);
    const { row } = worker.reserve(db, owner, randomUUID(), recipe, "video", 1),
      input = worker.sequenceInputPath(row.id, 0),
      fixture = input + ".png";
    await worker.command(ffmpeg, [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=navy:s=160x120",
      "-frames:v",
      "1",
      fixture,
    ]);
    copyFileSync(fixture, input);
    worker.setState(db, row.id, "pending");
    await worker.tick(db, "aspect-worker");
    expect(worker.findJob(db, owner, row.id)?.state).toBe("completed");
    const info = await worker.probe(worker.outputPath(row)),
      expected =
        aspect === "9:16"
          ? [720, 1280]
          : aspect === "16:9"
            ? [1280, 720]
            : aspect === "4:5"
              ? [720, 900]
              : [720, 720];
    expect([info.streams[0].width, info.streams[0].height]).toEqual(expected);
  }
}, 120000);

test("missing captured sequence inputs fail closed and cancelled jobs produce no output", async () => {
  db.prepare("UPDATE worker SET heartbeat=0").run();
  const recipe = sequenceSnapshot([clip(randomUUID(), "video")]),
    { row } = worker.reserve(db, owner, randomUUID(), recipe, "video", 1);
  worker.setState(db, row.id, "pending");
  await worker.tick(db, "failure-worker");
  expect(worker.findJob(db, owner, row.id)?.state).toBe("pending");
  worker.cancel(db, owner, row.id);
  await worker.tick(db, "failure-worker");
  expect(worker.findJob(db, owner, row.id)?.state).toBe("cancelled");
  expect(existsSync(worker.outputPath(row))).toBe(false);
});

test("timed subtitles are burned into actual output only during each clip-relative interval", async () => {
  db.prepare("UPDATE worker SET heartbeat=0").run();
  const id = randomUUID(),
    one = clip(id, "image"),
    recipe = sequenceSnapshot([
      {
        ...one,
        recipe: {
          ...one.recipe,
          duration: 3,
          captions: [
            { start: 1, end: 2, text: "SYNTHETIC: owner's 100% text" },
          ],
        },
      },
      {
        ...one,
        mediaId: randomUUID(),
        kind: "video",
        recipe: {
          ...one.recipe,
          duration: 3,
          captions: [{ start: 0.12, end: 0.4, text: "LOW-FPS SYNTHETIC CUE" }],
        },
      },
    ]);
  const { row } = worker.reserve(db, owner, randomUUID(), recipe, "video", 1),
    input = worker.sequenceInputPath(row.id, 0),
    fixture = input + ".png";
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:s=160x120",
    "-frames:v",
    "1",
    fixture,
  ]);
  copyFileSync(fixture, input);
  const videoInput = worker.sequenceInputPath(row.id, 1),
    videoFixture = videoInput + ".mp4";
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:s=160x120:r=1:d=3",
    "-t",
    "3",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    videoFixture,
  ]);
  copyFileSync(videoFixture, videoInput);
  worker.setState(db, row.id, "pending");
  await worker.tick(db, "captions-worker");
  expect(worker.findJob(db, owner, row.id)?.state).toBe("completed");
  const output = worker.outputPath(row);
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-xerror",
    "-i",
    output,
    "-f",
    "null",
    "-",
  ]);
  for (const [time, visible] of [
    [0.3, false],
    [1.3, true],
    [2.3, false],
    [3.05, false],
    [3.2, true],
    [3.6, false],
    [5.2, false],
  ] as const) {
    const pixels = output + `.${time}.caption.rgb`;
    await worker.command(ffmpeg, [
      "-v",
      "error",
      "-y",
      "-ss",
      String(time),
      "-i",
      output,
      "-vf",
      "crop=720:220:0:400",
      "-frames:v",
      "1",
      "-pix_fmt",
      "rgb24",
      "-f",
      "rawvideo",
      pixels,
    ]);
    const bytes = readFileSync(pixels);
    let whites = 0;
    for (let i = 0; i < bytes.length; i += 3)
      if (bytes[i] > 190 && bytes[i + 1] > 190 && bytes[i + 2] > 190) whites++;
    expect(whites > 30).toBe(visible);
  }
  copyFileSync(
    output,
    resolve(".tools/delivery/media-studio/synthetic-timed-captions.mp4"),
  );
}, 120000);
