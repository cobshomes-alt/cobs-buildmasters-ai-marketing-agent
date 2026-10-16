export const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const finite = (v, min, max) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const keys = (o, allowed) =>
  o &&
  typeof o === "object" &&
  !Array.isArray(o) &&
  Object.keys(o).every((k) => allowed.includes(k));
export function validateEffects(c, last = false) {
  const e = c.effects;
  if (e !== undefined) {
    if (
      !keys(e, [
        "motion",
        "template",
        "animateText",
        "layer",
        "grade",
        "speed",
        "logoEnding",
      ])
    )
      return "Unsupported cinematic effect.";
    if (e.grade !== undefined && e.grade !== "art-of-building")
      return "Unsupported colour preset.";
    if (
      e.speed !== undefined &&
      (c.kind !== "video" || !finite(e.speed, 0.5, 2))
    )
      return "Video speed must be between 0.5 and 2.";
    if (
      e.logoEnding !== undefined &&
      (typeof e.logoEnding !== "boolean" ||
        (e.logoEnding && (!last || !c.recipe.watermark)))
    )
      return "Animated logo requires the branded final scene.";
    if (
      e.template !== undefined &&
      !["plain", "lower-third", "intro", "outro"].includes(e.template)
    )
      return "Unsupported title template.";
    if (e.animateText !== undefined && typeof e.animateText !== "boolean")
      return "Invalid text animation.";
    if (e.motion !== undefined) {
      const m = e.motion;
      if (
        !keys(m, ["fromScale", "toScale", "fromX", "toX", "fromY", "toY"]) ||
        !["fromScale", "toScale"].every((k) => finite(m[k], 1, 1.8)) ||
        !["fromX", "toX", "fromY", "toY"].every((k) => finite(m[k], 0, 1))
      )
        return "Use two bounded linear motion keyframes.";
    }
    if (e.layer !== undefined) {
      const l = e.layer;
      if (
        !keys(l, ["mediaId", "kind", "start", "x", "y", "width"]) ||
        !uuid.test(l.mediaId) ||
        !["image", "video"].includes(l.kind) ||
        !finite(l.start, 0, 570) ||
        (l.kind === "image" && l.start !== 0) ||
        !finite(l.width, 0.15, 0.45) ||
        !finite(l.x, 0, 1 - l.width) ||
        !finite(l.y, 0, 0.55)
      )
        return "Invalid picture-in-picture layer.";
    }
  }
  if (c.transition !== undefined) {
    const t = c.transition;
    if (
      !keys(t, ["type", "duration"]) ||
      !["cut", "fade", "dissolve"].includes(t.type) ||
      !finite(t.duration, 0, 1) ||
      (t.type === "cut"
        ? t.duration !== 0
        : t.duration < 0.08 || t.duration > c.recipe.duration / 2) ||
      (last && t.type !== "cut")
    )
      return "Invalid outgoing transition.";
  }
  return null;
}
export function validateTracks(tracks) {
  if (tracks === undefined) return null;
  if (
    !Array.isArray(tracks) ||
    tracks.length > 2 ||
    new Set(tracks.map((t) => t?.kind)).size !== tracks.length
  )
    return "Use one music and one narration track.";
  for (const t of tracks)
    if (
      !keys(t, ["id", "kind", "volume", "offset", "fade", "loop"]) ||
      !uuid.test(t.id) ||
      !["music", "narration"].includes(t.kind) ||
      !finite(t.volume, 0, 2) ||
      !finite(t.offset, 0, 59) ||
      !finite(t.fade, 0, 3) ||
      typeof t.loop !== "boolean" ||
      (t.kind === "narration" && t.loop)
    )
      return "Invalid separate audio track.";
  return null;
}
export const sequenceDuration = (clips) =>
  clips.reduce(
    (n, c, i) =>
      n +
      c.recipe.duration -
      (i < clips.length - 1 && c.transition?.type !== "cut"
        ? c.transition?.duration || 0
        : 0),
    0,
  );
export function visualSources(clips) {
  return [
    ...new Set(
      clips.flatMap((c) => [
        c.mediaId,
        ...(c.effects?.layer ? [c.effects.layer.mediaId] : []),
      ]),
    ),
  ];
}
