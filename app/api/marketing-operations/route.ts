import {
  requireOwner,
  HttpError,
  errorResponse,
} from "../../../lib/server-auth";
import { database, listJobs } from "../../../lib/render-worker.mjs";
import {
  operationsTables,
  jobs,
  tasks,
  reconcileJobs,
  prepareJob,
  updateJob,
  createTask,
  reportStep,
} from "../../../lib/marketing-operations";
import {
  CHANNELS,
  PLAN_TEMPLATES,
  analyticsContract,
  type MarketingPost,
} from "../../../lib/marketing-contracts";
import { isEditingRecord } from "../../../lib/studio-model.mjs";
import { isPlanningRecord } from "../../../lib/creative-plan";
import { uuid } from "../../../lib/cinematic-model.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  let db;
  try {
    const { client, user } = await requireOwner(request);
    if (process.env.VERCEL)
      throw new HttpError(
        503,
        "Local operational storage is not a production publishing service.",
      );
    db = database();
    operationsTables(db);
    const [p, c, l] = await Promise.all([
      client
        .from("cobs_posts")
        .select(
          "id,title,body,status,updated_at,approved_at,approved_by,campaign_id,media_id",
        )
        .order("updated_at", { ascending: false })
        .limit(200),
      client.from("cobs_campaigns").select("id,name").limit(100),
      client.from("cobs_leads").select("id").limit(200),
    ]);
    if (p.error || c.error || l.error)
      throw new HttpError(
        503,
        "Workspace records could not be verified. No results fabricated.",
      );
    const posts = (p.data || []).filter(
      (post) => !isEditingRecord(post) && !isPlanningRecord(post),
    ) as MarketingPost[];
    const publishing = reconcileJobs(db, user.id, posts),
      renderJobs = listJobs(db, user.id);
    const usage = db
      .prepare(
        "SELECT count(*) jobs,coalesce(sum(bytes),0) reservedBytes FROM jobs WHERE owner=? AND created>?",
      )
      .get(user.id, Date.now() - 30 * 86400000);
    return Response.json(
      {
        posts,
        campaigns: c.data,
        leadRecordsLoaded: l.data?.length || 0,
        publishing,
        tasks: tasks(db, user.id),
        renderJobs,
        usage,
        analytics: analyticsContract(),
        integrations: CHANNELS.map((platform) => ({
          platform,
          connected: false,
          liveVerified: false,
          reason: "Official connector not configured; publication disabled.",
        })),
        scope:
          "Local owner-scoped operational jobs; up to 200 posts/100 campaigns/200 lead IDs loaded. No provider analytics available.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  } finally {
    db?.close();
  }
}
export async function POST(request: Request) {
  let db;
  try {
    const { client, user } = await requireOwner(request);
    if (process.env.VERCEL)
      throw new HttpError(
        503,
        "Local operational storage is not a production publishing service.",
      );
    const reader = request.body?.getReader();
    let raw = "",
      bytes = 0;
    if (reader) {
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 16000) {
            await reader.cancel();
            throw new HttpError(413, "Request too large.");
          }
          raw += decoder.decode(value, { stream: true });
        }
        raw += decoder.decode();
      } finally {
        reader.releaseLock();
      }
    }
    let b;
    try {
      b = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "Invalid request.");
    }
    if (!b || typeof b !== "object")
      throw new HttpError(400, "Invalid request.");
    db = database();
    operationsTables(db);
    if (b.action === "task") {
      if (
        typeof b.objective !== "string" ||
        !b.objective.trim() ||
        b.objective.length > 1000 ||
        !Object.hasOwn(PLAN_TEMPLATES, b.template) ||
        !(b.campaignId === null || uuid.test(b.campaignId))
      )
        throw new HttpError(
          400,
          "Choose a valid planning objective and template.",
        );
      if (b.campaignId) {
        const c = await client
          .from("cobs_campaigns")
          .select("id")
          .eq("id", b.campaignId)
          .maybeSingle();
        if (c.error || !c.data)
          throw new HttpError(400, "Campaign unavailable.");
      }
      return Response.json({
        task: createTask(db, user.id, b.objective, b.template, b.campaignId),
      });
    }
    if (b.action === "step") {
      if (
        !uuid.test(b.id) ||
        !Number.isInteger(b.revision) ||
        !Number.isInteger(b.index) ||
        b.index < 0 ||
        typeof b.evidence !== "string" ||
        !b.evidence.trim() ||
        b.evidence.length > 1000
      )
        throw new HttpError(400, "Provide explicit owner evidence.");
      return Response.json({
        task: reportStep(db, user.id, b.id, b.revision, b.index, b.evidence),
      });
    }
    let post: MarketingPost | undefined;
    const job =
      b.action === "prepare"
        ? null
        : jobs(db, user.id).find((j) => j.id === b.id);
    const postId = b.action === "prepare" ? b.postId : job?.postId;
    if (!uuid.test(postId))
      throw new HttpError(400, "Choose an existing content post.");
    const result = await client
      .from("cobs_posts")
      .select(
        "id,title,body,status,updated_at,approved_at,approved_by,campaign_id,media_id",
      )
      .eq("id", postId)
      .maybeSingle();
    if (result.error)
      throw new HttpError(503, "Approval could not be verified.");
    post = result.data as MarketingPost | undefined;
    if (!post || isEditingRecord(post) || isPlanningRecord(post))
      throw new HttpError(400, "Content post unavailable.");
    if (b.action === "prepare") {
      if (
        !Array.isArray(b.platforms) ||
        !b.platforms.length ||
        b.platforms.length > 4 ||
        new Set(b.platforms).size !== b.platforms.length ||
        !b.platforms.every((p: string) =>
          CHANNELS.includes(p as (typeof CHANNELS)[number]),
        ) ||
        !["now", "schedule"].includes(b.mode) ||
        !b.captions ||
        b.platforms.some(
          (p: string) =>
            typeof b.captions[p] !== "string" ||
            !b.captions[p].trim() ||
            b.captions[p].length > 2200,
        )
      )
        throw new HttpError(
          400,
          "Choose supported platforms and individual captions.",
        );
      const schedule = b.mode === "schedule" ? b.scheduleAt : null;
      if (
        b.mode === "schedule" &&
        (typeof schedule !== "string" ||
          !schedule ||
          !Number.isFinite(Date.parse(schedule)) ||
          Date.parse(schedule) <= Date.now())
      )
        throw new HttpError(
          400,
          "Choose a future schedule time. This records a plan, not an active publisher.",
        );
      db.exec("BEGIN IMMEDIATE");
      try {
        const results = b.platforms.map((p: (typeof CHANNELS)[number]) =>
          prepareJob(db!, user.id, post!, p, b.captions[p], b.mode, schedule),
        );
        db.exec("COMMIT");
        return Response.json({ results });
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    }
    if (
      !["retry", "cancel", "report", "review"].includes(b.action) ||
      !job ||
      !Number.isInteger(b.revision) ||
      (b.action === "report" &&
        (typeof b.url !== "string" || b.url.length > 1000))
    )
      throw new HttpError(400, "Invalid publishing action.");
    return Response.json({
      job: updateJob(db, user.id, b.id, b.revision, b.action, post, b.url),
    });
  } catch (e) {
    return errorResponse(
      e instanceof HttpError
        ? e
        : new HttpError(
            409,
            e instanceof Error ? e.message : "Local operation failed.",
          ),
    );
  } finally {
    db?.close();
  }
}
