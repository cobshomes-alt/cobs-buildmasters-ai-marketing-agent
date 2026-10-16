import { validateTimeline, type TimelineDocument } from "../timeline";
import { sequenceSnapshot } from "../sequence-model.mjs";
import { DIMENSIONS } from "../studio-model.mjs";

export type GraphicsDirective = {
  version: 1;
  mode: "local-evaluation";
  scenes: {
    clipId: string;
    title: string;
    style: "premium-title" | "lower-third";
  }[];
  logoEnding: boolean;
};
export type GraphicsPlan = {
  fps: 25;
  width: number;
  height: number;
  frames: number;
  scenes: {
    clipId: string;
    from: number;
    to: number;
    title: string;
    style: "premium-title" | "lower-third";
  }[];
  logoFrom: number | null;
};
const exact = (o: unknown, allowed: string[]) =>
  o !== null &&
  typeof o === "object" &&
  !Array.isArray(o) &&
  Object.keys(o).every((k) => allowed.includes(k));

/** Accept data only, never model-generated JSX, URLs, paths or shell arguments. */
export function compileGraphicsPlan(
  doc: TimelineDocument,
  value: unknown,
): GraphicsPlan {
  const invalid = validateTimeline(doc);
  if (invalid) throw Error(invalid);
  sequenceSnapshot(doc.clips, doc.audioTracks);
  const d = value as GraphicsDirective;
  if (
    !exact(d, ["version", "mode", "scenes", "logoEnding"]) ||
    d.version !== 1 ||
    d.mode !== "local-evaluation" ||
    !Array.isArray(d.scenes) ||
    d.scenes.length > 12 ||
    typeof d.logoEnding !== "boolean"
  )
    throw Error("Use a bounded local-evaluation graphics directive.");
  const ids = new Set<string>();
  if (!d.scenes.length && !d.logoEnding)
    throw Error(
      "Add a scene title or final logo ending before evaluating graphics.",
    );
  for (const s of d.scenes) {
    if (
      !exact(s, ["clipId", "title", "style"]) ||
      !doc.clips.some((c) => c.id === s.clipId) ||
      ids.has(s.clipId) ||
      typeof s.title !== "string" ||
      !s.title.trim() ||
      s.title.length > 80 ||
      /[\u0000-\u001f]/.test(s.title) ||
      !["premium-title", "lower-third"].includes(s.style)
    )
      throw Error("Invalid graphics scene, title or supported style.");
    ids.add(s.clipId);
  }
  let cursor = 0;
  const windows = doc.clips.map((c, i) => {
    const from = Math.round(cursor * 25);
    cursor +=
      c.recipe.duration -
      (i < doc.clips.length - 1 ? c.transition?.duration || 0 : 0);
    return { clipId: c.id, from, to: Math.round(cursor * 25) };
  });
  const [width, height] = DIMENSIONS[doc.aspect];
  const scenes = d.scenes.map((s) => ({
    ...s,
    ...windows.find((w) => w.clipId === s.clipId)!,
  }));
  const last = windows.at(-1)!;
  if (d.logoEnding && !doc.clips.at(-1)?.recipe.watermark)
    throw Error("Enable original branding on the final scene first.");
  return {
    fps: 25,
    width,
    height,
    frames: Math.round(cursor * 25),
    scenes,
    logoFrom: d.logoEnding ? last.from : null,
  };
}

/** Deterministic mapping from existing editable scene titles; no visual analysis. */
export function directiveFromTimeline(
  doc: TimelineDocument,
): GraphicsDirective {
  return {
    version: 1,
    mode: "local-evaluation",
    scenes: doc.clips
      .filter((c) => c.recipe.text.trim())
      .map((c) => ({
        clipId: c.id,
        title: c.recipe.text,
        style:
          c.effects?.template === "lower-third"
            ? "lower-third"
            : "premium-title",
      })),
    logoEnding: Boolean(doc.clips.at(-1)?.effects?.logoEnding),
  };
}

/** Render a derived base without double titles/closing logos. Original doc is untouched. */
export function baseTimeline(
  doc: TimelineDocument,
  directive: GraphicsDirective,
): TimelineDocument {
  compileGraphicsPlan(doc, directive);
  const ids = new Set(directive.scenes.map((s) => s.clipId));
  return {
    ...doc,
    clips: doc.clips.map((c, i) => {
      const closing = directive.logoEnding && i === doc.clips.length - 1;
      return {
        ...c,
        recipe: {
          ...c.recipe,
          ...(ids.has(c.id) ? { text: "" } : {}),
          ...(closing ? { watermark: false } : {}),
        },
        ...(c.effects
          ? {
              effects: {
                ...c.effects,
                ...(closing ? { logoEnding: undefined } : {}),
              },
            }
          : {}),
      };
    }),
  };
}
