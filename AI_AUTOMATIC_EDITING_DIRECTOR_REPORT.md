# COBS Automatic Editing Director — development report

Date: 15 October 2026. Branch: `develop/dashboard-media`.

## Implementation

The existing Media Studio now includes an owner-reviewed **free rule-based Editing Director**. The existing FFmpeg renderer, queue, private export/download API, original company logo, Creative Director, approvals and Supabase integration are reused.

The owner selects one to six existing originals, priority footage, platforms, target duration, aspect, framing style, captions and branding. Optional company information and preferred narration are retained as review notes; they are not automatically asserted as facts or converted to speech. The instruction-hints button recognizes explicit duration, platform, ratio/orientation, style and captions/logo preferences and populates controls for review. It does not interpret arbitrary English or identify objects, people or activities in footage.

`POST /api/studio/plan` authenticates the owner using the existing permission checks, resolves actual RLS-scoped asset records, checks owner paths and deletion flags, signs short-lived private reads, captures bounded originals locally and probes actual dimensions, encoded orientation, duration and audio presence. Browser-supplied metadata and unknown fields are rejected. Responses contain no signed URLs or credentials. Temporary inspection copies are removed after success or failure.

The plan contains ordered asset IDs, scene purposes, video trim ranges, photo durations, editable brand captions, original-logo placement, hard cuts, original-audio instructions, exact frame-based estimated duration and MP4 preset. Priority selections are placed first in priority-selection order, followed by other originals in selection order. Remaining duration is distributed across all selected sources in whole 25fps frames within each source's capacity. This is deterministic allocation, not semantic shot selection or a promise of creative understanding.

Applying the plan is an explicit owner action that creates a **new unsaved production identity**, preserves the campaign selection, and leaves saved projects/originals untouched. Existing timeline controls provide ordering, trims, photo durations, caption edits, remove/add, preview and export. A replacement-media selector was added. Undo restores the preceding timeline. Following undo across a saved-project/new-project boundary, optimistic revision checking may require reopening the saved production before saving; no automatic overwrite is performed.

To try it: sign in locally, open **Media Studio → Multi-asset production**, enter a brief, optionally apply instruction hints, select originals, then choose **Generate rule-based editing plan**. Review the measured facts and proposal before choosing **Use plan as editable timeline**. Edit and preview the timeline, then explicitly choose **Export combined MP4**. Inspection requires the existing local FFmpeg/ffprobe installation and `COBS_LOCAL_RENDER_ENABLED=1`; export also requires the existing local worker. No new packages or API key are required.

Files introduced: `lib/automatic-editing.ts`, `app/api/studio/plan/route.ts`, `app/components/automatic-editing-director.tsx`, three `tests/automatic-editing*.test.ts` files, and this report. Existing integration points changed: `production-workspace.tsx`, `globals.css`, `sequence-output.test.ts` and the Media Studio/export browser tests. Existing unrelated uncommitted work has not been discarded.

## Genuine AI versus rule-based behavior

**No OpenAI or other AI calls were made or enabled by this feature.** The existing server-side OpenAI integration remains available to Creative Director; this new editing path does not call it, even when a key exists. ChatGPT subscriptions are not treated as API credits.

Initial automatic editing is functional deterministic planning using measured metadata and owner controls. Brand captions use only the company name and a generic contact call to action; filenames are not converted into factual claims about construction results. The owner edits captions to describe verified activities. Professional/educational styles fit originals; energetic style fills/crops the frame. These are framing presets, not separate AI models or visual analysis.

Future semantic scene analysis or AI-authored plans require a separate server-side structured-output integration, media-consent/privacy review, per-request cost estimate and explicit paid-call authorization. No provider/model pricing estimate is claimed because no provider has been selected for that integration. Proposed outputs must pass the same asset, trim, caption and renderer-limit validation before owner review.

## Supported and unsupported instructions

- Supported: select/order/priority originals; explicit video start trims; feasible target duration; 9:16, 16:9, 1:1, 4:5 presets; contain/cover framing; editable timed brand captions; original logo bottom-right; hard cuts; original clip audio. One output preset per reviewed export.
- Unsupported effects explicitly rejected in instructions: zoom/pan, keyframes, crossfades/dissolves, animation, picture-in-picture, rotation, opacity, slow motion, speed ramps, music/soundtrack generation, voice-over generation and transcription. Unknown request fields are rejected. Unrecognized prose remains a brief, not a silently implemented effect.
- Not implemented: visual scene understanding, automated narration, dedicated music tracks, automatic platform-specific copies, AI soundtrack selection, or automatic publication.
- Available metadata: file type, exact captured byte count, probed duration/resolution, encoded orientation and audio presence, existing project/product labels. Images use the private original for preview; generated video thumbnails are honestly marked unavailable. Rotation metadata/phone display orientation needs broader compatibility validation.

## Security, resources and persistence

Owner authentication precedes inspection. No service-role bypass, production permission/policy/Auth changes, migration changes, P2, paid service activation or publication was performed. Existing rendering checks revalidate owner asset access and actual source ranges at export time, including after manual edits.

Planning requests are bounded to 12,000 bytes, six unique assets and 50 MiB combined originals. One inspection runs at a time per server process; capture uses strict origin checks, redirects disabled, per-download timeouts, bounded bytes and an overall capture deadline. Metadata probes use the existing bounded local FFmpeg tooling. A completed plan must fit the renderer's 12 clips / 60 seconds / six originals / 50 MiB export limits. Photos and clips have a one-second minimum and 30-second per-scene maximum.

Inspection copies are in ignored `.tools/director-inspection`, not public assets. A process crash can leave private local temporary copies; automatic crash-recovery cleanup and distributed inspection throttling remain follow-up work. Ordinary success/failure cleanup is tested. Test outputs, browser sessions, local queues and `.env.local` remain ignored/local.

No new schema is required for planning/rendering. The previously proposed multi-asset cloud persistence migration remains **unapplied**; do not describe unsaved timelines as permanently stored. Company/narration notes and the review plan are in-memory and are lost on reload. Only the timeline can use the existing save path when its schema is available; the complete brief is not durably persisted.

Operating cost: no AI/API generation charge in this mode. Local CPU, disk and electricity are used; inspecting/downloading hosted originals consumes existing Supabase bandwidth and must stay within the account's free allowances. The existing local worker needs an awake PC and is not claimed as a deployed production worker.

## Actual output verification and tests

The six-source fixture includes three videos and three photographs. Local tests probe actual files, generate a rule-based plan, edit scene order, photo duration and captions, then render using the existing engine. Decoded colour segments verify intended sources/order; full FFmpeg decoding checks playable H.264/AAC data. The square owner-edited output is `.tools/delivery/media-studio/synthetic-automatic-director.mp4`; the local API-to-API vertical output is `.tools/delivery/media-studio/synthetic-automatic-api-vertical.mp4` (720×1280, approximately 12.54 seconds, 313 encoded video frames). Companion JSON evidence records brief, plan, edits and output metadata.

The API-to-API test uses the actual planning route, actual FFmpeg probing, actual existing sequence capture route and actual queue/renderer, with **mocked owner authentication, asset lookup and private transfers**. No hosted records or media were created. Separate tests reject anonymous/member access, unavailable/foreign/deleted assets, oversized/changed transfers, incorrect origins, malformed requests, unsupported effects and out-of-range edits. Probe failure cleanup and lock release are verified.

Final results:

| Check | Actual result |
|---|---|
| Complete Vitest suite | **134 passed, 21 files**, 170.92 seconds |
| Complete Playwright suite | **8 passed**, 2.9 minutes |
| TypeScript | **Passed** |
| Prettier formatting | **Passed** |
| Next.js 15.5.28 production build | **Passed**, seven generated pages; main first-load JS approximately 206 kB |
| Inspection cleanup | No remaining inspection folders after tests |
| Restored local preview | HTTP 200 at `http://127.0.0.1:3102/`; anonymous planning POST denied with HTTP 401; local worker online and idle |
| Original logo | SHA-256 unchanged: `ae058b018e0629ce577dffd4740307677d7254339af041d75035938f0d0b7f14` |
| Git scope | Development branch retained; local `main`/`origin/main` unchanged at `5578dfdbebc4029f028dbdfed4da692146c84e5e` |

The browser suite covers instruction failure feedback, six selected assets, review/handoff, duration and order edits, export submission, mobile overflow checks, Creative Director, existing dashboard, original branding and corrected reauthentication. Actual square automatic-export playback reaches the end in Chrome without a media error. Browser application services are mocked; real output playback and real FFmpeg metadata/rendering are tested separately and through the local API-to-API test.

An earlier browser run failed a mocked reload readiness check and the new instruction field's label selector. The dashboard passed on a stable rerun. The instruction field test now uses its rendered accessible textbox role with an explicit editable-state assertion; the complete final suite passed. These automation failures are not evidence of a hosted owner-login failure.

Unverified: the new plan endpoint against hosted owner Auth/Storage, new hosted campaign/post/media writes (none attempted), phone codec/rotation diversity, deployed worker operation, crash recovery, and real OpenAI plan generation. Existing P2/security findings and migration-history work remain pending in their previous reports.

## Next milestones

1. Complete hosted read-only inspection and owner-reviewed export acceptance using separately authorized synthetic uploads; preserve production records and existing security settings.
2. With separate migration approval, persist the complete reviewed brief/plan and timeline using the already proposed owner-scoped project schema; add safe crash cleanup and deployment-specific worker throttling.
3. Add richer owner-authored captions/closing cards and separately reviewed structured AI plan generation with explicit cost controls. Reuse the renderer rather than replacing it.

No commit, push, merge, deployment or production migration is included in this delivery.
