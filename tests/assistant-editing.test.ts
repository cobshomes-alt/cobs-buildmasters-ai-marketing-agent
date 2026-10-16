import { test, expect } from "vitest";
import {
  proposeEdit,
  confirmEdit,
  starterTemplates,
} from "../lib/assistant-editing";
import {
  newTimeline,
  newClip,
  timelineDuration,
  validateTimeline,
} from "../lib/timeline";
function fixture() {
  return {
    ...newTimeline(),
    clips: Array.from({ length: 3 }, () => {
      const c = newClip({
        id: crypto.randomUUID(),
        original_name: "SYNTHETIC",
        mime_type: "image/png",
      });
      c.recipe.duration = 15;
      return c;
    }),
  };
}
test("proposes supported changes without mutation, confirms atomically and rejects stale plans", () => {
  const d = fixture(),
    before = JSON.stringify(d),
    p = proposeEdit(
      d,
      "Make this video more cinematic and use a vertical Instagram format",
    );
  expect(JSON.stringify(d)).toBe(before);
  expect(validateTimeline(p.document)).toBeNull();
  expect(p.document.clips[0].effects?.grade).toBe("art-of-building");
  const applied = confirmEdit(d, p);
  expect(applied).not.toBe(p.document);
  expect(() => confirmEdit({ ...d, title: "Changed" }, p)).toThrow(
    "timeline changed",
  );
  expect(JSON.parse(before)).toEqual(d);
});
test("shortens without extending originals and preserves project identity, captions, tracks", () => {
  const d = fixture();
  const p = proposeEdit(d, "Shorten this video to 30 seconds");
  expect(timelineDuration(p.document)).toBeCloseTo(30);
  expect(p.document.id).toBe(d.id);
  expect(() => proposeEdit(d, "Shorten this video to 60 seconds")).toThrow();
});
test("all templates use valid real effects; captions require owner text; unsupported edits fail", () => {
  for (const t of starterTemplates) {
    const p = proposeEdit(fixture(), t);
    expect(validateTimeline(p.document)).toBeNull();
    expect(p.document.clips.at(-1)?.effects?.logoEnding).toBe(true);
  }
  expect(() => proposeEdit(fixture(), "Add professional captions")).toThrow(
    "verified caption",
  );
  const p = proposeEdit(
    fixture(),
    "Add professional captions",
    "Synthetic test only",
  );
  expect(p.document.clips[0].recipe.captions?.[0].text).toBe(
    "Synthetic test only",
  );
  expect(() =>
    proposeEdit(p.document, "Add professional captions", "Overwrite"),
  ).toThrow("preserved");
  expect(() => proposeEdit(fixture(), "Make cinematic and publish")).toThrow();
  expect(() => proposeEdit({ ...newTimeline() }, "cinematic")).toThrow(
    "Add your photos",
  );
});

test("metadata arrangement retains all sources and rejects partially supported instructions", () => {
  const d = fixture();
  d.clips[0].kind = "video";
  d.clips[1].kind = "video";
  const p = proposeEdit(
    d,
    "Arrange the uploaded photos and videos into an attractive sequence",
  );
  expect(p.document.clips.map((c) => c.kind)).toEqual([
    "video",
    "image",
    "video",
  ]);
  expect(new Set(p.document.clips.map((c) => c.id))).toEqual(
    new Set(d.clips.map((c) => c.id)),
  );
  expect(() =>
    proposeEdit(d, "Make this video more cinematic and add a dragon"),
  ).toThrow("Unsupported");
});
