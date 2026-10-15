# COBS BUILDMASTERS LTD — AI business growth roadmap

15 October 2026 · `develop/dashboard-media` · architecture and delivery plan.

## Delivery decision

Preserve the existing application, original logo, P1 controls, owner approval system and ongoing Media Studio work. The five growth modules below are **planned, not implemented**. A roadmap, mockup, sample or navigation item is not implementation evidence. No new navigation sections or production tables are created by this document.

Order: **working multi-video/multi-photo export → Construction Progress Storytelling → Educational Marketing → Local Marketing → Contractor Relationships → Campaign Experimentation**. Each phase starts with a refreshed architecture, cost and data-security review and ends with executable acceptance evidence and an owner review. Production migrations, paid APIs, outbound customer messages and advertising spend require separate approval. P2 remains pending.

## Current architecture and constraints

- Existing Next.js/TypeScript workspace and Supabase project remain authoritative. `cobs_campaigns`, `cobs_posts`, `cobs_profiles`, `cobs_leads` and `cobs_media_assets` are reused where their semantics fit. Do not overload social-post bodies with unprotected lists of project/customer/media references.
- Creative Director already supports sample/manual planning, scripts, storyboard, filming checklist, campaign linkage and review-draft handoff. Live OpenAI depends on an existing configured server-side key; sample output remains explicitly labelled.
- Media Library already owns private original uploads and previews. Media Studio has a manual multi-asset timeline, guarded batch uploads and a tested single-source local FFmpeg worker. Multi-asset hosted saving depends on a reviewed but **unapplied** proposal; its interface must continue to say when edits are unsaved.
- Campaign Planner and Content Calendar remain the campaign/draft authorities. The existing approval workflow is the only publishing approval path; editing approved content invalidates approval. An editing export is not an approved social post.
- Future Publishing Centre and connected performance analytics are specifications/dependencies, not working platform integrations. Existing Overview counts are workspace counts, not advertising performance.
- Owner authorization remains based on a server-verified user and trusted profile. Do not reinterpret ordinary authenticated users as authorized staff or broaden current owner permissions to deliver CRM.
- Supabase remains the company database. Local SQLite is a private operational rendering queue with temporary files and retention, not durable company/project/contact storage.

## Immediate phase: real combined Media Studio export

### Architecture review

Extend the existing worker and authenticated Studio API rather than start another editor. Accept a validated snapshot of the current timeline; resolve every unique media ID through the owner-scoped Supabase client, authorize private Storage access and capture bounded originals before the job becomes pending. Never accept browser file paths, remote media URLs, signed URLs or arbitrary FFmpeg instructions. Persist only a sanitized recipe and private local inputs in the queue.

Normalize each clip into the selected aspect, H.264 video and stereo AAC audio; loop photographs for their selected duration, trim videos, apply existing composition/colour/static text/original-logo settings and original-audio levels. Add silence where a clip has no audio, then concatenate normalized clips in the selected order using hard cuts. Reuse leases, restart recovery, idempotency, usage caps, cancellation, owner-only downloads and 24-hour export retention.

Exporting a snapshot does **not** save a hosted multi-asset project or bypass the pending schema proposal. Originals remain untouched; files are downloaded privately and any permanent output upload remains an explicit owner operation. Do not automatically register, approve, publish or attach exports.

Initial bounded delivery target: up to 12 timeline clips, 6 unique originals, 60 seconds total, 50 MiB combined source capture and 50 MiB output, using existing per-clip limits and aspect ratios. Larger editable timelines remain editable but are explicitly rejected for export until resource evidence supports higher bounds. Display these limits before submission. Restrict concurrency and total processing time; enforce intermediate-disk limits too.

**Current update:** this bounded hard-cut export path is now implemented and locally tested. The complete suite passed 108 tests; 7 browser tests and the production build passed. Hosted Storage capture/download acceptance and durable multi-asset saving remain unverified/pending. See `MEDIA_STUDIO_MULTI_EXPORT_VALIDATION.md` for exact evidence and limits. The five modules below remain planned.

### Cost review

Local FFmpeg requires no API subscription or AI credits. Electricity, local disk/CPU, Supabase storage and egress still have costs/quotas. A maximum-size unique export captures up to 50 MiB; repeated sources in one job should be downloaded once. Existing 20-reservation/day and 1 GiB/rolling-30-day source caps remain ceilings, not a guarantee that the hosted Free quota has headroom. Do not purchase hosting or raise limits automatically. Current account usage has not been queried in this phase.

### Data-security review

Require owner authentication before metadata lookup, job creation, cancellation and download. Validate media type, owner-prefixed storage path, deletion state, positive integer size, authorized Storage origin and exact streamed byte count. Use bounded requests, redirects disabled, shell-free local FFmpeg arguments, restricted protocols/demuxers, checked dimensions and duration. Retain no JWTs, keys or signed URLs in job metadata. Snapshot capture can race with an authorized media change; a failed/changed source must fail closed. Once captured, a job uses that immutable local snapshot; it is not permission to republish later.

### Acceptance gate

Real synthetic photo-only, video-only and mixed exports must decode and play; verify exact order, duration, aspect, audio/silent spans, trim, per-clip edits, logo and original-byte preservation. Test missing/invalid media, foreign owners, SSRF/path input, oversized transfers, duplicate submissions, partial capture, worker restart, cancellation and private download authorization. Run existing regression suite, TypeScript and production build sequentially with browser tests. Hosted capture-to-download remains unverified until separately authorized synthetic acceptance.

## 1. Construction Progress Storytelling

**Status: planned; no project/stage schema or storytelling generator implemented.**

### Owner workflow

Create a real project with name, location and verified facts → select/upload originals in Media Library → enter actual capture dates, stage labels and evidence notes → review suggested chronological order (unknown dates remain unknown) → explicitly choose authentic before/after pairs from that same project → generate labelled sample/manual or live-AI scripts and captions → review claims/shot list → create a manual editing timeline in Media Studio → render → upload/select the resulting export → create a Content Calendar draft → owner review and approval.

### Data entities and API

Proposed `cobs_construction_projects` (name, location, verified facts, owner, revision), `cobs_project_media` (project/media FKs, owner-confirmed capture date, stage, evidence and order), `cobs_progress_comparisons` (project and two media FKs, comparison notes) and `cobs_progress_plans` (project/campaign/plan linkage and evidence version). Reuse `cobs_media_assets`, campaigns, social drafts and proposed Media Studio project/clip entities. Dates should include provenance; EXIF/filename guesses are suggestions, never verified facts.

Owner-only project CRUD, evidence/order/comparison validation and Creative Director generation endpoints; timeline handoff uses existing Media Studio schema and strict media FKs. Deleting referenced media/projects must be blocked or explicitly resolved. Do not copy originals into a second bucket.

### AI, dependencies and cost

Text planning and progress summaries use the existing server-side OpenAI adapter when configured; manual templates work without spending credits. Automated visual understanding/date inference is a later, separately costed capability. Depends on real combined export, durable multi-asset saving, private previews and existing approvals. Local editing has no AI service fee; model calls and hosted usage consume existing quotas/billing only with approval.

### Security and privacy

Project/stage evidence is private. Validate same-project comparisons server-side. Preserve original media and owner corrections; never assert a stage is completed from an image alone. Require permission for identifiable workers, clients, addresses and site details. Keep evidence revisions attached to draft approvals; changed evidence must trigger review. RLS and owner predicates apply to every proposed entity.

### Milestones and acceptance

1. Approved schema/recovery plan, isolated FK/RLS tests and owner-reviewed project UI.
2. Dated-media organization and corrected ordering; undated entries never silently receive dates.
3. Before/after evidence selection and grounded scripts with no invented progress.
4. Timeline handoff, real rendering and approved draft linkage.

Tests: no cross-project media/comparisons; preserved order after reload; missing dates stay unknown; owner correction overrides suggestions; no fabricated claims; deleted/replaced evidence invalidates relevant review; no non-owner access; render uses actual selected originals; no publication occurs.

## 2. Educational Marketing

**Status: planned; generic existing Creative Director functionality is not this specialized module.**

### Workflow and data

Within Creative Director, select an education topic (block quality, solid/hollow blocks, handling/curing, planning, rentals, materials, budgeting or residential tips) → choose audience/format → enter verified company facts → produce ideas, scripts, captions, carousel outlines and video concepts → review general advice versus project-specific requirements → owner verifies technical claims → create a standard review draft.

Proposed `cobs_education_briefs`, `cobs_technical_claims` (claim, source/provenance, scope, verifier and revision) and a plan/claim join with true FKs. Reuse campaigns and `cobs_posts`; never create a parallel approval status. Owner-only APIs validate technical claim references and hand off drafts through the current workflow. Retrieval/source ingestion is optional future work with its own source-license and prompt-injection review.

### AI, integration and costs

Use existing server-side text generation with a structured education schema and explicit fact grounding. Provide labelled sample/manual mode. No paid image/video generation. Integrates Creative Director, Content Calendar, Media Library, rendering and later Publishing Centre. Local templates are free of AI API charges; live text generation is metered under an existing authorized account.

### Security, milestones and acceptance

Distinguish general education from engineering design, building-code approval and project-specific professional advice. Do not invent block strength/certification, curing guarantees, savings or suitability. Owner verification is required for technical claims and must be invalidated on material edits; it does not substitute for professional engineering approval.

Milestones: reviewed content taxonomy/claim model → manual educational planner → grounded AI adapter → carousel/video handoff and approval integration. Tests verify topic coverage, clear scope, no invented company specifications or prices, unverified claims blocked from approval-ready handoff, changed claims return for review, correct sample labelling and owner-only access.

## 3. Local Construction Marketing

**Status: planned; no service coverage or charges are assumed configured.**

### Workflow and data

Owner configures actual service areas, services, delivery availability and charges/effective dates → confirms which facts may be used → selects an area/campaign → receives grounded suggestions/captions/CTAs → creates normal drafts → owner approves → manual publishing until platform integration is approved.

Adenta, Madina, Pantang and Aburi are suggested setup choices, **not verified coverage**. Other areas require owner confirmation. Proposed `cobs_service_areas`, `cobs_service_area_services` and `cobs_service_charges` with effective dates/currency/conditions/verification revisions; use existing campaigns and drafts. Owner-only configuration APIs and Creative Director generation read only currently verified facts. Missing/expired coverage or charges must not be filled by AI.

### AI, integration and cost

Text personalization through the current adapter; sample/manual mode remains available. No geocoding/maps purchase is required for named-area entry. Integrates Campaign Planner, Creative Director, Content Calendar and future Publishing Centre. Paid-ad submission remains disabled until platform permissions, budget ceiling and owner approval are completed. No new ad API is connected now.

### Security, milestones and acceptance

No customer geolocation is collected by default. Changes to coverage/charges must invalidate dependent offers for review. Treat generated text as untrusted. Milestones: approved configuration model → owner editor → grounded campaign suggestions → draft/approval linkage. Tests: unapproved areas and stale charges excluded; unknown prices remain absent; currency/conditions retained; non-owner edits denied; no ad submission or spending path exists.

## 4. Contractor Relationship Manager

**Status: planned; existing Lead Register is not a complete CRM or staff authorization system.**

### Workflow and data

Authorized person records enquiry/contact type, minimal contact details, project stage, product interests, communication preference and consent provenance → sees possible duplicates → owner confirms merge when necessary → sets follow-up date → receives an in-app reminder and editable suggested message → manually authorizes any communication through a later approved integration.

Proposed `cobs_contacts`, `cobs_contact_channels`, `cobs_enquiries`, `cobs_followups`, `cobs_consent_events` and `cobs_enquiry_outcomes`. Reuse/link existing `cobs_leads` instead of copying it into an independent duplicate store; first inspect its actual records and constraints before proposing a mapping/backfill. Keep organization/workspace ownership and true FKs. Preserve original consent events rather than overwriting history.

### APIs, AI and costs

Owner-only CRUD/deduplication suggestions first; prospective staff permissions require a separate explicit role/scoping review and approved policies. Normalize phone/email conservatively for duplicate candidates; do not merge different people automatically. In-app reminders first; no email/SMS/WhatsApp transport is enabled. AI produces drafts using minimal necessary data and no contact identifiers by default. Message services and automated reminders may have costs and require approval.

### Privacy, milestones and acceptance

Collect only necessary data, restrict contact access, respect opt-outs/consent purpose, establish retention/export/correction/deletion procedures and audit access. A follow-up date does not grant communication consent. Owner approval of marketing content does not authorize an individual customer message.

Milestones: existing-lead/schema/privacy review → owner-only enquiries/follow-ups → duplicate detection with guarded merge proposal → approved staff scope → optional authorized communications. Tests: cross-user isolation, duplicate candidate detection without auto-merging, opt-out suppression, timezone-correct reminders, no automatic sends, minimal AI payloads, existing lead counts unchanged during rollout and recoverable approved data changes.

## 5. Campaign Experimentation

**Status: planned; no connected performance results, experiment launching or sales attribution implemented.**

### Workflow and data

Owner chooses a campaign, hypothesis and approved offer → creates headline/caption/CTA/photo/hook/style variants using authentic originals → compares and approves each variant → optionally prepares a fixed-budget experiment plan → separately authorizes platform submission → imports actual results when connected → reviews enquiries/sales with attribution confidence and missing data stated.

Proposed `cobs_campaign_experiments`, `cobs_experiment_variants` (campaign/post/media FKs and content revision), `cobs_experiment_metrics` (platform/source/object ID, observed period, metric definition and fetched timestamp), and `cobs_attribution_links` (enquiry/outcome, source, method and confidence). Use campaign/post/media authorities and future CRM IDs. Unique platform observation keys prevent duplicate imports; preserve raw provenance separately with access controls.

### APIs, AI and dependencies

Variant generation reuses the text adapter. Read-only performance connectors are a later Publishing Centre/Analytics integration, using supported APIs and officially authorized account scopes. No scraping, invented impressions/conversions or fake attribution. Launching ads and changing budgets are separate privileged actions with explicit owner approval and fixed ceilings; no automatic budget increase.

### Costs, security, milestones and acceptance

Manual comparisons and sample variants require no ad spend. Live model calls, platform access and advertising budgets require approval and current cost verification. OAuth credentials remain server-side, encrypted/managed and minimally scoped; imported metrics are private. Statistical conclusions must state sample size, metric definitions and uncertainty; estimates never appear as verified sales.

Milestones: variants/offer grounding → approval-aware comparison UI → manual provenance-labelled observations → approved read-only connector → enquiry/outcome linkage → separately approved fixed-budget launch. Tests: no unapproved offer text, edits invalidate variant approval, unapproved launch denied, disconnected platforms show unavailable metrics, idempotent imports, estimates distinct from actuals, incomplete attribution explicit, and no spend increases.

## Shared approval, migration and recovery gates

1. Inspect current schema, records, dependencies, grants and migration discrepancy read-only before any schema work.
2. Prepare narrowly scoped versioned proposals, exact rollback metadata, tested recovery and any guarded backfill plan. Do not register historical migrations, use db push/reset/repair or infer that a reviewed proposal was applied.
3. Rehearse schema/FK/RLS/owner/staff tests in an isolated local database with synthetic records.
4. Present exact production SQL/hash, effects on existing records, recovery limits and cost implications; wait for explicit approval.
5. Apply only authorized changes, verify immediately and stop on drift/failure. Hosted synthetic records/uploads and cleanup require scoped approval.
6. Run full local regressions and build; review the interface and report actual local versus hosted evidence before any commit/push.

All five modules must share owner approval and existing media/campaign authorities. Production backups must include metadata and Storage recovery considerations; database backups alone do not recover deleted originals. Never silently auto-delete originals or unrelated records to satisfy foreign keys.

## Evidence and status updates

See `COBS_COMPLETE_UI_AUDIT_AND_REDESIGN.md`, `PREMIUM_MEDIA_STUDIO_REDESIGN.md`, `MEDIA_STUDIO_IMPLEMENTATION_REPORT.md`, `SUPABASE_SECURITY_REVIEW.md`, `COBS_SECURITY_FIX_VALIDATION.md`, `INTEGRATION_INVENTORY.md` and `FUTURE_PUBLISHING_CENTRE_SPEC.md`. Earlier reports describe historical milestone boundaries; new combined-export evidence is recorded separately in `MEDIA_STUDIO_MULTI_EXPORT_VALIDATION.md` when implementation/testing finishes.

Official implementation references: [Supabase signed URLs](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl), [FFmpeg concat demuxer](https://ffmpeg.org/ffmpeg-formats.html#concat), [FFmpeg filtering](https://ffmpeg.org/ffmpeg-filters.html). These are implementation references, not authorization to enable paid services or change production permissions.
