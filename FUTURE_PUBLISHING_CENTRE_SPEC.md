# COBS Publishing Centre — future implementation specification

15 October 2026. Specification only: no publisher, social OAuth connection, scheduler worker, analytics synchronizer or advertising integration is activated by this milestone.

## Owner journey and final action

Draft → Edited → Previewed → Owner Approved → Final Publish Confirmation → Publishing → Published or Failed.

The final screen must contain a prominent **Publish Content** action. It is a distinct action after owner approval, never a side effect of saving, rendering, previewing or approving. Until a destination is connected and its adapter is implemented, offer Download media and Copy caption for manual publishing; never a decorative success button. The current application has draft approval and local readiness scheduling, not external publication.

The final screen shows the actual finished asset, platform-specific editable caption, verified company identity, selected individual connected accounts, organic/advertisement distinction, supported features and validation failures. Owner chooses Publish Now or Schedule, selects local date/time with explicit timezone and UTC conversion, reviews the approved immutable revision and confirms submission. Changing text, media, destination or material platform options invalidates the corresponding approved revision. Editing a studio recipe alone does not replace an approved post's media; explicitly attach a new export through the existing post editor, which resets approval.

## Official account connection

Owner initiates provider OAuth in the browser; use state/CSRF protection and PKCE where supported, exact registered redirect URLs, least scopes and server-side code exchange. Confirm returned provider account IDs and manageable Page/channel/profile identities; allow selection of individual accounts. Display connected, expired, revoked and unsupported states truthfully. Encrypt refresh/access tokens server-side using a separately managed key; no browser/localStorage secrets or Git credentials. Redact logs. Implement supported refresh, explicit disconnect/revocation and deletion of credentials without deleting company posts. Never ask for tokens in chat. App verification, privacy policy, business verification and scope review may be prerequisites, not UI-only steps.

## API capability gates

| Destination                  | Proposed official surface and gate                                                                                                                                                                                                                                                                                                                                      | Honest alternative                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Facebook Feed/Reels          | Pages/Video/Reels API, Page authority and reviewed publish scopes; not personal-profile posting. Meta documentation returned HTTP 429 during this audit; revalidate exact version/scopes before implementation.                                                                                                                                                         | Owner downloads media and copies caption into Meta's own interface.  |
| Instagram Feed/Reels/Stories | Instagram professional account and selected official login product; review publishing scopes and per-format/account support. Do not assume consumer accounts or every Stories capability is supported.                                                                                                                                                                  | Instagram app/manual export.                                         |
| TikTok                       | Content Posting API plus creator-info readiness, approved scopes and required disclosure/privacy UX. Unaudited Direct Post clients are private-only. Check audit eligibility for this owner-operated use case before coding. [Official guide](https://developers.tiktok.com/doc/content-posting-api-get-started).                                                       | Export to TikTok app; no browser automation pretending to be an API. |
| YouTube/Shorts               | OAuth upload/channel authorization; video upload and subsequent processing/status read. Shorts eligibility is platform-determined. Current method reference and overview disagree about unverified-project restrictions: resolve current project policy with Google before connecting. [Method reference](https://developers.google.com/youtube/v3/docs/videos/insert). | YouTube Studio upload.                                               |
| X                            | Official user-context posting/media APIs, purchased usage eligibility and current limits; no paid credits authorised. [Pricing](https://docs.x.com/x-api/getting-started/pricing).                                                                                                                                                                                      | Native X composer.                                                   |
| Snapchat                     | Public Profile API for eligible profiles/content types, official OAuth and approved access. Not a universal Snapchat personal-account publisher. [Official API](https://developers.snap.com/marketing-api/Public-Profile-API/Introduction).                                                                                                                             | Snapchat app/manual export.                                          |
| Google Business Profile      | Approved Cloud API project, verified eligible business location, owner/manager OAuth and supported local-post operations. [Prerequisites](https://developers.google.com/my-business/content/prereqs).                                                                                                                                                                   | Business Profile management interface.                               |

The new Social Post Preview is a layout simulation using actual saved draft text/media, not a connected account screenshot or platform compliance validator. Eleven destinations are selectable; no views, likes, comments, follower counts or invented call-to-action values.

## Durable jobs, scheduling and duplicate prevention

Before implementation, present an exact additive Supabase migration for connected accounts, immutable approved revisions, per-destination submissions, durable jobs, provider events and analytics snapshots with foreign keys, owner RLS and rollback/recovery review. Do not apply old migration files as a shortcut. Keep provider secrets in a separate restricted server-only store.

Transactionally validate owner, approved revision hash, account authority, media readiness and final consent, then insert a unique submission `(revision, account, operation)` and an outbox job. Persistent workers claim leased jobs with bounded concurrency. Record queued/processing/retry/failed/published, attempt timestamps and sanitized provider errors. Honor Retry-After and provider rate limits. Back off transient failures; do not retry permanent permission/media failures. After a timeout of uncertain submission outcome, query provider status before resending. Some providers do not provide idempotency: exactly-once delivery cannot be promised; uncertain submissions require reconciliation/manual review.

Scheduling must survive browser closure and worker restart. UTC jobs retain user's timezone, account, revision and consent; revoked approval cancels pending work. Cancel cannot recall a provider operation already accepted; display that boundary. Confirm actual provider completion, external post ID and canonical external link before marking Published. Acceptance/upload success alone means Processing. Test delayed provider processing and partial multi-account success.

## Analytics and advertising

Fetch permitted metrics using real connected account/post IDs. Store source, provider timestamp, retrieval time, timezone, units and permissions. Display Unavailable for missing/unsupported values and separate manually entered results from provider-confirmed metrics. Derive success rates only from actual job outcomes; compare campaigns on like-for-like periods. Recommendations need a disclosed minimum evidence threshold; general posting guidance must be labelled heuristic. Retention/deletion must follow provider policy. Synchronization requires its own durable queue, rate limits and token lifecycle tests.

Advertising is a separately approved product: organic content never implies an active advertisement. Capture objective, audience and Ghana location targeting, GHS budget, dates/timezone, individual ad account and supported CTA; preview actual media and caption. Verify account currency and provider billing units; do not silently convert GHS or alter existing budgets. Owner must separately approve exact spend ceiling, billing account, targeting and creative, followed by final submission confirmation. Provider ad review and delivery are separate states. Report actual billed/estimated spend with source/time, never invented results. No billing details, campaign launch or subscriptions are requested here.

## Acceptance and recovery requirements

Test owner/member/anonymous gates; changed-revision approval invalidation; unsupported dimensions/captions; OAuth CSRF/revocation/refresh; expired signed-media access; duplicate click; provider 401/403/429/5xx; processing timeout and ambiguous success; browser closure; worker crash/restart; timezone/DST and missed schedules; disconnected accounts; cancellation races; partial success; metrics unavailable; and denied advertising without exact budget consent. Use provider sandbox/mocks first, then separately approved real accounts and synthetic posts. Preserve business records. Database rollback cannot undo an external post or incurred ad spend; these need explicit provider-side recovery and owner approval.

## Implementation order

1. Review this specification, provider eligibility, costs and exact schema/recovery plan.
2. Authorize one destination and OAuth connection; implement its manual export and validation first.
3. Test connection and approval/submission worker with sandbox/mocks and restart tests.
4. Obtain explicit approval for a labelled live publish test and its later cleanup.
5. Add scheduling and truthful history; then analytics after sufficient real data.
6. Consider advertising only under separate spending authorization. No platform is universally supported by default.
