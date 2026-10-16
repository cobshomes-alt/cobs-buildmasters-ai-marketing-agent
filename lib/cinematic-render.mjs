import { join } from "node:path";
import { sequenceDuration } from "./cinematic-model.mjs";
export async function composeCinematic({
  command,
  ffmpeg,
  files,
  sequence,
  dir,
  output,
  maxBytes,
  timeout,
}) {
  const deadline = Date.now() + timeout;
  const remaining = () => {
    const value = deadline - Date.now();
    if (value < 1) throw Error("Cinematic composition time limit exceeded.");
    return value;
  };
  const args = [
    "-v",
    "error",
    "-nostdin",
    "-y",
    "-filter_complex_threads",
    "1",
  ];
  for (const f of files)
    args.push("-threads", "1", "-protocol_whitelist", "file,pipe", "-i", f);
  const tracks = sequence.audioTracks || [];
  for (const t of tracks)
    args.push(
      ...(t.loop ? ["-stream_loop", "-1"] : []),
      "-protocol_whitelist",
      "file,pipe",
      "-format_whitelist",
      "wav,mp3,mov",
      "-i",
      join(dir, `audio-${t.kind}`),
    );
  const g = [];
  files.forEach((_, i) => {
    g.push(`[${i}:v]settb=AVTB,setpts=PTS-STARTPTS,format=yuv420p[v${i}]`);
    g.push(
      `[${i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=PTS-STARTPTS[a${i}]`,
    );
  });
  let v = "v0",
    a = "a0",
    duration = sequence.clips[0].recipe.duration;
  for (let i = 1; i < files.length; i++) {
    const t = sequence.clips[i - 1].transition,
      overlap = t && t.type !== "cut" ? t.duration : 0;
    if (overlap) {
      g.push(
        `[${v}][v${i}]xfade=transition=${t.type}:duration=${overlap}:offset=${(duration - overlap).toFixed(4)}[vx${i}]`,
      );
      g.push(`[${a}][a${i}]acrossfade=d=${overlap}:c1=tri:c2=tri[ax${i}]`);
    } else {
      g.push(`[${v}][v${i}]concat=n=2:v=1:a=0[vx${i}]`);
      g.push(`[${a}][a${i}]concat=n=2:v=0:a=1[ax${i}]`);
    }
    v = `vx${i}`;
    a = `ax${i}`;
    duration += sequence.clips[i].recipe.duration - overlap;
  }
  const total = sequenceDuration(sequence.clips),
    mix = [a];
  for (const [i, t] of tracks.entries()) {
    const available = total - t.offset;
    if (available <= 0) throw Error("Audio starts after the production ends.");
    const audioInfo = JSON.parse(
      await command(
        ffmpeg.replace(/ffmpeg\.exe$/, "ffprobe.exe"),
        [
          "-v",
          "error",
          "-protocol_whitelist",
          "file,pipe",
          "-format_whitelist",
          "wav,mp3",
          "-show_format",
          "-show_streams",
          "-of",
          "json",
          join(dir, `audio-${t.kind}`),
        ],
        Math.min(remaining(), 10000),
      ),
    );
    const measured = Number(audioInfo.format?.duration);
    if (
      !Number.isFinite(measured) ||
      measured <= 0 ||
      measured > 600 ||
      !audioInfo.streams.some((s) => s.codec_type === "audio") ||
      audioInfo.streams.some((s) => s.codec_type === "video")
    )
      throw Error("Invalid captured audio original.");
    const active = t.loop ? available : Math.min(available, measured),
      fade = Math.min(t.fade, active / 2);
    g.push(
      `[${files.length + i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=PTS-STARTPTS,atrim=duration=${active},volume=${t.volume}${fade > 0 ? `,afade=t=in:d=${fade},afade=t=out:st=${active - fade}:d=${fade}` : ""},adelay=${Math.round(t.offset * 1000)}:all=1,apad=whole_dur=${total}[track${i}]`,
    );
    mix.push(`track${i}`);
  }
  if (mix.length > 1) {
    g.push(
      `${mix.map((x) => `[${x}]`).join("")}amix=inputs=${mix.length}:duration=longest:normalize=0,alimiter=limit=0.95:latency=1,atrim=duration=${total}[mixed]`,
    );
    a = "mixed";
  }
  args.push(
    "-filter_complex",
    g.join(";"),
    "-map",
    `[${v}]`,
    "-map",
    `[${a}]`,
    "-t",
    String(total),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "25",
    "-threads",
    "1",
    "-c:a",
    "aac",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    "-fs",
    String(maxBytes + 1),
    output,
  );
  await command(ffmpeg, args, remaining());
}
