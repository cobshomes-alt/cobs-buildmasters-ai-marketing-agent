import { test, expect } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { resolve, join } from "node:path";
import {
  mkdirSync,
  readFileSync,
  copyFileSync,
  writeFileSync,
  statSync,
} from "node:fs";
import {
  generateEditingPlan,
  validatePlanTimeline,
  type MediaFacts,
} from "../lib/automatic-editing";
import { sequenceSnapshot, validateSequence } from "../lib/sequence-model.mjs";
import {
  sequenceDuration,
  validateEffects,
  visualSources,
} from "../lib/cinematic-model.mjs";
import { moveClip, splitClip } from "../lib/timeline";
import { proposeEdit, confirmEdit } from "../lib/assistant-editing";
process.env.COBS_RENDER_ROOT = resolve(
  ".tools/construction-tests-" + randomUUID(),
);
const worker = await import("../lib/render-worker.mjs");
const ffmpeg = resolve(".tools/ffmpeg/ffmpeg.exe");
const hash = (p: string) =>
  createHash("sha256").update(readFileSync(p)).digest("hex");
test("construction effects are explicit, bounded, versioned and preserved correctly through splits and reordering", () => {
  const media: MediaFacts[] = Array.from({ length: 6 }, (_, i) => ({
    id: randomUUID(),
    name: "Synthetic " + i,
    mime: i % 2 ? "image/png" : "video/mp4",
    bytes: 100,
    duration: i % 2 ? null : 10,
    width: 320,
    height: 320,
    audio: !(i % 2),
    orientation: "square",
    labels: [],
    thumbnail: i % 2 ? "private original" : "not generated",
  }));
  const p = generateEditingPlan(
    {
      instructions:
        "Create a 12-second warm cinematic construction advertisement with professional music",
      cinematicPreset: "art-of-building",
      mediaIds: media.map((f) => f.id),
      priorityIds: [],
      platforms: ["Instagram"],
      duration: 12,
      aspect: "9:16",
      style: "professional",
      companyInfo: "",
      narration: "",
      captions: false,
      branding: true,
      starts: {},
    },
    media,
  );
  expect(p.totalDuration).toBe(12);
  expect(new Set(p.scenes.map((s) => s.duration)).size).toBeGreaterThan(1);
  expect(
    p.timeline.clips.every((c) => c.effects?.grade === "art-of-building"),
  ).toBe(true);
  expect(p.timeline.clips.filter((c) => c.recipe.watermark)).toHaveLength(1);
  expect(p.timeline.clips.at(-1)?.effects?.logoEnding).toBe(true);
  const seq = sequenceSnapshot(p.timeline.clips);
  expect(seq.version).toBe(5);
  expect(validateSequence({ ...seq, version: 4 })).toBeTruthy();
  const first = p.timeline.clips[0];
  first.effects!.speed = 0.5;
  first.recipe.duration = 4;
  const split = splitClip(p.timeline, first.id, 1);
  expect(split.clips[1].recipe.start).toBe(0.5);
  const moved = moveClip(p.timeline, p.timeline.clips.at(-1)!.id, -1);
  expect(validateSequence(sequenceSnapshot(moved.clips))).toBeNull();
  expect(validateEffects({ ...first, effects: { speed: 0.49 } })).toBeTruthy();
  expect(() =>
    validatePlanTimeline(
      {
        ...p.timeline,
        clips: p.timeline.clips.map((c, i) =>
          i
            ? c
            : {
                ...c,
                recipe: { ...c.recipe, start: 9, duration: 4 },
                effects: { ...c.effects, speed: 2 },
              },
        ),
      },
      media,
    ),
  ).toThrow();
  expect(
    validateEffects({ ...first, kind: "image", effects: { speed: 1 } }),
  ).toBeTruthy();
  expect(
    validateEffects({ ...first, effects: { logoEnding: true } }),
  ).toBeTruthy();
  expect(
    validateEffects({ ...first, effects: { grade: "unknown" } as never }),
  ).toBeTruthy();
});
test("Art of Building renders six synthetic construction-pattern sources in three ratios with grading, trim, speed, transitions, music, text and animated original logo", async () => {
  const root = process.env.COBS_RENDER_ROOT!,
    fixtures = join(root, "fixtures");
  mkdirSync(fixtures, { recursive: true });
  const colors = [
    "0x805030",
    "0x788b96",
    "0x466a50",
    "0x786a8b",
    "0x406780",
    "0x786650",
  ];
  const sources: string[] = [],
    media: MediaFacts[] = [];
  for (let i = 0; i < 6; i++) {
    const photo = i % 2 === 1,
      file = join(fixtures, `${i}.${photo ? "png" : "mp4"}`);
    sources.push(file);
    await worker.command(ffmpeg, [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=${colors[i]}:s=320x320:r=25:d=6`,
      ...(photo
        ? []
        : ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000"]),
      "-vf",
      "drawgrid=w=80:h=40:t=2:c=black@0.45,drawbox=x=0:y=0:w=80:h=80:color=0x808080:t=fill,drawbox=x=80:y=0:w=80:h=80:color=0x333333:t=fill,drawbox=x=160:y=0:w=80:h=80:color=0xe6e6e6:t=fill" +
        (photo
          ? ""
          : ",drawbox=x=240:y=0:w=80:h=80:color=white:t=fill:enable='gte(t,2)'"),
      ...(photo
        ? ["-frames:v", "1"]
        : ["-t", "6", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac"]),
      "-threads",
      "1",
      file,
    ]);
    media.push({
      id: randomUUID(),
      name: `SYNTHETIC masonry pattern ${i + 1}`,
      mime: photo ? "image/png" : "video/mp4",
      bytes: statSync(file).size,
      duration: photo ? null : 6,
      width: 320,
      height: 320,
      audio: !photo,
      orientation: "square",
      labels: ["Synthetic test pattern — not company footage"],
      thumbnail: photo ? "private original" : "not generated",
    });
  }
  const music = join(fixtures, "synthetic-music.wav");
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
    music,
  ]);
  const originals = [
      ...sources,
      music,
      resolve("public/branding/cobs-buildmasters-logo.jpeg"),
    ],
    hashes = originals.map(hash);
  const results = [];
  const destination = resolve(".tools/delivery/media-studio");
  mkdirSync(destination, { recursive: true });
  for (const aspect of ["9:16", "16:9", "1:1"] as const) {
    const p = generateEditingPlan(
      {
        instructions: "Create a restrained cinematic construction montage",
        cinematicPreset: "art-of-building",
        mediaIds: media.map((f) => f.id),
        priorityIds: [],
        platforms: ["Instagram"],
        duration: 12,
        aspect,
        style: "professional",
        companyInfo: "",
        narration: "",
        captions: false,
        branding: true,
        starts: Object.fromEntries(
          media.filter((f) => f.duration).map((f) => [f.id, 0.4]),
        ),
      },
      media,
    );
    p.timeline.clips[0].effects!.speed = 0.5;
    p.timeline.clips[2].effects!.speed = 1.25;
    p.timeline.audioTracks = [
      {
        id: randomUUID(),
        kind: "music",
        volume: 0.4,
        offset: 0,
        fade: 0.4,
        loop: true,
      },
    ];
    const assistantProposal = proposeEdit(
      p.timeline,
      "Add professional captions",
      "SYNTHETIC TEST - not company footage",
    );
    p.timeline = confirmEdit(p.timeline, assistantProposal);
    validatePlanTimeline(p.timeline, media);
    const recipe = sequenceSnapshot(p.timeline.clips, p.timeline.audioTracks),
      db = worker.database();
    try {
      const { row } = worker.reserve(
        db,
        "synthetic-construction-owner",
        randomUUID(),
        recipe,
        "video",
        media.reduce((n, f) => n + f.bytes, statSync(music).size),
      );
      visualSources(recipe.clips).forEach((id, i) =>
        copyFileSync(
          sources[media.findIndex((f) => f.id === id)],
          worker.sequenceInputPath(row.id, i),
        ),
      );
      copyFileSync(music, join(root, row.id, "audio-music"));
      worker.setState(db, row.id, "pending");
      await worker.tick(db, "construction-test-worker");
      const result = worker.findJob(
        db,
        "synthetic-construction-owner",
        row.id,
      )!;
      if (result.state !== "completed")
        await worker.renderSequence(row.id, recipe, "construction-diagnostic");
      expect(result.state).toBe("completed");
      const out = worker.outputPath(result),
        info = await worker.probe(out),
        video = info.streams.find((s) => s.codec_type === "video")!;
      const dimensions =
        aspect === "9:16"
          ? [720, 1280]
          : aspect === "16:9"
            ? [1280, 720]
            : [720, 720];
      expect([video.width, video.height]).toEqual(dimensions);
      expect(video.codec_name).toBe("h264");
      expect(info.streams.some((s) => s.codec_name === "aac")).toBe(true);
      expect(
        Math.abs(Number(info.format.duration) - sequenceDuration(recipe.clips)),
      ).toBeLessThan(0.15);
      await worker.command(ffmpeg, [
        "-v",
        "error",
        "-xerror",
        "-i",
        out,
        "-f",
        "null",
        "-",
      ]);
      async function pixels(t: number, filter: string) {
        const f = out + randomUUID() + ".rgb";
        await worker.command(ffmpeg, [
          "-v",
          "error",
          "-y",
          "-ss",
          String(t),
          "-i",
          out,
          "-vf",
          filter,
          "-frames:v",
          "1",
          "-pix_fmt",
          "rgb24",
          "-f",
          "rawvideo",
          f,
        ]);
        return readFileSync(f);
      }
      // Sampling a fixed bottom-right interior patch avoids titles, logo, grid lines and padding.
      let elapsed = 0;
      const samples: number[][] = [];
      for (const c of recipe.clips) {
        const at = elapsed + c.recipe.duration * 0.55;
        const b = await pixels(
          at,
          `crop=2:2:${Math.round(dimensions[0] / 2 + 200)}:${Math.round(dimensions[1] / 2 + 130)}`,
        );
        samples.push([...b.subarray(0, 3)]);
        elapsed += c.recipe.duration - (c.transition?.duration || 0);
      }
      if (aspect === "1:1") {
        for (let i = 0; i < samples.length; i++) {
          const rgb = colors[i]
            .slice(2)
            .match(/../g)!
            .map((x) => parseInt(x, 16));
          expect(
            samples[i].reduce((n, v, k) => n + (v - rgb[k]) ** 2, 0),
          ).toBeLessThan(6000);
        }
        // Same neutral calibration patches in every source prove a consistent warm grade.
        const neutral = [];
        elapsed = 0;
        for (const c of recipe.clips) {
          const b = await pixels(elapsed + 0.8, "crop=2:2:70:70");
          neutral.push([...b.subarray(0, 3)]);
          expect(b[0]).toBeGreaterThan(b[2]);
          elapsed += c.recipe.duration - (c.transition?.duration || 0);
        }
        for (const rgb of neutral)
          expect(Math.abs(rgb[0] - neutral[0][0])).toBeLessThan(12);
        // Deeper dark patch and rolled-off highlights, measured from actual encoded output.
        expect((await pixels(0.8, "crop=2:2:250:70"))[0]).toBeLessThan(51);
        expect((await pixels(0.8, "crop=2:2:430:70"))[0]).toBeLessThan(230);
        // Slow first source consumes only .4 + output*.5; its t>=2 white sentinel must stay absent.
        const slow = await pixels(
          recipe.clips[0].recipe.duration - 0.3,
          "crop=2:2:600:70",
        );
        expect(slow[0]).toBeLessThan(210);
        const t = recipe.clips[0].recipe.duration - 0.12;
        const blend = await pixels(t, "crop=2:2:560:490");
        expect(blend[1]).toBeGreaterThan(samples[0][1] + 10);
        expect(blend[1]).toBeLessThan(samples[1][1] - 10);
        const fastTime =
          recipe.clips
            .slice(0, 3)
            .reduce(
              (n, c) => n + c.recipe.duration - (c.transition?.duration || 0),
              0,
            ) - 0.02;
        expect((await pixels(fastTime, "crop=2:2:600:70"))[0]).toBeGreaterThan(
          220,
        );
        await expect(
          worker.render(
            row.id,
            { ...recipe.clips[0].recipe, start: 5, duration: 2 },
            "video",
            "range-rejection",
            {
              input: worker.sequenceInputPath(row.id, 0),
              effects: { speed: 2 },
            },
          ),
        ).rejects.toThrow("clip range");
        const closingStart = 12 - recipe.clips.at(-1)!.recipe.duration;
        const logoRef = join(fixtures, "logo.rgb");
        await worker.command(ffmpeg, [
          "-v",
          "error",
          "-y",
          "-i",
          originals.at(-1)!,
          "-vf",
          "scale=280:280",
          "-frames:v",
          "1",
          "-pix_fmt",
          "rgb24",
          "-f",
          "rawvideo",
          logoRef,
        ]);
        const ref = readFileSync(logoRef),
          late = await pixels(closingStart + 1, "crop=280:280:220:220"),
          early = await pixels(closingStart + 0.28, "crop=280:280:220:220");
        const mae = (buf: Buffer) =>
          buf.reduce((n, v, i) => n + Math.abs(v - ref[i]), 0) / ref.length;
        expect(mae(late)).toBeLessThan(12);
        expect(mae(early)).toBeGreaterThan(mae(late) + 8);
        const text = await pixels(0.8, "crop=600:120:60:300");
        expect([...text].filter((v) => v > 200).length).toBeGreaterThan(200);
        const pcm = join(fixtures, "mixed.pcm");
        await worker.command(ffmpeg, [
          "-v",
          "error",
          "-y",
          "-i",
          out,
          "-ac",
          "1",
          "-ar",
          "8000",
          "-f",
          "s16le",
          pcm,
        ]);
        const audio = readFileSync(pcm);
        function tone(freq: number) {
          let re = 0,
            im = 0;
          for (let i = 0; i < 4000; i++) {
            const v = audio.readInt16LE((i + 4000) * 2) / 32768,
              a = (2 * Math.PI * freq * i) / 8000;
            re += v * Math.cos(a);
            im += v * Math.sin(a);
          }
          return Math.hypot(re, im) / 4000;
        }
        expect(tone(220)).toBeGreaterThan(0.01);
        expect(tone(440)).toBeGreaterThan(0.01);
        await worker.command(ffmpeg, [
          "-v",
          "error",
          "-y",
          "-i",
          out,
          "-vf",
          "fps=1/2,scale=240:-1,tile=3x2",
          "-frames:v",
          "1",
          join(destination, "art-of-building-contact-sheet.png"),
        ]);
      }
      const exported = join(
        destination,
        `cobs-art-of-building-${aspect.replace(":", "x")}.mp4`,
      );
      copyFileSync(out, exported);
      results.push({
        aspect,
        dimensions,
        duration: Number(info.format.duration),
        frames: video.nb_frames,
        bytes: statSync(out).size,
        version: recipe.version,
        sources: media.map((f) => f.name),
        samples,
        output: exported,
      });
    } finally {
      db.close();
    }
  }
  expect(originals.map(hash)).toEqual(hashes);
  writeFileSync(
    join(destination, "art-of-building-verification.json"),
    JSON.stringify(
      {
        mode: "synthetic local FFmpeg; no paid AI, visual scene analysis or hosted writes",
        results,
        originalFilesUnchanged: true,
      },
      null,
      2,
    ),
  );
}, 660000);
