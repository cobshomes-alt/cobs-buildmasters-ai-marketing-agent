import { test, expect } from "vitest";
import {
  newTimeline,
  newClip,
  validateTimeline,
  moveClip,
  splitClip,
  clipAt,
  timelineDuration,
} from "../lib/timeline";
const photo = {
  id: "11111111-1111-4111-8111-111111111111",
  original_name: "Synthetic photo",
  mime_type: "image/png",
};
test("mixed timeline orders, splits, removes and preserves original identities without mutation", () => {
  const original = newTimeline(),
    image = newClip(photo),
    video = newClip({
      ...photo,
      id: "22222222-2222-4222-8222-222222222222",
      mime_type: "video/mp4",
    });
  const doc = { ...original, clips: [image, video] };
  expect(validateTimeline(doc)).toBeNull();
  expect(timelineDuration(doc)).toBe(10);
  expect(clipAt(doc, 6)?.clip.id).toBe(video.id);
  const moved = moveClip(doc, video.id, -1);
  expect(moved.clips[0].id).toBe(video.id);
  expect(doc.clips[0].id).toBe(image.id);
  const split = splitClip(doc, video.id, 2);
  expect(split.clips).toHaveLength(3);
  expect(split.clips[2].recipe.start).toBe(2);
  expect(split.clips[2].mediaId).toBe(video.mediaId);
  expect(timelineDuration(split)).toBe(10);
  expect(
    validateTimeline({
      ...doc,
      clips: Array.from({ length: 41 }, () => newClip(photo)),
    }),
  ).toBeTruthy();
  expect(validateTimeline({ ...doc, clips: [image, image] })).toBeTruthy();
});
test("20-item factory production remains bounded and rejects overlong or invalid references", () => {
  const doc = {
    ...newTimeline(),
    clips: Array.from({ length: 20 }, (_, i) =>
      newClip({ ...photo, mime_type: i < 12 ? "video/mp4" : "image/png" }),
    ),
  };
  expect(validateTimeline(doc)).toBeNull();
  expect(timelineDuration(doc)).toBe(100);
  expect(
    validateTimeline({
      ...doc,
      clips: doc.clips.map((c) => ({
        ...c,
        recipe: { ...c.recipe, duration: 30 },
      })),
    }),
  ).toMatch(/five minutes/);
  expect(
    validateTimeline({ ...doc, clips: [{ ...doc.clips[0], mediaId: "bad" }] }),
  ).toBeTruthy();
});
