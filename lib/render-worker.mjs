// Owner-operated worker only. No provider tokens or signed URLs are stored here.
import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { DIMENSIONS, validateRecipe } from "./studio-model.mjs";
import { validateSequence } from "./sequence-model.mjs";
export const ROOT = resolve(
  process.env.COBS_RENDER_ROOT || ".tools/media-worker",
);
const BIN = resolve(".tools/ffmpeg");
export const MAX_BYTES = 50 * 1024 * 1024;
export function limits() {
  const bounded = (name, min, max) => {
    const n = Number(process.env[name]);
    return Number.isInteger(n) && n >= min && n <= max ? n : max;
  };
  return {
    daily: bounded("COBS_RENDER_DAILY_LIMIT", 1, 20),
    monthlyBytes: bounded("COBS_RENDER_MONTHLY_BYTES", 1024 * 1024, 1024 ** 3),
  };
}
const terminal = ["completed", "failed", "cancelled"];
export function readiness() {
  return (
    !process.env.VERCEL &&
    process.env.COBS_LOCAL_RENDER_ENABLED === "1" &&
    existsSync(join(BIN, "ffmpeg.exe")) &&
    existsSync(join(BIN, "ffprobe.exe"))
  );
}
export function database() {
  mkdirSync(ROOT, { recursive: true });
  const db = new DatabaseSync(join(ROOT, "queue.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, owner TEXT NOT NULL, key TEXT UNIQUE NOT NULL, state TEXT NOT NULL, recipe TEXT NOT NULL, kind TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, lease TEXT, error TEXT, bytes INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS events (job TEXT NOT NULL, at INTEGER NOT NULL, state TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS worker (id INTEGER PRIMARY KEY CHECK(id=1), token TEXT, heartbeat INTEGER);
    INSERT OR IGNORE INTO worker VALUES(1,NULL,0);
    CREATE TABLE IF NOT EXISTS worker_capabilities(id INTEGER PRIMARY KEY CHECK(id=1), token TEXT, version INTEGER NOT NULL);
    INSERT OR IGNORE INTO worker_capabilities VALUES(1,NULL,1);`);
  return db;
}
function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function event(db, id, state) {
  db.prepare("INSERT INTO events VALUES(?,?,?)").run(id, Date.now(), state);
}
export function publicJob(db, row) {
  if (!row) return null;
  return {
    id: row.id,
    state: row.state,
    attempts: row.attempts,
    kind: row.kind,
    created: row.created,
    updated: row.updated,
    error: row.error,
    history: db
      .prepare("SELECT at,state FROM events WHERE job=? ORDER BY at")
      .all(row.id),
  };
}
export function findJob(db, owner, id) {
  return db.prepare("SELECT * FROM jobs WHERE owner=? AND id=?").get(owner, id);
}
export function listJobs(db, owner) {
  return db
    .prepare("SELECT * FROM jobs WHERE owner=? ORDER BY created DESC LIMIT 30")
    .all(owner)
    .map((r) => publicJob(db, r));
}
export function reserve(db, owner, key, recipe, kind, bytes) {
  if (
    ([2, 3].includes(recipe?.version)
      ? validateSequence(recipe) || kind !== "video"
      : validateRecipe(recipe)) ||
    !["image", "video"].includes(kind) ||
    !Number.isInteger(bytes) ||
    bytes < 1 ||
    bytes > MAX_BYTES
  )
    throw new Error("Invalid render input.");
  return transaction(db, () => {
    const existing = db
      .prepare("SELECT * FROM jobs WHERE key=? AND owner=?")
      .get(key, owner);
    if (existing) return { row: existing, duplicate: true };
    const now = Date.now();
    const usage = db
      .prepare(
        "SELECT count(*) count,coalesce(sum(bytes),0) bytes FROM jobs WHERE owner=? AND created>?",
      )
      .get(owner, now - 30 * 86400000);
    const daily = db
      .prepare("SELECT count(*) count FROM jobs WHERE owner=? AND created>?")
      .get(owner, now - 86400000);
    const active = db
      .prepare(
        "SELECT count(*) count,coalesce(sum(owner=?),0) own FROM jobs WHERE state IN ('receiving','pending','processing')",
      )
      .get(owner);
    if (
      daily.count >= limits().daily ||
      usage.bytes + bytes > limits().monthlyBytes ||
      active.count >= 8 ||
      active.own >= 4
    )
      throw new Error(
        "Local render usage limit reached. Try later or review worker usage.",
      );
    const id = randomUUID();
    mkdirSync(join(ROOT, id));
    db.prepare(
      "INSERT INTO jobs(id,owner,key,state,recipe,kind,created,updated,bytes) VALUES(?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      owner,
      key,
      "receiving",
      JSON.stringify(recipe),
      kind,
      now,
      now,
      bytes,
    );
    event(db, id, "receiving");
    return { row: findJob(db, owner, id), duplicate: false };
  });
}
export function setState(db, id, state, error = null, expected = null) {
  const result = db
    .prepare(
      "UPDATE jobs SET state=?,updated=?,error=?,lease=NULL WHERE id=? AND (? IS NULL OR state=?)",
    )
    .run(state, Date.now(), error, id, expected, expected);
  if (result.changes) event(db, id, state);
}
export function inputPath(id) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid job ID.");
  return join(ROOT, id, "input");
}
export function sequenceInputPath(id, index) {
  inputPath(id);
  if (!Number.isInteger(index) || index < 0 || index > 5)
    throw new Error("Invalid source index.");
  return join(ROOT, id, `input-${index}`);
}
export function outputPath(row) {
  return join(ROOT, row.id, row.kind === "image" ? "export.png" : "export.mp4");
}
export function cancel(db, owner, id) {
  const row = findJob(db, owner, id);
  if (row && !terminal.includes(row.state)) setState(db, id, "cancelled");
  return publicJob(db, findJob(db, owner, id));
}
export function renderKey(owner, project, updated, body, path) {
  return createHash("sha256")
    .update(JSON.stringify([owner, project, updated, body, path]))
    .digest("hex");
}
export function command(exe, args, timeout = 90000) {
  return new Promise((ok, bad) => {
    const child = spawn(exe, args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeout);
    child.stdout.on("data", (b) => {
      if (stdout.length < 100000) stdout += b;
    });
    child.stderr.on("data", (b) => {
      if (stderr.length < 10000) stderr += b;
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      bad(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0 && !timedOut
        ? ok(stdout)
        : bad(
            new Error(
              timedOut
                ? "Render time limit exceeded."
                : `Media processing failed (${code}).`,
            ),
          );
    });
  });
}
export async function probe(path) {
  return JSON.parse(
    await command(
      join(BIN, "ffprobe.exe"),
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-format_whitelist",
        "mov,image2,png_pipe,jpeg_pipe,webp_pipe",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        path,
      ],
      10000,
    ),
  );
}
export async function render(id, recipe, kind, token, options = {}) {
  if (validateRecipe(recipe)) throw new Error("Invalid recipe.");
  const maxBytes = Math.min(MAX_BYTES, options.maxBytes ?? MAX_BYTES);
  if (maxBytes < 1) throw new Error("Export disk limit reached.");
  const dir = join(ROOT, id),
    input = options.input || inputPath(id),
    info = await probe(input);
  const video = info.streams.find((s) => s.codec_type === "video");
  const audio = info.streams.some((s) => s.codec_type === "audio");
  const duration = Number(info.format.duration);
  if (
    !video ||
    video.width * video.height > 3840 * 2160 ||
    (kind === "video" &&
      !options.photoVideo &&
      (!Number.isFinite(duration) ||
        duration > 600 ||
        duration < recipe.start + recipe.duration - 0.1))
  )
    throw new Error("Input dimensions or clip range exceed supported limits.");
  const [w, h] = DIMENSIONS[recipe.aspect];
  const filters =
    recipe.fit === "contain"
      ? [
          `scale=${w}:${h}:force_original_aspect_ratio=decrease`,
          `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x102f5b`,
        ]
      : [
          `scale=${w}:${h}:force_original_aspect_ratio=increase`,
          `crop=${w}:${h}:(iw-ow)*${recipe.position}:(ih-oh)*${recipe.position}`,
        ];
  filters.push(
    `setsar=1`,
    `eq=brightness=${recipe.brightness}:contrast=${recipe.contrast}:saturation=${recipe.saturation}`,
  );
  // Apply timed overlays after frame-rate normalization, including low-fps screen recordings.
  if (kind === "video") filters.push("setpts=PTS-STARTPTS", "fps=25");
  // Text is read from a private file, never interpolated into FFmpeg's filter parser.
  for (const [key, y, text, enabled] of [
    ["text", "h*0.12", recipe.text, ""],
    ["subtitle", "h*0.82", recipe.subtitle, ""],
    ...(recipe.captions || []).map((cue, i) => [
      `caption-${i}`,
      "h-th-180",
      cue.text,
      `:enable='gte(t,${cue.start.toFixed(3)})*lt(t,${cue.end.toFixed(3)})'`,
    ]),
  ])
    if (text) {
      const fontSize = key.startsWith("caption-") ? 24 : 28;
      const columns = Math.floor(
        (w - 60) / (key.startsWith("caption-") ? fontSize : 18),
      );
      const lines = [];
      let line = "";
      for (const char of text) {
        line += char;
        if ([...line].length >= columns) {
          lines.push(line);
          line = "";
        }
      }
      if (line) lines.push(line);
      writeFileSync(join(dir, `${key}.txt`), lines.join("\n"), "utf8");
      filters.push(
        `drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':textfile='${key}.txt':expansion=none:fontsize=${fontSize}:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=10:x=(w-tw)/2:y=${y}${enabled}`,
      );
    }
  const args = [
    "-v",
    "error",
    "-nostdin",
    "-y",
    "-threads",
    "1",
    "-protocol_whitelist",
    "file,pipe",
    "-format_whitelist",
    "mov,image2,png_pipe,jpeg_pipe,webp_pipe",
  ];
  if (options.photoVideo) args.push("-loop", "1", "-framerate", "25");
  else if (kind === "video") args.push("-ss", String(recipe.start));
  args.push("-i", input);
  let graph = `[0:v]${filters.join(",")}[base]`;
  if (recipe.watermark) {
    args.push("-i", resolve("public/branding/cobs-buildmasters-logo.jpeg"));
    // The logo is a single still frame. Repeat it until the primary video ends;
    // shortest=1 would silently truncate each branded segment to one frame.
    graph += `;[1:v]scale=120:120[logo];[base][logo]overlay=W-w-20:H-h-20:eof_action=repeat:repeatlast=1[out]`;
  } else graph += ";[base]null[out]";
  if (options.silence && !audio)
    args.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo");
  args.push(
    "-filter_complex_threads",
    "1",
    "-filter_complex",
    graph,
    "-map",
    "[out]",
  );
  if (kind === "video") {
    args.push(
      "-t",
      String(recipe.duration),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-threads",
      "1",
      "-r",
      "25",
    );
    if (audio || options.silence) {
      args.push(
        "-map",
        audio ? "0:a:0" : `${recipe.watermark ? 2 : 1}:a:0`,
        "-af",
        `asetpts=PTS-STARTPTS,volume=${recipe.volume}${recipe.fade > 0 ? `,afade=t=in:d=${recipe.fade},afade=t=out:st=${recipe.duration - recipe.fade}:d=${recipe.fade}` : ""}${options.silence ? `,apad=whole_dur=${recipe.duration},atrim=duration=${recipe.duration},asetpts=PTS-STARTPTS` : ""}`,
        "-c:a",
        "aac",
        "-ar",
        "48000",
        "-ac",
        "2",
      );
    }
    args.push("-movflags", "+faststart");
  } else args.push("-frames:v", "1", "-c:v", "png", "-threads", "1");
  const temp = join(dir, `${token}.${kind === "image" ? "png" : "mp4"}`);
  args.push("-fs", String(maxBytes + 1), temp);
  // Resolve text files relative to job directory without allowing user-supplied paths.
  await new Promise((ok, bad) => {
    const p = spawn(join(BIN, "ffmpeg.exe"), args, {
      cwd: dir,
      shell: false,
      windowsHide: true,
      stdio: "ignore",
    });
    const timer = setTimeout(() => {
      p.kill();
      bad(new Error("Render time limit exceeded."));
    }, options.timeout || 90000);
    p.on("error", (e) => {
      clearTimeout(timer);
      bad(e);
    });
    p.on("close", (c) => {
      clearTimeout(timer);
      c === 0 ? ok() : bad(new Error("FFmpeg could not render this media."));
    });
  });
  const output = await probe(temp),
    v = output.streams.find((s) => s.codec_type === "video");
  if (
    statSync(temp).size > maxBytes ||
    v?.width !== w ||
    v?.height !== h ||
    (kind === "video" &&
      (v.codec_name !== "h264" ||
        Math.abs(Number(output.format.duration) - recipe.duration) > 0.3 ||
        (audio && !output.streams.some((s) => s.codec_name === "aac"))))
  )
    throw new Error("Export validation failed.");
  return temp;
}
export async function renderSequence(
  id,
  sequence,
  token,
  allowed = () => true,
) {
  if (validateSequence(sequence)) throw new Error("Invalid sequence.");
  const dir = join(ROOT, id),
    sources = [...new Set(sequence.clips.map((c) => c.mediaId))],
    files = [];
  const deadline = Date.now() + 180000;
  const timeLeft = () => {
    const left = deadline - Date.now();
    if (left < 1 || !allowed()) throw new Error("Combined export stopped.");
    return Math.min(90000, left);
  };
  let intermediateBytes = 0;
  try {
    for (const [index, c] of sequence.clips.entries()) {
      const file = await render(id, c.recipe, "video", `${token}.${index}`, {
        input: sequenceInputPath(id, sources.indexOf(c.mediaId)),
        photoVideo: c.kind === "image",
        silence: true,
        timeout: timeLeft(),
        maxBytes: 100 * 1024 * 1024 - intermediateBytes,
      });
      files.push(file);
      intermediateBytes += statSync(file).size;
      if (intermediateBytes > 100 * 1024 * 1024)
        throw new Error("Intermediate export limit exceeded.");
    }
    const list = join(dir, `${token}.concat.txt`),
      output = join(dir, `${token}.mp4`);
    writeFileSync(
      list,
      files.map((_, i) => `file '${token}.${i}.mp4'`).join("\n"),
    );
    await command(
      join(BIN, "ffmpeg.exe"),
      [
        "-v",
        "error",
        "-nostdin",
        "-y",
        "-protocol_whitelist",
        "file,pipe",
        "-f",
        "concat",
        "-safe",
        "1",
        "-i",
        list,
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        "-fs",
        String(MAX_BYTES + 1),
        output,
      ],
      timeLeft(),
    );
    const info = await probe(output),
      v = info.streams.find((s) => s.codec_type === "video"),
      [w, h] = DIMENSIONS[sequence.clips[0].recipe.aspect];
    if (
      !allowed() ||
      statSync(output).size > MAX_BYTES ||
      v?.codec_name !== "h264" ||
      v.width !== w ||
      v.height !== h ||
      !info.streams.some((s) => s.codec_name === "aac") ||
      Math.abs(
        Number(info.format.duration) -
          sequence.clips.reduce((s, c) => s + c.recipe.duration, 0),
      ) > 0.5
    )
      throw new Error("Combined export validation failed.");
    return output;
  } finally {
    // Only generated files inside this validated job directory; originals survive.
    inputPath(id);
    for (let i = 0; i < sequence.clips.length; i++)
      rmSync(join(dir, `${token}.${i}.mp4`), { force: true });
    rmSync(join(dir, `${token}.concat.txt`), { force: true });
  }
}
export async function tick(db, workerToken) {
  const row = transaction(db, () => {
    const worker = db.prepare("SELECT * FROM worker WHERE id=1").get();
    if (worker.token !== workerToken && worker.heartbeat > Date.now() - 15000)
      return null;
    db.prepare("UPDATE worker SET token=?,heartbeat=? WHERE id=1").run(
      workerToken,
      Date.now(),
    );
    db.prepare(
      "UPDATE worker_capabilities SET token=?,version=3 WHERE id=1",
    ).run(workerToken);
    // Only a dead worker's jobs can be reclaimed; two attempts maximum.
    for (const old of db
      .prepare("SELECT * FROM jobs WHERE state='processing' AND updated<?")
      .all(Date.now() - 15000))
      setState(
        db,
        old.id,
        old.attempts < 2 ? "pending" : "failed",
        "Worker interrupted.",
      );
    for (const old of db
      .prepare("SELECT * FROM jobs WHERE state='receiving' AND updated<?")
      .all(Date.now() - 120000))
      setState(db, old.id, "failed", "Source transfer interrupted.");
    const next = db
      .prepare(
        "SELECT * FROM jobs WHERE state='pending' AND (attempts=0 OR updated<?) ORDER BY created LIMIT 1",
      )
      .get(Date.now() - 5000);
    if (!next) return null;
    const lease = randomUUID();
    db.prepare(
      "UPDATE jobs SET state='processing',lease=?,attempts=attempts+1,updated=? WHERE id=?",
    ).run(lease, Date.now(), next.id);
    event(db, next.id, "processing");
    return { ...next, lease };
  });
  if (!row) return false;
  const heartbeat = setInterval(() => {
    db.prepare("UPDATE worker SET heartbeat=? WHERE id=1 AND token=?").run(
      Date.now(),
      workerToken,
    );
    db.prepare(
      "UPDATE jobs SET updated=? WHERE id=? AND lease=? AND state='processing'",
    ).run(Date.now(), row.id, row.lease);
  }, 2000);
  try {
    const recipe = JSON.parse(row.recipe);
    const temp = [2, 3].includes(recipe.version)
      ? await renderSequence(row.id, recipe, row.lease, () => {
          const current = findJob(db, row.owner, row.id);
          return current?.state === "processing" && current.lease === row.lease;
        })
      : await render(row.id, recipe, row.kind, row.lease);
    transaction(db, () => {
      const current = findJob(db, row.owner, row.id);
      if (current.state === "processing" && current.lease === row.lease) {
        renameSync(temp, outputPath(row));
        setState(db, row.id, "completed");
      } else rmSync(temp, { force: true });
    });
  } catch {
    rmSync(
      join(
        ROOT,
        row.id,
        `${row.lease}.${row.kind === "image" ? "png" : "mp4"}`,
      ),
      { force: true },
    );
    const current = findJob(db, row.owner, row.id);
    if (current.state === "processing" && current.lease === row.lease)
      setState(
        db,
        row.id,
        current.attempts < 2 ? "pending" : "failed",
        "Render failed: unsupported input, invalid clip range or processing limit. Review recipe and worker setup.",
      );
  } finally {
    clearInterval(heartbeat);
  }
  return true;
}
export function cleanup(db) {
  for (const row of db
    .prepare(
      "SELECT * FROM jobs WHERE state IN ('completed','failed','cancelled') AND updated<?",
    )
    .all(Date.now() - 86400000)) {
    // UUID-constrained paths always remain below ROOT.
    inputPath(row.id);
    rmSync(join(ROOT, row.id), { recursive: true, force: true });
  }
  db.prepare(
    "DELETE FROM events WHERE job IN (SELECT id FROM jobs WHERE created<?)",
  ).run(Date.now() - 31 * 86400000);
  db.prepare(
    "DELETE FROM jobs WHERE state IN ('completed','failed','cancelled') AND created<?",
  ).run(Date.now() - 31 * 86400000);
}
