import {
  defaultRecipe,
  validateRecipe,
  sliceCaptions,
  type Recipe,
} from "./studio-model.mjs";
export type TimelineClip = {
  id: string;
  mediaId: string;
  kind: "image" | "video";
  label: string;
  recipe: Recipe;
};
export type TimelineDocument = {
  version: 1;
  id: string;
  title: string;
  campaignId: string | null;
  aspect: Recipe["aspect"];
  clips: TimelineClip[];
};
export type SavedTimeline = TimelineDocument & {
  revision: number;
  updatedAt: string;
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function newTimeline(): TimelineDocument {
  return {
    version: 1,
    id: crypto.randomUUID(),
    title: "Untitled production",
    campaignId: null,
    aspect: "9:16",
    clips: [],
  };
}
export function newClip(media: {
  id: string;
  original_name: string;
  mime_type: string;
}): TimelineClip {
  return {
    id: crypto.randomUUID(),
    mediaId: media.id,
    kind: media.mime_type.startsWith("video/") ? "video" : "image",
    label: media.original_name,
    recipe: { ...defaultRecipe(), duration: 5, watermark: true },
  };
}
export function timelineDuration(doc: TimelineDocument) {
  return doc.clips.reduce((sum, c) => sum + c.recipe.duration, 0);
}
export function validateTimeline(value: unknown): string | null {
  const d = value as TimelineDocument;
  if (
    !d ||
    d.version !== 1 ||
    !uuid.test(d.id) ||
    typeof d.title !== "string" ||
    !d.title.trim() ||
    d.title.length > 180 ||
    !["9:16", "16:9", "1:1", "4:5"].includes(d.aspect) ||
    !(d.campaignId === null || uuid.test(d.campaignId)) ||
    !Array.isArray(d.clips) ||
    d.clips.length > 40
  )
    return "Invalid project. Use a title and at most 40 clips.";
  const ids = new Set<string>();
  for (const c of d.clips) {
    if (
      !c ||
      !uuid.test(c.id) ||
      ids.has(c.id) ||
      !uuid.test(c.mediaId) ||
      !["video", "image"].includes(c.kind) ||
      typeof c.label !== "string" ||
      c.label.length > 200 ||
      validateRecipe(c.recipe) ||
      c.recipe.aspect !== d.aspect
    )
      return "A timeline clip is invalid.";
    ids.add(c.id);
  }
  if (timelineDuration(d) > 300)
    return "This milestone supports timelines up to five minutes.";
  return null;
}
export function moveClip(
  d: TimelineDocument,
  id: string,
  delta: number,
): TimelineDocument {
  const clips = [...d.clips],
    from = clips.findIndex((c) => c.id === id),
    to = from + delta;
  if (from < 0 || to < 0 || to >= clips.length) return d;
  [clips[from], clips[to]] = [clips[to], clips[from]];
  return { ...d, clips };
}
export function splitClip(
  d: TimelineDocument,
  id: string,
  offset: number,
): TimelineDocument {
  const index = d.clips.findIndex((c) => c.id === id),
    clip = d.clips[index];
  if (
    !clip ||
    offset < 1 ||
    clip.recipe.duration - offset < 1 ||
    d.clips.length >= 40
  )
    return d;
  const first = {
      ...clip,
      recipe: {
        ...clip.recipe,
        duration: offset,
        captions: sliceCaptions(clip.recipe, 0, offset),
        fade: Math.min(clip.recipe.fade, offset / 2),
      },
    },
    second = {
      ...clip,
      id: crypto.randomUUID(),
      recipe: {
        ...clip.recipe,
        start:
          clip.kind === "video"
            ? clip.recipe.start + offset
            : clip.recipe.start,
        duration: clip.recipe.duration - offset,
        captions: sliceCaptions(clip.recipe, offset, clip.recipe.duration),
        fade: Math.min(clip.recipe.fade, (clip.recipe.duration - offset) / 2),
      },
    };
  return {
    ...d,
    clips: [
      ...d.clips.slice(0, index),
      first,
      second,
      ...d.clips.slice(index + 1),
    ],
  };
}
export function clipAt(d: TimelineDocument, time: number) {
  let start = 0;
  for (const clip of d.clips) {
    const end = start + clip.recipe.duration;
    if (time < end) return { clip, start, offset: Math.max(0, time - start) };
    start = end;
  }
  const clip = d.clips.at(-1);
  return clip
    ? {
        clip,
        start: start - clip.recipe.duration,
        offset: clip.recipe.duration,
      }
    : null;
}
