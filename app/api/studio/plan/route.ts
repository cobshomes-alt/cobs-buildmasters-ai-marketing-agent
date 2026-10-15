import {
  requireOwner,
  HttpError,
  errorResponse,
} from "../../../../lib/server-auth";
import {
  generateEditingPlan,
  validateBrief,
  type MediaFacts,
} from "../../../../lib/automatic-editing";
import { readiness, probe } from "../../../../lib/render-worker.mjs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { resolve, join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
let inspecting = false;
export async function POST(request: Request) {
  let folder: string | undefined,
    locked = false;
  try {
    const { client, user } = await requireOwner(request);
    if (!readiness())
      throw new HttpError(
        503,
        "Local media inspection is unavailable. Start the configured FFmpeg environment.",
      );
    const reader = request.body?.getReader();
    let bytes = 0,
      text = "";
    if (reader) {
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 12000) {
            await reader.cancel();
            throw new HttpError(413, "Editing brief is too large.");
          }
          text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
      } finally {
        reader.releaseLock();
      }
    }
    let brief;
    try {
      brief = JSON.parse(text);
      validateBrief(brief);
    } catch (e) {
      throw new HttpError(
        400,
        e instanceof Error ? e.message : "Invalid editing brief.",
      );
    }
    if (inspecting)
      throw new HttpError(
        429,
        "Another media inspection is running. Try again shortly.",
      );
    inspecting = true;
    locked = true;
    const found = await client
      .from("cobs_media_assets")
      .select(
        "id,storage_path,original_name,mime_type,size_bytes,project,product,deletion_pending",
      )
      .in("id", brief.mediaIds);
    if (
      found.error ||
      !found.data ||
      found.data.length !== brief.mediaIds.length
    )
      throw new HttpError(
        400,
        "One or more selected originals are unavailable.",
      );
    const assets = brief.mediaIds.map((id: string) =>
      found.data!.find((a) => a.id === id)!,
    );
    if (
      assets.some(
        (a) =>
          !a ||
          a.deletion_pending ||
          !Number.isInteger(a.size_bytes) ||
          a.size_bytes < 1 ||
          !new RegExp(
            `^${user.id}/[a-f0-9-]{36}\\.(jpg|png|webp|mp4|mov)$`,
            "i",
          ).test(a.storage_path) ||
          ![
            "image/jpeg",
            "image/png",
            "image/webp",
            "video/mp4",
            "video/quicktime",
          ].includes(a.mime_type),
      ) ||
      assets.reduce((n, a) => n + a.size_bytes, 0) > 50 * 1024 * 1024
    )
      throw new HttpError(
        400,
        "Selected originals are unsupported, unavailable or exceed 50 MiB.",
      );
    const root = resolve(".tools/director-inspection");
    await mkdir(root, { recursive: true });
    folder = await mkdtemp(join(root, "inspect-"));
    const facts: MediaFacts[] = [],
      deadline = Date.now() + 90000;
    for (const [i, a] of assets.entries()) {
      if (Date.now() > deadline)
        throw new HttpError(504, "Media inspection exceeded its time limit.");
      const signed = await client.storage
        .from("cobs-media")
        .createSignedUrl(a.storage_path, 60);
      if (signed.error || !signed.data)
        throw new HttpError(502, "Private media authorization failed.");
      const url = new URL(signed.data.signedUrl);
      if (
        url.protocol !== "https:" ||
        url.origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin
      )
        throw new HttpError(502, "Unexpected private media origin.");
      const response = await fetch(url, {
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(
          Math.max(1, Math.min(30000, deadline - Date.now())),
        ),
      });
      if (!response.ok || !response.body)
        throw new HttpError(502, "Private media transfer failed.");
      let captured = 0;
      const file = join(folder, `input-${i}`);
      await pipeline(
        Readable.fromWeb(response.body as never),
        new Transform({
          transform(chunk, _encoding, callback) {
            captured += chunk.length;
            callback(
              captured > a.size_bytes
                ? new Error("Source size changed.")
                : null,
              chunk,
            );
          },
        }),
        createWriteStream(file, { flags: "wx" }),
      );
      if (captured !== a.size_bytes)
        throw new HttpError(
          502,
          "Original size changed. Refresh your media library.",
        );
      const info = await probe(file),
        v = info.streams.find((s) => s.codec_type === "video");
      if (
        !v?.width ||
        !v.height ||
        (a.mime_type.startsWith("image/") &&
          !["png", "mjpeg", "webp"].includes(v.codec_name)) ||
        (a.mime_type.startsWith("video/") &&
          ["png", "mjpeg", "webp"].includes(v.codec_name))
      )
        throw new HttpError(
          400,
          "Media type does not match the inspected original.",
        );
      facts.push({
        id: a.id,
        name: a.original_name,
        mime: a.mime_type,
        bytes: captured,
        width: v.width,
        height: v.height,
        duration: a.mime_type.startsWith("video/")
          ? Number(info.format.duration)
          : null,
        audio: info.streams.some((s) => s.codec_type === "audio"),
        orientation:
          v.width === v.height
            ? "square"
            : v.width > v.height
              ? "landscape"
              : "portrait",
        labels: [a.project, a.product].filter(Boolean),
        thumbnail: a.mime_type.startsWith("image/")
          ? "private original"
          : "not generated",
      });
    }
    let plan;
    try {
      plan = generateEditingPlan(brief, facts);
    } catch (e) {
      throw new HttpError(
        400,
        e instanceof Error ? e.message : "The requested plan is not feasible.",
      );
    }
    return Response.json(
      { plan },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  } finally {
    try {
      if (folder) await rm(folder, { recursive: true, force: true });
    } finally {
      if (locked) inspecting = false;
    }
  }
}
