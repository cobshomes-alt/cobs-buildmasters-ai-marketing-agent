import {
  requireOwner,
  HttpError,
  errorResponse,
} from "../../../lib/server-auth";
import { validateTimeline, type TimelineDocument } from "../../../lib/timeline";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { client } = await requireOwner(request);
    const result = await client
      .from("cobs_edit_projects")
      .select("id,title,campaign_id,aspect,revision,updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (result.error)
      throw new HttpError(
        503,
        "Multi-asset cloud saving is unavailable. The separately reviewed project schema must be approved and installed first.",
      );
    return Response.json(
      { projects: result.data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    const { client } = await requireOwner(request);
    if (Number(request.headers.get("content-length") || 0) > 100000)
      throw new HttpError(413, "Project exceeds request limit.");
    const reader = request.body?.getReader();
    let body = "";
    const decoder = new TextDecoder();
    if (reader) {
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          body += decoder.decode(next.value, { stream: true });
          if (body.length > 100000) {
            await reader.cancel();
            throw new HttpError(413, "Project exceeds request limit.");
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      throw new HttpError(400, "Invalid project request.");
    }
    if (
      data.action === "open" &&
      typeof data.id === "string" &&
      /^[a-f0-9-]{36}$/i.test(data.id)
    ) {
      const result = await client
        .from("cobs_edit_projects")
        .select("*,cobs_edit_clips(*)")
        .eq("id", data.id)
        .single();
      if (result.error || !result.data)
        throw new HttpError(404, "Saved project could not be opened.");
      const p = result.data;
      const doc = {
        version: 1,
        id: p.id,
        title: p.title,
        campaignId: p.campaign_id,
        aspect: p.aspect,
        clips: p.cobs_edit_clips
          .sort(
            (a: { position: number }, b: { position: number }) =>
              a.position - b.position,
          )
          .map(
            (c: {
              id: string;
              media_id: string;
              kind: string;
              label: string;
              recipe: unknown;
            }) => ({
              id: c.id,
              mediaId: c.media_id,
              kind: c.kind,
              label: c.label,
              recipe: c.recipe,
            }),
          ),
      };
      if (validateTimeline(doc))
        throw new HttpError(
          422,
          "Saved project is unsupported or damaged. No records have been changed.",
        );
      return Response.json({
        document: doc,
        revision: p.revision,
        updatedAt: p.updated_at,
      });
    }
    if (
      data.action !== "save" ||
      validateTimeline(data.document) ||
      !Number.isInteger(data.revision) ||
      data.revision < 0
    )
      throw new HttpError(
        400,
        validateTimeline(data.document) || "Invalid save revision.",
      );
    const doc = data.document as TimelineDocument;
    const saved = await client.rpc("cobs_save_edit_project", {
      document: doc,
      expected_revision: data.revision,
    });
    if (saved.error)
      throw new HttpError(
        saved.error.code === "40001" ? 409 : 503,
        saved.error.code === "40001"
          ? "This project changed on another device. Reopen before saving."
          : "Project save was not confirmed. Schema setup or media availability needs attention. Your unsaved timeline remains open.",
      );
    return Response.json({ project: saved.data });
  } catch (e) {
    return errorResponse(e);
  }
}
