# Hosted application verification

Date: 15 October 2026. Branch: `develop/dashboard-media`. Existing project: `ldnyctzrgcpcjmhnrpms`.

## Live results

The owner signed in directly in a dedicated Chrome verification browser. Playwright exercised the existing local Next.js application against the real hosted project, without reading credentials or session storage and without mocked database or Storage responses.

| Check | Result |
| --- | --- |
| Owner authentication and workspace access | PASS |
| Create a temporary campaign through the app; reload and retrieve it | PASS |
| Create a campaign-linked draft through the app; reload and retrieve it | PASS |
| Submit, reject, resubmit and approve through owner controls | PASS; hosted responses confirmed each transition |
| Approval attribution | PASS; actual owner ID and approval timestamp saved |
| Edit approved content and reload | PASS; revised content persists as Draft, approval actor/time and scheduling cleared |
| Upload a synthetic 32×32 PNG to private Storage | PASS; 117 bytes, no company media |
| Preview image and reload Media Library | PASS; browser decoded the signed image at its actual dimensions |
| Owner removes unused synthetic media through the app | PASS after explicit cleanup approval |
| Anonymous and synthetic non-owner read/approval restrictions | PASS against hosted RLS; zero-row approval attempts in a rolled-back transaction |
| Cleanup and preservation | PASS; exact test draft/campaign removed with identity/content/dependency guards, test image removed through app; all five COBS tables and COBS Storage object count match the pre-test baseline |
| Browser runtime errors | None during successful live flow |

The negative RLS checks use actual hosted database roles and a synthetic claim, not a second authenticated user's browser session. They establish database-policy behavior; a real second-user Auth/JWT end-to-end test remains unperformed. No additional Auth user was created. Cross-device persistence, video upload, attached-media removal denial through the live UI, and real AI generation were not exercised in this phase. No content was published.

The only temporary run was `COBS TEMP VERIFY 20261015-c70d7520`. Campaign `16f323c2-9318-4665-bfaf-dc49c10704aa`, draft `16e42428-141c-4102-b575-55340b2126c4` and media asset `d61ff6eb-4e1b-4cd3-9b8e-aea9f37de276` were removed after approval. Private local evidence is under Git-ignored `.tools/live-verification-20261015/`. Existing business records were not edited or deleted; no unrelated table was written.

## Test-run issues resolved

An exact browser selector for the Campaign label timed out. The runner was corrected and reused the same campaign, avoiding duplicate records. A later upload attempt was rejected because the sandboxed local server could not connect to hosted Auth (`fetch failed EACCES`). Restarting the local test server with authorized network access resolved this; authentication checks were not weakened and application code did not require a workaround. Failed attempts and subsequent successful checks are retained in local evidence.

## Local checks and scope

- Automated Vitest suite: 29 passed across four files, including mocked API/component tests and isolated PostgreSQL migration/RLS tests.
- TypeScript and source formatting: passed.
- Production build: passed, including static generation and API route compilation.
- Existing Playwright browser suite: one passed (mocked Supabase, desktop/mobile workflow).

This phase added review and verification documentation. The commit also captures the previously approved reconciliation SQL and its seven isolated schema/recovery regression tests. The approved migration bytes remain unchanged. No new production migration, history repair, security configuration change, paid API, deployment, merge or push was performed.

## Follow-up

Review all 15 advisor warnings and the proposed migration baseline in [SECURITY_AND_BASELINE_REVIEW.md](SECURITY_AND_BASELINE_REVIEW.md). Security fixes and migration-history operations require separate explicit approval. Establish and test that baseline before enabling automatic database deployments. Then perform a real second-user authorization test and video/attachment lifecycle tests before advanced photo/video editing. AI credentials and live AI behavior remain unverified.
