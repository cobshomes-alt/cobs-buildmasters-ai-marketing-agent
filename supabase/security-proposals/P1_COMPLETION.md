# P1 production execution and read-only acceptance

15 October 2026. Existing project `ldnyctzrgcpcjmhnrpms`, `berica868@gmail.com's Project`, eu-west-1. Local branch `develop/dashboard-media`.

## Authorization and execution

The owner explicitly confirmed **P1 with read-only verification only**. No temporary records, uploads, live approval changes or Auth test users were authorized or created.

Applied only `p1.sql`, SHA-256 `7926d3d25adbbc6b2bf33a304cbc3ebd1bab216b8f214b5c447b1ba8485ab601`, through the authenticated official Supabase CLI against the explicit existing project reference. The guarded transaction completed successfully. Immediate pre-execution schema/dependency comparison showed no drift; the patch hash matched the reviewed file.

Changes were limited to:

- Four existing COBS marketing ALL policy targets changed from PUBLIC to authenticated, with their owner USING/WITH CHECK expressions preserved.
- EXECUTE on `public.cobs_is_owner()` revoked from PUBLIC and anon. Postgres, authenticated and service_role execution remained granted.

No function body/owner, trigger, Storage policy, Auth configuration, profile role, table definition or business record was changed by the patch. P2 and packages P3–P7 were not executed. No migration-history operation, db push/reset/repair, merge, push, deployment or paid service action occurred.

## Actual verification results

| Check                                                      | Actual result                                                                                                                                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact P1 post-state and rollback preconditions             | PASS in hosted read-only transaction; rollback assertion block only, no rollback executed                                                                                                    |
| RLS and owner/non-owner database reads                     | PASS; owner profile/marketing reads work; simulated unowned identity sees no protected data                                                                                                  |
| Anonymous database access                                  | PASS; protected rows hidden and helper execution denied                                                                                                                                      |
| Actual anonymous hosted Data API                           | PASS on all five COBS tables: no rows returned; helper RPC denied with permission error 42501                                                                                                |
| Full captured schema/security comparison                   | PASS; only four intended policy targets changed; all other captured function/trigger/grant/bucket/Storage policy definitions preserved                                                       |
| P2 and unrelated flagged function ACLs                     | PASS: unchanged                                                                                                                                                                              |
| COBS records/object counts                                 | PASS: unchanged, one profile and zero campaigns/posts/leads/media assets/COBS objects                                                                                                        |
| Migration history                                          | PASS: unchanged; only 20261015002801, 34 statements, remains recorded                                                                                                                        |
| Security advisor                                           | PASS: 15 → 14 warnings; exactly the anonymous cobs_is_owner finding removed; necessary authenticated helper finding and other 13 warnings remain                                             |
| Actual existing owner sign-in                              | PASS: owner entered credentials only in the labelled app browser, never in chat                                                                                                              |
| Owner read-only UI/navigation                              | PASS: Overview, Campaign Planner, Content Calendar, Approvals and Media Library loaded; reload returned a connected workspace; no browser runtime errors or database write requests observed |
| Campaign/draft persistence after P1                        | **Not exercised**: no existing records and read-only scope forbids creating verification records                                                                                             |
| Actual owner approval/rejection/edit invalidation after P1 | **Not exercised**: no draft exists and approval writes were not authorized; guard definition/binding and owner permission remain unchanged                                                   |
| Actual private media preview/download/upload after P1      | **Not exercised**: bucket is empty and uploads were not authorized; private bucket/settings/policies and owner metadata reads verified                                                       |

The role/claim SQL checks are simulation on the real hosted database, not a real second-user JWT. Empty-table reads cannot establish protection of a populated record or successful content persistence. The prior live content/media tests and local P1 tests remain supporting evidence, not post-P1 live write acceptance. No claim is made that these unperformed flows passed.

## Recovery status and limits

`p1.rollback.sql`, SHA-256 `9f95c0f8fb5b0f7f5d0e11424fa244074408b299f9c30ac08c19eb9807c06dd8`, remains unchanged. A fresh local P1-only rehearsal passed before execution, including existing local record preservation. Its expected post-P1 function/ACL/policy assertion block passed on production in a read-only transaction after execution. No live rollback ran, and no rollback is automatic.

Recovery restores the exact captured grant items/grantors/options and policy definitions/targets, although ACL array ordering may differ. It also restores previous anonymous helper exposure. This is scoped metadata recovery, not a full-project backup or Auth/Storage-byte restore. Any later rollback needs explicit approval and a fresh drift/dependency check; stop rather than bypass guards if concurrent changes occur.

Private evidence: `.tools/p1-final-preflight/` contains immediate/pre/post snapshots, execution result, read-only guard results, anonymous API checks, advisor results and owner browser evidence. No tokens, passwords, Auth session data or secret keys were exported. Ordinary owner sign-in may update service-managed login/session metadata; no Auth settings or account-role edits were performed.

## Next decision

P1's authorized read-only verification is complete with the limitations above. P2 remains unapplied. Keep it pending unless the owner separately approves a fresh P2 preflight and subsequently confirms production execution. Live write-dependent P1 acceptance would require new explicit approval for labelled temporary items and separate exact-ID cleanup approval.

The historical migration mismatch remains unresolved. P1 was not registered as a migration because history changes were expressly prohibited; document this separately applied patch in any future approved baseline/history mapping. Do not replay historical migrations or automatically push pending files.

Reports and tests remain local and uncommitted. Existing VS Code settings were untouched.
