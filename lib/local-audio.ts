import type { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { copyFileSync, existsSync, statSync } from "node:fs";
import { ROOT, command } from "./render-worker.mjs";
import { resolve } from "node:path";
import { uuid, type AudioTrack } from "./cinematic-model.mjs";
export function audioTable(db: DatabaseSync) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS local_audio(id TEXT PRIMARY KEY,owner TEXT NOT NULL,name TEXT NOT NULL,bytes INTEGER NOT NULL,duration REAL NOT NULL,created INTEGER NOT NULL)",
  );
}
export function audioFile(id: string) {
  if (!uuid.test(id)) throw Error("Invalid audio ID");
  return join(ROOT, "audio", id);
}
export async function inspectAudio(file: string) {
  const info = JSON.parse(
    await command(
      resolve(".tools/ffmpeg/ffprobe.exe"),
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-format_whitelist",
        "wav,mp3",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        file,
      ],
      10000,
    ),
  );
  const duration = Number(info.format?.duration);
  if (
    !info.streams?.some(
      (s: { codec_type: string }) => s.codec_type === "audio",
    ) ||
    info.streams.some(
      (s: { codec_type: string }) => s.codec_type === "video",
    ) ||
    !Number.isFinite(duration) ||
    duration < 0.1 ||
    duration > 600
  )
    throw Error("Use a WAV or MP3 audio-only original, up to ten minutes.");
  return duration;
}
export function resolveAudio(
  db: DatabaseSync,
  owner: string,
  tracks: AudioTrack[] = [],
) {
  if (!tracks.length) return [];
  audioTable(db);
  return tracks.map((t) => {
    const row = db
      .prepare("SELECT * FROM local_audio WHERE id=? AND owner=? AND created>?")
      .get(t.id, owner, Date.now() - 86400000) as
      { id: string; bytes: number; duration: number } | undefined;
    if (
      !row ||
      !existsSync(audioFile(t.id)) ||
      statSync(audioFile(t.id)).size !== row.bytes
    )
      throw Error(
        "An audio original is unavailable or expired. Upload it again.",
      );
    return { ...t, ...row };
  });
}
export function captureAudio(
  rows: ReturnType<typeof resolveAudio>,
  jobId: string,
) {
  if (!uuid.test(jobId)) throw Error("Invalid render job");
  for (const t of rows)
    copyFileSync(audioFile(t.id), join(ROOT, jobId, `audio-${t.kind}`));
}
