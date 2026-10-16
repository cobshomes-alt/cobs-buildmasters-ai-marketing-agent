import { test, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  operationsTables,
  jobs,
  tasks,
  prepareJob,
  updateJob,
  reconcileJobs,
  createTask,
  reportStep,
} from "../lib/marketing-operations";
import {
  analyticsContract,
  type MarketingPost,
} from "../lib/marketing-contracts";
const owner = randomUUID(),
  other = randomUUID(),
  path = resolve(".tools/operations-tests-" + randomUUID() + ".sqlite");
const post: MarketingPost = {
  id: randomUUID(),
  title: "Synthetic approved post",
  body: "Verified source copy",
  status: "Approved",
  updated_at: "2026-10-15T00:00:00Z",
  approved_at: "2026-10-15T00:00:00Z",
  approved_by: owner,
};
test("durable local preparation is idempotent, owner scoped, separately reviewed and never publishes", () => {
  let db = new DatabaseSync(path);
  operationsTables(db);
  const a = prepareJob(
    db,
    owner,
    post,
    "Instagram",
    "Platform caption",
    "now",
    null,
  );
  expect(a.job.state).toBe("awaiting_review");
  expect(
    prepareJob(db, owner, post, "Instagram", "Platform caption", "now", null)
      .duplicate,
  ).toBe(true);
  expect(jobs(db, other)).toEqual([]);
  expect(() => updateJob(db, other, a.job.id, 1, "review", post)).toThrow();
  expect(() =>
    updateJob(
      db,
      owner,
      a.job.id,
      1,
      "report",
      post,
      "https://instagram.com/p/test",
    ),
  ).toThrow(/Approval/);
  const reviewed = updateJob(db, owner, a.job.id, 1, "review", post);
  expect(reviewed.state).toBe("blocked_provider");
  expect(reviewed.ownerReviewedAt).toBeTruthy();
  expect(() => updateJob(db, owner, a.job.id, 1, "retry", post)).toThrow(
    /stale/,
  );
  db.close();
  db = new DatabaseSync(path);
  expect(jobs(db, owner)).toHaveLength(1);
  expect(() =>
    updateJob(
      db,
      owner,
      a.job.id,
      2,
      "report",
      post,
      "https://evil.example/post",
    ),
  ).toThrow();
  const recorded = updateJob(
    db,
    owner,
    a.job.id,
    2,
    "report",
    post,
    "https://instagram.com/p/synthetic?access_token=synthetic-only#private-fragment",
  );
  expect(recorded.state).toBe("owner_reported");
  expect(recorded.publishedUrl).toBe("https://instagram.com/p/synthetic");
  expect(recorded.reason).toMatch(/no provider/);
  expect(recorded.history).toHaveLength(3);
  db.close();
});
test("source edits invalidate job review and cannot bypass approval through retry or manual links", () => {
  const db = new DatabaseSync(":memory:");
  operationsTables(db);
  const a = prepareJob(
    db,
    owner,
    post,
    "Facebook",
    "Copy",
    "schedule",
    "2099-01-01T00:00:00Z",
  );
  updateJob(db, owner, a.job.id, 1, "review", post);
  const changed = {
    ...post,
    status: "Draft",
    approved_by: null,
    approved_at: null,
    updated_at: "changed",
  };
  const direct = updateJob(db, owner, a.job.id, 2, "retry", changed);
  expect(direct.ownerReviewedAt).toBeNull();
  expect(direct.state).toBe("awaiting_approval");
  const reconciled = reconcileJobs(db, owner, [changed])[0];
  expect(reconciled.state).toBe("awaiting_approval");
  expect(reconciled.ownerReviewedAt).toBeNull();
  expect(() =>
    updateJob(db, owner, a.job.id, reconciled.revision, "review", changed),
  ).toThrow(/Approve/);
  expect(() =>
    updateJob(
      db,
      owner,
      a.job.id,
      reconciled.revision,
      "report",
      changed,
      "https://facebook.com/posts/test",
    ),
  ).toThrow(/Approval/);
  let j = reconciled;
  for (let i = 0; i < 2; i++)
    j = updateJob(db, owner, j.id, j.revision, "retry", changed);
  expect(j.state).toBe("awaiting_approval");
  expect(() =>
    updateJob(db, owner, j.id, j.revision, "retry", changed),
  ).toThrow(/Three/);
  expect(updateJob(db, owner, j.id, j.revision, "cancel", changed).state).toBe(
    "cancelled",
  );
  db.close();
});
test("planning evidence stays explicitly owner-reported, does not invent metrics and survives scoped reads", () => {
  const db = new DatabaseSync(":memory:");
  operationsTables(db);
  const t = createTask(
    db,
    owner,
    "Synthetic education objective",
    "education",
    null,
  );
  expect(t.steps.every((s) => s.state === "planned")).toBe(true);
  expect(tasks(db, other)).toEqual([]);
  expect(() => reportStep(db, other, t.id, 1, 0, "evidence")).toThrow();
  const changed = reportStep(
    db,
    owner,
    t.id,
    1,
    0,
    "Owner checked actual source footage",
  );
  expect(changed.steps[0].state).toBe("owner_reported");
  expect(changed.steps[1].state).toBe("planned");
  expect(() => reportStep(db, owner, t.id, 1, 1, "stale")).toThrow();
  const analytics = analyticsContract();
  expect(
    Object.entries(analytics)
      .filter(([k]) => k !== "source")
      .every(([, v]) => v === null),
  ).toBe(true);
  db.close();
});
