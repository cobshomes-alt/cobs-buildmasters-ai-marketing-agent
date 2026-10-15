# P1 final execution review — awaiting confirmation

Historical pre-execution review. P1 was subsequently confirmed/applied with read-only acceptance only; see [P1_COMPLETION.md](P1_COMPLETION.md) for actual execution and verification results. The SQL files/hashes were preserved unchanged.

15 October 2026. Development branch: `develop/dashboard-media`. No production security change has been executed.

## Fresh preflight results

- Official project listing confirms existing project `ldnyctzrgcpcjmhnrpms`, `berica868@gmail.com's Project`, eu-west-1, ACTIVE_HEALTHY, PostgreSQL 17.11. Commands explicitly selected this reference; the CLI reported no default locally linked project, so no default link was relied on or changed.
- Current COBS schema, functions, policies, triggers, grants and bucket settings match the previously tested snapshot. Current dependency definitions and role inheritance match the audit. No unexpected dependency or security change was found.
- The exact P1 assertion block was extracted and executed inside `BEGIN READ ONLY`, without ALTER/GRANT/REVOKE statements: PASS.
- P1 and rollback SHA-256 values match the validation report. Both function body/owner and current ACL items match; all four policy targets/predicates match. Authenticated/service-role execution is retained.
- A fresh isolated **P1-only** forward/rollback rehearsal passed, restoring captured grant items, policy definitions/targets, function definitions/owners and trigger state while preserving existing local profile/campaign/draft fixtures and the unrelated sentinel. One test passed; seven other tests were deliberately skipped in this targeted run. The prior full suite had 36 passes; it was not rerun for this final read-only preflight.
- Current advisor baseline: 15 warnings. Existing confirmed owner/profile remains present; marketing/media tables and COBS Storage objects are empty.

Evidence is private under ignored `.tools/p1-final-preflight/`. No credentials, Auth sessions or secret keys were exported.

## Exact authorized scope to confirm

Apply only [p1.sql](p1.sql), SHA-256 `7926d3d25adbbc6b2bf33a304cbc3ebd1bab216b8f214b5c447b1ba8485ab601`, in its guarded transaction with bounded timeouts:

1. Retarget four existing COBS marketing ALL policies from PUBLIC to authenticated: campaigns, leads, posts and media assets. Keep USING/WITH CHECK owner predicates intact.
2. Revoke EXECUTE on `public.cobs_is_owner()` from PUBLIC and anon. Preserve postgres, authenticated and service_role grants. Do not change its definition or owner.

No INSERT/UPDATE/DELETE, table deletion, Auth setting, profile role, trigger binding, Storage policy, unrelated object or migration-history change is in the patch. P2 and packages P3–P7 remain excluded. No db push/reset/repair, merge, deployment or paid service is part of this action.

## Recovery and limits

[p1.rollback.sql](p1.rollback.sql), SHA-256 `9f95c0f8fb5b0f7f5d0e11424fa244074408b299f9c30ac08c19eb9807c06dd8`, restores PUBLIC/anon execution and the four PUBLIC policy targets. Its guard requires the expected post-P1 state. All original ACL grantors/options and policy predicates are captured; ACL array order can differ without changing permissions. Recovery restores the previous exposure, not a more secure state.

This is locally verified scoped security-metadata recovery, not a hosted rollback or full-project disaster restore. It does not restore Auth credentials, unrelated application data, or Storage file bytes. New dependencies/concurrent policy changes can invalidate guards; stop and review rather than bypass them. Refresh the snapshot and hashes immediately before execution if confirmation is delayed. Do not automatically execute rollback or P2 after a failure; stop, report actual results and seek approval for the next action.

## Post-P1 acceptance plan and separate test-data scope

Immediately verify exact changed grants/targets and unchanged function, triggers, Storage policies, unrelated definitions and history. Then check real owner login/access and anonymous restrictions. Expected advisor result is removal of only the anonymous cobs_is_owner warning (normally 15 → 14); its authenticated helper warning should remain.

Because no campaigns/drafts/media currently exist, complete live persistence/approval/media verification requires approval for new labelled temporary test data. Proposed scope: one unique `COBS TEMP P1 VERIFY` campaign, one draft, one small synthetic PNG; app-based save/reload, submit/reject/resubmit/approve/edit invalidation, private preview and anonymous denial. No real company media, business records, Auth users or external publishing will be used. Obtain explicit approval before creating these items and separate exact-ID approval before deleting them. Record test IDs and stop immediately on failure. If only read-only verification is approved, record those write-dependent flows as unverified rather than claiming success from empty-table reads.

Owner sign-in must occur in the app if needed, never through passwords/tokens in chat. Role/claim SQL simulation does not substitute for actual hosted owner acceptance. P2 must remain unapplied; only after P1 results are reported may separate P2 approval be considered.
