# Creative Director and Content Planning Studio

15 October 2026 · `develop/dashboard-media` · local development; branch-only commit and push subsequently approved by the owner.

## Delivery

The existing Creative Studio now contains a branded Creative Director workspace. Existing dashboard navigation, media library, short-post generator, campaign management and owner approval controls are preserved. The previous post generator remains under **Quick post generator · existing tools**.

| Capability              | Implemented behaviour                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production brief        | Promotion topic, campaign, project/location label, evidence/constraints, style, length, platform selection and calendar start date                                                          |
| Filming director        | Angles, camera position/movement, orientation, lighting, raw take durations, sequence, worker/presenter demonstrations, transitions, voice-over and final edit structure                    |
| Site safety             | Induction and supervisor permission, consent/privacy, exclusion zones, stationary filming and no unsafe demonstrations; filming guidance is subject to the real site's competent supervisor |
| Ideas and calendars     | Ten construction marketing themes; seven weekly slots or twelve slots across four weeks; editable idea/evidence text and calendar topic/platform/format                                     |
| Scripts and captions    | Two sample styles with alternate lengths; live AI structured scripts; editable hooks, voice-over, Facebook/Instagram captions, TikTok/YouTube descriptions, hashtags and calls to action    |
| Pre-production          | Persistent shot checklist and the five manual production stages; final Owner Review/Approved Content stages derive from the linked social post's actual approval status                     |
| Original media          | Existing private-library upload flow reused; one asset can be selected and previewed, attached to the plan and inherited by a newly created review draft                                    |
| Draft handoff           | Explicit **Create review draft**, choosing caption, description or voice-over; remains Draft and uses the existing submission/approval workflow; no automatic publishing                    |
| Honest generation modes | Sample template is explicitly labelled, makes no AI request, and becomes manually edited when its content is changed; missing/unverified AI configuration is visible                        |

Sample templates are reusable guidance, not fresh model output or claims that a particular project exists. The sample and AI instructions preserve the company facts already used by the existing generator. Unknown activities, locations and results require genuine footage or owner confirmation; before/after suggestions require dated matching evidence. AI instructions reduce fabrication risk but cannot guarantee factual correctness: the owner must review all generated claims.

## Persistence without a production migration

Production plans are versioned documents in separate owner-protected `cobs_posts` Draft rows, with the existing `campaign_id` relationship. The body starts with reserved marker `[COBS_PRODUCTION_PLAN_V1]`, followed by validated JSON. Project/location is a label within the plan, not a newly created database project entity. Each plan contains its brief, filming guidance, ideas/calendar, scripts, captured-shot indexes, manual stage and optional linked review-post ID.

Planning rows are excluded from Overview social counts/recent posts, Content Calendar, Approvals and Scheduler. Unreadable reserved documents remain visible as plans needing review and are preserved. Existing ordinary posts are unchanged. Updates use `updated_at` comparisons to reject stale saves. Media references use the existing `media_id` foreign key, retaining the existing protection against deletion of attached media.

The existing 10,000-character body limit is enforced before saving. The maximum supported sample brief, four platforms, monthly calendar, completed checklist and review link fit this limit in automated tests. Oversized AI/manual plans fail clearly rather than truncating. This is a deliberately bounded first implementation, not a replacement for a future dedicated planning schema.

Save explicitly before leaving Creative Studio. Changing calendar period, style, length or selected platforms requires generating a new plan before saving; this prevents relabelling old output as a new format. The start date can move the existing calendar when saved. Each plan links to one review post. Once linked, its campaign cannot be reassigned in this interface; existing draft media/content changes belong in Content Calendar. Editing a plan does not silently overwrite its social post. Existing post edits continue to invalidate approval through the unchanged database guard.

Plan save, review-post creation and link save are separate requests. If the final link save fails, the interface identifies the created draft, blocks duplicate creation in the open plan and allows **Save production plan** to repair the link. This recovery is tested. It is not a cross-device transaction: if that warning appears, repair before navigating away or reloading. An ambiguous network failure after a successful insert still requires checking existing records before retrying.

## Secure AI and cost behaviour

`GET /api/creative-director` and `POST /api/creative-director` verify the authenticated user with Supabase and require the existing owner profile. They use the existing `requireOwner` implementation and public client/RLS, not a service-role bypass.

Generation uses the existing server-only OpenAI key and Responses API with strict JSON schema, runtime bounds, requested-platform/calendar validation, a 45-second timeout, `store: false` and a 3,500-output-token cap. Provider credential, quota, malformed/incomplete-output and configuration failures are surfaced without substituting sample content or exposing provider secrets. The per-process concurrent-request guard prevents overlapping requests for an owner; it is not a distributed spending cap or account-wide rate limiter. Input size and explicit user action bound normal use, but configured live generation can consume the existing API account's quota. No live provider calls were made during development.

Required existing configuration: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Optional live text planning: server-only `OPENAI_API_KEY`, with `OPENAI_MODEL` overriding the existing `gpt-4.1-mini` default if compatible with structured outputs. No environment values were changed. No image/video generation service or subscription was activated.

The implementation follows the official [OpenAI structured output format](https://developers.openai.com/api/docs/guides/structured-outputs). Site guidance reflects general [construction induction and site-rule principles](https://www.hse.gov.uk/construction/safetytopics/site-rules-induction.htm); it does not replace site-specific risk assessment or local requirements. Platform notes are suggested production formats, with a reminder to verify current upload limits before export.

## Files

- `app/components/creative-director.tsx`: integrated brief, saved plans, filming/checklist, ideas/calendar, scripts, media and draft handoff.
- `app/api/creative-director/route.ts`: owner-only configuration check and structured text-plan generation.
- `lib/creative-plan.ts`: versioned document types/validation, bounded templates, calendar dates and approval-stage derivation.
- `app/page.tsx`: integration and separation of planning rows from social content.
- `app/globals.css`: navy/gold/charcoal/white workspace, responsive cards, controls and scrollable calendar.
- `tests/creative-plan.test.ts`, `tests/creative-director.test.tsx`, `tests/api.test.ts`, `tests/e2e/creative-director.spec.ts`: new unit, component, API and browser coverage.
- This report. Previously uncommitted `POST_P1_LIVE_ACCEPTANCE.md` and its `SECURITY_VERIFICATION_HANDOFF.md` link are preserved; `.vscode/` remains local and untouched.

## Validation

| Check                                                 | Final result                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `npm.cmd test`                                        | **PASS — 51 tests across seven files**, including the existing isolated database/security regressions  |
| `npm.cmd run test:e2e`                                | **PASS — three mocked browser tests**, using the corrected navigation-based workspace readiness helper |
| `npm.cmd run typecheck`                               | **PASS**, repeated after the final production build                                                    |
| `npm.cmd run build`                                   | **PASS**, including the new dynamic Creative Director API route                                        |
| `npm.cmd run format:check`                            | **PASS**                                                                                               |
| `git diff --check`                                    | **PASS**, no whitespace errors                                                                         |
| Desktop/mobile visual QA                              | **PASS**, screenshots inspected; 390-pixel browser check confirms no page overflow                     |
| Hosted new planning workflow / live OpenAI generation | **UNTESTED**, intentionally not exercised                                                              |

All tests use mocks or the existing isolated database fixtures; no new production test records are created. New coverage includes bounded weekly/monthly serialization, adequate raw footage for longer sample films, distinct script alternatives, malformed documents, approval-stage derivation, owner-only API access, missing/rejected/quota-limited AI, strict structured requests, incomplete/wrong-calendar output, overlapping requests, campaign/checklist persistence after remount/reload, media inheritance, Draft handoff, optimistic save conditions, failure preservation, partial-link repair and mobile overflow.

The original browser selector for the campaign field failed despite the field being visible and correctly named in the accessibility tree. The new test now selects the accessible combobox role/name. Visual QA also found inherited full-width checkbox styling; it was corrected, and calendar cells now remain readable through horizontal scrolling. These local test/layout issues did not involve a production login or database failure.

## Implemented limits and remaining verification

- **Editing Queue is a manual handoff**, not a video editor, renderer, background job or paid generation integration.
- Calendars are planning suggestions; they do not automatically create all posts, schedule delivery or publish. One selected script creates one linked review draft per plan.
- Live AI output, invalid real provider credentials and new Creative Director persistence against hosted Supabase remain **unverified**; automated tests use mocked provider/Supabase responses. Existing foundational live acceptance passed previously and was not repeated unnecessarily.
- Real non-owner JWT testing, broader video/attachment lifecycle and cross-device verification remain as documented in [the security handoff](SECURITY_VERIFICATION_HANDOFF.md) and [post-P1 live acceptance](POST_P1_LIVE_ACCEPTANCE.md).
- Fourteen previously recorded advisor warnings, P2 and other security proposals remain pending. The shared-project recovery limitations and migration-history discrepancy remain unchanged. No `db push`, reset, migration repair, production SQL, permission, Auth, Storage-policy or record change was performed in this phase.
- The current app exposes only one media attachment per plan/review post. A multi-clip editing project and durable render queue require a separately reviewed later phase.

## Recovery and next step

The owner reviewed this report and subsequently authorised committing and pushing these changes only to `develop/dashboard-media`, with regression checks repeated before delivery. Local code can be revised without production migration rollback. If planning rows have subsequently been created, do not deploy an older app that interprets every `cobs_posts` row as social content: retain the reserved-prefix filter and read-only plan access while reverting other UI/API changes. Do not delete planning records as an automatic rollback.

Review of the twelve changed/new source and report files found no matches for provider/GitHub/Supabase secret patterns, complete JWTs, private keys or credentialed database URLs. Test credentials are synthetic. This targeted check is not a guarantee that arbitrary future edits are secret-free. Environment files, browser state, private recovery material and screenshots remain ignored; local VS Code settings are untouched. The working branch is `develop/dashboard-media`; local `main` remains `5578dfdbebc4029f028dbdfed4da692146c84e5e`. Nothing was staged, committed, pushed, merged or deployed during the initial implementation phase. Subsequent delivery is authorised only for the development branch; production database changes and deployment remain excluded.

Commit/push approval has now been received for this phase. The safest next validation is an owner walkthrough in sample/manual mode; hosted persistence of a newly saved plan should use separately authorised synthetic records and separately approved cleanup. A live AI smoke test should occur only after the owner confirms existing key/model access and acceptable API usage. No production change, P2 execution, merge or deployment is implied by this recommendation.
