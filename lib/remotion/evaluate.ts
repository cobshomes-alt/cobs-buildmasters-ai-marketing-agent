// Local evaluation adapter only. Deliberately not imported by any production API/worker.
import { bundle } from "@remotion/bundler";
import {
  renderFrames,
  selectComposition,
  makeCancelSignal,
} from "@remotion/renderer";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  realpathSync,
} from "node:fs";
import { resolve, join, relative, isAbsolute } from "node:path";
import { performance } from "node:perf_hooks";
import { compileGraphicsPlan, type GraphicsDirective } from "./plan";
import type { TimelineDocument } from "../timeline";

type Command = (
  file: string,
  args: string[],
  timeout?: number,
) => Promise<unknown>;
export async function renderGraphicsEvaluation({
  document,
  directive,
  baseVideo,
  outputDir,
  command,
  evaluationAcknowledged,
}: {
  document: TimelineDocument;
  directive: GraphicsDirective;
  baseVideo: string;
  outputDir: string;
  command: Command;
  evaluationAcknowledged: boolean;
}) {
  if (evaluationAcknowledged !== true)
    throw Error("This adapter is for non-commercial local evaluation only.");
  const plan = compileGraphicsPlan(document, directive);
  if (plan.frames > 375)
    throw Error("Local evaluation is limited to 15 seconds at 25 fps.");
  const root = resolve(".tools/remotion-evaluation");
  const within = (p: string) => {
    const r = relative(root, p);
    return r !== "" && !r.startsWith("..") && !isAbsolute(r);
  };
  if (!within(resolve(outputDir)) || !within(realpathSync(baseVideo)))
    throw Error("Use isolated local evaluation paths.");
  mkdirSync(outputDir, { recursive: true });
  if (!within(realpathSync(outputDir)))
    throw Error("Evaluation output escapes its workspace.");
  const ffmpeg = resolve(".tools/ffmpeg/ffmpeg.exe"),
    browserExecutable = "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const verifyVideo = async (path: string) => {
    const info = JSON.parse(
      String(
        await command(resolve(".tools/ffmpeg/ffprobe.exe"), [
          "-v",
          "error",
          "-show_streams",
          "-show_format",
          "-of",
          "json",
          path,
        ]),
      ),
    );
    const v = info.streams.find(
      (s: { codec_type: string }) => s.codec_type === "video",
    );
    if (
      v?.codec_name !== "h264" ||
      v.width !== plan.width ||
      v.height !== plan.height ||
      v.r_frame_rate !== "25/1" ||
      !info.streams.some(
        (s: { codec_name: string }) => s.codec_name === "aac",
      ) ||
      Math.abs(Number(info.format.duration) - plan.frames / 25) > 0.1 ||
      statSync(path).size > 50 * 1024 * 1024
    )
      throw Error(
        "Hybrid video dimensions, duration, codecs or size do not match the plan.",
      );
  };
  await verifyVideo(baseVideo);
  const logoSource =
    "data:image/jpeg;base64," +
    readFileSync(
      resolve("public/branding/cobs-buildmasters-logo.jpeg"),
    ).toString("base64");
  const start = performance.now(),
    cpu = process.cpuUsage();
  let peakNodeRss = process.memoryUsage().rss;
  const sample = setInterval(() => {
    peakNodeRss = Math.max(peakNodeRss, process.memoryUsage().rss);
  }, 100);
  try {
    const bundleStart = performance.now();
    const serveUrl = await bundle({
      entryPoint: resolve("lib/remotion/entry.tsx"),
      outDir: join(outputDir, "bundle"),
      publicDir: null,
    });
    const bundleMs = performance.now() - bundleStart;
    const inputProps = { plan, logoSource };
    const composition = await selectComposition({
      serveUrl,
      id: "CobsGraphics",
      inputProps,
      browserExecutable,
      logLevel: "error",
    });
    const framesDir = join(outputDir, "frames");
    const renderStart = performance.now();
    const { cancelSignal, cancel } = makeCancelSignal();
    const frameDeadline = setTimeout(cancel, 120000);
    try {
      await renderFrames({
        serveUrl,
        composition,
        inputProps,
        outputDir: framesDir,
        imageFormat: "png",
        concurrency: 1,
        onStart: ({ frameCount }) => {
          if (frameCount !== plan.frames)
            throw Error("Unexpected graphics frame count.");
        },
        onFrameUpdate: () => {},
        browserExecutable,
        logLevel: "error",
        timeoutInMilliseconds: 30000,
        cancelSignal,
      });
    } finally {
      clearTimeout(frameDeadline);
    }
    const graphicsMs = performance.now() - renderStart;
    const images = readdirSync(framesDir)
      .filter((f) => f.endsWith(".png"))
      .sort();
    const name = images[0]?.match(/^(.*?)(\d+)\.png$/);
    if (images.length !== plan.frames || !name || Number(name[2]) !== 0)
      throw Error("Unexpected Remotion frame output.");
    const pattern = join(framesDir, `${name[1]}%0${name[2].length}d.png`);
    const output = join(outputDir, "cobs-remotion-ffmpeg-evaluation.mp4"),
      encodeStart = performance.now();
    await command(
      ffmpeg,
      [
        "-v",
        "error",
        "-nostdin",
        "-y",
        "-threads",
        "1",
        "-protocol_whitelist",
        "file,pipe",
        "-i",
        baseVideo,
        "-framerate",
        "25",
        "-protocol_whitelist",
        "file,pipe",
        "-i",
        pattern,
        "-filter_complex_threads",
        "1",
        "-filter_complex",
        "[0:v][1:v]overlay=0:0:shortest=1:format=auto,format=yuv420p[v]",
        "-map",
        "[v]",
        "-map",
        "0:a:0",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-threads",
        "1",
        "-c:a",
        "copy",
        "-t",
        String(plan.frames / 25),
        "-movflags",
        "+faststart",
        output,
      ],
      120000,
    );
    const encodeMs = performance.now() - encodeStart;
    await verifyVideo(output);
    const parentCpu = process.cpuUsage(cpu);
    return {
      output,
      plan,
      metrics: {
        bundleMs,
        graphicsMs,
        encodeMs,
        wallMs: performance.now() - start,
        frames: images.length,
        pngBytes: images.reduce(
          (n, f) => n + statSync(join(framesDir, f)).size,
          0,
        ),
        outputBytes: statSync(output).size,
        peakNodeRss,
        parentCpuMilliseconds: (parentCpu.user + parentCpu.system) / 1000,
        concurrency: 1,
        limitations:
          "Node RSS/CPU excludes Chromium and FFmpeg children; not aggregate worker peak.",
      },
    };
  } finally {
    clearInterval(sample);
  }
}
