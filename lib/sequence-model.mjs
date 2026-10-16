import { defaultRecipe, validateRecipe } from "./studio-model.mjs";
import {
  validateEffects,
  validateTracks,
  sequenceDuration,
  visualSources,
} from "./cinematic-model.mjs";
export const SEQUENCE_LIMITS = Object.freeze({
  clips: 12,
  sources: 6,
  seconds: 60,
  bytes: 50 * 1024 * 1024,
});
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function validateSequence(s) {
  if (
    !s ||
    ![2, 3, 4, 5].includes(s.version) ||
    !Array.isArray(s.clips) ||
    !s.clips.length ||
    s.clips.length > SEQUENCE_LIMITS.clips
  )
    return "Use 1–12 clips for a combined export.";
  const kinds = new Map();
  let duration = 0,
    aspect;
  for (const c of s.clips) {
    if (
      !c ||
      !uuid.test(c.mediaId) ||
      !["image", "video"].includes(c.kind) ||
      validateRecipe(c.recipe)
    )
      return "Invalid combined-export clip.";
    if (c.recipe.captions?.length && s.version < 3)
      return "Timed captions require a version-3 sequence.";
    if (kinds.has(c.mediaId) && kinds.get(c.mediaId) !== c.kind)
      return "Conflicting source types.";
    kinds.set(c.mediaId, c.kind);
    const effectError = validateEffects(c, c === s.clips.at(-1));
    if (effectError) return effectError;
    if ((c.effects || c.transition || s.audioTracks?.length) && s.version < 4)
      return "Cinematic features require worker version 4.";
    if (
      (c.effects?.grade ||
        c.effects?.speed !== undefined ||
        c.effects?.logoEnding !== undefined) &&
      s.version < 5
    )
      return "Construction effects require worker version 5.";
    if (c.effects?.layer) {
      const l = c.effects.layer;
      if (kinds.has(l.mediaId) && kinds.get(l.mediaId) !== l.kind)
        return "Conflicting layer source type.";
      kinds.set(l.mediaId, l.kind);
    }
    if (aspect && c.recipe.aspect !== aspect)
      return "All clips must use the same aspect ratio.";
    aspect = c.recipe.aspect;
    duration += c.recipe.duration;
  }
  if (kinds.size > SEQUENCE_LIMITS.sources)
    return "Use at most six unique originals per export.";
  if (duration > SEQUENCE_LIMITS.seconds)
    return "Combined exports support up to 60 seconds.";
  const tracksError = validateTracks(s.audioTracks);
  if (tracksError) return tracksError;
  if (
    s.clips.some(
      (c, i) =>
        i < s.clips.length - 1 &&
        (c.transition?.duration || 0) > s.clips[i + 1].recipe.duration / 2,
    )
  )
    return "Transition exceeds the next clip range.";
  return null;
}
export function sequenceSnapshot(clips, audioTracks) {
  const result = {
    version: clips.some(
      (c) =>
        c.effects?.grade ||
        c.effects?.speed !== undefined ||
        c.effects?.logoEnding !== undefined,
    )
      ? 5
      : clips.some((c) => c.effects || c.transition) || audioTracks?.length
        ? 4
        : clips.some((c) => c.recipe?.captions?.length)
          ? 3
          : 2,
    clips: clips.map((c) => ({
      mediaId: c.mediaId,
      kind: c.kind,
      ...(c.effects ? { effects: c.effects } : {}),
      ...(c.transition ? { transition: c.transition } : {}),
      recipe: Object.fromEntries(
        Object.keys(defaultRecipe()).map((k) => [
          k,
          k === "captions" && Array.isArray(c.recipe?.captions)
            ? c.recipe.captions.map((cue) => ({
                start: cue?.start,
                end: cue?.end,
                text: cue?.text,
              }))
            : c.recipe?.[k],
        ]),
      ),
    })),
  };
  if (audioTracks?.length) result.audioTracks = audioTracks;
  const error = validateSequence(result);
  if (error) throw new Error(error);
  return result;
}
