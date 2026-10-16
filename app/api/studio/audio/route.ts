import {
  requireOwner,
  HttpError,
  errorResponse,
} from "../../../../lib/server-auth";
import { database, ROOT, readiness } from "../../../../lib/render-worker.mjs";
import {
  audioTable,
  audioFile,
  inspectAudio,
} from "../../../../lib/local-audio";
import { mkdir, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const receiving = new Set<string>();
export async function POST(request: Request) {
  let db, file: string | undefined;
  let lockedOwner: string | undefined;
  try {
    const { user } = await requireOwner(request);
    if (!readiness())
      throw new HttpError(503, "Local audio capture is unavailable.");
    if (
      !["audio/wav", "audio/x-wav", "audio/mpeg"].includes(
        request.headers.get("content-type") || "",
      )
    )
      throw new HttpError(400, "Use WAV or MP3.");
    const name = decodeURIComponent(
      request.headers.get("x-audio-name") || "Audio original",
    );
    if (name.length > 180 || /[\x00-\x1f]/.test(name))
      throw new HttpError(400, "Invalid audio filename.");
    if (!request.body) throw new HttpError(400, "Choose an audio file.");
    if (receiving.has(user.id) || receiving.size >= 2)
      throw new HttpError(
        429,
        "Another local audio transfer is running. Wait before retrying.",
      );
    receiving.add(user.id);
    lockedOwner = user.id;
    db = database();
    audioTable(db);
    const usage = db
      .prepare(
        "SELECT count(*) n,coalesce(sum(bytes),0) bytes FROM local_audio WHERE owner=? AND created>?",
      )
      .get(user.id, Date.now() - 86400000) as { n: number; bytes: number };
    if (usage.n >= 10 || usage.bytes >= 50 * 1024 * 1024)
      throw new HttpError(429, "Local audio daily limit reached.");
    const id = randomUUID();
    await mkdir(join(ROOT, "audio"), { recursive: true });
    file = audioFile(id);
    let bytes = 0;
    const abort = new AbortController(),
      timer = setTimeout(() => abort.abort(), 30000);
    try {
      await pipeline(
        Readable.fromWeb(request.body as never),
        new Transform({
          transform(chunk, _encoding, cb) {
            bytes += chunk.length;
            cb(
              bytes > Math.min(10 * 1024 * 1024, 50 * 1024 * 1024 - usage.bytes)
                ? new Error("Audio exceeds local limit.")
                : null,
              chunk,
            );
          },
        }),
        createWriteStream(file, { flags: "wx" }),
        { signal: abort.signal },
      );
    } finally {
      clearTimeout(timer);
    }
    const duration = await inspectAudio(file);
    db.prepare("INSERT INTO local_audio VALUES(?,?,?,?,?,?)").run(
      id,
      user.id,
      name,
      bytes,
      duration,
      Date.now(),
    );
    file = undefined;
    return Response.json(
      { id, name, bytes, duration, expiresAt: Date.now() + 86400000 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(
      e instanceof HttpError
        ? e
        : new HttpError(
            400,
            "Audio capture failed. Use a valid WAV/MP3 under 10 MiB.",
          ),
    );
  } finally {
    try {
      if (file) await rm(file, { force: true });
    } finally {
      if (lockedOwner) receiving.delete(lockedOwner);
      db?.close();
    }
  }
}
