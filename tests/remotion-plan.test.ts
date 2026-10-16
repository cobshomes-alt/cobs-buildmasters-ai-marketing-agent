import { test, expect } from "vitest";
import { newClip, newTimeline } from "../lib/timeline";
import {
  compileGraphicsPlan,
  directiveFromTimeline,
  baseTimeline,
} from "../lib/remotion/plan";
const photo = {
  id: "11111111-1111-4111-8111-111111111111",
  original_name: "Synthetic",
  mime_type: "image/png",
};
function fixture() {
  const clips = [
    newClip(photo),
    newClip({ ...photo, id: "22222222-2222-4222-8222-222222222222" }),
  ];
  clips[0].recipe.duration = 2;
  clips[0].recipe.text = "Synthetic opening";
  clips[0].transition = { type: "fade", duration: 0.2 };
  clips[1].recipe.duration = 2;
  clips[1].effects = { logoEnding: true };
  return { ...newTimeline(), clips };
}
test("graphics uses the existing overlap timing, bounded titles and original logo settings", () => {
  const doc = fixture(),
    before = JSON.stringify(doc),
    directive = directiveFromTimeline(doc),
    plan = compileGraphicsPlan(doc, directive);
  expect(plan.frames).toBe(95);
  expect(plan.logoFrom).toBe(45);
  expect(plan.scenes[0]).toMatchObject({ from: 0, to: 45 });
  const base = baseTimeline(doc, directive);
  expect(base.clips[0].recipe.text).toBe("");
  expect(base.clips[1].recipe.watermark).toBe(false);
  expect(base.clips[0].transition).toEqual(doc.clips[0].transition);
  expect(JSON.stringify(doc)).toBe(before);
});
test("untrusted model directives reject code, URLs, unknown assets, styles and commercial mode", () => {
  const doc = fixture(),
    d = directiveFromTimeline(doc);
  for (const bad of [
    { ...d, mode: "commercial" },
    { ...d, url: "https://example.test/private" },
    { ...d, scenes: [{ ...d.scenes[0], clipId: crypto.randomUUID() }] },
    { ...d, scenes: [{ ...d.scenes[0], style: "arbitrary-shader" }] },
    { ...d, scenes: [{ ...d.scenes[0], title: "x".repeat(81) }] },
    { ...d, scenes: [d.scenes[0], d.scenes[0]] },
  ])
    expect(() => compileGraphicsPlan(doc, bad)).toThrow();
});
test("automatic planner output maps titles honestly without truncation or invented visual facts", () => {
  const doc = fixture();
  doc.clips[0].recipe.text = "x".repeat(81);
  expect(() => compileGraphicsPlan(doc, directiveFromTimeline(doc))).toThrow(
    /Invalid graphics/,
  );
  doc.clips[0].recipe.text = "";
  expect(directiveFromTimeline(doc).scenes).toEqual([]);
  doc.clips[1].effects = undefined;
  expect(() => compileGraphicsPlan(doc, directiveFromTimeline(doc))).toThrow(
    /Add a scene title/,
  );
});
