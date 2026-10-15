import {
  requireOwner,
  HttpError,
  errorResponse,
} from "../../../../lib/server-auth";
import {
  sequenceSnapshot,
  SEQUENCE_LIMITS,
} from "../../../../lib/sequence-model.mjs";
import {
  validateTimeline,
  type TimelineDocument,
} from "../../../../lib/timeline";
import {
  database,
  readiness,
  reserve,
  renderKey,
  publicJob,
  findJob,
  setState,
  sequenceInputPath,
} from "../../../../lib/render-worker.mjs";
import { createWriteStream } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  let db;
  try {
    const { client, user } = await requireOwner(request);
    if (!readiness())
      throw new HttpError(503, "Local rendering is unavailable.");
    if (Number(request.headers.get("content-length") || 0) > 48000)
      throw new HttpError(413, "Timeline request is too large.");
    const reader = request.body?.getReader();
    let text = "",
      bytes = 0;
    if (reader) {
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 48000) {
            await reader.cancel();
            throw new HttpError(413, "Timeline request is too large.");
          }
          text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
      } finally {
        reader.releaseLock();
      }
    }
    let doc: TimelineDocument;
    try {
      doc = JSON.parse(text);
    } catch {
      throw new HttpError(400, "Send a valid timeline.");
    }
    const invalid = validateTimeline(doc);
    if (invalid) throw new HttpError(400, invalid);
    let recipe;
    try {
      recipe = sequenceSnapshot(doc.clips);
    } catch (e) {
      throw new HttpError(
        400,
        e instanceof Error ? e.message : "Invalid timeline.",
      );
    }
    const ids = [...new Set(recipe.clips.map((c) => c.mediaId))];
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
    if (!(
      worker?.version >=
        (recipe.clips.some((c) => c.recipe.captions?.length) ? 3 : 2) &&
      typeof worker.token === "string" &&
      worker.token === worker.capability_token &&
      worker.heartbeat > Date.now() - 15000
    ))
      throw new HttpError(
        503,
        "Start the updated local render worker before exporting a sequence.",
      );
    const found = await client
      .from("cobs_media_assets")
      .select("id,storage_path,mime_type,size_bytes,deletion_pending")
      .in("id", ids);
    if (found.error || !found.data || found.data.length !== ids.length)
      throw new HttpError(400, "One or more originals are unavailable.");
    const assets = ids.map((id) => {
      const asset = found.data.find((a) => a.id === id);
      if (!asset) throw new HttpError(400, "An original is unavailable.");
      return asset;
    });
    let size = 0;
    for (const asset of assets) {
      if (
        !asset ||
        asset.deletion_pending ||
        !Number.isInteger(asset.size_bytes) ||
        asset.size_bytes < 1 ||
        !new RegExp(
          `^${user.id}/[a-f0-9-]{36}\\.(jpg|png|webp|mp4|mov)$`,
          "i",
        ).test(asset.storage_path) ||
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
          "video/mp4",
          "video/quicktime",
        ].includes(asset.mime_type) ||
        recipe.clips.some(
          (c) =>
            c.mediaId === asset.id &&
            c.kind !==
              (asset.mime_type.startsWith("image/") ? "image" : "video"),
        )
      )
        throw new HttpError(400, "An original is unavailable or unsupported.");
      size += asset.size_bytes;
    }
    if (size > SEQUENCE_LIMITS.bytes)
      throw new HttpError(
        413,
        "Combined originals exceed the 50 MiB export limit.",
      );
    let reserved;
    try {
      reserved = reserve(
        db,
        user.id,
        renderKey(
          user.id,
          `sequence-v${recipe.version}:${doc.id}`,
          "snapshot",
          JSON.stringify(recipe),
          JSON.stringify(
            assets.map((a) => [
              a.id,
              a.storage_path,
              a.size_bytes,
              a.mime_type,
            ]),
          ),
        ),
        recipe,
        "video",
        size,
      );
    } catch (e) {
      throw new HttpError(
        429,
        e instanceof Error ? e.message : "Render limit reached.",
      );
    }
    const { row, duplicate } = reserved;
    if (duplicate)
      return Response.json({ job: publicJob(db, row), duplicate: true });
    const deadline = Date.now() + 90000;
    try {
      for (const [index, asset] of assets.entries()) {
        if (findJob(db, user.id, row.id)?.state !== "receiving") break;
        const remaining = deadline - Date.now();
        if (remaining < 1) throw new Error("Transfer time limit.");
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
          signal: AbortSignal.timeout(Math.min(30000, remaining)),
          redirect: "error",
          cache: "no-store",
        });
        if (!response.ok || !response.body)
          throw new Error("Private transfer failed.");
        let captured = 0;
        await pipeline(
          Readable.fromWeb(response.body as never),
          new Transform({
            transform(chunk, _encoding, callback) {
              captured += chunk.length;
              callback(
                captured > asset.size_bytes
                  ? new Error("Source size changed.")
                  : null,
                chunk,
              );
            },
          }),
          createWriteStream(sequenceInputPath(row.id, index), { flags: "wx" }),
        );
        if (captured !== asset.size_bytes)
          throw new Error("Source size changed.");
      }
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
        "Private sequence capture failed; no export produced.",
        "receiving",
      );
      throw new HttpError(
        502,
        "An original could not be captured. Check media access and file sizes. No export was produced.",
      );
    }
  } catch (e) {
    return errorResponse(e);
  } finally {
    db?.close();
  }
}
