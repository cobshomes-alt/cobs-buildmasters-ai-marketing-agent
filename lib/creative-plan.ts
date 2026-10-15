import { verifiedScenes, VERIFIED_ACTIVITIES } from "./production-guidance";
export const PLAN_PREFIX = "[COBS_PRODUCTION_PLAN_V1]\n";
export const PLATFORM_NAMES = [
  "Facebook",
  "Instagram",
  "TikTok",
  "YouTube",
] as const;
export const WORK_STAGES = [
  "Idea",
  "Filming Plan",
  "Shot Checklist",
  "Upload Original Media",
  "Editing Queue",
] as const;
export const COMPANY_FACTS =
  "COBS BUILDMASTERS LTD; Adenta New Legon, Ghana; concrete blocks, construction materials, construction services, equipment rentals and flooring products; contacts 0594599327 and 0503466178.";
export type Brief = {
  activity?: "general" | "factory" | "construction" | "rentals" | "property";
  product?: string;
  audience?: string;
  objective?: string;
  footage?: string;
  instructions?: string;
  verifiedActivities?: string[];
  topic: string;
  project: string;
  evidence: string;
  period: "week" | "month";
  style: "Professional" | "Educational" | "Behind the scenes";
  length: "15–30 seconds" | "45–60 seconds" | "90 seconds";
  platforms: string[];
  startDate: string;
};
export type CreativePlan = {
  overview: string;
  orientation: string;
  lighting: string;
  sequence: string;
  structure: string;
  safety: string[];
  shots: {
    purpose?: string;
    shotType?: string;
    onScreen?: string;
    audio?: string;
    narration?: string;
    screenText?: string;
    retake?: string;
    scene: string;
    angle: string;
    movement: string;
    seconds: number;
    demonstration: string;
    transition: string;
  }[];
  platforms: { platform: string; format: string; requirements: string }[];
  ideas: { title: string; category: string; evidence: string }[];
  calendar: {
    day: number;
    idea: string;
    platform: string;
    format: string;
    objective?: string;
    evidence?: string;
  }[];
  scripts: {
    talkingPoints?: string;
    style: string;
    length: string;
    hook: string;
    voiceover: string;
    caption: string;
    description: string;
    hashtags: string;
    cta: string;
  }[];
};
export type PlanDocument = {
  version: 1;
  brief: Brief;
  plan: CreativePlan;
  source: "ai" | "starter" | "manual";
  checked: number[];
  stage: (typeof WORK_STAGES)[number];
  outputPostId: string | null;
};
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, limit: number) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= limit;
export function validBrief(value: unknown): value is Brief {
  if (!object(value)) return false;
  return (
    (value.activity === undefined ||
      ["general", "factory", "construction", "rentals", "property"].includes(
        String(value.activity),
      )) &&
    ["product", "audience", "objective", "footage", "instructions"].every(
      (key) =>
        value[key] === undefined ||
        (typeof value[key] === "string" &&
          (value[key] as string).length <= 240),
    ) &&
    (value.verifiedActivities === undefined ||
      (Array.isArray(value.verifiedActivities) &&
        value.verifiedActivities.length <= 12 &&
        value.verifiedActivities.every(
          (item) =>
            typeof item === "string" &&
            item.length <= 100 &&
            VERIFIED_ACTIVITIES[String(value.activity || "general")]?.includes(
              item,
            ),
        ) &&
        new Set(value.verifiedActivities).size ===
          value.verifiedActivities.length)) &&
    text(value.topic, 400) &&
    typeof value.project === "string" &&
    value.project.length <= 120 &&
    typeof value.evidence === "string" &&
    value.evidence.length <= 1200 &&
    ["week", "month"].includes(String(value.period)) &&
    ["Professional", "Educational", "Behind the scenes"].includes(
      String(value.style),
    ) &&
    ["15–30 seconds", "45–60 seconds", "90 seconds"].includes(
      String(value.length),
    ) &&
    Array.isArray(value.platforms) &&
    value.platforms.length > 0 &&
    value.platforms.length <= 4 &&
    value.platforms.every((p) =>
      PLATFORM_NAMES.includes(p as (typeof PLATFORM_NAMES)[number]),
    ) &&
    new Set(value.platforms).size === value.platforms.length &&
    typeof value.startDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.startDate) &&
    !Number.isNaN(Date.parse(value.startDate)) &&
    new Date(value.startDate).toISOString().slice(0, 10) === value.startDate
  );
}
function list(
  value: unknown,
  max: number,
  fields: Record<string, number>,
  extra: (row: Record<string, unknown>) => boolean = () => true,
) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= max &&
    value.every(
      (row) =>
        object(row) &&
        Object.entries(fields).every(([key, limit]) => text(row[key], limit)) &&
        extra(row),
    )
  );
}
export function validPlan(value: unknown): value is CreativePlan {
  if (!object(value)) return false;
  return (
    ["overview", "orientation", "lighting", "sequence", "structure"].every(
      (k) => text(value[k], 600),
    ) &&
    Array.isArray(value.safety) &&
    value.safety.length > 0 &&
    value.safety.length <= 6 &&
    value.safety.every((s) => text(s, 250)) &&
    list(
      value.shots,
      12,
      {
        scene: 160,
        angle: 160,
        movement: 160,
        demonstration: 240,
        transition: 100,
      },
      (r) =>
        [
          "purpose",
          "shotType",
          "onScreen",
          "audio",
          "narration",
          "screenText",
          "retake",
        ].every(
          (key) =>
            r[key] === undefined ||
            (typeof r[key] === "string" && (r[key] as string).length <= 180),
        ) &&
        Number.isInteger(r.seconds) &&
        Number(r.seconds) >= 1 &&
        Number(r.seconds) <= 30,
    ) &&
    list(
      value.platforms,
      4,
      { platform: 30, format: 80, requirements: 300 },
      (r) =>
        PLATFORM_NAMES.includes(r.platform as (typeof PLATFORM_NAMES)[number]),
    ) &&
    list(value.ideas, 12, { title: 120, category: 80, evidence: 180 }) &&
    list(
      value.calendar,
      12,
      { idea: 120, platform: 30, format: 80 },
      (r) =>
        ["objective", "evidence"].every(
          (key) =>
            r[key] === undefined ||
            (typeof r[key] === "string" && (r[key] as string).length <= 180),
        ) &&
        Number.isInteger(r.day) &&
        Number(r.day) >= 1 &&
        Number(r.day) <= 28 &&
        PLATFORM_NAMES.includes(r.platform as (typeof PLATFORM_NAMES)[number]),
    ) &&
    list(
      value.scripts,
      3,
      {
        style: 60,
        length: 60,
        hook: 200,
        voiceover: 1200,
        caption: 900,
        description: 900,
        hashtags: 250,
        cta: 200,
      },
      (r) =>
        r.talkingPoints === undefined ||
        (typeof r.talkingPoints === "string" && r.talkingPoints.length <= 180),
    )
  );
}
export function validDocument(value: unknown): value is PlanDocument {
  return (
    object(value) &&
    value.version === 1 &&
    validBrief(value.brief) &&
    validPlan(value.plan) &&
    ["ai", "starter", "manual"].includes(String(value.source)) &&
    WORK_STAGES.includes(value.stage as (typeof WORK_STAGES)[number]) &&
    Array.isArray(value.checked) &&
    value.checked.every(
      (n) =>
        Number.isInteger(n) &&
        n >= 0 &&
        n < (value.plan as CreativePlan).shots.length,
    ) &&
    new Set(value.checked).size === value.checked.length &&
    (value.outputPostId === null ||
      (typeof value.outputPostId === "string" &&
        value.outputPostId.length > 0 &&
        value.outputPostId.length <= 80))
  );
}
export function planMatchesBrief(plan: CreativePlan, brief: Brief) {
  const expectedDays = brief.period === "week" ? 7 : 12;
  return (
    plan.shots.length >= 5 &&
    plan.ideas.length >= 10 &&
    plan.scripts.length >= 2 &&
    new Set(plan.scripts.map((script) => script.style)).size >= 2 &&
    plan.safety.length >= 3 &&
    plan.calendar.length === expectedDays &&
    plan.calendar.every(
      (day) =>
        day.day <= (brief.period === "week" ? 7 : 28) &&
        brief.platforms.includes(day.platform),
    ) &&
    new Set(plan.calendar.map((day) => day.day)).size === expectedDays &&
    plan.platforms.length === brief.platforms.length &&
    new Set(plan.platforms.map((p) => p.platform)).size ===
      brief.platforms.length &&
    plan.platforms.every((p) => brief.platforms.includes(p.platform))
  );
}
export function encodePlan(document: PlanDocument) {
  if (!validDocument(document))
    throw new Error(
      "The production brief is invalid. Check its fields before saving.",
    );
  const body = PLAN_PREFIX + JSON.stringify(document);
  if (body.length > 10000)
    throw new Error(
      "This brief exceeds the 10,000-character workspace limit. Shorten the plan before saving.",
    );
  return body;
}
export function decodePlan(body: string): PlanDocument | null {
  if (!body.startsWith(PLAN_PREFIX) || body.length > 10000) return null;
  try {
    const value: unknown = JSON.parse(body.slice(PLAN_PREFIX.length));
    return validDocument(value) ? value : null;
  } catch {
    return null;
  }
}
export function isPlanningRecord(post: { body: string }) {
  return post.body.startsWith(PLAN_PREFIX);
}
export function calendarDate(start: string, day: number) {
  const date = new Date(start + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + day - 1);
  return date.toISOString().slice(0, 10);
}
export function workflowStage(
  document: PlanDocument,
  output?: { status: string; approved_at?: string | null },
) {
  if (output?.status === "Pending approval") return "Owner Review";
  if (
    output &&
    ["Approved", "Scheduled"].includes(output.status) &&
    output.approved_at
  )
    return "Approved Content";
  if (output) return "Editing Queue";
  return document.stage;
}
export function samplePlan(brief: Brief): CreativePlan {
  const scenes = [
    [
      "Site or factory introduction",
      "Wide view from a designated visitor area",
      "Static tripod",
      "Presenter introduces the activity without claiming unverified results",
      "Straight cut",
    ],
    [
      "Materials and preparation",
      "Medium view at eye level",
      "Slow pan from a safe fixed position",
      "Show the genuine materials that are available to film",
      "Cut on movement",
    ],
    [
      "Process demonstration",
      "Medium side view behind the exclusion boundary",
      "Static; never approach operating machinery",
      "A competent worker demonstrates only their normal approved task",
      "Match cut",
    ],
    [
      "Detail and quality check",
      "Close-up of a stationary item",
      "Slow handheld push-in while standing still",
      "Explain a visible feature; do not claim certification or tested strength",
      "Detail cut",
    ],
    [
      "People and progress",
      "Eye-level medium shot with consent",
      "Static interview",
      "Worker explains today's task; use only verified project evidence",
      "Audio bridge",
    ],
    [
      "Final product or current site condition",
      "Wide then detail",
      "Static alternate angles",
      "Show actual current condition; before/after only with dated matching evidence",
      "Straight cut",
    ],
    [
      "Enquiry and brand closing",
      "Medium presenter shot",
      "Static with clean background",
      "Invite enquiries without inventing price, stock or delivery promises",
      "Fade to verified contacts",
    ],
  ];
  const themes = [
    "Concrete block production",
    "Factory behind the scenes",
    "Product demonstration",
    "Project progress",
    "Evidence-based before and after",
    "Equipment rental enquiries",
    "Customer education",
    "Building tips",
    "Property walkthrough",
    "Company branding",
  ];
  const isShort = brief.length === "15–30 seconds";
  const styles = [
    brief.style,
    brief.style === "Educational" ? "Behind the scenes" : "Educational",
  ];
  return {
    overview: `Sample production plan for: ${brief.topic}. Adapt every detail to the real location and available evidence.`,
    orientation:
      "Use portrait 9:16 for mobile feeds; capture landscape 16:9 takes for YouTube landscape edits. Keep key details away from edges.",
    lighting:
      "Use soft morning or late-afternoon light if safe. Face presenters toward the light; avoid glare, backlighting and poor visibility.",
    sequence:
      "Obtain permission and site induction → wide establishing view → preparation → normal process → stationary detail → short interview → current result → enquiry closing. Capture clean ambient sound separately.",
    structure: `${brief.length}: hook → context → process/detail → evidence → enquiry. ${isShort ? "Use 4–5 selected clips, mostly 2–4 seconds each." : "Use 6–8 selected clips plus a short presenter explanation; trim pauses."} Raw take durations include editing handles, not final runtime.`,
    safety: [
      "Follow site induction and the competent supervisor's approved filming locations and rules.",
      "Stay outside machinery, vehicle and lifting exclusion zones; never bypass guards or request unsafe demonstrations.",
      "Do not climb scaffolding, walk backwards or enter active work areas to obtain a shot. Stop filming when safe separation cannot be maintained.",
      "Use required site PPE; PPE does not grant access to a restricted area. Obtain worker consent and protect customer/address information.",
    ],
    shots:
      verifiedScenes(brief) ||
      scenes.map(([scene, angle, movement, demonstration, transition]) => ({
        scene,
        angle,
        movement,
        seconds: isShort ? 5 : brief.length === "90 seconds" ? 18 : 10,
        demonstration,
        transition,
      })),
    platforms: brief.platforms.map((platform) => ({
      platform,
      format:
        platform === "YouTube"
          ? "9:16 short / 16:9 landscape"
          : "9:16 portrait",
      requirements:
        "Use 1080p, subtitles, clear speech and licensed audio; avoid interface overlays. Verify current platform upload limits.",
    })),
    ideas: themes.map((title, i) => ({
      title,
      category: [
        "Production",
        "Factory",
        "Products",
        "Projects",
        "Evidence",
        "Rentals",
        "Education",
        "Education",
        "Property",
        "Brand",
      ][i],
      evidence:
        i === 4
          ? "Dated matching before/after evidence required."
          : "Real footage and owner-confirmed facts required.",
    })),
    calendar: Array.from(
      { length: brief.period === "week" ? 7 : 12 },
      (_, i) => ({
        day:
          brief.period === "week"
            ? i + 1
            : Math.floor(i / 3) * 7 + [1, 3, 5][i % 3],
        idea: themes[i % themes.length],
        platform: brief.platforms[i % brief.platforms.length],
        format:
          i % 3 === 0
            ? "Short video"
            : i % 3 === 1
              ? "Photo with educational caption"
              : "Presenter Q&A",
      }),
    ),
    scripts: styles.map((style, i) => ({
      style,
      length:
        i === 0 ? brief.length : isShort ? "45–60 seconds" : "15–30 seconds",
      hook:
        style === "Educational"
          ? "What should you look for before choosing construction materials?"
          : style === "Behind the scenes"
            ? "Step behind the scenes with our team."
            : "See the work behind your next building decision.",
      voiceover:
        style === "Educational"
          ? "Before choosing materials, [explain a visible feature accurately]. Ask COBS BUILDMASTERS LTD about your needs; confirm specifications."
          : style === "Behind the scenes"
            ? "Today our team is [genuine task shown]. Watch the process from a safe location. Ask COBS BUILDMASTERS LTD about your requirements."
            : "At COBS BUILDMASTERS LTD, [describe the genuine activity shown]. Ask about materials, services or rentals; confirm availability.",
      caption:
        "COBS BUILDMASTERS LTD: [verified activity and location]. Ask about your project.",
      description:
        "COBS BUILDMASTERS LTD. [Summarise genuine footage.] Confirm availability with our team.",
      hashtags:
        "#COBSBuildmasters #ConstructionGhana #ConcreteBlocks #BuildingMaterials",
      cta: "Enquiries: 0594599327 / 0503466178.",
    })),
  };
}

const str = { type: "string" };
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});
const array = (items: unknown) => ({ type: "array", items });
export const PLAN_SCHEMA = obj({
  overview: str,
  orientation: str,
  lighting: str,
  sequence: str,
  structure: str,
  safety: array(str),
  shots: array(
    obj({
      scene: str,
      angle: str,
      movement: str,
      seconds: { type: "integer" },
      demonstration: str,
      transition: str,
    }),
  ),
  platforms: array(obj({ platform: str, format: str, requirements: str })),
  ideas: array(obj({ title: str, category: str, evidence: str })),
  calendar: array(
    obj({ day: { type: "integer" }, idea: str, platform: str, format: str }),
  ),
  scripts: array(
    obj({
      style: str,
      length: str,
      hook: str,
      voiceover: str,
      caption: str,
      description: str,
      hashtags: str,
      cta: str,
    }),
  ),
});
