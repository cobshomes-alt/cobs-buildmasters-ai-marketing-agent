# P1 post-deployment verification

15 October 2026 (UTC). Branch: `develop/dashboard-media`. Existing hosted project: `ldnyctzrgcpcjmhnrpms`. **No regression detected within the tested scope. P2 remains pending.**

| Check                                        | Status                             | Actual evidence                                                                                                                                                                                                                                                         |
| -------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing owner sign-in                       | PASS — live                        | Owner signed in directly in the labelled browser; no credentials were shared in chat or captured by the test.                                                                                                                                                           |
| Owner campaigns/drafts/media reads           | PASS — live empty-list reads       | Actual hosted queries succeeded; one owner profile, zero campaigns, drafts or media assets. Campaign Planner, Content Calendar, Approvals and Media Library opened. Reload preserved connected access. Populated-record rendering is untested.                          |
| Anonymous COBS record access                 | PASS — live                        | All five protected table queries returned no rows; owner-helper RPC denied with permission error 42501. Tables with no records provide limited negative-access evidence.                                                                                                |
| Owner secure media API authorization         | PASS — live Auth and server checks | The app sent its normal owner-authenticated request, but the test substituted an inert unknown action. Server Auth getUser/profile checks passed, then returned expected HTTP 400 “Unknown media action.” before any Storage call. No upload was prepared or performed. |
| Unauthorized media API calls                 | PASS — live endpoint               | Missing authentication and invalid bearer each returned HTTP 401 using inert requests.                                                                                                                                                                                  |
| Existing automated security/regression suite | PASS — local/mocked                | 37 tests passed across five files, including eight isolated SQL security tests. Local tests exercise proposal/rollback behavior; they do not apply P2 to production or prove hosted Auth/Storage transfers.                                                             |
| Browser runtime/database writes              | PASS                               | No runtime errors or hosted database write requests observed during owner navigation/API probe.                                                                                                                                                                         |
| Failed checks                                | NONE                               | No tested assertion failed. The intentional 400/401 responses above are expected passes.                                                                                                                                                                                |

## Untested live flows requiring permission

- Creating a labelled campaign/draft, reloading to verify persistence, and exercising rejection/resubmission/approval/edit invalidation require temporary records and updates.
- Real upload, private signed preview/download, attachment handling and unused-media removal require a synthetic media object and metadata record. The currently empty library provides no file to read.
- A real non-owner JWT end-to-end test needs a suitable existing non-owner account or separately approved Auth test user; no account was created.

No such production writes or uploads were attempted. Any test-item creation requires explicit permission; deletion requires approval for the exact created items. Prior live write tests and current local regression results do not establish these post-P1 live flows.

## Boundaries and recovery

Only read-only acceptance and inert API probes were performed. No production record was created/deleted, and no permission, policy, trigger, Auth setting or migration-history change was issued. Ordinary owner sign-in may update service-managed login/session metadata. No merge, deployment, purchase, commit or push occurred. P2 remains unapplied.

If a later regression is detected, stop and compare fresh definitions/grants with the captured P1 state. The guarded [P1 rollback](supabase/security-proposals/p1.rollback.sql) restores the prior PUBLIC/anon helper grants and four PUBLIC policy targets, including prior exposure; it does not restore data or Auth sessions and is not a full-project backup. Obtain explicit rollback approval and stop on drift; do not automatically run rollback or P2. See [P1 completion and recovery limits](supabase/security-proposals/P1_COMPLETION.md).

Private evidence is in ignored `.tools/p1-post-verification/owner-api.json`, `media-denials.json`, and the repeated anonymous API result under `.tools/p1-final-preflight/anonymous-api.json`. No secrets or business-record contents were exported. This report remains local and uncommitted.
