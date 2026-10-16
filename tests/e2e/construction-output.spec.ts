import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
test("Art of Building portrait MP4 plays to completion in Chrome (real synthetic local export)", async ({
  page,
}) => {
  test.setTimeout(720000);
  await promisify(execFile)(
    process.execPath,
    [
      "node_modules/vitest/vitest.mjs",
      "run",
      "tests/construction-preset-output.test.ts",
      "--reporter=default",
      "--reporter=json",
      "--outputFile=.tools/construction-focused-vitest.json",
    ],
    { windowsHide: true, timeout: 690000, env: { ...process.env } },
  );
  await page.route("**/construction-synthetic.mp4", (r) =>
    r.fulfill({
      contentType: "video/mp4",
      body: readFileSync(
        ".tools/delivery/media-studio/cobs-art-of-building-9x16.mp4",
      ),
    }),
  );
  await page.goto("/");
  await page.evaluate(async () => {
    const v = document.createElement("video");
    v.setAttribute("aria-label", "Actual Art of Building export");
    v.muted = true;
    v.controls = true;
    v.src = "/construction-synthetic.mp4";
    document.body.append(v);
    await v.play();
  });
  const v = page.getByLabel("Actual Art of Building export");
  await expect
    .poll(() => v.evaluate((e) => (e as HTMLVideoElement).ended), {
      timeout: 18000,
    })
    .toBe(true);
  expect(await v.evaluate((e) => (e as HTMLVideoElement).error)).toBeNull();
  expect(
    await v.evaluate((e) => [
      (e as HTMLVideoElement).videoWidth,
      (e as HTMLVideoElement).videoHeight,
    ]),
  ).toEqual([720, 1280]);
});
