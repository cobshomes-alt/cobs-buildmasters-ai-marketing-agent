import { test, expect } from "vitest";
import {
  newTimeline,
  newClip,
  reorderClip,
  validateTimeline,
} from "../lib/timeline";
import { projectFile, openProjectFile } from "../lib/project-file";
const asset = {
  id: "11111111-1111-4111-8111-111111111111",
  original_name: "Synthetic photo",
  mime_type: "image/png",
};
test("local project recovery preserves editable scenes and rejects missing originals", () => {
  const clips = Array.from({ length: 8 }, (_, i) => ({
    ...newClip({
      ...asset,
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    }),
    recipe: { ...newClip(asset).recipe, text: `Scene ${i + 1}` },
  }));
  const doc = { ...newTimeline(), title: "Synthetic recovery", clips };
  const ids = clips.map((c) => c.mediaId);
  const raw = projectFile(doc);
  expect(openProjectFile(raw, ids)).toEqual(doc);
  expect(() => openProjectFile(raw, ids.slice(1))).toThrow(
    /originals are missing/,
  );
  expect(() => openProjectFile("{", ids)).toThrow(/valid COBS project/);
  expect(() => openProjectFile("x".repeat(524289), ids)).toThrow(/too large/);
  expect(() =>
    openProjectFile(JSON.stringify({ ...doc, aspect: "unsupported" }), ids),
  ).toThrow();
});
test("project download strips unknown root and recipe fields", () => {
  const clip = newClip(asset);
  const doc = {
    ...newTimeline(),
    clips: [
      { ...clip, recipe: { ...clip.recipe, privateSession: "never export" } },
    ],
    privateToken: "never export",
  };
  const raw = projectFile(doc);
  expect(raw).not.toContain("privateSession");
  expect(raw).not.toContain("privateToken");
});
test("drag reorder preserves source references, trim and captions without mutating original", () => {
  const clips = Array.from({ length: 3 }, () => newClip(asset));
  const doc = { ...newTimeline(), clips };
  const next = reorderClip(doc, clips[0].id, clips[2].id);
  expect(next.clips.map((c) => c.id)).toEqual([
    clips[1].id,
    clips[2].id,
    clips[0].id,
  ]);
  expect(doc.clips[0]).toBe(clips[0]);
  expect(next.clips[2].recipe).toEqual(clips[0].recipe);
  expect(validateTimeline(next)).toBeNull();
  expect(reorderClip(doc, "foreign", clips[0].id)).toBe(doc);
});
