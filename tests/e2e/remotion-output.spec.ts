import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
test("local Remotion hybrid MP4 plays and shared SVG preview matches exported graphics pixels", async ({
  page,
}) => {
  test.setTimeout(90000);
  const dir = resolve(".tools/delivery/media-studio");
  const info = JSON.parse(
    readFileSync(join(dir, "remotion-evaluation-verification.json"), "utf8"),
  );
  const frames = join(dirname(info.output), "frames"),
    file = readdirSync(frames).find((f) => /025\.png$/.test(f))!;
  expect(file).toBeTruthy();
  await page.setViewportSize({ width: 720, height: 1280 });
  await page.setContent(
    `<style>html,body{margin:0;width:100%;height:100%;background:transparent}</style>${readFileSync(join(dir, "remotion-preview-frame.svg"), "utf8")}`,
  );
  await expect(page.locator("svg")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const preview = join(dir, "remotion-browser-preview.png");
  await page.screenshot({ path: preview, omitBackground: true });
  const raws: Buffer[] = [];
  for (const [i, png] of [join(frames, file), preview].entries()) {
    const out = join(dir, `remotion-compare-${i}.rgba`);
    await promisify(execFile)(
      resolve(".tools/ffmpeg/ffmpeg.exe"),
      [
        "-v",
        "error",
        "-y",
        "-i",
        png,
        "-frames:v",
        "1",
        "-pix_fmt",
        "rgba",
        "-f",
        "rawvideo",
        out,
      ],
      { windowsHide: true, timeout: 30000 },
    );
    raws.push(readFileSync(out));
  }
  expect(raws[0].length).toBe(raws[1].length);
  const meanError =
    raws[0].reduce((n, v, i) => n + Math.abs(v - raws[1][i]), 0) /
    raws[0].length;
  expect(meanError).toBeLessThan(1);
  test.info().annotations.push({
    type: "graphics-preview-mean-rgba-error",
    description: String(meanError),
  });
  await page.route("**/remotion-synthetic.mp4", (route) =>
    route.fulfill({
      contentType: "video/mp4",
      body: readFileSync(join(dir, "cobs-remotion-evaluation.mp4")),
    }),
  );
  await page.goto("/");
  await page.setContent(
    '<video src="/remotion-synthetic.mp4" muted controls style="width:360px" aria-label="Synthetic hybrid evaluation output"></video>',
  );
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.videoWidth),
    )
    .toBe(720);
  await page.locator("video").evaluate(async (v: HTMLVideoElement) => {
    v.currentTime = 0.8;
    await new Promise<void>((r) =>
      v.addEventListener("seeked", () => r(), { once: true }),
    );
  });
  await page.screenshot({ path: join(dir, "remotion-title-browser.png") });
  await page.locator("video").evaluate(async (v: HTMLVideoElement) => {
    v.currentTime = 10.1;
    await new Promise<void>((r) =>
      v.addEventListener("seeked", () => r(), { once: true }),
    );
  });
  await page.screenshot({ path: join(dir, "remotion-logo-browser.png") });
  await page.locator("video").evaluate(async (v: HTMLVideoElement) => {
    v.currentTime = 0;
    v.playbackRate = 4;
    await v.play();
  });
  await expect
    .poll(
      () => page.locator("video").evaluate((v: HTMLVideoElement) => v.ended),
      { timeout: 15000 },
    )
    .toBe(true);
  expect(
    await page.locator("video").evaluate((v: HTMLVideoElement) => v.error),
  ).toBeNull();
  writeFileSync(
    join(dir, "remotion-browser-verification.json"),
    JSON.stringify(
      {
        mode: "local synthetic Chrome playback; no hosted integration",
        graphicsPreviewMeanRgbaError: meanError,
        videoWidth: 720,
        videoHeight: 1280,
        ended: true,
      },
      null,
      2,
    ),
  );
});
