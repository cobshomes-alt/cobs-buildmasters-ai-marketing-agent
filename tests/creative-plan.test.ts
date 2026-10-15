import { expect, test } from "vitest";
import {
  samplePlan,
  encodePlan,
  decodePlan,
  validBrief,
  validPlan,
  workflowStage,
  calendarDate,
  isPlanningRecord,
  type Brief,
  type PlanDocument,
} from "../lib/creative-plan";
export const brief: Brief = {
  topic: "Film the concrete block factory",
  project: "Factory",
  evidence: "Only genuine footage",
  period: "week",
  style: "Professional",
  length: "45–60 seconds",
  platforms: ["Facebook", "Instagram"],
  startDate: "2026-10-15",
};
test("sample plans round trip and fit existing storage limits for weekly and monthly calendars", () => {
  for (const period of ["week", "month"] as const) {
    const input = {
      ...brief,
      period,
      platforms: ["Facebook", "Instagram", "TikTok", "YouTube"],
    };
    const document: PlanDocument = {
      version: 1,
      brief: input,
      plan: samplePlan(input),
      source: "starter",
      checked: [0],
      stage: "Shot Checklist",
      outputPostId: null,
    };
    expect(validPlan(document.plan)).toBe(true);
    const body = encodePlan(document);
    expect(body.length).toBeLessThanOrEqual(10000);
    expect(decodePlan(body)).toEqual(document);
    expect(isPlanningRecord({ body })).toBe(true);
    expect(document.plan.calendar).toHaveLength(period === "week" ? 7 : 12);
    expect(document.plan.ideas).toHaveLength(10);
  }
});
test("approval stages require real linked approval and reset after a content edit", () => {
  const doc: PlanDocument = {
    version: 1,
    brief,
    plan: samplePlan(brief),
    source: "starter",
    checked: [],
    stage: "Editing Queue",
    outputPostId: "draft",
  };
  expect(workflowStage(doc, { status: "Pending approval" })).toBe(
    "Owner Review",
  );
  expect(
    workflowStage(doc, { status: "Approved", approved_at: "2026-10-15" }),
  ).toBe("Approved Content");
  expect(workflowStage(doc, { status: "Approved", approved_at: null })).toBe(
    "Editing Queue",
  );
  expect(workflowStage(doc, { status: "Draft", approved_at: null })).toBe(
    "Editing Queue",
  );
});
test("invalid briefs, corrupted plans and oversized documents are rejected without guessing", () => {
  expect(validBrief({ ...brief, startDate: "2026-02-30" })).toBe(false);
  expect(validBrief({ ...brief, platforms: [] })).toBe(false);
  expect(validBrief({ ...brief, platforms: ["Instagram", "Instagram"] })).toBe(
    false,
  );
  expect(validPlan({ ...samplePlan(brief), shots: [{ seconds: -1 }] })).toBe(
    false,
  );
  expect(decodePlan('[COBS_PRODUCTION_PLAN_V1]\n{"version":2}')).toBeNull();
  expect(calendarDate("2026-12-30", 4)).toBe("2027-01-02");
});

test("largest supported sample brief leaves room for workflow links and checklist", () => {
  const input: Brief = {
    ...brief,
    topic: "x".repeat(400),
    project: "p".repeat(120),
    evidence: "e".repeat(1200),
    period: "month",
    platforms: ["Facebook", "Instagram", "TikTok", "YouTube"],
  };
  expect(
    encodePlan({
      version: 1,
      brief: input,
      plan: samplePlan(input),
      source: "starter",
      checked: [0, 1, 2, 3, 4, 5, 6],
      stage: "Upload Original Media",
      outputPostId: "a".repeat(36),
    }).length,
  ).toBeLessThan(10000);
});

test("longer sample films provide enough raw footage and distinct script alternatives", () => {
  const plan = samplePlan({ ...brief, length: "90 seconds" });
  expect(
    plan.shots.reduce((total, shot) => total + shot.seconds, 0),
  ).toBeGreaterThan(90);
  expect(new Set(plan.scripts.map((script) => script.voiceover)).size).toBe(2);
  expect(new Set(plan.scripts.map((script) => script.length)).size).toBe(2);
});
