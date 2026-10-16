import { defaultRecipe } from "./studio-model.mjs";
import { sequenceSnapshot } from "./sequence-model.mjs";
import { validateTimeline, type TimelineDocument } from "./timeline";
import { sequenceDuration } from "./cinematic-model.mjs";

export type MediaFacts = {
  id: string;
  name: string;
  mime: string;
  bytes: number;
  duration: number | null;
  width: number;
  height: number;
  audio: boolean;
  orientation: "portrait" | "landscape" | "square";
  labels: string[];
  thumbnail: "private original" | "not generated";
};
export type EditBrief = {
  instructions: string;
  mediaIds: string[];
  priorityIds: string[];
  platforms: string[];
  duration: number;
  aspect: "9:16" | "16:9" | "1:1" | "4:5";
  style: "professional" | "energetic" | "educational";
  companyInfo: string;
  narration: string;
  captions: boolean;
  branding: boolean;
  starts: Record<string, number>;
  cinematicPreset?: "none" | "gentle" | "story" | "art-of-building";
  feedback?: string;
};
export type EditingPlan = {
  mode: "rule-based";
  brief: EditBrief;
  media: MediaFacts[];
  scenes: {
    mediaId: string;
    purpose: string;
    start: number;
    end: number;
    duration: number;
    caption: string;
    transition: "cut" | "fade";
  }[];
  totalDuration: number;
  preset: string;
  branding: string;
  audio: string;
  limitations: string[];
  timeline: TimelineDocument;
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function instructionHints(instructions: string): Partial<EditBrief> {
  const hints: Partial<EditBrief> = {};
  if (
    /art of building|warm cinematic|cinematic construction/i.test(instructions)
  )
    hints.cinematicPreset = "art-of-building";
  else if (/\bcinematic\b|\bsoft crossfades?\b/i.test(instructions))
    hints.cinematicPreset = "story";
  else if (/\bgentle zoom\b/i.test(instructions))
    hints.cinematicPreset = "gentle";
  const duration = instructions.match(
    /\b(\d+(?:\.\d+)?)\s*[- ]?\s*(?:seconds?|secs?)\b/i,
  );
  if (duration) hints.duration = Number(duration[1]);
  const platforms = ["Instagram", "TikTok", "Facebook", "YouTube"].filter((p) =>
    instructions.toLowerCase().includes(p.toLowerCase()),
  );
  if (platforms.length) hints.platforms = platforms;
  const aspect = instructions.match(/\b(9:16|16:9|1:1|4:5)\b/);
  if (aspect) hints.aspect = aspect[1] as EditBrief["aspect"];
  else if (/\b(portrait|vertical)\b/i.test(instructions)) hints.aspect = "9:16";
  else if (/\b(landscape|horizontal)\b/i.test(instructions))
    hints.aspect = "16:9";
  if (/\b(energetic|dynamic)\b/i.test(instructions)) hints.style = "energetic";
  else if (/\b(educational|tutorial)\b/i.test(instructions))
    hints.style = "educational";
  else if (/\bprofessional\b/i.test(instructions)) hints.style = "professional";
  if (/\b(?:no|without) captions\b/i.test(instructions)) hints.captions = false;
  else if (/\bcaptions\b/i.test(instructions)) hints.captions = true;
  if (/\b(?:no|without) (?:company )?logo\b/i.test(instructions))
    hints.branding = false;
  else if (/\blogo\b/i.test(instructions)) hints.branding = true;
  return hints;
}
export function validateBrief(value: unknown): asserts value is EditBrief {
  const b = value as EditBrief;
  const text = (v: unknown, max: number) =>
    typeof v === "string" && v.length <= max && !/[\x00-\x08\x0b-\x1f]/.test(v);
  if (
    !b ||
    Object.keys(b).some(
      (k) =>
        ![
          "instructions",
          "mediaIds",
          "priorityIds",
          "platforms",
          "duration",
          "aspect",
          "style",
          "companyInfo",
          "narration",
          "captions",
          "branding",
          "starts",
          "cinematicPreset",
          "feedback",
        ].includes(k),
    ) ||
    !text(b.instructions, 2000) ||
    !b.instructions.trim() ||
    !text(b.companyInfo, 1000) ||
    !text(b.narration, 1000) ||
    (b.feedback !== undefined && !text(b.feedback, 1000)) ||
    (b.cinematicPreset !== undefined &&
      !["none", "gentle", "story", "art-of-building"].includes(
        b.cinematicPreset,
      )) ||
    !Array.isArray(b.mediaIds) ||
    b.mediaIds.length < 1 ||
    b.mediaIds.length > 6 ||
    new Set(b.mediaIds).size !== b.mediaIds.length ||
    !b.mediaIds.every((id) => uuid.test(id)) ||
    !Array.isArray(b.priorityIds) ||
    new Set(b.priorityIds).size !== b.priorityIds.length ||
    !b.priorityIds.every((id) => b.mediaIds.includes(id)) ||
    !Array.isArray(b.platforms) ||
    !b.platforms.length ||
    !b.platforms.every((p) =>
      ["Instagram", "TikTok", "Facebook", "YouTube"].includes(p),
    ) ||
    !Number.isFinite(b.duration) ||
    b.duration < b.mediaIds.length ||
    b.duration > 60 ||
    Math.abs(b.duration * 25 - Math.round(b.duration * 25)) > 0.00001 ||
    !["9:16", "16:9", "1:1", "4:5"].includes(b.aspect) ||
    !["professional", "energetic", "educational"].includes(b.style) ||
    typeof b.captions !== "boolean" ||
    typeof b.branding !== "boolean" ||
    !b.starts ||
    Array.isArray(b.starts) ||
    typeof b.starts !== "object" ||
    !Object.entries(b.starts).every(
      ([id, s]) =>
        b.mediaIds.includes(id) && Number.isFinite(s) && s >= 0 && s <= 570,
    )
  )
    throw new Error(
      "Invalid brief. Select 1–6 originals, supported options and a feasible duration up to 60 seconds.",
    );
  if (
    /\b(crossfade|dissolve|keyframes?|picture.in.picture|animated|slow.motion|speed.ramp|pan|zoom|rotate|rotation|opacity|music|soundtrack|voice.over|transcribe|narrate|generate.audio)\b/i.test(
      (b.instructions + " " + (b.feedback || ""))
        .replace(
          b.cinematicPreset === "art-of-building"
            ? /\b(?:professional music|background music|music|soundtrack)\b/gi
            : /$^/,
          "",
        )
        .replace(/\bgentle zoom\b|\bsoft crossfades?\b/gi, ""),
    )
  )
    throw new Error(
      "That request includes unsupported effects or audio generation. Use the supported preset controls; music must be supplied separately, and automatic speech generation and speed ramps are unavailable.",
    );
}

export function generateEditingPlan(
  input: unknown,
  facts: MediaFacts[],
): EditingPlan {
  validateBrief(input);
  const b = input;
  if (
    facts.length !== b.mediaIds.length ||
    new Set(facts.map((f) => f.id)).size !== facts.length ||
    facts.some(
      (f) =>
        !b.mediaIds.includes(f.id) ||
        !Number.isInteger(f.bytes) ||
        f.bytes < 1 ||
        !Number.isInteger(f.width) ||
        !Number.isInteger(f.height) ||
        f.width < 1 ||
        f.height < 1 ||
        f.width * f.height > 3840 * 2160 ||
        ![
          "image/png",
          "image/jpeg",
          "image/webp",
          "video/mp4",
          "video/quicktime",
        ].includes(f.mime) ||
        (f.mime.startsWith("image/") && f.duration !== null) ||
        (f.mime.startsWith("video/") &&
          (!Number.isFinite(f.duration) ||
            f.duration! < 1 ||
            f.duration! > 600)),
    )
  )
    throw new Error("Selected originals need valid, server-verified metadata.");
  if (facts.reduce((n, f) => n + f.bytes, 0) > 50 * 1024 * 1024)
    throw new Error("Selected originals exceed 50 MiB.");
  const order = [
    ...b.priorityIds,
    ...b.mediaIds.filter((id) => !b.priorityIds.includes(id)),
  ];
  const media = order.map((id) => facts.find((f) => f.id === id)!);
  const starts = media.map((f) =>
    f.mime.startsWith("video/") ? b.starts[f.id] || 0 : 0,
  );
  if (media.some((f, i) => f.mime.startsWith("image/") && b.starts[f.id]))
    throw new Error("Photographs do not have video trim points.");
  const capacity = media.map((f, i) =>
    Math.floor(
      Math.min(30, f.duration === null ? 30 : f.duration - starts[i]) * 25,
    ),
  );
  const construction = b.cinematicPreset === "art-of-building";
  const cinematic = !!b.cinematicPreset && b.cinematicPreset !== "none";
  const target =
      Math.round(b.duration * 25) +
      (cinematic ? (media.length - 1) * (construction ? 6 : 10) : 0),
    frames = media.map(() => 25);
  if (target > 1500)
    throw new Error(
      "Cinematic handles exceed the 60-second source budget. Reduce target duration.",
    );
  if (
    capacity.some((c) => c < 25) ||
    capacity.reduce((n, c) => n + c, 0) < target
  )
    throw new Error(
      "Not enough source duration after trims. Shorten the target or select longer originals.",
    );
  // Allocate whole 25fps frames, preserving every selected source and its trim.
  let remaining = target - frames.length * 25;
  while (remaining > 0)
    for (let i = 0; i < frames.length && remaining > 0; i++)
      if (frames[i] < capacity[i]) {
        const add = Math.min(
          remaining,
          capacity[i] - frames[i],
          construction ? [2, 3, 2, 4, 3, 4][i % 6] : 1,
        );
        frames[i] += add;
        remaining -= add;
      }
  const timeline: TimelineDocument = {
    version: 1,
    id: crypto.randomUUID(),
    title: b.instructions.trim().slice(0, 180),
    campaignId: null,
    aspect: b.aspect,
    clips: [],
  };
  const scenes = media.map((f, i) => {
    const duration = frames[i] / 25;
    const purpose =
      i === 0
        ? "Opening"
        : i === media.length - 1
          ? "Closing"
          : "Supporting original";
    // Labels describe selection only; never turn file names into asserted company facts.
    const caption =
      i === media.length - 1
        ? "Contact COBS BUILDMASTERS LTD"
        : "COBS BUILDMASTERS LTD";
    timeline.clips.push({
      id: crypto.randomUUID(),
      mediaId: f.id,
      kind: f.mime.startsWith("video/") ? "video" : "image",
      label: f.name.slice(0, 200),
      recipe: {
        ...defaultRecipe(),
        aspect: b.aspect,
        start: starts[i],
        duration,
        fit: b.style === "energetic" ? "cover" : "contain",
        watermark: b.branding && (!construction || i === media.length - 1),
        captions:
          b.captions && (!construction || i === media.length - 1)
            ? [{ start: 0, end: duration, text: caption }]
            : [],
        text: construction
          ? i === 0
            ? "THE ART OF BUILDING"
            : i === media.length - 1
              ? "COBS BUILDMASTERS LTD"
              : ""
          : b.cinematicPreset === "story" && (i === 0 || i === media.length - 1)
            ? caption
            : "",
      },
      ...(cinematic
        ? {
            effects: {
              ...(construction
                ? {
                    grade: "art-of-building" as const,
                    ...(i === media.length - 1 && b.branding
                      ? { logoEnding: true }
                      : {}),
                  }
                : {}),
              motion: {
                fromScale: 1,
                toScale: construction ? 1.08 : 1.12,
                fromX: 0.5,
                toX: 0.5,
                fromY: 0.5,
                toY: 0.5,
              },
              animateText: true,
              template: (b.cinematicPreset === "story" || construction
                ? i === 0
                  ? "intro"
                  : i === media.length - 1
                    ? "outro"
                    : "lower-third"
                : "plain") as "intro" | "outro" | "lower-third" | "plain",
            },
            ...(i < media.length - 1
              ? {
                  transition: {
                    type: "fade" as const,
                    duration: construction ? 0.24 : 0.4,
                  },
                }
              : {}),
          }
        : {}),
    });
    return {
      mediaId: f.id,
      purpose,
      start: starts[i],
      end: starts[i] + duration,
      duration,
      caption:
        b.captions && (!construction || i === media.length - 1) ? caption : "",
      transition:
        cinematic && i < media.length - 1
          ? ("fade" as const)
          : ("cut" as const),
    };
  });
  validatePlanTimeline(timeline, media);
  return {
    mode: "rule-based",
    brief: b,
    media,
    scenes,
    totalDuration: Math.round(sequenceDuration(timeline.clips) * 25) / 25,
    preset: `H.264/AAC MP4 · 25 fps · ${b.aspect}`,
    branding:
      construction && b.branding
        ? "Original logo, centered fade-in ending; full image preserved"
        : b.branding
          ? "Original logo · bottom right · 120×120 · 20px inset"
          : "Off",
    audio:
      "Original clip audio at volume 1; silent sources remain silent. Add your licensed music or recorded narration in the timeline; no music or voice is generated or attached automatically.",
    limitations: [
      "No automatic beat detection or audio-driven cuts. Pacing follows deterministic frame allocation, not the music waveform.",
      "No visual scene understanding: priority order and measured metadata determine selection, not image contents.",
      "Instructions are a production brief; explicit controls determine the edit. Company information and preferred narration are review notes, not synthesized speech or automatic factual captions.",
      "One shared aspect preset; render separate owner-reviewed versions for different platform ratios. Cinematic requests use bounded preset motion/transitions, not semantic shot understanding.",
      "Review captions, framing and source trim points before rendering. This plan is unsaved and does not grant publication approval.",
    ],
    timeline,
  };
}
export function validatePlanTimeline(
  doc: TimelineDocument,
  facts: MediaFacts[],
) {
  const invalid = validateTimeline(doc);
  if (invalid) throw new Error(invalid);
  sequenceSnapshot(doc.clips);
  for (const c of doc.clips) {
    const f = facts.find((f) => f.id === c.mediaId);
    if (
      !f ||
      c.kind !== (f.mime.startsWith("video/") ? "video" : "image") ||
      (c.kind === "video" &&
        c.recipe.start + c.recipe.duration * (c.effects?.speed || 1) >
          f.duration! + 0.001)
    )
      throw new Error(
        "Timeline references unavailable media or exceeds an original's duration.",
      );
  }
}
