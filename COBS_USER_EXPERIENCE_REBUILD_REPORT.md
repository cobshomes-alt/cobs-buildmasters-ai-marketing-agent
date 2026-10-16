# COBS user experience rebuild � Milestones A and B

Status: Milestones A/B implemented locally; final mobile-brand correction still requires browser verification and a fresh build. Visual owner review is required before Milestone C. No commit, push or deployment has been performed.

## Scope and recovery

Continued the existing Next.js application on `develop/dashboard-media`. The pre-refactor checkpoint is `.tools/checkpoints/ux-2026-10-16T10-37-45-905Z`: 144 source/configuration files copied and SHA-256 verified, with a manifest recording the original HEAD. Ignored credentials, sessions and private database material were excluded. Restore individual reviewed files from its `files` directory after comparing the manifest; do not reset the repository or execute SQL. This checkpoint is local and is not a production database backup.

Earlier uncommitted accelerated-development and cinematic renderer changes remain present. No database migration, P2, paid provider request, publication or production configuration change is part of this milestone.

## Product changes

Milestone A substantially reorganizes the frontend: a new original-logo login with password visibility, duplicate-submit protection, plain-language errors and keyboard support; Home with four creation actions; a mobile navigation menu; and secondary business tools grouped behind a disclosure. Existing internal section identifiers, owner profile checks, Supabase session handlers, campaign/draft persistence and owner approvals remain in use. Home counts and recent work come from loaded records rather than fabricated performance metrics.

Milestone B provides separate automatic-planning and manual-editing entries. The manual editor has a tool rail, media/audio panel, real source preview, contextual inspector and interactive video/photo, title, caption, source-audio, music, narration and overlay tracks. Existing clip selection, ordering, trims, photo durations, supported cinematic effects, subtitles, undo/redo and real sequence export are reused. Hidden mode panes retain edits. Drag reorder uses the same validated timeline operations as buttons.

A validated local JSON project download/reopen workflow supplements existing cloud projects without requiring a production migration. Files contain asset references and editable instructions, not original media or authentication sessions. Opening rejects invalid, oversized or unavailable-source projects. Separate local audio handles expire after 24 hours and must be uploaded again if expired; JSON is not a portable media bundle.

Completed MP4 jobs can be previewed through the existing authenticated download endpoint. Source preview remains a framing/sequence preview: the finished MP4 is authoritative for transitions, mixed audio and exact colour processing. Track bars represent editable timing, not fabricated audio waveforms. Non-looped music/narration bars show the available playback window; the source can end earlier.

## Working boundaries

The automatic planner remains explicitly rule-based. It does not identify attractive construction moments through visual understanding. Templates currently mean implemented title templates and the original-logo ending; the broader gallery and Ask COBS AI conversation belong to Milestone C and have not been built. No automatic publication or owner approval is added.

Editing supports larger projects than rendering: the existing renderer permits 12 clips, six unique originals, 60 seconds and 50 MiB of originals. Advanced cloud timeline persistence still requires separately reviewed schema support; no migration was executed. Existing simpler cloud projects remain supported. The authentic company JPEG is preserved byte-for-byte.

## Evidence and visual review

Before screenshots in `.tools/ux-review/before/` are copies of the previous verified mocked-browser interface; they are not fresh hosted-session captures. After screenshots and any demonstration recording are local synthetic/mocked-browser artifacts. They must not be described as hosted Supabase acceptance tests.

The interactive browser connector reported no available browsers. Chrome automation and screenshot inspection are therefore used for local verification; final hands-on owner design acceptance remains pending.

## Verification results

See the actual results and final verification limitation below. No hosted records were created.

## Review walkthrough

1. Open the local preview and sign in through the normal owner form.
2. On Home, choose Create with AI to enter the existing labelled rule-based planner, or Edit Myself to arrange your own footage.
3. In Edit Myself, use Media to add originals; select a timeline scene and use the contextual tools to change trims, captions, filters or supported effects.
4. Download a project file for local recovery. Review export limits, render, then use Preview finished MP4 or Download MP4.
5. To retain an export and prepare an approved post, upload it through Media Library and use My Posts and Owner Review. Rendering does not approve or publish a post.

Stop for visual review before Milestone C. Remaining security-advisor warnings, pending P2 and migration-history reconciliation retain their existing approval boundaries in the security reports.

## Files and safety review

New implementation files: `app/components/product-shell.tsx`, `app/components/editor-tracks.tsx`, `app/product-experience.css`, `lib/project-file.ts`. New regression coverage: `tests/product-experience.test.tsx`, `tests/project-recovery.test.ts`, `tests/e2e/product-login.spec.ts`.

Existing frontend changes cover `app/page.tsx`, `app/layout.tsx`, shared colour tokens in `app/globals.css`, Home, Media Studio, production workspace, contextual cinematic controls and finished-export preview. Creative Director's unsaved-work guard now compares stable section IDs rather than renamed display labels. Existing dashboard, reauthentication and browser tests use the revised visible navigation while preserving the corrected owner-readiness checks.

A SHA-256 comparison against the checkpoint found **37 protected API, SQL, authentication/renderer/model and logo files unchanged**. The original JPEG SHA-256 remains `ae058b018e0629ce577dffd4740307677d7254339af041d75035938f0d0b7f14`. HEAD and main retain their original hashes; no commit or push occurred. Pattern and filename review of 57 modified/untracked candidates found no credential patterns or private-file candidates; local `.vscode` settings are excluded from that source review and must remain local. Ignored tools, credentials, screenshots, recordings and synthetic renders are not proposed source additions.

## Issues found and corrected during verification

- Switching from manual mode back to automatic mode originally unmounted and reset the planning form. Both panes now retain their state, and the browser test applies two plans across mode switches.
- The new project-file busy lock initially prevented the shared edit helper from restoring the parsed document. Restoration now updates the validated timeline under that lock. The browser changes a duration before reopening and confirms recovery restores the saved value.
- Hidden panes now follow an explicit hidden-state rule, preserving state without exposing invisible controls to layout or keyboard navigation.
- Renamed sidebar labels no longer break unsaved-work guards or owner readiness detection. Login submits are locked while awaiting authentication.
- Obsolete audio-availability wording was removed. Export notices and preview blobs clear when the timeline changes; historical jobs remain explicitly separate exports.
- Older browser assertions expected the former Home hero and background colour. They were updated for the new components/tokens. The finished-preview fixture initially contained text bytes, not video; it now serves the actual local synthetic MP4.

## Actual verification evidence

- Full Vitest run: **159 passed, 29 files**, 239.13 seconds. Includes mocked application/security/API tests, isolated database checks, timeline/project-file recovery and real synthetic FFmpeg output tests.
- Chrome: the broad run passed 11 existing/new scenarios; the editor scenario then passed its focused rerun after correcting its download fixture. This is 12 distinct passing scenarios, not a claim that the earlier full run was entirely green. The final editor rerun passed after the wording/export-notice corrections. The subsequent mobile-brand CSS correction remains unverified in Chrome.
- Accessibility/responsiveness: **54 screen/tab checks** across 1440, 768 and 390 px reported zero detected violations and no page overflow. Login and populated editor receive additional axe checks. Some gradient contrast checks remain marked incomplete by axe and require visual judgement.
- Actual computed styles for Verified activities: background `rgb(27,42,58)`, labels `rgb(237,243,251)` and helper text `rgb(186,203,224)`. Calculated contrast is **13.08:1** for labels and **8.83:1** for helper text at all three widths.
- Real browser playback passed for the Art of Building montage, cinematic sequence, six-source automatic director output, single-source edit and combined photo/video output. The studio UI verifies real decoding of a local MP4 returned by a mocked protected download endpoint; it does not claim a new hosted rendering integration test.
- Output samples remain in `.tools/delivery/media-studio/`, including six-source and Art of Building exports. The renderer and API files were not changed by this UX milestone.

Hosted Supabase login, production record writes/uploads, real external publishing and paid AI were not retested or invoked. Their previous reports remain the authority for earlier live acceptance. Owner hands-on visual acceptance of this new interface is outstanding.

## Final mobile correction and verification blocker

Screenshot inspection detected the legacy mobile brand image flex basis of 96 px overflowing the new 64 px header slot and overlapping the workspace tagline. Removed the three obsolete mobile sidebar-brand rules from globals.css; the product shell now owns its responsive logo sizing. Added a browser geometry assertion that the logo and tagline do not overlap and that the logo remains square. The logo JPEG itself is unchanged.

The subsequent elevated Chrome verification command was not executed: automatic approval review failed because its usage limit was reached. This was a review-service failure, not a determination that the action was unsafe. The check was not bypassed. The last complete production build passed before this final CSS correction (Next.js 15.5.28; seven prerendered pages; 219 kB first-load JavaScript for Home). A fresh browser run, mobile screenshots and build are required before declaring the corrected interface fully verified.

The 159-test full suite, 13 focused UX regressions, 12 distinct Chrome scenarios and production build passed before the final mobile CSS correction. Existing after screenshots and the walkthrough recording show that prior tested version; the mobile screenshot therefore still shows the overlap that prompted the correction. Final source-only TypeScript and formatting results are recorded separately when complete. No local preview of the stale production build was started for review.

### Local evidence files

| Evidence                                   | Path                                                             |
| ------------------------------------------ | ---------------------------------------------------------------- |
| Previous Home                              | `.tools/ux-review/before/dashboard-desktop.png`                  |
| Previous editor                            | `.tools/ux-review/before/premium-video-editor.png`               |
| New login, desktop/mobile                  | `.tools/ux-review/after/login-1440.png`, `login-390.png`         |
| New Home, desktop/mobile                   | `.tools/ux-review/after/home-desktop.png`, `home-mobile.png`     |
| New editor, before final mobile correction | `.tools/ux-review/after/editor-desktop.png`, `editor-mobile.png` |
| Mocked/synthetic walkthrough               | `.tools/ux-review/after/editor-walkthrough.webm`                 |

The final measured twenty-item interaction took 4,143 ms in local Chrome, including automation overhead. This is not a hosted performance or render-throughput benchmark.

Next action: when elevated verification becomes available, run the focused editor/login Chrome checks, refresh mobile screenshots, rerun TypeScript/format/build, then start the updated local preview at 127.0.0.1:3102 for owner visual review. Do not begin Milestone C or commit/push before review.
Final source-only checks after the mobile correction: TypeScript `tsc --noEmit` passed, and the complete configured Prettier check passed. The added browser geometry assertion has not yet run. Protected-file hash verification still reports 37 unchanged files, including the original logo. Branch remains `develop/dashboard-media`; production data/settings and Git history remain untouched.

### Superseding verification update — 16 October 2026

The previous approval-service usage-limit interruption no longer blocks local browser verification. The corrected mobile geometry assertions now passed in the focused premium-editor scenario, with desktop/mobile screenshots refreshed in `.tools/ux-review/after`. The latest studio, login and Remotion playback browser rerun passed all three scenarios. These browser tests use mocked services and synthetic media, not a production owner-session verification. Final TypeScript and configured formatting checks passed again. See `REMOTION_FFMPEG_INTEGRATION_REPORT.md` for the current rendering evidence and final build status. Earlier pending-check statements above are retained as history. Milestone C, production security changes and commits/pushes remain outside this delivery.
