import {
  timelineDuration,
  validateTimeline,
  type TimelineDocument,
} from "./timeline";
export const starterTemplates = [
  "Cinematic Construction",
  "Luxury Real Estate",
  "Concrete Block Advertisement",
] as const;
export type EditProposal = {
  before: string;
  document: TimelineDocument;
  summary: string[];
};
export function proposeEdit(
  source: TimelineDocument,
  instruction: string,
  caption = "",
): EditProposal {
  if (validateTimeline(source))
    throw new Error("Fix invalid timeline values before asking for an edit.");
  if (!source.clips.length)
    throw new Error("Add your photos or videos to the timeline first.");
  const text = instruction.trim().toLowerCase();
  if (!text || text.length > 600)
    throw new Error("Describe your edit in 1–600 characters.");
  const supported = [
    /^(?:make (?:this |my |the )?(?:video )?(?:more )?)?cinematic[.!]?$/,
    /^(?:make (?:the )?colou?rs |make (?:this |my )?video )?warmer[.!]?$/,
    /^(?:use (?:a )?)?vertical(?: (?:instagram|tiktok))?(?: format)?[.!]?$/,
    /^shorten (?:this |my |the )?video to \d+(?:\.\d+)? seconds?[.!]?$/,
    /^add (?:my |the |our )?(?:original )?(?:company |cobs )?logo(?: at the end| ending)?[.!]?$/,
    /^add (?:professional )?captions[.!]?$/,
    /^arrange (?:the |my )?(?:uploaded )?photos and videos into an attractive sequence[.!]?$/,
    /^(?:use (?:the )?)?(?:cinematic construction|luxury real estate|concrete block advertisement)(?: template)?[.!]?$/,
  ];
  // Keep "photos and videos" together when separating multiple commands.
  const clauses = text
    .replace(/photos and videos/g, "photos & videos")
    .split(/\s+and\s+|[,;]/)
    .map((s) => s.trim().replace(/photos & videos/g, "photos and videos"));
  if (clauses.some((c) => !supported.some((pattern) => pattern.test(c))))
    throw new Error(
      "Unsupported wording or effect. Use a starter template or one of the supported example commands; no changes made.",
    );
  if (
    /remove|delete|publish|send|best shot|recogniz|transcrib|remotion|generate music/.test(
      text,
    )
  )
    throw new Error(
      "That request needs manual review or an unavailable integration. No changes made.",
    );
  const document = structuredClone(source),
    summary: string[] = [];
  const template = starterTemplates.find((t) => text.includes(t.toLowerCase()));
  if (template || /cinematic/.test(text)) {
    document.clips.forEach((c, i) => {
      c.effects = { ...c.effects, grade: "art-of-building", animateText: true };
      if (c.kind === "image")
        c.effects.motion = {
          fromScale: 1,
          toScale: 1.06,
          fromX: 0.5,
          toX: 0.5,
          fromY: 0.5,
          toY: 0.5,
        };
      if (i < document.clips.length - 1)
        c.transition = {
          type: "fade",
          duration: Math.min(
            0.3,
            c.recipe.duration / 4,
            document.clips[i + 1].recipe.duration / 4,
          ),
        };
    });
    summary.push(
      `${template || "Cinematic treatment"}: warm grade, restrained text fades, photo zoom and gentle crossfades; existing scene order preserved.`,
    );
    if (template === "Luxury Real Estate")
      document.clips.forEach((c) => {
        c.recipe.contrast = 1.03;
        c.recipe.saturation = 0.95;
      });
    if (template === "Concrete Block Advertisement")
      document.clips.forEach((c) => {
        c.recipe.contrast = 1.12;
      });
  }
  if (/warm/.test(text) && !summary.length) {
    document.clips.forEach((c) => {
      c.effects = { ...c.effects, grade: "art-of-building" };
    });
    summary.push("Apply the existing warm cinematic colour preset.");
  }
  if (/vertical|instagram|tiktok/.test(text)) {
    document.aspect = "9:16";
    document.clips.forEach((c) => {
      c.recipe.aspect = "9:16";
      c.recipe.fit = "contain";
    });
    summary.push(
      "Use vertical 9:16 export, fitting originals without cropping.",
    );
  }
  const target = text.match(/(?:to|a)\s+(\d+(?:\.\d+)?)\s*[- ]?seconds?/);
  if (/shorten/.test(text) && !target)
    throw new Error(
      "Specify the target, for example: Shorten this video to 30 seconds.",
    );
  if (target) {
    const seconds = Number(target[1]),
      old = timelineDuration(document),
      ratio = seconds / old;
    if (seconds < document.clips.length || seconds > old)
      throw new Error(
        "Shortening must keep every scene at least one second and cannot extend source footage.",
      );
    document.clips.forEach((c) => {
      c.recipe.duration *= ratio;
      c.recipe.fade = Math.min(c.recipe.fade * ratio, c.recipe.duration / 2);
      if (c.transition) c.transition.duration *= ratio;
      c.recipe.captions = (c.recipe.captions || [])
        .filter((q) => q.start < c.recipe.duration)
        .map((q) => ({ ...q, end: Math.min(q.end, c.recipe.duration) }));
    });
    summary.push(
      `Shorten to ${seconds} seconds by trimming each scene proportionally; review shortened captions and soundtrack timing.`,
    );
  }
  if (/logo|template/.test(text) || template) {
    const c = document.clips.at(-1)!;
    c.recipe.watermark = true;
    c.effects = { ...c.effects, logoEnding: true };
    summary.push(
      "Add the original COBS logo ending using the existing FFmpeg effect.",
    );
  }
  if (/caption/.test(text)) {
    if (!caption.trim())
      throw new Error(
        "Enter your verified caption text below. Automatic speech transcription is unavailable.",
      );
    if (caption.length > 120 || /[\x00-\x1f\x7f]/.test(caption))
      throw new Error("Use a single caption line of at most 120 characters.");
    if (document.clips.some((c) => c.recipe.captions?.length))
      throw new Error(
        "Existing timed captions are preserved. Edit them in the Captions tool rather than replacing them automatically.",
      );
    document.clips.forEach((c) => {
      c.recipe.captions = [
        { start: 0, end: c.recipe.duration, text: caption.trim() },
      ];
    });
    summary.push(
      `Add “${caption.trim()}” to each scene; no speech or company facts inferred.`,
    );
  }
  if (/arrange|sequence/.test(text)) {
    const videos = document.clips.filter((c) => c.kind === "video"),
      photos = document.clips.filter((c) => c.kind === "image"),
      ending = document.clips.some((c) => c.effects?.logoEnding);
    document.clips = [];
    while (videos.length || photos.length) {
      const v = videos.shift(),
        p = photos.shift();
      if (v) document.clips.push(v);
      if (p) document.clips.push(p);
    }
    document.clips.forEach((c, i) => {
      if (c.effects?.logoEnding) c.effects.logoEnding = false;
      if (i === document.clips.length - 1) {
        c.transition = undefined;
        if (ending) {
          c.recipe.watermark = true;
          c.effects = { ...c.effects, logoEnding: true };
        }
      }
    });
    summary.push(
      "Alternate videos and photos while preserving order within each type. Metadata-based arrangement only; no visual shot ranking.",
    );
  }
  if (!summary.length)
    throw new Error(
      "Supported edits: cinematic, warmer colours, vertical format, shorten to N seconds, logo ending, supplied captions or a starter template.",
    );
  const error = validateTimeline(document);
  if (error) throw new Error(error);
  return { before: JSON.stringify(source), document, summary };
}
export function confirmEdit(current: TimelineDocument, proposal: EditProposal) {
  if (JSON.stringify(current) !== proposal.before)
    throw new Error(
      "The timeline changed. Review a fresh proposal before applying.",
    );
  const error = validateTimeline(proposal.document);
  if (error) throw new Error(error);
  return structuredClone(proposal.document);
}
