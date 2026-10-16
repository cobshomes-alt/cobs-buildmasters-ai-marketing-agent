import { test, expect, vi } from "vitest";
import { resolve, join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { newTimeline, newClip } from "../lib/timeline";
import { directiveFromTimeline } from "../lib/remotion/plan";
import { renderGraphicsEvaluation } from "../lib/remotion/evaluate";
const asset = {
  id: "11111111-1111-4111-8111-111111111111",
  mime_type: "image/png",
  original_name: "Synthetic",
};
test("evaluation requires explicit acknowledgement, bounded duration and isolated paths before processing", async () => {
  const c = newClip(asset);
  c.recipe.duration = 2;
  c.recipe.text = "Synthetic title";
  const doc = { ...newTimeline(), clips: [c] },
    command = vi.fn();
  const options = {
    document: doc,
    directive: directiveFromTimeline(doc),
    baseVideo: "unavailable",
    outputDir: resolve(".tools/remotion-evaluation/gates"),
    command,
    evaluationAcknowledged: false,
  };
  await expect(renderGraphicsEvaluation(options)).rejects.toThrow(
    /non-commercial/,
  );
  await expect(
    renderGraphicsEvaluation({
      ...options,
      evaluationAcknowledged: true,
      outputDir: resolve("public"),
    }),
  ).rejects.toThrow(/isolated/);
  c.recipe.duration = 16;
  await expect(
    renderGraphicsEvaluation({ ...options, evaluationAcknowledged: true }),
  ).rejects.toThrow(/15 seconds/);
  expect(command).not.toHaveBeenCalled();
});
test("mismatched base metadata fails before graphics rendering (mocked probe)", async () => {
  const c = newClip(asset);
  c.recipe.duration = 2;
  c.recipe.text = "Synthetic title";
  const doc = { ...newTimeline(), clips: [c] },
    dir = resolve(".tools/remotion-evaluation", "gates-" + crypto.randomUUID());
  mkdirSync(dir, { recursive: true });
  const base = join(dir, "synthetic-placeholder");
  writeFileSync(base, "mocked probe input only");
  const command = vi.fn(async () =>
    JSON.stringify({
      streams: [
        {
          codec_type: "video",
          codec_name: "h264",
          width: 1,
          height: 1,
          r_frame_rate: "25/1",
        },
        { codec_name: "aac" },
      ],
      format: { duration: 2 },
    }),
  );
  await expect(
    renderGraphicsEvaluation({
      document: doc,
      directive: directiveFromTimeline(doc),
      baseVideo: base,
      outputDir: join(dir, "output"),
      command,
      evaluationAcknowledged: true,
    }),
  ).rejects.toThrow(/dimensions/);
  expect(command).toHaveBeenCalledTimes(1);
});
