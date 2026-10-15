import type { Brief, CreativePlan } from "./creative-plan";

export const ACTIVITY_LABELS = {
  general: "Construction services",
  factory: "Concrete block factory",
  construction: "Residential / commercial construction",
  rentals: "Equipment rentals",
  property: "Property marketing",
};
export const VERIFIED_ACTIVITIES: Record<string, string[]> = {
  factory: [
    "Factory entrance",
    "Cement and quarry dust preparation",
    "Material measurement and mixing",
    "Block-machine operation and filling moulds",
    "Demoulding",
    "Finished blocks",
    "Stacking and curing",
    "Quality inspection where performed",
  ],
  construction: [
    "Site preparation",
    "Foundation",
    "Structural work, columns and beams",
    "Blockwork",
    "Flooring systems",
    "Roofing",
    "Plastering",
    "Mechanical / electrical work",
    "Finishing",
    "Current project progress",
  ],
  rentals: [
    "Scaffolding",
    "Props",
    "Adjustable pillar moulds",
    "Concrete mixers",
    "Vibrators",
    "Other confirmed rental equipment",
  ],
  property: [
    "Building exterior",
    "Front and side angles",
    "Interiors",
    "Room transitions",
    "Current construction progress",
    "Genuine architectural plans / 3D renders",
  ],
  general: [
    "Actual service demonstration",
    "Verified materials",
    "Team introduction",
    "Current project progress",
  ],
};

export function verifiedScenes(brief: Brief): CreativePlan["shots"] | null {
  const allowed = VERIFIED_ACTIVITIES[brief.activity || "general"] || [];
  const selected = allowed.filter((activity) =>
    brief.verifiedActivities?.includes(activity),
  );
  if (!selected.length) return null;
  const target =
    brief.length === "90 seconds"
      ? 90
      : brief.length === "15–30 seconds"
        ? 30
        : 60;
  const alternate = target === 90 && selected.length === 1;
  const seconds = Math.min(
    30,
    Math.max(
      5,
      Math.ceil((target * 1.2) / (selected.length + 2 + (alternate ? 1 : 0))),
    ),
  );
  const shot = (
    scene: string,
    index: number,
  ): CreativePlan["shots"][number] => ({
    scene,
    angle:
      angles[scene] ||
      (index % 2
        ? "Medium eye-level at the approved boundary"
        : "Wide, safe stationary viewpoint"),
    movement: "Static tripod outside active work and vehicle zones",
    seconds,
    demonstration: scene.includes("renders")
      ? "Show genuine owner-provided plans; label clearly as proposed visualisation, not the existing building."
      : directions[scene] ||
        "Show the confirmed activity from an approved area. Describe visible facts, not unverified results or completed work.",
    transition: "Clean straight cut",
  });
  return [
    shot("Location and activity introduction", 0),
    ...selected.map(shot),
    ...(alternate ? [shot(`Additional safe angle: ${selected[0]}`, 1)] : []),
    shot("Customer enquiry closing", 1),
  ];
}

const directions: Record<string, string> = {
  "Factory entrance":
    "Establish the real factory from the designated visitor area; protect private addresses and people.",
  "Cement and quarry dust preparation":
    "Show confirmed materials and normal preparation from a safe boundary; avoid dust exposure.",
  "Material measurement and mixing":
    "Show genuine measurement and mixing. Operators follow normal approved procedures; do not stage a demonstration.",
  "Block-machine operation and filling moulds":
    "Film normal operation and mould filling across the guard line; never enter machinery exclusion zones.",
  Demoulding:
    "Film normal demoulding from a supervisor-approved position; never reach into moving parts.",
  "Finished blocks":
    "Capture stationary blocks without unverified strength, certification or stock claims.",
  "Stacking and curing":
    "Show actual safe stacking and documented curing practice; do not invent curing times.",
  "Quality inspection where performed":
    "Record only inspections actually performed; explain verified checks without inventing test results.",
  Scaffolding:
    "Show stationary equipment from ground level. Do not climb or stage an unsafe installation.",
  Props:
    "Show stationary props and visible condition; do not claim load ratings without verified documentation.",
  "Adjustable pillar moulds":
    "Show stationary mould details and real features from a safe position; no unsupported specifications.",
  "Concrete mixers":
    "Show actual equipment from the approved boundary; avoid moving components and electrical hazards.",
  Vibrators:
    "Show stationary equipment; no dangerous staged operation or unverified performance claims.",
  "Mechanical / electrical work":
    "Competent workers explain genuine work from a safe area; never film exposed energised systems or stage tasks.",
  "Room transitions":
    "Use stationary room views and clean cuts; use cleared approved routes, never walk backwards.",
  "Customer enquiry closing":
    "Invite enquiries with verified COBS contact details; promise no price, stock or completion date.",
};

const angles: Record<string, string> = {
  "Factory entrance": "Wide view from the designated visitor area",
  Demoulding: "Medium side view behind the approved boundary",
  "Finished blocks": "Close-up of stationary blocks from a safe position",
  "Quality inspection where performed":
    "Detail of a stationary inspection item, with permission",
  Props: "Detail of stationary equipment at ground level",
  "Adjustable pillar moulds": "Close-up of stationary mould features",
  Vibrators: "Detail of stationary equipment from the approved area",
  "Genuine architectural plans / 3D renders":
    "Detail of an authentic, clearly labelled drawing or render",
};

export function shotPresentation(
  shot: CreativePlan["shots"][number],
  index: number,
  plan: CreativePlan,
) {
  return {
    purpose:
      shot.purpose ||
      (index === 0
        ? "Establish the real setting and context"
        : "Explain the genuine activity with visible evidence"),
    shotType:
      shot.shotType ||
      (/close|detail/i.test(shot.angle)
        ? "Close-up / detail"
        : /wide/i.test(shot.angle)
          ? "Wide"
          : "Medium"),
    onScreen: shot.onScreen || shot.demonstration,
    audio:
      shot.audio ||
      "Record clear speech only from a safe position; capture ambient sound separately. Use licensed music in the edit.",
    orientation: plan.orientation,
    lighting: plan.lighting,
    narration: shot.narration || "",
    screenText: shot.screenText || "",
  };
}
