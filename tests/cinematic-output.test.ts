import { test, expect } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { resolve, join } from "node:path";
import {
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { defaultRecipe } from "../lib/studio-model.mjs";
import { sequenceSnapshot, validateSequence } from "../lib/sequence-model.mjs";
import {
  sequenceDuration,
  validateEffects,
  validateTracks,
  visualSources,
} from "../lib/cinematic-model.mjs";
process.env.COBS_RENDER_ROOT = resolve(
  ".tools/cinematic-tests-" + randomUUID(),
);
const worker = await import("../lib/render-worker.mjs"),
  ffmpeg = resolve(".tools/ffmpeg/ffmpeg.exe");
test("cinematic effects reject invalid motion, unsupported operations, bad layers and outgoing final transitions", () => {
  expect(
    validateEffects({
      recipe: { duration: 2 },
      effects: {
        motion: {
          fromScale: 0,
          toScale: 2,
          fromX: 0,
          toX: 1,
          fromY: 0,
          toY: 1,
        },
      },
    }),
  ).toBeTruthy();
  expect(
    validateEffects(
      { recipe: { duration: 2 }, transition: { type: "fade", duration: 0.4 } },
      true,
    ),
  ).toBeTruthy();
  expect(
    validateTracks([
      {
        id: randomUUID(),
        kind: "narration",
        volume: 1,
        offset: 0,
        fade: 0,
        loop: true,
      },
    ]),
  ).toBeTruthy();
  const c = {
    mediaId: randomUUID(),
    kind: "image" as const,
    recipe: { ...defaultRecipe(), duration: 2 },
  };
  const snapshot = sequenceSnapshot([{ ...c, effects: { animateText: true } }]);
  expect(snapshot.version).toBe(4);
  expect(validateSequence({ ...snapshot, version: 3 })).toBeTruthy();
});
test("real cinematic six-source export contains music, narration, crossfades, dissolve, motion, layered footage, captions and original logo", async () => {
  const root = process.env.COBS_RENDER_ROOT!,
    fixtures = join(root, "fixtures");
  mkdirSync(fixtures, { recursive: true });
  const colors = ["red", "yellow", "green", "purple", "blue", "cyan"];
  const ids: string[] = colors.map(() => randomUUID());
  const sources: string[] = [];
  for (let i = 0; i < 6; i++) {
    const f = join(fixtures, `${i}${i % 2 ? ".png" : ".mp4"}`);
    await worker.command(ffmpeg, [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      `color=c=${colors[i]}:s=160x120:r=25:d=3`,
      ...(i % 2
        ? ["-frames:v", "1"]
        : [
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:sample_rate=48000",
            "-vf",
            "drawbox=x=15:y=0:w=20:h=ih:color=white:t=fill",
            "-t",
            "3",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
          ]),
      f,
    ]);
    sources.push(f);
  }
  const audio = ["music", "narration"].map((k) => join(fixtures, k + ".wav"));
  for (let i = 0; i < 2; i++)
    await worker.command(ffmpeg, [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${i ? 880 : 220}:sample_rate=48000:duration=${i ? 8 : 2}`,
      "-c:a",
      "pcm_s16le",
      audio[i],
    ]);
  const clips = ids.map((mediaId, i) => ({
    mediaId,
    kind: i % 2 ? ("image" as const) : ("video" as const),
    recipe: {
      ...defaultRecipe(),
      aspect: "1:1" as const,
      duration: 2,
      text:
        i === 0
          ? "COBS BUILDMASTERS LTD"
          : i === 5
            ? "Contact COBS BUILDMASTERS LTD"
            : "",
      captions: [
        { start: 0.5, end: 1.5, text: "SYNTHETIC CINEMATIC VERIFICATION" },
      ],
    },
    ...(i < 5
      ? {
          transition: {
            type: i === 1 ? ("dissolve" as const) : ("fade" as const),
            duration: 0.4,
          },
        }
      : {}),
    ...(i === 0
      ? {
          effects: {
            motion: {
              fromScale: 1,
              toScale: 1.4,
              fromX: 0.2,
              toX: 0.8,
              fromY: 0.5,
              toY: 0.5,
            },
            template: "intro" as const,
            animateText: true,
            layer: {
              mediaId: ids[4],
              kind: "video" as const,
              start: 0,
              x: 0.05,
              y: 0.05,
              width: 0.3,
            },
          },
        }
      : i === 5
        ? { effects: { template: "outro" as const, animateText: true } }
        : {}),
  }));
  const tracks = [
    {
      id: randomUUID(),
      kind: "music" as const,
      volume: 0.4,
      offset: 0,
      fade: 0.2,
      loop: true,
    },
    {
      id: randomUUID(),
      kind: "narration" as const,
      volume: 0.7,
      offset: 1,
      fade: 0.2,
      loop: false,
    },
  ];
  const recipe = sequenceSnapshot(clips, tracks),
    db = worker.database();
  const files = [...sources, ...audio];
  const hashes = files.map((f) =>
    createHash("sha256").update(readFileSync(f)).digest("hex"),
  );
  try {
    const { row } = worker.reserve(
      db,
      "synthetic-owner",
      randomUUID(),
      recipe,
      "video",
      files.reduce((n, f) => n + statSync(f).size, 0),
    );
    visualSources(clips).forEach((id, i) =>
      copyFileSync(
        sources[ids.indexOf(id)],
        worker.sequenceInputPath(row.id, i),
      ),
    );
    audio.forEach((f, i) =>
      copyFileSync(f, join(root, row.id, `audio-${tracks[i].kind}`)),
    );
    worker.setState(db, row.id, "pending");
    await worker.tick(db, "cinematic-test-worker");
    const result = worker.findJob(db, "synthetic-owner", row.id)!;
    if (result.state !== "completed")
      await worker.renderSequence(row.id, recipe, "synthetic-diagnostic");
    expect(result.state).toBe("completed");
    const output = worker.outputPath(result),
      info = await worker.probe(output);
    expect(
      Math.abs(Number(info.format.duration) - sequenceDuration(clips)),
    ).toBeLessThan(0.2);
    expect(info.streams[0].width).toBe(720);
    expect(Number(info.streams[0].nb_frames)).toBeGreaterThanOrEqual(249);
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
    async function pixels(t: number, crop = "crop=2:2:350:440") {
      const p = output + `.${t}-${crop.replace(/\W/g, "")}.rgb`;
      await worker.command(ffmpeg, [
        "-v",
        "error",
        "-y",
        "-ss",
        String(t),
        "-i",
        output,
        "-vf",
        crop,
        "-frames:v",
        "1",
        "-pix_fmt",
        "rgb24",
        "-f",
        "rawvideo",
        p,
      ]);
      return readFileSync(p);
    }
    const palette = [
      [255, 0, 0],
      [255, 255, 0],
      [0, 128, 0],
      [128, 0, 128],
      [0, 0, 255],
      [0, 255, 255],
    ];
    for (const [time, i] of [
      [0.8, 0],
      [2.4, 1],
      [4, 2],
      [5.7, 3],
      [7.3, 4],
      [9, 5],
    ]) {
      const p = await pixels(time);
      expect(
        palette[i].reduce((n, v, k) => n + (v - p[k]) ** 2, 0),
      ).toBeLessThan(3000);
    }
    const blend = await pixels(1.8);
    expect(blend[1]).toBeGreaterThan(30);
    expect(blend[1]).toBeLessThan(230);
    const dissolve = await pixels(3.4, "crop=32:32:300:420");
    let yellow = 0,
      green = 0;
    for (let i = 0; i < dissolve.length; i += 3) {
      if (dissolve[i] > 180 && dissolve[i + 1] > 180) yellow++;
      if (dissolve[i] < 80 && dissolve[i + 1] > 70 && dissolve[i + 1] < 190)
        green++;
    }
    expect(yellow).toBeGreaterThan(30);
    expect(green).toBeGreaterThan(30);
    const whites = (b: Buffer) => {
      let n = 0;
      for (let i = 0; i < b.length; i += 3)
        if (b[i] > 190 && b[i + 1] > 190 && b[i + 2] > 190) n++;
      return n;
    };
    expect(whites(await pixels(0.04, "crop=520:100:200:300"))).toBeLessThan(20);
    expect(whites(await pixels(0.8, "crop=520:100:200:300"))).toBeGreaterThan(
      30,
    );
    expect(whites(await pixels(2.05, "crop=720:150:0:400"))).toBeLessThan(20);
    expect(whites(await pixels(2.4, "crop=720:150:0:400"))).toBeGreaterThan(30);
    const logoReference = output + ".logo-reference.rgb";
    await worker.command(ffmpeg, [
      "-v",
      "error",
      "-y",
      "-i",
      resolve("public/branding/cobs-buildmasters-logo.jpeg"),
      "-vf",
      "scale=120:120",
      "-frames:v",
      "1",
      "-pix_fmt",
      "rgb24",
      "-f",
      "rawvideo",
      logoReference,
    ]);
    const logo = await pixels(0.8, "crop=120:120:580:580"),
      reference = readFileSync(logoReference);
    expect(
      logo.reduce((n, v, i) => n + Math.abs(v - reference[i]), 0) / logo.length,
    ).toBeLessThan(10);
    const layer = await pixels(0.8, "crop=2:2:100:100");
    expect(layer[2]).toBeGreaterThan(180);
    const motion = [];
    for (const t of [0.2, 1.2]) {
      const p = await pixels(t, "crop=720:2:0:300");
      let sum = 0,
        count = 0;
      for (let i = 0; i < 720; i++)
        if (p[i * 3] > 190 && p[i * 3 + 1] > 190 && p[i * 3 + 2] > 190) {
          sum += i;
          count++;
        }
      expect(count).toBeGreaterThan(10);
      motion.push(sum / count);
    }
    expect(Math.abs(motion[0] - motion[1])).toBeGreaterThan(5);
    const pcm = output + ".pcm";
    await worker.command(ffmpeg, [
      "-v",
      "error",
      "-y",
      "-i",
      output,
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
    const tone = (t: number, f: number) => {
      let re = 0,
        im = 0;
      const start = Math.round(t * 8000),
        n = 1600;
      for (let i = 0; i < n; i++) {
        const v = samples.readInt16LE((start + i) * 2);
        re += v * Math.cos((2 * Math.PI * f * i) / 8000);
        im += v * Math.sin((2 * Math.PI * f * i) / 8000);
      }
      return Math.hypot(re, im) / n;
    };
    expect(tone(0.6, 220)).toBeGreaterThan(100);
    expect(tone(0.6, 880)).toBeLessThan(30);
    expect(tone(2.4, 220)).toBeGreaterThan(100);
    expect(tone(2.4, 880)).toBeGreaterThan(100);
    expect(tone(0.6, 440)).toBeGreaterThan(100);
    expect(tone(9.6, 220)).toBeGreaterThan(100);
    expect(tone(0.02, 220) / tone(0.6, 220)).toBeLessThan(0.8);
    expect(tone(8.85, 880) / tone(2.4, 880)).toBeLessThan(0.8);
    expect(
      files.map((f) =>
        createHash("sha256").update(readFileSync(f)).digest("hex"),
      ),
    ).toEqual(hashes);
    const delivery = resolve(".tools/delivery/media-studio");
    mkdirSync(delivery, { recursive: true });
    copyFileSync(output, join(delivery, "synthetic-cinematic-six-sources.mp4"));
    writeFileSync(
      join(delivery, "cinematic-verification.json"),
      JSON.stringify(
        {
          scope:
            "Real local FFmpeg output, synthetic originals; no hosted writes or AI calls",
          recipe,
          duration: Number(info.format.duration),
          motionCentroids: motion,
          audio: {
            music220: tone(2.4, 220),
            narration880: tone(2.4, 880),
            original440: tone(0.6, 440),
          },
          fullDecode: "passed",
          sourceHashes: hashes,
        },
        null,
        2,
      ),
    );
  } finally {
    db.close();
  }
}, 180000);
