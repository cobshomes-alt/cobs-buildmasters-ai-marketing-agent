# Media Studio — bounded multi-source export validation

Subsequent milestone: manual timed subtitles and sequence-version-3 compatibility are added and tested in `MEDIA_STUDIO_EXPLAINER_MILESTONE.md`. This report preserves the original version-2 export evidence and bounds. Hosted acceptance and durable saving remain pending.

15 October 2026 · `develop/dashboard-media` · local, uncommitted development.

## Delivered result

The existing manual timeline now has **Export combined MP4**, private job history, cancellation and authenticated download controls. It can render multiple original videos, multiple photographs as a slideshow, or a mixed sequence. Clips follow the owner's timeline order with hard cuts; existing trim, fit/crop position, colour adjustments, static overlays, original-logo watermark and audio volume/fades are reused.

This is real local FFmpeg output, not a browser-only preview or fake download. **It is not yet hosted integration acceptance.** No production records, media uploads, SQL, permissions, Auth settings, Storage policies or migration history were changed or exercised by these tests. P2 remains pending. No AI generation, paid API, publication, commit, push, merge or deployment occurred.

The five business growth modules are architecture/roadmap work only; see `COBS_AI_BUSINESS_GROWTH_ROADMAP.md`. They are not implemented by this export milestone.

## Architecture, cost and data-security review

The review appears before implementation milestones in the roadmap. Implementation extends the existing owner-operated queue/worker and timeline; no second app, hosted project or duplicate business records were introduced.

`POST /api/studio/sequence` authenticates the owner using the existing server-side helper, validates a bounded timeline, strips unknown metadata from the rendering recipe, resolves every unique original through the owner-scoped Supabase client and captures private originals once each. Client-provided paths, URLs, FFmpeg filters, keys and signed URLs are not accepted or persisted.

Storage origin, owner-prefixed UUID paths, allowed MIME types, deletion state, source type, positive integer size and exact streamed bytes are checked. Redirects are disabled. Only a completely captured job can become pending; failures and cancellation cannot be overwritten by a pending transition. Authenticated download/cancellation use the existing Studio endpoints and owner isolation. No service-role bypass was added.

The queue stores a sanitized version-2 snapshot, media IDs, temporary local input bytes and operational job state. It does not save a company multi-asset project. The proposed production project/clip tables remain unapplied, and the interface retains its unsaved-change warning. Captured jobs continue from their immutable local snapshot even if the owner later edits the timeline. Media deletion after capture does not remove the temporary captured copy automatically; existing 24-hour retention applies.

Each segment is normalized to the selected dimensions, 25fps H.264 and 48kHz stereo AAC. Photographs loop for their chosen duration. Video clips are trimmed. Missing audio becomes silence; short audio is padded. Generated segments are concatenated with hard cuts, validated, then atomically promoted only while the job still holds its processing lease. Intermediates are removed in a guarded `finally` block. Existing originals remain untouched.

The worker advertises version-2 support in a separate additive **local operational SQLite table**. Existing job tables/records are retained. Both server submission and browser controls require a fresh matching worker token/capability heartbeat, preventing an old worker from accepting an unsupported sequence. This is not a production Supabase schema change.

No rendering API fee or OpenAI credits are used. Local processing consumes CPU/disk/electricity. A requested hosted export would consume existing Supabase egress; no live egress quota/headroom was verified. Failed reservations/transfers conservatively consume existing usage caps. Do not promise Free-plan availability for real workloads without a usage review.

## Explicit limits

| Resource | Enforced bound |
|---|---|
| Timeline export | 1–12 clips, at most 6 unique originals |
| Total output duration | 60 seconds; each clip retains the existing 1–30-second range |
| Editable project | Existing 40 clips / five minutes retained; larger sequences are explicitly disabled/rejected for export |
| Combined captured originals | 50 MiB; repeated originals captured once per job |
| Final MP4 | 50 MiB |
| Intermediate segments | 100 MiB aggregate budget, with remaining budget applied per segment |
| Input | Existing formats, maximum 4K dimensions and 10-minute video input |
| Source capture | 30-second individual fetch timeout within a 90-second capture window; Storage-signing SDK calls also depend on network availability |
| Processing | 180-second sequence deadline across render/concat steps; probes are separately bounded at 10 seconds |
| Queue | Existing one active worker, four active jobs/owner, eight globally, two render attempts and backoff |
| Usage | Existing maximum 20 reservations/day and 1 GiB reserved source bytes/rolling 30 days |
| Retention | Temporary inputs/exports 24 hours after terminal state; operational usage/history 31 days |

There is no promise of per-pixel browser/export equivalence or exact sub-frame timing. Codec/frame rounding and AAC boundaries permit small timing differences; combined duration validation allows at most 0.5 seconds discrepancy. Hard cuts, not crossfades or transitions, are implemented. No music import, automatic transcription, AI editing, cloud rendering, background service installation or automatic export registration/publishing is included.

## Actual test evidence

| Check | Result and evidence type |
|---|---|
| Complete automated suite | **108 tests passed, 17 files**, final run; mocked APIs, isolated database fixtures and real local rendering |
| New sequence tests | **23 passed**: 18 API cases and 5 output/model cases |
| Additional full-decode assertion | **5 output tests passed again** after adding full FFmpeg decode with errors treated as failures |
| Mixed sequence | **PASS, real local output**: two photos, two videos (one with audio, one without), repeated source, five-second MP4; sampled red/green/blue/purple/red frames confirm order |
| Video trim | **PASS, real local output**: yellow pre-trim frames excluded; intended green frames retained |
| Audio and silence | **PASS, measured PCM**: photo and silent-video intervals remain silent; source tone remains audible after volume adjustment |
| Source preservation | **PASS**: SHA-256 of every captured original unchanged after rendering |
| Photo-only / separate process | **PASS**: two-photo job rendered after another OS process reopened the persistent queue |
| Four output ratios | **PASS, real files**: 9:16, 16:9, 1:1 and 4:5 dimensions; watermark path enabled |
| Missing source / cancellation | **PASS**: failure/retry state stays non-completed, cancelled job produces no output |
| Authentication | **PASS, mocked boundary**: anonymous and member requests denied before media lookup/reservation; existing real server-auth regressions also retained |
| Capture protection | **PASS, mocked transfer**: foreign paths, missing/deleted media, MIME mismatch, over-limit/zero size, wrong origin, short/long/failed responses, duplicate requests and cancellation races |
| Unknown metadata | **PASS**: unexpected recipe fields are excluded from queued snapshot |
| Old worker | **PASS**: rejected before metadata access or reservation |
| Request budget | **PASS**: oversized streaming/declared bodies rejected; early rejection does not leave a reader lock |
| Browser regressions | **7 passed**, final run; existing mocked dashboard/planning/security readiness plus Media Studio flows and real synthetic MP4 playback |
| Combined export UI | **PASS, mocked services**: ordered snapshot submitted, private download triggered, large timeline export disabled, existing save/reopen/undo/redo/import/mobile layout retained |
| Actual Chrome playback | **PASS, real local media**: combined photo/video MP4 advances through its cut; 1280px wide and no media error |
| TypeScript / formatting | **PASS** |
| Production compilation | **PASS**, standalone Next.js 15.5.28 build; main route first-load JavaScript 202 kB and dynamic `/api/studio/sequence` |
| Original logo | **PASS**: exact JPEG SHA-256 remains `ae058b018e0629ce577dffd4740307677d7254339af041d75035938f0d0b7f14` |
| Local runtime check | **PASS**: preview HTTP 200; anonymous combined-export POST HTTP 401; updated version-2 worker online and no active local jobs |
| Hosted private Storage → worker → owner download | **UNTESTED**; no company media or hosted synthetic records were used |

The existing UI sweep also runs across the ten main sections and all eight Creative Director tabs at desktop/tablet/mobile sizes. This preserves earlier corrected authentication readiness checks; no retired success banner is used to infer sign-in. Axe's gradient-related incomplete checks remain documented in the UI audit.

An initial local fixture used `.2` as an FFmpeg duration; FFmpeg rejected it. The test now uses `0.2`. Type checking also caught an intentionally unexpected metadata property in a test literal; the fixture now passes it as an extended object so sanitization remains tested. Those were corrected and the affected tests rerun. Node SQLite's experimental warning remains a runtime notice, not a failed test.

## Files and review artifacts

- `lib/sequence-model.mjs` / `.d.mts`: sanitized snapshot and export limits.
- `lib/render-worker.mjs` / `.d.mts`: combined rendering, silent audio, intermediate budget, capabilities and existing queue integration.
- `app/api/studio/sequence/route.ts`: new owner-only bounded capture endpoint.
- `app/api/studio/route.ts`: worker capability status; existing download and cancellation security retained.
- `app/components/sequence-export.tsx`: timeline export controls and private jobs.
- `app/components/production-workspace.tsx`: existing timeline integration and transfer navigation protection.
- `app/components/system-status.tsx`, `app/globals.css`: updated feature status and responsive export-panel layout.
- `tests/sequence-api.test.ts`, `tests/sequence-output.test.ts`, existing browser/status tests: new coverage above.
- `COBS_AI_BUSINESS_GROWTH_ROADMAP.md` and this report: proposed modules and implementation evidence.

Synthetic review file: `.tools/delivery/media-studio/synthetic-combined.mp4` (ignored/local only). Logs: `.tools/growth-final-unit-tests.log`, `.tools/growth-browser-tests.log`, `.tools/growth-build.log`. Existing synthetic screenshot artifacts remain under `.tools/screenshots`. No credentials or browser sessions are proposed for delivery.

## Recovery and remaining acceptance

No production rollback SQL is necessary: no production changes ran. Existing P1/P2 recovery limits and migration discrepancy remain in the security reports. Do not apply/register any schema proposal automatically.

Local queue/file retention is not a backup of company originals or project metadata. Keep the PC awake and the updated worker running during exports. Before rolling worker code back, stop processing and preserve its queue/files; an older worker cannot render version-2 jobs. Drain or explicitly recover those jobs with the new worker rather than delete/reset the queue. Older single-source jobs remain supported. Corrupt disk/SQLite recovery and host failure are not certified by these tests.

Failed capture jobs remain failed under their idempotency key; the same snapshot is not silently downloaded again. A materially edited snapshot or new production can start another explicitly requested export and consumes quota. Render-stage transient failures retain the existing bounded retry path. A dedicated user-driven capture retry workflow is a future usability improvement.

Next safe review: inspect the synthetic MP4 and local Media Studio interface; then separately authorize a small hosted synthetic capture/export/download acceptance test. It must identify any new records/objects and obtain separate cleanup approval. Durable multi-asset schema approval remains a distinct prerequisite for hosted saving; export implementation does not grant that approval.

Local preview: `http://127.0.0.1:3102/` → **Media Studio** → arrange originals in the existing timeline → **Export your sequence**. The preview process has its OpenAI key explicitly empty; no environment file was changed. Do not submit company-media export requests as part of this automated review. The supplied synthetic MP4 is available for direct inspection without creating hosted records.

After that acceptance and owner review, begin Construction Progress Storytelling's schema/evidence architecture review before implementation. Do not skip ahead to the other four modules or advertising integrations.
