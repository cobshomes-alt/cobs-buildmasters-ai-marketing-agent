import { test, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  generateEditingPlan,
  validateBrief,
  validatePlanTimeline,
  instructionHints,
  type EditBrief,
  type MediaFacts,
} from "../lib/automatic-editing";
const media: MediaFacts[] = Array.from({ length: 6 }, (_, i) => ({
  id: randomUUID(),
  name: `Owner label ${i}`,
  mime: i % 2 ? "image/png" : "video/mp4",
  bytes: 100,
  width: 160,
  height: 120,
  duration: i % 2 ? null : 10,
  audio: i === 0,
  orientation: "landscape",
  labels: ["Owner supplied"],
  thumbnail: i % 2 ? "private original" : "not generated",
}));
const brief = (): EditBrief => ({
  instructions: "Prepare a professional factory promotion",
  mediaIds: media.map((m) => m.id),
  priorityIds: [],
  platforms: ["Instagram", "TikTok"],
  duration: 45,
  aspect: "9:16",
  style: "professional",
  companyInfo: "Owner verified notes",
  narration: "Notes only",
  captions: true,
  branding: true,
  starts: {},
});
test("plain-English instruction hints are explicit, deterministic and do not invent scene content", () => {
  expect(
    instructionHints(
      "Create a professional 45-second Instagram and TikTok advertisement, vertical, captions and company logo",
    ),
  ).toEqual({
    duration: 45,
    platforms: ["Instagram", "TikTok"],
    aspect: "9:16",
    style: "professional",
    captions: true,
    branding: true,
  });
  expect(
    instructionHints("Use landscape without captions and without logo"),
  ).toEqual({ aspect: "16:9", captions: false, branding: false });
  expect(instructionHints("Show a happy customer")).toEqual({});
});
test("deterministic six-source planner uses only selected facts, whole frames, priority and editable captions", () => {
  const b = brief();
  b.priorityIds = [media[4].id];
  b.starts[media[4].id] = 2;
  const p = generateEditingPlan(b, media);
  expect(p.mode).toBe("rule-based");
  expect(p.scenes[0].mediaId).toBe(media[4].id);
  expect(p.scenes[0].start).toBe(2);
  expect(p.totalDuration).toBe(45);
  expect(p.timeline.clips).toHaveLength(6);
  expect(p.timeline.clips.every((c) => c.recipe.watermark)).toBe(true);
  expect(p.scenes.every((s) => s.transition === "cut")).toBe(true);
  expect(p.scenes.at(-1)?.caption).toMatch(/Contact COBS/);
  expect(() => validatePlanTimeline(p.timeline, media)).not.toThrow();
  expect(JSON.stringify(p.scenes)).not.toContain("Owner verified notes");
});
test("rejects unavailable metadata, insufficient duration, spoofed IDs and unsupported effects", () => {
  expect(() => generateEditingPlan(brief(), media.slice(1))).toThrow(
    /metadata/,
  );
  expect(() =>
    generateEditingPlan(
      {
        ...brief(),
        duration: 60,
        starts: Object.fromEntries(
          media.filter((m) => m.duration).map((m) => [m.id, 9.5]),
        ),
      },
      media,
    ),
  ).toThrow(/duration/);
  expect(() =>
    generateEditingPlan({ ...brief(), mediaIds: [randomUUID()] }, media),
  ).toThrow();
  for (const instructions of [
    "Add crossfade transitions",
    "Use zoom and pan",
    "Add a music soundtrack",
    "Generate voice-over",
    "Set opacity to 50%",
  ])
    expect(() => validateBrief({ ...brief(), instructions })).toThrow(
      /unsupported/,
    );
  expect(() => validateBrief({ ...brief(), effects: ["dissolve"] })).toThrow();
  expect(() => validateBrief({ ...brief(), duration: 61 })).toThrow();
  expect(() => validateBrief({ ...brief(), duration: 6.01 })).toThrow();
  expect(() =>
    generateEditingPlan(
      brief(),
      media.map((m) => ({ ...m, bytes: 10 * 1024 * 1024 })),
    ),
  ).toThrow(/50 MiB/);
});
test("edited proposals reject unknown references and out-of-source trims; disabled branding/captions remain off", () => {
  const p = generateEditingPlan(
    { ...brief(), duration: 6, captions: false, branding: false },
    media,
  );
  expect(
    p.timeline.clips.every(
      (c) => !c.recipe.watermark && !c.recipe.captions?.length,
    ),
  ).toBe(true);
  p.timeline.clips[0].recipe.start = 10;
  expect(() => validatePlanTimeline(p.timeline, media)).toThrow(/duration/);
  p.timeline.clips[0].recipe.start = 0;
  p.timeline.clips[0].mediaId = randomUUID();
  expect(() => validatePlanTimeline(p.timeline, media)).toThrow(/unavailable/);
});
