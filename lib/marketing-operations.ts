import type { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import {
  approvalCurrent,
  type MarketingPost,
  type PublishingJob,
  type MarketingTask,
  PLAN_TEMPLATES,
  type Channel,
} from "./marketing-contracts";
export function operationsTables(db: DatabaseSync) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS marketing_jobs(id TEXT PRIMARY KEY,owner TEXT NOT NULL,key TEXT NOT NULL,body TEXT NOT NULL,UNIQUE(owner,key));CREATE TABLE IF NOT EXISTS marketing_tasks(id TEXT PRIMARY KEY,owner TEXT NOT NULL,body TEXT NOT NULL);`,
  );
}
export function jobs(db: DatabaseSync, owner: string): PublishingJob[] {
  return db
    .prepare(
      "SELECT body FROM marketing_jobs WHERE owner=? ORDER BY rowid DESC LIMIT 100",
    )
    .all(owner)
    .map((r) => JSON.parse(String(r.body)));
}
export function tasks(db: DatabaseSync, owner: string): MarketingTask[] {
  return db
    .prepare(
      "SELECT body FROM marketing_tasks WHERE owner=? ORDER BY rowid DESC LIMIT 100",
    )
    .all(owner)
    .map((r) => JSON.parse(String(r.body)));
}
function saveJob(
  db: DatabaseSync,
  owner: string,
  j: PublishingJob,
  previous: number,
) {
  const changed = db
    .prepare(
      "UPDATE marketing_jobs SET body=? WHERE id=? AND owner=? AND json_extract(body,'$.revision')=?",
    )
    .run(JSON.stringify(j), j.id, owner, previous);
  if (!changed.changes)
    throw Error("Publishing job changed. Refresh before retrying.");
}
export function reconcileJobs(
  db: DatabaseSync,
  owner: string,
  posts: MarketingPost[],
) {
  for (const job of jobs(db, owner)) {
    if (job.state === "cancelled" || job.state === "owner_reported") continue;
    const post = posts.find((p) => p.id === job.postId);
    if (
      !approvalCurrent(post, owner, job.sourceRevision) &&
      (job.state !== "awaiting_approval" || !!job.ownerReviewedAt)
    ) {
      const previous = job.revision++;
      job.state = "awaiting_approval";
      job.ownerReviewedAt = null;
      job.reason =
        "Source changed or owner approval is missing. Prepare a fresh job after review.";
      job.history.push({
        at: new Date().toISOString(),
        state: job.state,
        reason: job.reason,
      });
      saveJob(db, owner, job, previous);
    }
  }
  return jobs(db, owner);
}
export function prepareJob(
  db: DatabaseSync,
  owner: string,
  post: MarketingPost,
  platform: Channel,
  caption: string,
  mode: "now" | "schedule",
  scheduleAt: string | null,
) {
  const key = createHash("sha256")
    .update(
      JSON.stringify([
        post.id,
        post.updated_at,
        platform,
        caption,
        mode,
        scheduleAt,
      ]),
    )
    .digest("hex");
  const existing = db
    .prepare("SELECT body FROM marketing_jobs WHERE owner=? AND key=?")
    .get(owner, key);
  if (existing)
    return {
      job: JSON.parse(String(existing.body)) as PublishingJob,
      duplicate: true,
    };
  if (jobs(db, owner).length >= 100)
    throw Error("Local publishing job limit reached.");
  const approved = approvalCurrent(post, owner),
    state = approved ? "awaiting_review" : "awaiting_approval";
  const reason = approved
    ? "Review and approve this exact platform caption locally. Nothing was sent."
    : "Owner approval is required. Nothing was sent.";
  const job: PublishingJob = {
    id: randomUUID(),
    postId: post.id,
    sourceRevision: post.updated_at,
    platform,
    caption,
    mode,
    scheduleAt,
    state,
    reason,
    attempts: 0,
    revision: 1,
    publishedUrl: null,
    ownerReviewedAt: null,
    history: [{ at: new Date().toISOString(), state, reason }],
  };
  db.prepare("INSERT INTO marketing_jobs VALUES(?,?,?,?)").run(
    job.id,
    owner,
    key,
    JSON.stringify(job),
  );
  return { job, duplicate: false };
}
export function updateJob(
  db: DatabaseSync,
  owner: string,
  id: string,
  expected: number,
  action: "retry" | "cancel" | "report" | "review",
  post: MarketingPost | undefined,
  url?: string,
) {
  const job = jobs(db, owner).find((j) => j.id === id);
  if (!job || job.revision !== expected)
    throw Error("Publishing job unavailable or stale. Refresh first.");
  if (job.state === "owner_reported" || job.state === "cancelled")
    throw Error("This job is already final.");
  const previous = job.revision++;
  if (action === "cancel") {
    job.state = "cancelled";
    job.reason =
      "Owner cancelled local preparation. No external content was sent.";
  } else if (action === "review") {
    if (!approvalCurrent(post, owner, job.sourceRevision))
      throw Error(
        "Approve the unchanged source content before this platform review.",
      );
    job.ownerReviewedAt = new Date().toISOString();
    job.state = "blocked_provider";
    job.reason =
      "Exact platform caption reviewed by owner. Official connector and separate external authorization remain unavailable; nothing sent.";
  } else if (action === "report") {
    if (
      !job.ownerReviewedAt ||
      !approvalCurrent(post, owner, job.sourceRevision)
    )
      throw Error("Approval is missing or source changed.");
    const u = new URL(url || "");
    const allowed = {
      Instagram: ["www.instagram.com", "instagram.com"],
      Facebook: ["www.facebook.com", "facebook.com"],
      TikTok: ["www.tiktok.com", "tiktok.com"],
      YouTube: ["www.youtube.com", "youtube.com", "youtu.be"],
    }[job.platform];
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      !allowed.includes(u.hostname) ||
      u.pathname === "/"
    )
      throw Error("Use a public HTTPS post URL on the selected platform.");
    job.state = "owner_reported";
    const videoId = u.searchParams.get("v");
    u.search = "";
    u.hash = "";
    if (
      job.platform === "YouTube" &&
      u.pathname === "/watch" &&
      videoId &&
      /^[A-Za-z0-9_-]{11}$/.test(videoId)
    )
      u.searchParams.set("v", videoId);
    job.publishedUrl = u.toString();
    job.reason =
      "Owner-reported published link; no provider publication or verification was performed.";
  } else {
    if (job.attempts >= 3)
      throw Error(
        "Three readiness checks used. Correct the blocker before preparing a new revision.",
      );
    job.attempts++;
    if (!approvalCurrent(post, owner, job.sourceRevision))
      job.ownerReviewedAt = null;
    job.state = approvalCurrent(post, owner, job.sourceRevision)
      ? job.ownerReviewedAt
        ? "blocked_provider"
        : "awaiting_review"
      : "awaiting_approval";
    job.reason =
      job.state === "blocked_provider"
        ? "Connector still unavailable. No API publish request was attempted."
        : "Approval missing or content changed; fresh review and preparation required.";
  }
  job.history.push({
    at: new Date().toISOString(),
    state: job.state,
    reason: job.reason,
  });
  saveJob(db, owner, job, previous);
  return job;
}
export function createTask(
  db: DatabaseSync,
  owner: string,
  objective: string,
  template: keyof typeof PLAN_TEMPLATES,
  campaignId: string | null,
) {
  if (tasks(db, owner).length >= 100)
    throw Error("Local planning limit reached.");
  const task: MarketingTask = {
    id: randomUUID(),
    objective,
    template,
    campaignId,
    revision: 1,
    steps: PLAN_TEMPLATES[template].map((label, i) => ({
      label,
      component:
        template === "production"
          ? [
              "Creative Director",
              "Media Library",
              "Media Studio",
              "Render worker",
              "Approvals",
              "Publishing Centre",
              "External connector",
            ][i]
          : "Owner planning",
      state: "planned",
      evidence: "",
    })),
    history: [
      {
        at: new Date().toISOString(),
        message:
          "Owner created a local planning workflow. No business records or external accounts changed.",
      },
    ],
  };
  db.prepare("INSERT INTO marketing_tasks VALUES(?,?,?)").run(
    task.id,
    owner,
    JSON.stringify(task),
  );
  return task;
}
export function reportStep(
  db: DatabaseSync,
  owner: string,
  id: string,
  expected: number,
  index: number,
  evidence: string,
) {
  const task = tasks(db, owner).find((t) => t.id === id);
  if (!task || task.revision !== expected || !task.steps[index])
    throw Error("Task unavailable or stale. Refresh first.");
  const previous = task.revision++;
  task.steps[index] = {
    ...task.steps[index],
    state: "owner_reported",
    evidence,
  };
  task.history.push({
    at: new Date().toISOString(),
    message: `Owner reported evidence for step ${index + 1}; not automatically verified.`,
  });
  const changed = db
    .prepare(
      "UPDATE marketing_tasks SET body=? WHERE id=? AND owner=? AND json_extract(body,'$.revision')=?",
    )
    .run(JSON.stringify(task), id, owner, previous);
  if (!changed.changes) throw Error("Task changed. Refresh first.");
  return task;
}
