# Media Studio technical verification — 15 October 2026

## Result

**PASS after two local renderer corrections:** three independently trimmed videos and three photographs combine into one playable branded H.264/AAC MP4. Chrome played the complete export to its end without a media error. This is a local capture-files → persistent SQLite queue → FFmpeg render → decoded-output → Chrome playback test, not a hosted Supabase upload/download acceptance test.

No production records, permissions, authentication settings, Storage policies, migration history or P2 were changed. No paid APIs, publication, deployment, commit or push were performed. Existing uncommitted development work was preserved on `develop/dashboard-media`.

## Actual six-source export

Artifact: `.tools/delivery/media-studio/synthetic-three-videos-three-photos.mp4`.
Machine-readable evidence: `.tools/delivery/media-studio/six-source-verification.json`.

| Order | Synthetic source | Source trim | Requested duration | Decoded colour-run duration |
|---|---|---|---|---|
| 1 | Red video with out-of-range white sentinels | 0.5–1.5 s | 1 s | 1.04 s |
| 2 | Yellow photograph | — | 1.5 s | 1.52 s |
| 3 | Green video with out-of-range white sentinels | 1–2 s | 1 s | 1 s |
| 4 | Purple photograph | — | 2 s | 2 s |
| 5 | Blue video with out-of-range white sentinels | 1.5–2.5 s | 1 s | 1 s |
| 6 | Cyan photograph | — | 1.5 s | 1.52 s |

Output: **720 × 720**, 25 fps, approximately **8.061 s**. Every decoded frame was classified against the six source colours; all six runs appeared in order, within 0.13 s of their intended duration, with no white pre/post-trim sentinel frames. Frame count is also checked to prevent still-frame truncation from passing through duplicated decode frames. Full FFmpeg decoding with `-xerror` passed. Existing tests additionally rendered 720×1280, 1280×720 and 720×900 outputs.

Timed subtitles were checked before, during and after their 0.25–0.75 s interval in **each** segment. Original logo pixels were compared against the original JPEG resized proportionally to 120×120; mean channel error remained below 8/255. The repository logo SHA-256 matches the supplied Downloads original: `ae058b018e0629ce577dffd4740307677d7254339af041d75035938f0d0b7f14`. Source files and original logo remained byte-identical.

Audio: the first video retained its test tone at full volume; the second tone measured approximately half its RMS amplitude at volume 0.5, with explicit fade-in/out verified. Photographs and the video with no audio were silent. Disabled fade was tested near the opening. No separate background soundtrack was supplied: independent music/voice-over tracks are not implemented.

## Failures found and corrected

1. **Branded video truncation:** `overlay:shortest=1` ended the primary video when the single-frame JPEG logo ended. A container-duration check was insufficient because AAC continued. The overlay now repeats the unchanged still until the primary video ends. The new regression checks all output frames, frame count and complete Chrome playback.
2. **Zero fade was not off:** passing `afade d=0` allowed FFmpeg's default sample-count fade. Fade filters are now omitted when the requested fade is zero; audio timestamps are normalized before explicit clip-relative fades.
3. The timeline summary incorrectly described timed subtitles as pending; its label now reflects the implemented static/timed options.

Changed for this verification: `lib/render-worker.mjs`, `lib/render-worker.d.mts` (probe frame-count typing), `app/components/production-workspace.tsx` (label only), `tests/sequence-output.test.ts`, `tests/e2e/media-output.spec.ts`, and this report. A test worker heartbeat is reset between independent cases so an earlier test lease cannot suppress the next case.

## Operational controls and limits

| Capability | Current status |
|---|---|
| Manual ordering, split, undo/redo, independent trims and image duration | Implemented; local unit/browser regressions pass |
| Fit/cover, crop position, brightness, contrast, saturation | Implemented renderer/preview controls; existing regressions pass |
| Static titles/subtitles, manual timed captions, original logo | Implemented; real-output coverage |
| Original clip volume, mute and audio fades | Implemented; real-output audio checks |
| Combined MP4, photo slideshow, private job download, cancellation | Implemented; queue/output and mocked API tests; hosted job round trip not repeated |
| Transitions | Hard cuts only; no crossfade/animated transition export |
| Separate music/voice-over tracks; speech transcription | Not implemented |
| Multiple visual layers, picture-in-picture, zoom/pan/keyframes, animated callouts | Not implemented |
| Rotation, white balance, opacity, independent scale control | Explicitly pending |
| AI-directed timeline generation / semantic media analysis | Not implemented; Creative Director planning is separate |
| Multi-asset project cloud persistence | SQL proposal remains unapplied; UI must continue showing its unsaved/schema-pending warning |

The editing timeline permits 40 clips / five minutes, but **combined rendering is bounded to 12 clips, six unique sources, 60 seconds and 50 MiB captured originals/output**, with 100 MiB intermediate budget. Longer/larger edit documents are not evidence that they can render. The local worker requires the PC to remain running; no production worker deployment is claimed.

## Validation

- Complete Vitest suite: **118 tests across 18 files passed**.
- Playwright: **8 tests passed**, including actual six-source Chrome playback, existing single/combined MP4 playback, desktop/mobile Media Studio, Creative Director, branding and corrected reauthentication regressions. Supabase/application service tests use mocks; they are not new hosted verification.
- TypeScript: **passed**. Prettier formatting check: **passed**. Next.js 15.5.28 production build: **passed**, all seven pages generated; main route first-load JavaScript approximately 204 kB.
- `npm ls --depth=0`: no missing direct dependencies; two extraneous optional packages (`@emnapi/runtime`, `@img/sharp-wasm32`) were left untouched. Package manifest dependencies/devDependencies/engines match the lockfile root. No package installation or lockfile rewrite was needed for this verification.
- Original logo hash matches the supplied file. Local `main` and `origin/main` both remain `5578dfdbebc4029f028dbdfed4da692146c84e5e`; no remote mutation was performed.

Remaining unverified here: authenticated hosted Storage capture → render API → download, long/high-resolution real footage, phone codec diversity, crash/retry under load, and deployed worker operation. Existing security findings and unapplied schema/security proposals remain documented in their earlier reports. These tests do not establish that P2 or production schema changes are needed.

## Smallest next milestone

Add an **owner-reviewable edit-plan-to-timeline compiler**, reusing this renderer. Start with deterministic/rule-based interpretation of selected real media IDs and verified durations. Validate trims, order, caption intervals and render limits; reject unavailable media and unsupported operations. Present the proposed timeline for editing and explicit export. Do not claim semantic analysis, enable paid generation, auto-save into unapplied tables or publish automatically. A future server-side AI provider can produce the same validated plan contract after separate cost/configuration approval.
