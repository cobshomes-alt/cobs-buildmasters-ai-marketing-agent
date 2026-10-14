import { randomUUID } from "node:crypto";
import {
  requireOwner,
  HttpError,
  errorResponse,
} from "../../../lib/server-auth";
import {
  MEDIA_TYPES,
  type MediaType,
  validateMedia,
  matchesSignature,
} from "../../../lib/media";

export async function POST(request: Request) {
  try {
    const { client, user } = await requireOwner(request);
    let input;
    try {
      input = await request.json();
    } catch {
      throw new HttpError(400, "Request body must be JSON.");
    }
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new HttpError(400, "Invalid media request.");
    const bucket = client.storage.from("cobs-media");
    if (input.action === "prepare") {
      const invalid = validateMedia(input.name, input.type, input.size);
      if (invalid) throw new HttpError(400, invalid);
      const path = `${user.id}/${randomUUID()}.${MEDIA_TYPES[input.type as MediaType]}`;
      const result = await bucket.createSignedUploadUrl(path);
      if (result.error)
        throw new HttpError(
          502,
          "Storage could not prepare the upload. Check the bucket and policies.",
        );
      return Response.json({ path, token: result.data.token });
    }
    if (input.action !== "complete" && input.action !== "discard")
      throw new HttpError(400, "Unknown media action.");
    if (
      typeof input.path !== "string" ||
      !new RegExp(`^${user.id}/[0-9a-f-]{36}\\.(jpg|png|webp|mp4|mov)$`).test(
        input.path,
      )
    )
      throw new HttpError(400, "Invalid storage path.");
    if (input.action === "discard") {
      const existing = await client
        .from("cobs_media_assets")
        .select("id")
        .eq("storage_path", input.path);
      if (existing.error || existing.data?.length)
        throw new HttpError(409, "Registered media cannot be discarded.");
      const removed = await bucket.remove([input.path]);
      if (removed.error)
        throw new HttpError(502, "Upload cleanup failed. Retry cleanup.");
      return Response.json({ ok: true });
    }
    const invalid = validateMedia(input.name, input.type, input.size);
    if (invalid) throw new HttpError(400, invalid);
    const project =
      typeof input.project === "string" ? input.project.trim() : "";
    const product =
      typeof input.product === "string" ? input.product.trim() : "";
    if (project.length > 120 || product.length > 120)
      throw new HttpError(
        400,
        "Project and product labels must be at most 120 characters.",
      );
    const info = await bucket.info(input.path);
    if (info.error || !info.data)
      throw new HttpError(400, "Uploaded file was not found.");
    if (
      Number(info.data.size) !== input.size ||
      info.data.contentType !== input.type
    )
      throw new HttpError(
        400,
        "Uploaded file metadata does not match the request.",
      );
    const signed = await bucket.createSignedUrl(input.path, 60);
    if (signed.error)
      throw new HttpError(502, "Could not validate uploaded media.");
    const response = await fetch(signed.data.signedUrl, {
      headers: { Range: "bytes=0-31" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok || !response.body)
      throw new HttpError(502, "Could not read uploaded media.");
    const reader = response.body.getReader();
    const chunks: number[] = [];
    try {
      while (chunks.length < 32) {
        const chunk = await reader.read();
        if (chunk.done) break;
        chunks.push(...chunk.value.slice(0, 32 - chunks.length));
      }
    } finally {
      await reader.cancel();
    }
    if (!matchesSignature(new Uint8Array(chunks), input.type))
      throw new HttpError(
        400,
        "File contents do not match the selected media type.",
      );
    const saved = await client
      .from("cobs_media_assets")
      .insert({
        storage_path: input.path,
        original_name: input.name.trim(),
        mime_type: input.type,
        size_bytes: input.size,
        project,
        product,
        campaign_id: input.campaign_id || null,
        created_by: user.id,
      })
      .select()
      .single();
    if (saved.error)
      throw new HttpError(
        400,
        "Media could not be registered. Check the campaign and database migration.",
      );
    return Response.json({ asset: saved.data });
  } catch (error) {
    return errorResponse(error);
  }
}
