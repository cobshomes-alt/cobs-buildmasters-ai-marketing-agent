# Creative Director — UI redesign and validation

15 October 2026 · `develop/dashboard-media` · reviewed redesign and original logo; owner authorised development-branch-only commit/push after final checks.

## Scope and initial audit

The actual repository matched `CREATIVE_DIRECTOR_DEVELOPMENT.md`: version-1 production plans in owner-protected `cobs_posts` Draft rows, campaign/media relationships, bounded sample planning, server-side text generation and the existing approval workflow. The only initial untracked item was local `.vscode/` configuration. No prerequisite discrepancy required a database migration.

This phase extends that implementation. It does not replace the dashboard or storage architecture. At the initial audit, no authentic logo was available and the existing text branding was retained. The owner subsequently supplied the original JPEG, which is now copied byte-for-byte to `public/branding/cobs-buildmasters-logo.jpeg` and displayed in the sidebar, Overview banner and sign-in branding. Source and destination SHA-256 hashes match. The original colours, design, text, proportions and white padding are preserved with no cropping, stretching, conversion or image editing. No replacement logo or fictional project photography was generated.

## Delivered interface

| Section                 | Working behaviour                                                                                                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Creative dashboard      | Landing overview of the selected campaign, objective, audience, platforms/format, duration, actual captured/remaining shots, current stage and real save state/time; quick section links; no marketing performance statistics                                                 |
| Production brief        | Guided category, product/service, campaign, project/location, audience, objective, verified information, available footage/equipment, filming instructions, style, duration and platform controls                                                                             |
| Visual storyboard       | Scene order and compact cards with purpose, shot type, camera position/movement, action, orientation, raw duration, worker/presenter direction, lighting, audio, transition and capture status; expanded customisation; diagrams are explicitly shot guides, not real footage |
| Filming checklist       | Mobile capture view, recorded/not-recorded controls, progress, orientation/duration, saved retake notes and a prominent checklist save control; notes and progress stay in the same plan                                                                                      |
| Script & caption studio | Existing editable hooks, narration, captions, descriptions, hashtags and CTA; copying and text preview; optional presenter talking points and per-scene voice-over/on-screen text notes                                                                                       |
| Ideas & calendar        | Existing ten-theme idea bank and weekly/monthly model; date/topic/platform/format plus optional objective/evidence notes; mobile planning cards; every date remains a suggestion, with no invented per-date draft or publishing state                                         |
| Original media          | Existing private Media Library upload/selection reused, owner preview, file/type/size details and selected-versus-saved attachment status; a newly created review draft inherits the selection                                                                                |
| Production workflow     | Existing stage controls with actual capture/attachment/review evidence; owner review/approval derives from the linked post; **Editing Queue is explicitly a manual handoff**, not an editing engine                                                                           |

The navy, gold, charcoal and white design uses consistent line icons, restrained borders/shadows, readable form focus states, meaningful empty/loading/success/error feedback and reduced-motion support. Navigation and mobile controls have comfortable touch targets. Desktop, tablet and mobile layouts are exercised at 1280, 820 and 390 pixels.

## Construction-specific planning

The brief offers explicit checkboxes for **activities genuinely performed or available to film**. Named scenes are generated only for selected activities, in the recommended category order rather than click order. The owner still verifies that filming is permitted and the activity is genuinely available.

- Factory: entrance; confirmed cement/quarry dust preparation; measurement/mixing; normal machine operation and mould filling; demoulding; stationary finished blocks; actual stacking/curing; inspection where performed; enquiry closing. No invented ratios, curing times, strengths, certifications, stock or results.
- Construction: site preparation, foundation, structural work/columns/beams, blockwork, flooring, roofing, plastering, mechanical/electrical work, finishing and current progress, selected only where verified. No completed-stage claim is inferred.
- Rentals: scaffolding, props, adjustable pillar moulds, mixers, vibrators and other confirmed equipment, with safe stationary views and no dangerous staged operation or unsupported load/performance ratings.
- Property: exterior/front/side views, interiors, safe room transitions, current progress and genuine owner-provided plans/renders. Architectural visualisations are explicitly proposed appearances, not existing built structures.

Without verified selections, the existing conditional generic template remains available; it does not assert that a named process or project exists. Site induction, competent supervisor permission, consent/privacy and exclusion zones remain mandatory guidance. Video duration remains a target; raw take recommendations provide editing material, not a guarantee of final runtime.

## Data compatibility and safeguards

The reserved marker remains `[COBS_PRODUCTION_PLAN_V1]`, and document `version` remains `1`. New brief fields and shot/script/calendar notes are optional and bounded. Existing saved documents without these fields validate and reopen unchanged. Legacy shots obtain display-only guidance defaults until explicitly edited. Shot capacity is extended locally from eight to twelve to cover verified construction stages; the existing **10,000-character body limit remains unchanged**.

No tables, SQL migrations, RLS policies, grants, Auth settings or Storage policies were changed. Campaign/media foreign-key relationships and existing owner-only server authorization remain in place. Planning rows remain separate from social-post lists and approvals. Existing social-post edits still use the unchanged approval-invalidating database guard; the isolated security regressions are part of final validation.

Generation preserves the previous document on validation/provider failure. Regenerating creates a new unsaved plan rather than overwriting the saved original. Switching Creative Director sections preserves local edits. Leaving via dashboard navigation, Refresh, Sign out or browser unload warns about unsaved changes. Generation preference changes require regeneration or restoring the old preferences before saving.

Mutation controls are disabled while busy, with a synchronous operation guard against overlapping clicks. New plan/review inserts use a stable client-generated UUID within the open attempt, so retrying an ambiguously acknowledged insert cannot create another row with a different ID in that attempt. Existing updates retain `updated_at` conflict checks. The prior partial-link recovery remains tested. This is not a cross-device transaction: after a network ambiguity and reload, inspect existing records before retrying; do not assume an insert failed or delete anything automatically.

Sample/manual planning makes no OpenAI call. Configuration checks report presence only and do not call the provider. AI requests remain explicit, owner-authorized and server-side, with the existing timeout/token/concurrency bounds. The prompt now honours the guided brief, verified activities and proposed-visualisation distinction. Optional per-scene/presenter notes are manual editing fields; no automatic speech timing, rendered video, generated footage or advanced photo/video editor is implied.

## Validation results

| Check                                         | Actual final result                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm.cmd test`                                | **PASS — 57 tests across seven files**, including existing isolated security regressions              |
| `npm.cmd run test:e2e`                        | **PASS — four mocked browser tests**, with all eight Creative Director sections exercised             |
| `npm.cmd run typecheck`                       | **PASS**, strict TypeScript, repeated after the production build                                      |
| `npm.cmd run build`                           | **PASS**, existing Next.js application and all three API routes                                       |
| `npm.cmd run format:check`                    | **PASS**                                                                                              |
| `git diff --check`                            | **PASS**, no whitespace errors                                                                        |
| Responsive browser checks                     | **PASS**, no horizontal page overflow at 820 and 390 pixels; desktop 1280-pixel layout also inspected |
| Visual QA                                     | **PASS**, desktop, tablet and mobile screenshot evidence inspected                                    |
| New hosted Supabase / live OpenAI integration | **UNTESTED**, intentionally excluded from this design phase                                           |

All new browser and component persistence tests use mocked services; existing SQL security tests use isolated fixtures. No new hosted test records or media objects were created or deleted. The browser media check decoded a one-pixel synthetic PNG from the mocked signed-object response; it was not a real hosted upload.

Coverage includes all eight sections, guided brief validation, selected-only scenes, storyboard details, weekly/monthly rendering, clipboard API interaction, script preview, retake/checklist round trips, old-plan compatibility, media selection and decoded synthetic PNG preview, explicit Draft handoff, unsaved navigation cancellation, oversized-document preservation and failed-generation preservation. Existing owner access, approval invalidation, private media and API authorization regressions are retained.

During development, an exact text-label browser selector missed a populated textarea whose accessible textbox name was correct. Role/name selection fixed the test; this was not a hosted login or Supabase failure. TypeScript also caught unsupported Testing Library query options, which were removed. All final checks above passed after these corrections.

### Screenshot evidence

Screenshots show mocked workspace/test content and the owner-supplied original logo and are excluded by the existing `.tools/` ignore rule:

- `.tools/screenshots/creative-redesign-desktop.png` — desktop storyboard.
- `.tools/screenshots/creative-redesign-tablet.png` — tablet storyboard.
- `.tools/screenshots/branding-sign-in-mobile.png` ? original logo on the mobile sign-in screen.
- `.tools/screenshots/creative-redesign-mobile.png` — mobile filming checklist.
- `.tools/screenshots/creative-desktop.png` / `creative-mobile.png` — updated calendar layouts from the browser regression.

## Changed files

- `public/branding/cobs-buildmasters-logo.jpeg` ? unchanged original JPEG, 44,578 bytes.
- `app/components/overview.tsx` ? original logo replaces the older decorative Overview emblem.
- `app/components/brand-logo.tsx` ? accessible shared original-logo treatment.
- `app/page.tsx` ? original logo in the sidebar and sign-in section; authentication and approval logic unchanged.
- `tests/e2e/dashboard.spec.ts` ? original image decoding, proportions, mobile bounds and sign-in branding checks.

- `app/components/creative-director.tsx` — section navigation, guided brief, save/copy feedback, optional notes, unsaved-state protection and mutation guards.
- `app/components/creative-production.tsx` — dashboard, reusable icons, storyboard and on-site checklist views.
- `app/globals.css` — responsive premium styling, touch targets, calendar cards and checklist save control.
- `lib/creative-plan.ts` — backward-compatible optional fields, bounded validation and up-to-twelve-shot support.
- `lib/production-guidance.ts` — verified category choices, conditional scene directions and legacy display defaults.
- `app/api/creative-director/route.ts` — guided-brief/verified-evidence instructions for the existing secure provider request.
- `tests/creative-plan.test.ts` — legacy compatibility and selected-only category/visualisation coverage.
- `tests/creative-director.test.tsx` — section/copy/note persistence, size-limit preservation and failed-generation checks.
- `tests/dashboard.test.tsx` — unsaved-navigation warning and cancellation regression.
- `tests/e2e/creative-director.spec.ts` — expanded mocked workflow, media decoding and responsive screenshot evidence.
- This report. Local `.vscode/` settings remain untouched and excluded from the proposed commit.

The fifteen changed/new source and report files were reviewed for provider/GitHub/Supabase key patterns, complete JWTs, private keys and credentialed database URLs: no matches were found. This targeted check is not a guarantee about future edits. Screenshots, browser sessions, test output, environment values and private recovery material remain outside the proposed commit. No dependency packages were added. Local `main` remains `5578dfdbebc4029f028dbdfed4da692146c84e5e`.

## Limitations and unresolved items

Local review: **http://127.0.0.1:3102**, verified HTTP 200 after the final build. Sign in with the existing owner account, select **Creative Studio → Production brief**, choose genuinely verified activities and click **Create sample plan**. Explore Storyboard, Filming checklist and the other sections. Live AI is disabled in this local Node process only; no environment file was modified. Sample preview/editing consumes no API credits. Keep changes unsaved for a read-only design review; saving a plan uses the existing hosted Supabase database.

1. Mocked/isolated results do not prove the new guided fields or API prompt against hosted Supabase/OpenAI. Previously completed foundational live acceptance is preserved and was not repeated unnecessarily.
2. All production notes share the existing 10,000-character limit. Very long multi-scene plans can exceed it; the save fails clearly and preserves the current edits/previous saved record. Trim notes before saving. A separate planning schema would require a separately approved migration.
3. Clipboard support depends on browser permission/context. Failure displays instructions to select and copy manually.
4. Each plan still links to one review post and one original-media attachment. Calendar entries have no individual draft relationship. No false per-date approval/publishing state is shown.
5. P2 remains pending. The fourteen previously recorded advisor warnings, migration-history mismatch, broader media/video lifecycle and valid non-owner JWT verification remain documented in the existing security reports and handoff. None was silently remediated here.
6. A rollback must retain the planning-prefix filter and a reader for the expanded version-1 fields/shot count. Never delete saved plans or deploy a reader that treats them as ordinary social posts as an automatic rollback.

## Next phase proposal — after interface review

1. Review this interface with the owner and confirm editing needs using actual authorised original media.
2. Design a non-destructive editing project: clip order, trims, aspect ratio, text/subtitles, original-versus-proposed labels and audio rights. Preserve originals and the filming plan.
3. Prototype safe preview/export with free tooling, resource limits and owner-only access. Select rendering infrastructure only after feasibility and cost review; do not activate paid generation services automatically.
4. Bind exports to the existing owner-review workflow, invalidate approval on changed content and test attachment/export lifecycle before any publication integration.

The owner reviewed the interface and explicitly approved committing and pushing the completed redesign and original-logo integration only to `develop/dashboard-media`, provided the reviewed interface matches the tested files. Final automated, browser, TypeScript and build checks are repeated for delivery, with a before/after source-and-logo hash comparison. All final checks passed, and the source/logo hashes remained unchanged throughout final testing. Local-only settings, environment values, browser state and test artifacts remain excluded. No main merge, deployment, paid API activation, production database change, P2 execution or advanced editor development is part of this delivery.
