import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("real cinematic MP4 plays through all transitions and reaches its end in Chrome", async ({
  page,
}) => {
  test.setTimeout(180000);
  await promisify(execFile)(
    process.execPath,
    ["node_modules/vitest/vitest.mjs", "run", "tests/cinematic-output.test.ts"],
    { windowsHide: true, timeout: 150000, env: { ...process.env } },
  );
  await page.route("**/cinematic-synthetic.mp4", (route) =>
    route.fulfill({
      contentType: "video/mp4",
      body: readFileSync(
        resolve(
          ".tools/delivery/media-studio/synthetic-cinematic-six-sources.mp4",
        ),
      ),
    }),
  );
  await page.goto("/");
  await page.evaluate(async () => {
    const v = document.createElement("video");
    v.setAttribute("aria-label", "Actual cinematic export");
    v.muted = true;
    v.controls = true;
    v.src = "/cinematic-synthetic.mp4";
    document.body.append(v);
    await v.play();
  });
  const v = page.getByLabel("Actual cinematic export");
  await expect
    .poll(() => v.evaluate((e) => (e as HTMLVideoElement).ended), {
      timeout: 17000,
    })
    .toBe(true);
  expect(await v.evaluate((e) => (e as HTMLVideoElement).error)).toBeNull();
  expect(await v.evaluate((e) => (e as HTMLVideoElement).videoWidth)).toBe(720);
});

test("automatic director six-source edited branded export plays to the end in Chrome", async ({
  page,
}) => {
  test.setTimeout(180000);
  await promisify(execFile)(
    process.execPath,
    [
      "node_modules/vitest/vitest.mjs",
      "run",
      "tests/sequence-output.test.ts",
      "-t",
      "three independently trimmed videos",
    ],
    { windowsHide: true, timeout: 150000, env: { ...process.env } },
  );
  await page.route("**/six-source-export.mp4", (route) =>
    route.fulfill({
      contentType: "video/mp4",
      body: readFileSync(
        resolve(
          ".tools/delivery/media-studio/synthetic-automatic-director.mp4",
        ),
      ),
    }),
  );
  await page.goto("/");
  await page.evaluate(async () => {
    const video = document.createElement("video");
    video.setAttribute("aria-label", "Six-source verified export");
    video.muted = true;
    video.controls = true;
    video.src = "/six-source-export.mp4";
    document.body.append(video);
    await video.play();
  });
  const video = page.getByLabel("Six-source verified export");
  await expect
    .poll(() => video.evaluate((e) => (e as HTMLVideoElement).ended), {
      timeout: 15000,
    })
    .toBe(true);
  expect(
    await video.evaluate((e) => [
      (e as HTMLVideoElement).videoWidth,
      (e as HTMLVideoElement).videoHeight,
    ]),
  ).toEqual([720, 720]);
  expect(await video.evaluate((e) => (e as HTMLVideoElement).error)).toBeNull();
});
test("real studio MP4 plays in Chrome (synthetic local input, no hosted writes)", async ({
  page,
}) => {
  // Use the standalone Node ESM worker, not Playwright's TS module transformer.
  const code = `import {database,reserve,inputPath,outputPath,command,setState,tick,findJob} from './lib/render-worker.mjs';
 import {defaultRecipe} from './lib/studio-model.mjs';import {copyFileSync} from 'node:fs';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';
 const db=database();const {row}=reserve(db,'synthetic-owner',randomUUID(),{...defaultRecipe(),aspect:'16:9',duration:2,text:'Synthetic Chrome playback'},'video',1);
 const fixture=inputPath(row.id)+'.mp4';await command(resolve('.tools/ffmpeg/ffmpeg.exe'),['-v','error','-f','lavfi','-i','color=c=navy:s=320x240:r=25','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',fixture]);
 copyFileSync(fixture,inputPath(row.id));setState(db,row.id,'pending');await tick(db,'browser-worker');const completed=findJob(db,'synthetic-owner',row.id);console.log(JSON.stringify({state:completed.state,path:outputPath(completed)}));db.close();`;
  const result = await promisify(execFile)(
    process.execPath,
    ["--input-type=module", "-e", code],
    {
      windowsHide: true,
      timeout: 30000,
      env: {
        ...process.env,
        COBS_RENDER_ROOT: resolve(".tools/browser-render-" + randomUUID()),
        COBS_LOCAL_RENDER_ENABLED: "1",
      },
    },
  );
  const output = JSON.parse(result.stdout);
  expect(output.state).toBe("completed");
  await page.route("**/synthetic-export.mp4", (route) =>
    route.fulfill({
      status: 200,
      contentType: "video/mp4",
      body: readFileSync(output.path),
    }),
  );
  await page.goto("/");
  await page.evaluate(async () => {
    const video = document.createElement("video");
    video.setAttribute("aria-label", "Actual synthetic studio export");
    video.controls = true;
    video.muted = true;
    video.src = "/synthetic-export.mp4";
    document.body.append(video);
    await video.play();
  });
  const player = page.getByLabel("Actual synthetic studio export");
  await expect
    .poll(() => player.evaluate((e) => (e as HTMLVideoElement).videoWidth))
    .toBe(1280);
  await expect
    .poll(() => player.evaluate((e) => (e as HTMLVideoElement).currentTime))
    .toBeGreaterThan(0.2);
  expect(
    await player.evaluate((e) => (e as HTMLVideoElement).error),
  ).toBeNull();
});

test("actual combined photo/video MP4 plays through its cut in Chrome (local synthetic inputs)", async ({
  page,
}) => {
  const code = `import {database,reserve,sequenceInputPath,outputPath,command,setState,tick,findJob} from './lib/render-worker.mjs';import {defaultRecipe} from './lib/studio-model.mjs';import {randomUUID} from 'node:crypto';import {resolve} from 'node:path';import {copyFileSync} from 'node:fs';
  const db=database(),recipe={...defaultRecipe(),aspect:'16:9',duration:1,watermark:true,text:'Synthetic combined export'},sequence={version:2,clips:[{mediaId:randomUUID(),kind:'image',recipe},{mediaId:randomUUID(),kind:'video',recipe}]};
  const {row}=reserve(db,'synthetic-owner',randomUUID(),sequence,'video',2);
  for(let i=0;i<2;i++){const fixture=sequenceInputPath(row.id,i)+(i?'.mp4':'.png');await command(resolve('.tools/ffmpeg/ffmpeg.exe'),['-v','error','-f','lavfi','-i',i?'color=c=blue:s=160x120:r=25:d=2':'color=c=red:s=160x120',...(i?['-t','2','-c:v','libx264','-pix_fmt','yuv420p']:['-frames:v','1']),fixture]);copyFileSync(fixture,sequenceInputPath(row.id,i));}
  setState(db,row.id,'pending');await tick(db,'combined-browser-worker');const result=findJob(db,'synthetic-owner',row.id);console.log(JSON.stringify({state:result.state,path:outputPath(result)}));db.close();`;
  const result = await promisify(execFile)(
    process.execPath,
    ["--input-type=module", "-e", code],
    {
      windowsHide: true,
      timeout: 30000,
      env: {
        ...process.env,
        COBS_RENDER_ROOT: resolve(".tools/combined-browser-" + randomUUID()),
      },
    },
  );
  const output = JSON.parse(result.stdout);
  expect(output.state).toBe("completed");
  await page.route("**/combined-synthetic.mp4", (route) =>
    route.fulfill({
      contentType: "video/mp4",
      body: readFileSync(output.path),
    }),
  );
  await page.goto("/");
  await page.evaluate(async () => {
    const video = document.createElement("video");
    video.setAttribute("aria-label", "Actual combined export");
    video.muted = true;
    video.src = "/combined-synthetic.mp4";
    document.body.append(video);
    await video.play();
  });
  const player = page.getByLabel("Actual combined export");
  await expect
    .poll(() => player.evaluate((el) => (el as HTMLVideoElement).currentTime))
    .toBeGreaterThan(1.2);
  expect(
    await player.evaluate((el) => (el as HTMLVideoElement).videoWidth),
  ).toBe(1280);
  expect(
    await player.evaluate((el) => (el as HTMLVideoElement).error),
  ).toBeNull();
});
