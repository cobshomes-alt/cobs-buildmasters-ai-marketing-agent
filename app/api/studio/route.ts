import {
  requireOwner,
  HttpError,
  errorResponse,
} from "../../../lib/server-auth";
import { decodeEdit } from "../../../lib/studio-model.mjs";
import {
  database,
  readiness,
  listJobs,
  findJob,
  publicJob,
  reserve,
  renderKey,
  setState,
  inputPath,
  outputPath,
  cancel,
  MAX_BYTES,
} from "../../../lib/render-worker.mjs";
import { createWriteStream, readFileSync, existsSync } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export async function GET(request: Request) {
  let db;
  try {
    const { user } = await requireOwner(request);
    if (!readiness())
      return Response.json({
        ready: false,
        jobs: [],
        message:
          "Local rendering is unavailable. Enable the owner-operated worker; cloud rendering is not connected.",
      });
    db = database();
    const worker = db
      .prepare(
        "SELECT w.heartbeat,w.token,c.token AS capability_token,c.version FROM worker w LEFT JOIN worker_capabilities c ON c.id=w.id WHERE w.id=1",
      )
      .get() as {
      heartbeat: number;
      token: string;
      capability_token: string;
      version: number;
    };
    const id = new URL(request.url).searchParams.get("download");
    if (id) {
      const row = findJob(db, user.id, id);
      if (
        !row ||
        row.state !== "completed" ||
        row.updated < Date.now() - 86400000 ||
        !existsSync(outputPath(row))
      )
        throw new HttpError(404, "Export is not available or has expired.");
      return new Response(readFileSync(outputPath(row)), {
        headers: {
          "Content-Type": row.kind === "image" ? "image/png" : "video/mp4",
          "Content-Disposition": `attachment; filename="cobs-export-${row.id}.${row.kind === "image" ? "png" : "mp4"}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    return Response.json(
      {
        ready: true,
        workerOnline: worker.heartbeat > Date.now() - 15000,
        sequenceReady:
          worker.version >= 2 &&
          worker.token === worker.capability_token &&
          worker.heartbeat > Date.now() - 15000,
        timedCaptionsReady:
          worker.version >= 3 &&
          worker.token === worker.capability_token &&
          worker.heartbeat > Date.now() - 15000,
        constructionReady:
          worker.version >= 5 &&
          worker.token === worker.capability_token &&
          worker.heartbeat > Date.now() - 15000,
        cinematicReady:
          worker.version >= 4 &&
          worker.token === worker.capability_token &&
          worker.heartbeat > Date.now() - 15000,
        jobs: listJobs(db, user.id),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  } finally {
    db?.close();
  }
}
export async function POST(request: Request) {
  let db;
  try {
    const { client, user } = await requireOwner(request);
    if (!readiness())
      throw new HttpError(
        503,
        "Local rendering is unavailable. No cloud processing service is connected.",
      );
    if (Number(request.headers.get("content-length") || 0) > 2048)
      throw new HttpError(413, "Request is too large.");
    const reader = request.body?.getReader();
    let raw = "";
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          raw += new TextDecoder().decode(value);
          if (raw.length > 2048) {
            await reader.cancel();
            throw new HttpError(413, "Request is too large.");
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "Invalid request.");
    }
    db = database();
    if (data.action === "cancel" && uuid.test(data.id)) {
      const job = cancel(db, user.id, data.id);
      if (!job) throw new HttpError(404, "Job not found.");
      return Response.json({ job });
    }
    if (data.action !== "render" || !uuid.test(data.projectId))
      throw new HttpError(400, "Choose a saved editing project.");
    const result = await client
      .from("cobs_posts")
      .select("id,body,media_id,updated_at,status")
      .eq("id", data.projectId)
      .single();
    const project = result.data,
      recipe = project && decodeEdit(project.body);
    if (
      project &&
      (typeof data.updatedAt !== "string" ||
        project.updated_at !== data.updatedAt)
    )
      throw new HttpError(
        409,
        "This project changed on another device. Refresh and reopen it before exporting.",
      );
    if (
      result.error ||
      !project ||
      !recipe ||
      project.status !== "Draft" ||
      !project.media_id
    )
      throw new HttpError(
        400,
        "Save a valid Draft editing project with original media first.",
      );
    if (recipe.captions?.length) {
      throw new HttpError(
        400,
        "Export timed captions from the production timeline, not the single-source editor.",
      );
    }
    const media = await client
      .from("cobs_media_assets")
      .select("*")
      .eq("id", project.media_id)
      .single();
    const asset = media.data;
    if (
      media.error ||
      !asset ||
      asset.deletion_pending ||
      asset.size_bytes > MAX_BYTES ||
      !new RegExp(
        `^${user.id}/[a-f0-9-]{36}\\.(jpg|png|webp|mp4|mov)$`,
        "i",
      ).test(asset.storage_path)
    )
      throw new HttpError(400, "Original media is unavailable or unsupported.");
    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "video/mp4",
        "video/quicktime",
      ].includes(asset.mime_type)
    )
      throw new HttpError(400, "Unsupported media type.");
    let reserved;
    try {
      reserved = reserve(
        db,
        user.id,
        renderKey(
          user.id,
          project.id,
          project.updated_at,
          project.body,
          asset.storage_path,
        ),
        recipe,
        asset.mime_type.startsWith("image/") ? "image" : "video",
        asset.size_bytes,
      );
    } catch (error) {
      throw new HttpError(
        429,
        error instanceof Error ? error.message : "Render limit reached.",
      );
    }
    const { row, duplicate } = reserved;
    if (duplicate)
      return Response.json({ job: publicJob(db, row), duplicate: true });
    try {
      const signed = await client.storage
        .from("cobs-media")
        .createSignedUrl(asset.storage_path, 60);
      if (signed.error || !signed.data)
        throw new Error("Storage authorization failed.");
      const url = new URL(signed.data.signedUrl),
        configured = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
      if (url.origin !== configured.origin || url.protocol !== "https:")
        throw new Error("Unexpected Storage origin.");
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
        redirect: "error",
        cache: "no-store",
      });
      if (!response.ok || !response.body)
        throw new Error("Source download failed.");
      let size = 0;
      await pipeline(
        Readable.fromWeb(response.body as never),
        new Transform({
          transform(chunk, _encoding, callback) {
            size += chunk.length;
            callback(
              size > MAX_BYTES ? new Error("Source exceeds limit.") : null,
              chunk,
            );
          },
        }),
        createWriteStream(inputPath(row.id), { flags: "wx" }),
      );
      if (size !== asset.size_bytes) throw new Error("Source size changed.");
      // A second request may cancel while the source is transferring.
      setState(db, row.id, "pending", null, "receiving");
      return Response.json(
        { job: publicJob(db, findJob(db, user.id, row.id)) },
        { status: 202 },
      );
    } catch {
      setState(
        db,
        row.id,
        "failed",
        "Private source transfer failed. No export was produced.",
        "receiving",
      );
      throw new HttpError(
        502,
        "Private source transfer failed. Check Storage access and retry with a newly saved project revision.",
      );
    }
  } catch (error) {
    return errorResponse(error);
  } finally {
    db?.close();
  }
}
