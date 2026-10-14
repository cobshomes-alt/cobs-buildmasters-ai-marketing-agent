# Dashboard and media development report

Date: 14 October 2026. Branch: `develop/dashboard-media`.

## Scope and initial findings

Work used the verified repository at `C:\Users\Cobs_Homes\Documents\cobs-buildmasters-ai-marketing-agent`. The existing Next.js application, pages, Supabase tables, signup/sign-in, campaign form, lead form, starter captions and manual publishing workflow were extended. The application was not rebuilt from scratch.

The initial branch was correct and the working tree clean. Git was available through `C:\Program Files\Git\cmd\git.exe`, but not the terminal PATH. No ownership warning occurred or security setting was changed.

Initial implementation findings:

- Drafts, campaigns and leads already used Supabase records; they did not need migration from localStorage.
- Authentication and RLS existed in code, but hosted configuration could not be verified locally.
- Media table/bucket definitions existed, but there was no upload or library interface.
- AI generation was callable without authentication.
- There was no draft editing, attachment selection, approval audit record or database approval invalidation on edits.
- The sidebar and fixed layout were unsuitable for narrow screens.
- Documentation claimed team roles, version history, analytics and Meta publishing that were absent from the implementation.
- Node/npm and dependencies were absent. A checksum-verified, free portable Node 22.23.3 runtime was prepared in ignored `.tools`; npm dependencies and a lockfile were installed.

The original committed application was reproduced from this repository's HEAD in an ignored local baseline folder for a production build. It failed at `.next/types/app/api/generate/route.ts:12`: `extractGeneratedText` was an unsupported route-module export. Helpers were moved to `lib/generated-post.ts`, fixing this error.

## Implemented changes

### Dashboard and content

- Branded overview with navy/gold hero, draft/approval/readiness totals, recent content and workflow shortcuts.
- Responsive sidebar/navigation, mobile layouts, visible focus states, labelled inputs and live status messages.
- Existing workspace sections retained; media library added.
- Existing database-backed persistence retained and exercised with mocked UI save/remount tests and PostgreSQL tests.
- Draft editing, campaign assignment, one original media attachment per post and inline attachment previews in content and approval views.
- Optimistic concurrency filters on edit and status updates prevent stale clients from silently changing newer records.
- Failed database saves no longer produce a false AI/sample-caption success message.
- Late workspace responses are discarded after session changes; signed media preview links can be renewed with Refresh.

### Secure media

- Authenticated owner upload preparation and completion endpoints.
- Originals upload directly to private Supabase Storage, avoiding application-server video upload body limits.
- Server validation of name, supported MIME, size, owner storage path, actual stored size/content type and file signature before a library record is created.
- JPEG, PNG, WebP, MP4 and modern MOV originals, up to 50 MiB each.
- Image/video previews, original links, project/product labels, campaign assignment and search.
- Removal of unused media, deletion reservation and database rejection of new attachments to reserved assets.
- Attached media cannot be removed through the application or overwritten through Storage update policies. Replacement uses a new original and a changed attachment, requiring fresh approval.
- Upload cleanup is attempted on failure; uncertain cleanup and storage/metadata reconciliation failures are reported.

### Approval and AI

- Database guard permits owner review transitions and records `approved_by`/`approved_at`.
- New posts always start as Draft, even if a caller supplies Approved.
- Title, copy, source, campaign or media changes reset status, approval and publishing readiness in the database.
- Rejection and resubmission are supported. Scheduling/readiness cannot bypass approval.
- Historical Approved/Scheduled records lacking approval audit data return to Draft when the migration is applied.
- AI API verifies the bearer token with Supabase Auth and checks the owner profile before contacting OpenAI.
- Server-only API key, timeout, bounded output, response parsing and explicit missing/rejected/quota/provider failure messages. Provider internals are not returned verbatim.
- No automatic publisher or Meta request exists. The existing Scheduled state means ready for manual publishing.

The existing Responses API integration was checked against [official OpenAI text-generation documentation](https://developers.openai.com/api/docs/guides/text). No live OpenAI call was made.

## Files changed

| Files | Purpose |
| --- | --- |
| `app/page.tsx` | Extend existing dashboard, editing, attachments, campaigns, status updates and session handling |
| `app/layout.tsx`, `app/globals.css` | Global brand styling and responsive layout |
| `app/components/overview.tsx` | Overview, totals, recent content and shortcuts |
| `app/components/media-library.tsx` | Upload, preview, labels, search and removal |
| `app/components/post-attachment.tsx` | Content/approval attachment preview |
| `app/api/media/route.ts` | Authenticated prepare/complete/discard operations |
| `app/api/generate/route.ts` | Secure the existing AI endpoint and fix route exports |
| `lib/server-auth.ts` | Verified owner access and safe API errors |
| `lib/media.ts` | Shared media limits and signature validation |
| `lib/generated-post.ts` | Extract and validate actual generated text |
| `supabase/migrations/202610140003_dashboard_media.sql` | Media organisation/attachments, approval audit/guards and Storage policies |
| `tests/api.test.ts` | Auth, AI failures, upload metadata and signatures |
| `tests/database.test.ts` | Execute migrations, RLS, approval transitions and media guards in PGlite |
| `tests/dashboard.test.tsx` | Owner access, database save/remount, campaigns, media and save failures |
| `tests/e2e/dashboard.spec.ts` | Chrome save/reload, desktop/mobile layouts and runtime error checks |
| `vitest.config.mts`, `playwright.config.ts`, `tsconfig.json` | Test configuration and strict TypeScript |
| `package.json`, `package-lock.json` | Reproducible dependencies, checks, free test tools and patched PostCSS override |
| `.gitignore`, `.env.example` | Exclude credentials/generated files and document configuration names |
| `README.md`, `TECH_STACK.md`, `DEVELOPMENT_REPORT.md` | Accurate setup, implemented scope and this report |

Portable runtime, dependency cache, baseline reproduction, build output and screenshots are ignored local artifacts, not committed source.

## Final verification results

| Check | Result |
| --- | --- |
| Original production build | Failed due to unsupported API route helper exports; fixed |
| `npm test` | **22 passed** across 3 files |
| `npm run test:e2e` | **1 passed**, Chrome, mocked Supabase; server/browser exited successfully |
| `npm run build` | **Passed**, Next.js 15.5.28, all 6 static pages generated; media and generation routes compiled |
| `npm run typecheck` | **Passed**, strict TypeScript, including tests |
| `npm run format:check` | **Passed** |
| `npm audit` | **0 vulnerabilities** after replacing vulnerable transitive PostCSS with 8.5.30 |
| Git whitespace check | Passed; Windows line-ending notices only |
| Browser runtime errors | None captured in the tested flow |
| Mobile layout | No document overflow at 390 px for content and media views; desktop/mobile screenshots inspected |

Database tests exercise actual PostgreSQL execution in PGlite with test equivalents of Supabase Auth and Storage schemas. They verify owner/member access, database persistence, forced Draft insertion, approval bypass rejection, approval audit, edit invalidation, rejection/resubmission, attachment restrictions, media identity protection and deletion reservations. These are not hosted Supabase service tests or a full concurrent multi-device load test.

API tests mock Supabase and OpenAI. Dashboard tests mock database connections. The browser test uses fake public configuration and intercepts Supabase requests; a draft survives reload within its mocked backend. Browser assertions complement the database tests but do not prove hosted cross-device persistence.

Windows sandbox restrictions initially prevented automatic browser-test server cleanup. The final browser run outside that restriction completed and shut down normally. No user application or unrelated server was stopped.

## Required configuration and remaining verification

No `.env.local` or Supabase/OpenAI credentials were available in this session. Therefore live signup/sign-in, confirmation email delivery, hosted RLS, actual media upload/playback, cross-device persistence and real AI output remain **unverified**. The new migration has not been applied to a hosted database.

Required steps:

1. Fill ignored `.env.local` with the existing project's Supabase URL and public anonymous key.
2. Review/apply the original migration if needed, then the new migration once. Be aware that older approvals without audit records will require fresh owner review.
3. Enable email confirmation, configure redirect origins and confirm the owner account `cobshomes@gmail.com`.
4. Check private bucket policies and the project-wide storage size limit.
5. Optionally configure an existing server-only OpenAI key and permitted model. No paid API, subscription or account was activated here.
6. Verify the owner/member workflow with two accounts, reload in two devices, test representative original photos/videos, replace an approved attachment and verify approval resets.

Current limitations:

- One attachment per post; no carousel, bulk upload or transcoding.
- Uploads are not resumable and require the page to stay open; maximum 50 MiB per original.
- Video playback depends on browser codec support. Original links are provided.
- Basic file-signature checks do not fully decode media or scan for malware.
- Preview URLs last one hour; Refresh renews them.
- Storage and metadata updates are not a single cross-service transaction. Reported interrupted operations may require reconciliation; Remove can be retried for reserved assets.
- The existing lead form remains a save form; no expanded CRM was introduced.
- No real calendar/date scheduling, automatic publishing, Meta integration, analytics or complete post-version history.

## Recommended next phase

First configure the existing Supabase project and perform a live owner/member, media and cross-device acceptance test in a development environment. Resolve any hosted schema/policy differences before considering deployment.

Then add resumable video uploads with progress/retry, multiple attachments, actual calendar planning and post revision history. Supabase recommends [resumable uploads for larger files or unstable networks](https://supabase.com/docs/guides/storage/uploads/resumable-uploads). Social publishing should remain a separately reviewed phase with explicit owner approval and server verification of the approved revision.

Changes are intended for a local commit on `develop/dashboard-media` only. No merge to main, push or deployment was performed.
