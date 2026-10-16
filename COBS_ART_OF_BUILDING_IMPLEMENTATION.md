# COBS — The Art of Building: implementation and verification

Status: implemented and verified locally for owner review on 2026-10-16. No commit, push, production database change, production P2 execution, paid request, publication or deployment is authorized or performed in this phase.

## What changed

The existing Automatic Editing Director and multi-source FFmpeg worker have been extended, not replaced. Select **Media Studio → Automatic Editing Director → Cinematic preset → COBS — The Art of Building**. Select your permitted originals, priority order, source trim starts, duration and ratio; generate the explicitly labelled rule-based proposal and review it before using it as an editable timeline.

The preset applies a fixed warm RGB balance and bounded tone curve to every selected scene. It lowers dark tones and rolls off highlights, uses varied frame-aligned scene durations, gentle linear zoom, 0.24-second crossfades, restrained opening/closing text and the original logo only in the ending when branding is enabled. All selected media are retained. The pacing is deterministic; it does not choose shots by their visual contents or by detected music beats.

The original `public/branding/cobs-buildmasters-logo.jpeg` remains unchanged. SHA-256 matches the supplied Downloads original: `ae058b018e0629ce577dffd4740307677d7254339af041d75035938f0d0b7f14`. The entire square image, including its white background, is proportionally displayed; no cropping, replacement logo or modification to its design is involved. The ending fades the original image into the rendered video over 0.6 seconds.

## Implemented controls and output

| Capability         | Actual behavior                                                                                                                                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multiple originals | Existing upload/library workflow, selection, ordering, replacement, removal and editable source trim starts retained; originals are not overwritten.                                                                                                                                                                      |
| Warm preset        | Fixed SDR FFmpeg `curves` and `colorbalance`, selectable per scene. Existing brightness, contrast and saturation controls remain available. Identical treatment is not automatic exposure/white-balance matching between differently recorded clips.                                                                      |
| Speed              | Video-only 0.5–2×; output scene duration remains explicit. Source consumption is `output duration × speed`; the worker rejects unavailable ranges. Audio uses pitch-preserving `atempo`. Slow motion repeats available frames; it does not synthesize optical-flow frames. Splitting preserves the correct source offset. |
| Motion/keyframes   | Existing two bounded linear zoom/pan keyframes, including still images. No arbitrary multi-keyframe curves or speed ramps.                                                                                                                                                                                                |
| Transitions        | Actual hard cuts, crossfades and dissolves from the existing compositor. Overlaps shorten total duration and the planner accounts for their handles.                                                                                                                                                                      |
| Text/branding      | Editable minimal titles, existing timed captions and title fade-in; original-logo closing fade. No copied footage, watermark, identity or music.                                                                                                                                                                          |
| Audio              | Existing separate licensed WAV/MP3 music and recorded-narration inputs, adjustable levels, offsets, music looping and fades; source-audio level/fade controls retained. No stock music or generated speech is supplied.                                                                                                   |
| Export             | Actual H.264/AAC MP4 at 25 fps; 9:16, 16:9 and 1:1 tested. Existing 4:5 support preserved.                                                                                                                                                                                                                                |
| Owner review       | Applying a plan creates an editable, unsaved timeline; it does not approve a post or publish anything. Existing owner-only server authorization and private source capture remain in place.                                                                                                                               |

New grading/speed/ending snapshots require worker capability **5**. Legacy version 2/3/4 recipes remain supported. Both server and UI reject an older worker for new effects, preventing silently incomplete exports. Unknown colour presets, unsupported effects, invalid speeds and misplaced logo endings are rejected.

The browser shows framing, timing, text, speed and logo fade. Its warm CSS preview approximates the full FFmpeg grade; transition blending and the final audio mix must be reviewed in the exported MP4.

## Verification scope and artifacts

All new tests use synthetic local sources and isolated local SQLite render queues. Supabase/auth transfers in browser/API regression tests are mocked; no new hosted acceptance test or production record was needed. No accessible reference video was found in the supplied attachment directory, so this implementation follows the written style direction and makes no claim to analyze or match an unseen reference.

The six-source fixture contains three synthetic videos and three photographs, with masonry-style grids, distinct palette identifiers, identical neutral/dark/highlight calibration patches and timed source markers. These are test patterns, not footage of an actual company project. Music is a generated test tone; original-video audio has a distinct tone. Test files and exports stay under ignored `.tools/` paths.

Real review exports:

- `.tools/delivery/media-studio/cobs-art-of-building-9x16.mp4` — 720×1280.
- `.tools/delivery/media-studio/cobs-art-of-building-16x9.mp4` — 1280×720.
- `.tools/delivery/media-studio/cobs-art-of-building-1x1.mp4` — 720×720.
- `.tools/delivery/media-studio/art-of-building-contact-sheet.png` — frames sampled from the square MP4.
- `.tools/delivery/media-studio/art-of-building-verification.json` — measured output metadata and sample values.

Each montage is exactly 12 seconds / 300 encoded frames, contains all six selected sources, includes owner-style edits to video speed (0.5× and 1.25×) and source trim starts, and retains the original logo. Full FFmpeg decode verifies every encoded frame/audio stream. Pixel tests verify order, grade consistency, highlight/shadow treatment, source timing, transition blending, text and the proportional logo/fade. Frequency tests verify real source/music mixing. Original source and logo hashes must remain unchanged. Chrome separately plays the portrait export to completion. Measured sizes: portrait 599,111 bytes; landscape 609,227 bytes; square 524,477 bytes. The latest mocked mobile UI screenshot is `.tools/screenshots/art-of-building-mobile.png`.

## Regression caught during validation

The full suite caught low-level non-silent output after tempo processing was unnecessarily applied to generated silence and unchanged-speed legacy audio. The filter now runs only when the original has audio and its requested speed differs from 1. This preserves the legacy/silent pipeline. The two affected legacy export tests passed on rerun. The final complete suite then passed all 154 tests.

An earlier three-ratio test hit its aggregate 240-second timeout on a slow run. Colour processing now occurs before upscaling small originals (and after downscaling large originals), with padding/logo kept outside the grade. The aggregate test budget now accounts for three separately bounded jobs; each export retains its existing 180-second deadline. The final three-ratio fixture passed in 55.37 seconds. This is a local test observation, not a production performance guarantee.

## Final checks

- Complete Vitest suite: **154/154 passed, 27/27 files**, final run 227.41 seconds. Includes isolated PostgreSQL/PGlite security/rollback regressions, mocked API/auth tests, UI regressions and real FFmpeg output. P2 test execution is isolated only; P2 remains unapplied in production.
- Chrome browser coverage: **11 distinct scenarios verified**. The full run passed 10; the remaining expanded studio case passed on its final focused rerun (48.1 seconds). Its test needed to explicitly accept the existing unsaved-timeline confirmation, then a larger aggregate budget for the added proposal workflow. Application safeguards and per-action assertions were retained. Coverage includes actual cinematic MP4 playback, the original mobile logo, new preset selection/export snapshot, mobile overflow, twenty-item editing/save/reopen, owner reauthentication, Creative Director and marketing approval gates. Hosted services are mocked in these browser cases.
- Final TypeScript: **passed** (`tsc --noEmit`).
- Formatting: **passed** (all files covered by `format:check`).
- Production build: **passed**, Next.js 15.5.28, seven static pages generated, all existing API routes retained; 214 kB first-load JavaScript for the main page.
- Original-logo SHA-256 and protected authentication/media/security-file diff checks: **passed**. No changes to those protected files.
- Source credential/artifact scan: final review completed without detected sensitive-source matches; generated media, test sessions and private local files remain ignored and uncommitted.

Operating costs: no new API charges or subscriptions. Synthetic rendering uses local CPU, disk and electricity. Future owner use of hosted original media consumes the existing Supabase project quotas; no new hosted resources were created.

## Local review

The verified production preview is running at **http://127.0.0.1:3102/**. Open **Media Studio → Automatic Editing Director → Cinematic preset → COBS — The Art of Building**. This preview clears the OpenAI key for its process only, so review does not consume generation credits; no environment file was edited. Local HTTP health and the served original JPEG returned 200, and the served-logo hash matched the original. Worker capability 5 is online with no active jobs at handoff.

## Limitations and next step

- No HDR-to-SDR tone mapping, camera-profile/LUT management or automatic per-shot exposure/white-balance matching; test SDR footage and review originals with the available manual colour controls.
- No genuine semantic visual analysis, automatic craftsmanship/close-up detection, automatic music beat synchronization, speed ramps or optical-flow slow motion. Manual shot selection remains necessary.
- No paid API is invoked. This planner is deterministic, not a live OpenAI or visual-analysis result. Any future provider needs a documented cost/privacy review and separate approval.
- Advanced cinematic/audio fields remain blocked from cloud project saving until a compatible schema extension is reviewed and separately approved. Existing simpler saved productions are preserved; review/export new advanced timelines before leaving the workspace.
- Rendering remains an owner-operated local Windows FFmpeg worker. A hosted worker, licensed music source and platform publishing integrations are separate future work; no Vercel deployment or social publication is implied.
- P2 and other unresolved security/migration items remain pending in the existing security reports. No security or migration proposals were executed against hosted Supabase.
- Synthetic tests establish functional output, not aesthetic equivalence to a real construction reference. The safest next step is owner review of these exports, followed by a separately authorized local trial with a small set of original construction footage and licensed music.

## Main implementation files

- `lib/cinematic-model.mjs` / declarations: strictly validated grade, speed and final-scene logo controls.
- `lib/sequence-model.mjs` / declarations and `app/api/studio/route.ts`: version-5 snapshot/capability negotiation with legacy support.
- `lib/render-worker.mjs` / declarations: real grade, source-range-aware speed/audio processing and original-logo fade.
- `lib/automatic-editing.ts`, `lib/timeline.ts`: named preset, pacing/transition handles and source-correct splitting/reordering.
- `app/components/automatic-editing-director.tsx`, `cinematic-controls.tsx`, `production-workspace.tsx`, `sequence-export.tsx`: preset selection, editable effects, preview and honest worker blockers.
- `tests/construction-preset-output.test.ts`, browser output/premium studio tests, sequence API and readiness regressions: actual output and authorization/capability coverage.

## Preservation and recovery

All previously uncommitted accelerated-development work is retained. This change adds no migration, dependency or provider. Server authentication, approval enforcement, private media API and SQL security proposals are not changed. Effects can be removed using **Clear cinematic effects**, and timeline edits remain undoable; original files are unchanged. No production recovery action is needed because production was not modified. Review this milestone before authorizing any commit or push.
