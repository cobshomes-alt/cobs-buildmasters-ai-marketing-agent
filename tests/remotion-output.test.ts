import { test, expect } from "vitest";
import { resolve, join } from "node:path";
import {
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { cpus, totalmem } from "node:os";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { newClip, newTimeline } from "../lib/timeline";
import { baseTimeline, directiveFromTimeline } from "../lib/remotion/plan";
import { GraphicsFrame } from "../lib/remotion/graphics";
import { sequenceSnapshot } from "../lib/sequence-model.mjs";
import { renderGraphicsEvaluation } from "../lib/remotion/evaluate";
process.env.COBS_RENDER_ROOT = resolve(
  ".tools/remotion-evaluation",
  "jobs-" + randomUUID(),
);
const worker = await import("../lib/render-worker.mjs");
const ffmpeg = resolve(".tools/ffmpeg/ffmpeg.exe");
const hash = (p: string) =>
  createHash("sha256").update(readFileSync(p)).digest("hex");
test("local non-commercial hybrid evaluation renders six synthetic originals with real Remotion titles and unchanged original logo", async () => {
  const root = process.env.COBS_RENDER_ROOT!,
    id = randomUUID();
  mkdirSync(join(root, id), { recursive: true });
  const colors = [
      "0xb04030",
      "0x308040",
      "0x3040b0",
      "0xb0a030",
      "0x903090",
      "0x309090",
    ],
    sources: string[] = [];
  const clips = [];
  for (let i = 0; i < 6; i++) {
    const photo = i % 2 === 1,
      file = join(root, `synthetic-${i}.${photo ? "png" : "mp4"}`);
    sources.push(file);
    await worker.command(ffmpeg, [
      "-v",
      "error",
      "-nostdin",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=${colors[i]}:s=320x320:r=25:d=4`,
      ...(photo
        ? []
        : [
            "-f",
            "lavfi",
            "-i",
            `sine=frequency=${330 + i * 70}:sample_rate=48000`,
          ]),
      "-vf",
      "drawgrid=w=80:h=40:t=2:c=black@0.3" +
        (photo
          ? ""
          : ",drawbox=x=0:y=0:w=80:h=80:color=white:t=fill:enable='gte(t,0.35)'"),
      ...(photo
        ? ["-frames:v", "1"]
        : ["-t", "4", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac"]),
      "-threads",
      "1",
      file,
    ]);
    const c = newClip({
      id: randomUUID(),
      original_name: `SYNTHETIC masonry ${i + 1}`,
      mime_type: photo ? "image/png" : "video/mp4",
    });
    c.recipe.duration = 2;
    c.recipe.start = photo ? 0 : 0.4;
    c.recipe.text =
      i === 5 ? "LOCAL EVALUATION ONLY" : `SYNTHETIC BUILDING STUDY ${i + 1}`;
    c.recipe.watermark = i === 5;
    c.recipe.captions = [
      {
        start: 0.3,
        end: 1.7,
        text: "Synthetic test media - not company footage",
      },
    ];
    c.effects = {
      grade: "art-of-building",
      ...(i === 5 ? { logoEnding: true } : {}),
      ...(i === 0 ? { speed: 0.5 } : {}),
    };
    if (i < 5) c.transition = { type: "fade", duration: 0.2 };
    clips.push(c);
    copyFileSync(file, worker.sequenceInputPath(id, i));
  }
  const doc = {
    ...newTimeline(),
    title: "SYNTHETIC REMOTION EVALUATION",
    clips,
    audioTracks: [
      {
        id: randomUUID(),
        kind: "music" as const,
        volume: 0.3,
        offset: 0,
        fade: 0.3,
        loop: true,
      },
    ],
  };
  const music = join(root, id, "audio-music");
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=220:sample_rate=48000:duration=2",
    "-c:a",
    "pcm_s16le",
    "-f",
    "wav",
    music,
  ]);
  const directive = directiveFromTimeline(doc),
    before = JSON.stringify(doc),
    hashes = sources.map(hash),
    logo = resolve("public/branding/cobs-buildmasters-logo.jpeg"),
    logoHash = hash(logo);
  const base = baseTimeline(doc, directive),
    baseStart = performance.now();
  const baseVideo = await worker.renderSequence(
    id,
    sequenceSnapshot(base.clips, base.audioTracks),
    "base-evaluation",
  );
  const baseMs = performance.now() - baseStart;
  const result = await renderGraphicsEvaluation({
    document: doc,
    directive,
    baseVideo,
    outputDir: join(root, "hybrid"),
    command: worker.command,
    evaluationAcknowledged: true,
  });
  const info = await worker.probe(result.output),
    v = info.streams.find((s) => s.codec_type === "video")!;
  expect(v.codec_name).toBe("h264");
  expect([v.width, v.height]).toEqual([720, 1280]);
  expect(Math.abs(Number(info.format.duration) - 11)).toBeLessThan(0.1);
  expect(info.streams.some((s) => s.codec_name === "aac")).toBe(true);
  const destination = resolve(".tools/delivery/media-studio");
  mkdirSync(destination, { recursive: true });
  copyFileSync(
    result.output,
    join(destination, "cobs-remotion-evaluation.mp4"),
  );
  const samples = [];
  for (let i = 0; i < 6; i++) {
    const time = i * 1.8 + (i === 5 ? 0.32 : 0.6),
      rgb = join(root, `sample-${i}.rgb`),
      baseRgb = join(root, `base-${i}.rgb`);
    for (const [input, out] of [
      [result.output, rgb],
      [baseVideo, baseRgb],
    ])
      await worker.command(ffmpeg, [
        "-v",
        "error",
        "-y",
        "-ss",
        String(time),
        "-i",
        input,
        "-vf",
        "crop=2:2:60:650,scale=1:1",
        "-frames:v",
        "1",
        "-pix_fmt",
        "rgb24",
        "-f",
        "rawvideo",
        out,
      ]);
    const actual = [...readFileSync(rgb)],
      reference = [...readFileSync(baseRgb)];
    expect(reference.reduce((a, b) => a + b, 0)).toBeGreaterThan(80);
    const palette = colors.map((c) => [
      parseInt(c.slice(2, 4), 16),
      parseInt(c.slice(4, 6), 16),
      parseInt(c.slice(6, 8), 16),
    ]);
    const distances = palette.map((c) =>
      c.reduce((sum, v, k) => sum + (v - reference[k]) ** 2, 0),
    );
    expect(distances.indexOf(Math.min(...distances))).toBe(i);
    for (let k = 0; k < 3; k++)
      expect(Math.abs(actual[k] - reference[k])).toBeLessThan(24);
    const pcm = join(root, `audio-${i}.pcm`);
    await worker.command(ffmpeg, [
      "-v",
      "error",
      "-y",
      "-ss",
      String(time),
      "-i",
      result.output,
      "-t",
      "0.1",
      "-vn",
      "-ac",
      "1",
      "-ar",
      "8000",
      "-f",
      "s16le",
      pcm,
    ]);
    const sound = readFileSync(pcm);
    let energy = 0;
    for (let j = 0; j < sound.length; j += 2)
      energy += sound.readInt16LE(j) ** 2;
    const audioRms = Math.sqrt(energy / (sound.length / 2));
    expect(audioRms).toBeGreaterThan(100);
    samples.push({ scene: i + 1, time, actual, base: reference, audioRms });
  }
  expect(new Set(samples.map((s) => s.base.join(","))).size).toBe(6);
  expect(JSON.stringify(doc)).toBe(before);
  expect(sources.map(hash)).toEqual(hashes);
  expect(hash(logo)).toBe(logoHash);
  const trimRgb = join(root, "trim.rgb");
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-y",
    "-ss",
    "0.08",
    "-i",
    baseVideo,
    "-vf",
    "crop=2:2:80:320,scale=1:1",
    "-frames:v",
    "1",
    "-pix_fmt",
    "rgb24",
    "-f",
    "rawvideo",
    trimRgb,
  ]);
  expect([...readFileSync(trimRgb)].every((v) => v > 180)).toBe(true);
  const logoActual = join(root, "logo-actual.rgb"),
    logoReference = join(root, "logo-reference.rgb");
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-y",
    "-ss",
    "10.1",
    "-i",
    result.output,
    "-vf",
    "crop=360:360:180:282",
    "-frames:v",
    "1",
    "-pix_fmt",
    "rgb24",
    "-f",
    "rawvideo",
    logoActual,
  ]);
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-y",
    "-i",
    logo,
    "-vf",
    "scale=360:360",
    "-frames:v",
    "1",
    "-pix_fmt",
    "rgb24",
    "-f",
    "rawvideo",
    logoReference,
  ]);
  const la = readFileSync(logoActual),
    lr = readFileSync(logoReference);
  const logoMeanError =
    la.reduce((n, v, i) => n + Math.abs(v - lr[i]), 0) / la.length;
  expect(logoMeanError).toBeLessThan(10);
  const captionBuffers: Buffer[] = [];
  for (const [i, input] of [baseVideo, result.output].entries()) {
    const out = join(root, `closing-captions-${i}.rgb`);
    await worker.command(ffmpeg, [
      "-v",
      "error",
      "-y",
      "-ss",
      "10.1",
      "-i",
      input,
      "-vf",
      "crop=600:140:60:980",
      "-frames:v",
      "1",
      "-pix_fmt",
      "rgb24",
      "-f",
      "rawvideo",
      out,
    ]);
    captionBuffers.push(readFileSync(out));
  }
  const captionMeanError =
    captionBuffers[0].reduce(
      (n, v, i) => n + Math.abs(v - captionBuffers[1][i]),
      0,
    ) / captionBuffers[0].length;
  let brightCaptionPixels = 0;
  for (let i = 0; i < captionBuffers[1].length; i += 3)
    if (
      captionBuffers[1][i] > 180 &&
      captionBuffers[1][i + 1] > 180 &&
      captionBuffers[1][i + 2] > 180
    )
      brightCaptionPixels++;
  expect(captionMeanError).toBeLessThan(5);
  expect(brightCaptionPixels).toBeGreaterThan(300);
  const titlePixels: number[][] = [];
  for (const [i, time] of [0.04, 0.8].entries()) {
    const out = join(root, `animated-title-${i}.rgb`);
    await worker.command(ffmpeg, [
      "-v",
      "error",
      "-y",
      "-ss",
      String(time),
      "-i",
      result.output,
      "-vf",
      "crop=2:2:50:830,scale=1:1",
      "-frames:v",
      "1",
      "-pix_fmt",
      "rgb24",
      "-f",
      "rawvideo",
      out,
    ]);
    titlePixels.push([...readFileSync(out)]);
  }
  expect(titlePixels[0][0] - titlePixels[1][0]).toBeGreaterThan(50);
  const fadePixel = join(root, "transition.rgb");
  await worker.command(ffmpeg, [
    "-v",
    "error",
    "-y",
    "-ss",
    "1.88",
    "-i",
    result.output,
    "-vf",
    "crop=2:2:60:650,scale=1:1",
    "-frames:v",
    "1",
    "-pix_fmt",
    "rgb24",
    "-f",
    "rawvideo",
    fadePixel,
  ]);
  const fade = [...readFileSync(fadePixel)];
  expect(fade[0]).toBeGreaterThan(60);
  expect(fade[0]).toBeLessThan(160);
  expect(fade[1]).toBeGreaterThan(60);
  expect(fade[1]).toBeLessThan(125);
  const logoSource =
    "data:image/jpeg;base64," + readFileSync(logo).toString("base64");
  writeFileSync(
    join(destination, "remotion-preview-frame.svg"),
    renderToStaticMarkup(
      createElement(GraphicsFrame, {
        plan: result.plan,
        frame: 25,
        logoSource,
      }),
    ),
  );
  writeFileSync(
    join(destination, "remotion-evaluation-verification.json"),
    JSON.stringify(
      {
        mode: "non-commercial local synthetic evaluation; no paid AI or hosted writes",
        ...result,
        baseMs,
        sourceHashesPreserved: true,
        logoHash,
        samples,
        logoMeanError,
        captionMeanError,
        brightCaptionPixels,
        titlePixels,
        transitionPixel: fade,
        host: {
          node: process.version,
          platform: process.platform,
          logicalCpus: cpus().length,
          physicalRamBytes: totalmem(),
          cpu: cpus()[0]?.model,
        },
        inputBytes: sources.reduce((n, p) => n + statSync(p).size, 0),
      },
      null,
      2,
    ),
  );
}, 300000);
