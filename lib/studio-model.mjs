export const EDIT_PREFIX = "[COBS_EDIT_PROJECT_V1]\n";
export const DIMENSIONS = {
  "9:16": [720, 1280],
  "16:9": [1280, 720],
  "1:1": [720, 720],
  "4:5": [720, 900],
};
export function defaultRecipe() {
  return {
    version: 1,
    aspect: "9:16",
    fit: "contain",
    position: 0.5,
    start: 0,
    duration: 15,
    brightness: 0,
    contrast: 1,
    saturation: 1,
    volume: 1,
    fade: 0,
    watermark: true,
    text: "",
    subtitle: "",
    captions: [],
  };
}
export function validateRecipe(r) {
  if (
    !r ||
    typeof r !== "object" ||
    Array.isArray(r) ||
    r.version !== 1 ||
    !Object.hasOwn(DIMENSIONS, r.aspect) ||
    !["contain", "cover"].includes(r.fit)
  )
    return "Invalid editing recipe.";
  for (const [k, min, max] of [
    ["position", 0, 1],
    ["start", 0, 570],
    ["duration", 1, 30],
    ["brightness", -0.3, 0.3],
    ["contrast", 0.5, 1.5],
    ["saturation", 0, 2],
    ["volume", 0, 2],
    ["fade", 0, 3],
  ]) {
    if (
      typeof r[k] !== "number" ||
      !Number.isFinite(r[k]) ||
      r[k] < min ||
      r[k] > max
    )
      return `Invalid ${k}.`;
  }
  if (r.fade > r.duration / 2 || typeof r.watermark !== "boolean")
    return "Invalid fade or watermark.";
  for (const k of ["text", "subtitle"])
    if (
      typeof r[k] !== "string" ||
      r[k].length > 120 ||
      /[\x00-\x1f\x7f]/.test(r[k])
    )
      return "Use a single line of at most 120 characters for overlays.";
  if (r.captions !== undefined) {
    if (!Array.isArray(r.captions) || r.captions.length > 12)
      return "Use at most 12 timed captions per clip.";
    let previous = 0;
    for (const cue of r.captions) {
      if (
        !cue ||
        typeof cue.start !== "number" ||
        typeof cue.end !== "number" ||
        !Number.isFinite(cue.start) ||
        !Number.isFinite(cue.end) ||
        cue.start < previous ||
        cue.end - cue.start < 0.04 - 1e-6 ||
        cue.end > r.duration ||
        typeof cue.text !== "string" ||
        !cue.text.trim() ||
        cue.text.length > 120 ||
        /[\x00-\x1f\x7f]/.test(cue.text)
      )
        return "Use ordered, non-overlapping caption times within the clip and 1–120 characters.";
      previous = cue.end;
    }
    if (r.captions.length && r.subtitle)
      return "Choose timed captions or a static subtitle, not both.";
  }
  return null;
}
export function sliceCaptions(recipe, from, to) {
  return (recipe.captions || [])
    .filter((c) => c.end > from && c.start < to)
    .map((c) => ({
      start: Math.max(c.start, from) - from,
      end: Math.min(c.end, to) - from,
      text: c.text,
    }))
    .filter((c) => c.end - c.start >= 0.04 - 1e-6);
}
export function encodeEdit(r) {
  const error = validateRecipe(r);
  if (error) throw new Error(error);
  return EDIT_PREFIX + JSON.stringify(r);
}
export function decodeEdit(body) {
  try {
    if (!body?.startsWith(EDIT_PREFIX)) return null;
    const r = JSON.parse(body.slice(EDIT_PREFIX.length));
    return validateRecipe(r) ? null : r;
  } catch {
    return null;
  }
}
export function isEditingRecord(post) {
  return typeof post.body === "string" && post.body.startsWith(EDIT_PREFIX);
}
