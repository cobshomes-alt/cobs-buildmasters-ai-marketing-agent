# COBS Security Fix Validation — P1 and P2

**Follow-up:** P1 was subsequently explicitly confirmed and applied, with read-only hosted verification only. See [P1 completion](supabase/security-proposals/P1_COMPLETION.md). P2 remains local and unapplied. The original validation results and patch/rollback bytes below are preserved as pre-execution evidence.

**Date:** 15 October 2026 (UTC). **Branch:** `develop/dashboard-media`. **Existing project:** `ldnyctzrgcpcjmhnrpms`. **Status:** prepared and locally tested; not applied to production.

## Scope and decision

Only COBS packages P1 and P2 were prepared/tested. No package P3–P7 was executed, no hosted project was created, and no live data, permissions, policies, triggers, Auth settings or migration history were changed. No commit, push, main merge, deployment or subscription action was performed. The existing application implementation is preserved.

The proposals are reviewable SQL patches outside the active migration directory. They are intentionally not registered migrations. P1 removes anonymous/PUBLIC owner-helper execution and targets the four marketing policies to authenticated callers, retaining their owner predicates. P2 removes browser/PUBLIC execution from the Auth provisioning function while retaining its body, security context, owner and existing trigger. Both have exact-state rollback scripts and drift guards.

**Decision needed:** explicit approval before staged production execution. Local tests passed, but post-fix hosted Auth service provisioning, JWT login and Storage HTTP behavior remain unverified. Local reproduction is not a full shared-project backup or migration-history solution.

## Fresh read-only production inspection

Official CLI 2.121.0 reused the existing authorized connection. SELECT-only catalog queries refreshed columns, constraints, policies, functions, triggers, grants, bucket settings, dependency information, role memberships, counts and history. The combined inspection was wrapped in a read-only transaction. Evidence remains private and ignored under `.tools/p1-p2-validation/`; no password, session, token or secret API key was exported.

- Hosted PostgreSQL version: **17.11**.
- Both functions are owned by `postgres`, SECURITY DEFINER, with `search_path=public`.
- Exact captured ACL for each function: `=X/postgres`, `postgres=X/postgres`, `anon=X/postgres`, `authenticated=X/postgres`, `service_role=X/postgres`. The empty grantee denotes PUBLIC. No grant options are present.
- `anon` and `authenticated` are inheriting, non-bypass-RLS roles; the captured membership list has no parent roles for either. `service_role` bypasses RLS. `supabase_auth_admin` is NOINHERIT and owns `auth.users`.
- Five COBS tables have RLS enabled. Four marketing-table ALL policies target PUBLIC with both USING and WITH CHECK equal to `cobs_is_owner()`. The self-profile SELECT policy remains separate.
- The owner is confirmed and has an owner profile. Counts: one COBS profile; zero posts, campaigns, leads, media assets and COBS Storage objects.
- Final read-only comparison confirmed unchanged production function ACLs, owner-confirmation information, event-trigger inventory, schema CREATE privileges and COBS counts. No production write command was issued.

### Exact P1 policy scope

| Table             | Policy                          | Current target | Proposed target |
| ----------------- | ------------------------------- | -------------- | --------------- |
| cobs_campaigns    | owner manages COBS campaigns    | PUBLIC         | authenticated   |
| cobs_leads        | owner manages COBS leads        | PUBLIC         | authenticated   |
| cobs_posts        | owner manages COBS posts        | PUBLIC         | authenticated   |
| cobs_media_assets | owner manages cobs media assets | PUBLIC         | authenticated   |

The helper is also used by the enabled COBS approval guard and the existing owner read/upload/unused-delete Storage policies. None of their definitions or Storage targets changes. Authenticated execution remains granted directly. Unlike the audit's illustrative GRANT statement, the final guarded patch does not repeat that grant because it is already captured and preserved.

### Exact P2 dependency

`cobs_auth_user_profile` is an enabled AFTER INSERT trigger on `auth.users` executing `public.cobs_new_user_profile()`. The function inserts NEW.id/NEW.email into COBS profiles; the configured owner email produces owner, other users produce member; ON CONFLICT(id) does nothing. No owner assignment convention or existing profile is changed. The function cannot be called as an ordinary trigger-context RPC.

Catalog dependencies and function bodies were reviewed. String-body function calls are not exhaustively represented by pg_depend, so refresh definitions, all policy/trigger bindings and role inheritance before release. The patch guards validate the changed function/ACL/policy objects, not every possible new dependency elsewhere in the shared database.

## Proposed files and hashes

The exact forward and rollback SQL is embedded in Appendix A. These files were the inputs to the local tests, not abbreviated examples.

| File                                                       | SHA-256                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| [P1](supabase/security-proposals/p1.sql)                   | `7926d3d25adbbc6b2bf33a304cbc3ebd1bab216b8f214b5c447b1ba8485ab601` |
| [P1 rollback](supabase/security-proposals/p1.rollback.sql) | `9f95c0f8fb5b0f7f5d0e11424fa244074408b299f9c30ac08c19eb9807c06dd8` |
| [P2](supabase/security-proposals/p2.sql)                   | `3db2a422af5538a003080d7d29071cfbb7a5ca5ceb10ff3ef85bcfe750c1dedf` |
| [P2 rollback](supabase/security-proposals/p2.rollback.sql) | `4209a1775dcd794506f23a7b45ca4f5f94a355ebb454c3ea5db5f9aa312e791f` |

The function-definition MD5 values inside SQL are drift comparisons, not cryptographic approval signatures. SHA-256 above identifies complete patch bytes. ACL guard comparison ignores array order but requires the same ACL items, including grantors and grant options. Policy guards require the exact name, target, command, permissiveness and predicates. Each patch uses a transaction, five-second lock timeout and 30-second statement timeout. Unexpected state aborts before its mutations; do not bypass a failed guard.

## Isolated environment and reproducibility

`tests/fixtures/cobs-security-schema.json` is the fresh production definition snapshot; `cobs-security-acls.json` captures only P1/P2 ACLs. No business records are in either fixture. `restoreExistingSchema` accepts a supplied snapshot while preserving its original default and the existing reconciliation tests. The new `tests/security-fixes.test.ts` rebuilds a fresh PGlite PostgreSQL database for each test using current definitions directly, without replaying historical migrations.

Auth users/identity lookup and Storage tables are minimal local scaffolding. Local roles reproduce relevant browser grants and a NOINHERIT Auth writer owning the local auth.users table. Provisioning exercises the actual captured trigger function through INSERT by that writer, not by directly calling its body. A small empty unrelated media table and false-returning organization helper satisfy the unchanged campaign-media policy dependencies; they do not reproduce the unrelated application. Synthetic IDs and records are local only. No hosted test user, content or upload was created in this phase.

Reproduce with:

```powershell
npm test -- tests/security-fixes.test.ts
npm test
npm run test:e2e
npm run build
npm run typecheck
npm run format:check
```

Run the browser suite and build/typecheck sequentially because the Next development server and build share `.next`. The browser suite uses its existing mocked Supabase endpoint, not this local SQL fixture or production. A network-enabled local server would be needed for future authorized hosted API acceptance; permissions must not be weakened to work around a local network restriction.

## Actual results

| Test/check                                                                                                                                                                  | Result                                                              | Evidence type                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| P1 alone: owner saves campaign; member/anonymous cannot access protected rows; anonymous helper invocation denied                                                           | PASS                                                                | Isolated PostgreSQL with captured P1 definition/policies        |
| P2 alone: Auth writer provisions member; existing owner lookup/self-profile access work; member cannot promote profile; direct browser trigger execution denied             | PASS                                                                | Local simulated Auth writer, not hosted signup/login            |
| P1+P2: campaign-linked, media-attached draft remains stored across a fresh role/claim context                                                                               | PASS                                                                | Local database persistence, not a browser reload                |
| P1+P2: rejection/resubmission/approval, owner actor/time, invalid scheduling transition and edit invalidation                                                               | PASS                                                                | Captured approval trigger and local RLS                         |
| P1+P2: owner media object insertion/read/unused removal; member insertion/read denied; wrong prefix and attached deletion denied                                            | PASS                                                                | Local Storage metadata policies; not real bytes or HTTP service |
| Rollback restores ACL items, all policy definitions/targets, function definitions/owners, enabled triggers, existing profile/campaign/draft fixtures and unrelated sentinel | PASS                                                                | Exact scoped local forward/reverse rehearsal                    |
| Definition/policy drift aborts without partial patch changes                                                                                                                | PASS                                                                | Local negative guard tests                                      |
| Rollback refuses unexpected ACL changes; restored patches can be reapplied                                                                                                  | PASS                                                                | Local guard/reapplication test                                  |
| P2 owner-email bootstrap remains compatible with captured function logic                                                                                                    | PASS                                                                | Synthetic local Auth account, not an existing account change    |
| Full automated suite                                                                                                                                                        | **36 passed across five files**, including seven new security tests | Mocked component/API and isolated PostgreSQL tests              |
| Existing browser suite                                                                                                                                                      | **One passed**                                                      | Mocked Supabase desktop/mobile workflow                         |
| Production build                                                                                                                                                            | PASS                                                                | Local Next optimized build/static generation/API compilation    |
| TypeScript and source formatting                                                                                                                                            | PASS                                                                | Local checks after sequential regeneration                      |
| Production P1/P2 grants and counts before/after                                                                                                                             | PASS: unchanged                                                     | Real hosted read-only inspection                                |

The first local run failed because the scaffold lacked SELECT permission on the unrelated media-policy stub and a rollback assertion compared ACL array ordering rather than exact grant items. The fixture was corrected and the assertion/guards now compare equivalent ACL item sets. A fixture type annotation initially included unrelated historical metadata that differed from the current snapshot; it now describes only the fields consumed by restoration. One overlapping browser-server/TypeScript run failed on regenerated `.next` files; final build/typecheck were rerun sequentially. These were test-environment issues, not production patches or weakened access controls. Final results above reflect the corrected code.

## Live versus simulated verification and remaining blockers

**Real hosted in this phase:** function/ACL/policy/trigger/role/history inspection and unchanged final counts/grants only. **Not performed after these fixes:** hosted Auth provisioning, actual owner JWT login, a second user's JWT rejection, actual image/video bytes through Storage, signed-preview requests or a hosted application save/approve workflow. P1/P2 are not installed on the hosted project, so such tests could not establish post-fix hosted behavior without violating the current approval boundary.

The previous committed live verification proved owner login, campaign/draft reload persistence, approval transitions/edit invalidation and synthetic image upload/preview/removal **before** P1/P2. See [LIVE_VERIFICATION_REPORT.md](supabase/LIVE_VERIFICATION_REPORT.md). It supports the unchanged baseline only. Local SQL permission tests plus the independent mocked UI tests are not a single end-to-end Supabase service test.

P2's principal residual risk is actual Auth service integration: PostgreSQL's local trigger execution remains operational after execute revocation, but minimal Auth scaffolding cannot prove GoTrue's full transaction and operational behavior. The current read-only evidence shows the live Auth table owner; no live signup was attempted. Any future hosted test account and cleanup require separate approval. Neither patch changes owner roles, profile data, function bodies, trigger bindings, Storage policies or Auth configuration.

## Recovery and release procedure — approval required

1. Review the exact four files/hashes and the recorded limitations. Refresh production definitions, all relevant policy/trigger bindings, ACLs, inherited roles, counts and backups immediately before approved execution. Abort on drift or unexpected dependencies. Confirm the rollback files still match the intended post-patch state.
2. Keep private copies of the fresh schema/ACL capture, protected record backup and patch hashes. P1/P2 do not mutate records; their tested recovery is scoped security-metadata restoration. This is not a complete shared-project disaster restore and does not back up Auth secrets or Storage file bytes. A future destructive proposal must stop if complete reliable recovery is unavailable.
3. If explicitly approved, apply **P1 only first**, in its transaction. Verify intended ACLs/policy targets and actual owner/non-owner/anonymous application behavior. Authenticated owner authorization and existing Storage policies must remain operational. Stop if any regression occurs; do not continue to P2.
4. Apply **P2 only after P1 acceptance**, if approved. Keep Auth service monitoring and owner access checks available. Hosted new-user provisioning requires an explicitly approved synthetic-account test; never alter the existing owner account to test bootstrap behavior.
5. On an approved recovery, reverse **P2 then P1** using the corresponding guarded rollback files. Rollbacks restore captured PUBLIC/browser grants and policy targets; they therefore restore previous exposure as well as functionality. ACL array ordering may differ, but all restored grants/grantors/options and effective permissions were checked locally. No row deletion, credential reset, trigger disabling or original schema rollback is needed.
6. If a rollback guard fails, stop and inspect the changed state. Do not issue GRANT ALL, drop/recreate functions or bypass guards. Obtain a revised exact recovery plan/approval. A failed transaction is atomic; if using a persistent SQL session, explicitly roll it back before further investigation.
7. After acceptance, review advisor results. P1 should clear the anonymous helper warning but retain its necessary authenticated-helper warning; P2 should clear its two browser-execution warnings. Other packages and the Free-plan password warning are outside this approval scope.

No production execution or history registration command is authorized by the current request. Any later execution/history bookkeeping must be separately approved. New live write tests and cleanup are not implied by approval of ACL changes alone.

## Migration-history baseline proposal

Fresh history still records only `20261015002801_reconcile_existing_cobs_workspace`, 34 statements. The older local reference versions remain unrecorded and differ from manually installed definitions. No historical migration was applied or registered. No db push, db reset or migration repair was run.

[BASELINE_PROPOSAL.md](supabase/security-proposals/BASELINE_PROPOSAL.md) provides the reproducible scoped fixture and a complete-baseline preparation process: export and verify recovery of all relevant shared-project definitions/data, produce an explicit historical-statement map, propose archival and truthful version mapping, rehearse fresh install and existing-state transition, and obtain approval for exact files/bookkeeping. The existing COBS fixture and recovery rehearsal do not prove full-project restore. Full shared-project recovery, unrelated dependencies and an approved history map remain blockers to automatic migration deployment. Do not put P1/P2 into an unfiltered pending migration push to bypass them.

## Files changed/prepared

- Four SQL files under `supabase/security-proposals/`: separate forward/reverse patches.
- `supabase/security-proposals/BASELINE_PROPOSAL.md`: reproducibility and baseline plan.
- `tests/security-fixes.test.ts`: seven targeted permission, compatibility and recovery tests.
- `tests/fixtures/cobs-security-schema.json` and `cobs-security-acls.json`: definition-only fresh captures.
- `tests/helpers/existing-schema.ts`: optional supplied snapshot; existing callers preserve original behavior.
- This report. The earlier security review and local `.vscode/` settings remain untouched.

All work remains local and uncommitted on the development branch. No paid tooling or additional hosted project was used.

## References

[Supabase function privileges](https://supabase.com/docs/guides/database/functions), [PostgreSQL 17 trigger creation](https://www.postgresql.org/docs/17/sql-createtrigger.html), [Supabase Storage RLS](https://supabase.com/docs/guides/storage/security/access-control). These explain privilege boundaries; the pass results above come from executed tests, not documentation claims.

## Appendix A — exact proposed SQL and rollback

### p1.sql

```sql
-- REVIEW PROPOSAL ONLY. No production execution authorized.
-- Captured 2026-10-15 from ldnyctzrgcpcjmhnrpms; abort on drift.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $guard$ begin
 if not exists(select 1 from pg_proc where oid='public.cobs_is_owner()'::regprocedure and pg_get_userbyid(proowner)='postgres' and md5(pg_get_functiondef(oid))='fa0ba4c24e7295672568d8c9f2c6f360' and proacl @> array['=X/postgres'::aclitem,'postgres=X/postgres'::aclitem,'anon=X/postgres'::aclitem,'authenticated=X/postgres'::aclitem,'service_role=X/postgres'::aclitem] and proacl <@ array['=X/postgres'::aclitem,'postgres=X/postgres'::aclitem,'anon=X/postgres'::aclitem,'authenticated=X/postgres'::aclitem,'service_role=X/postgres'::aclitem]) then
  raise exception 'Function definition/owner/ACL drift: cobs_is_owner; stop and recapture';
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='cobs_campaigns' and policyname='owner manages COBS campaigns' and roles=array['public']::name[] and cmd='ALL' and permissive='PERMISSIVE' and qual='cobs_is_owner()' and with_check='cobs_is_owner()') then raise exception 'Policy drift: owner manages COBS campaigns'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='cobs_leads' and policyname='owner manages COBS leads' and roles=array['public']::name[] and cmd='ALL' and permissive='PERMISSIVE' and qual='cobs_is_owner()' and with_check='cobs_is_owner()') then raise exception 'Policy drift: owner manages COBS leads'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='cobs_posts' and policyname='owner manages COBS posts' and roles=array['public']::name[] and cmd='ALL' and permissive='PERMISSIVE' and qual='cobs_is_owner()' and with_check='cobs_is_owner()') then raise exception 'Policy drift: owner manages COBS posts'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='cobs_media_assets' and policyname='owner manages cobs media assets' and roles=array['public']::name[] and cmd='ALL' and permissive='PERMISSIVE' and qual='cobs_is_owner()' and with_check='cobs_is_owner()') then raise exception 'Policy drift: owner manages cobs media assets'; end if;
end $guard$;
alter policy "owner manages COBS campaigns" on public."cobs_campaigns" to authenticated;
alter policy "owner manages COBS leads" on public."cobs_leads" to authenticated;
alter policy "owner manages COBS posts" on public."cobs_posts" to authenticated;
alter policy "owner manages cobs media assets" on public."cobs_media_assets" to authenticated;
revoke execute on function public.cobs_is_owner() from public, anon;
commit;
```

### p2.sql

```sql
-- REVIEW PROPOSAL ONLY. No production execution authorized.
-- Captured 2026-10-15 from ldnyctzrgcpcjmhnrpms; abort on drift.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $guard$ begin
 if not exists(select 1 from pg_proc where oid='public.cobs_new_user_profile()'::regprocedure and pg_get_userbyid(proowner)='postgres' and md5(pg_get_functiondef(oid))='f4129b6ac0c5f00c1f440b005ebbdb16' and proacl @> array['=X/postgres'::aclitem,'postgres=X/postgres'::aclitem,'anon=X/postgres'::aclitem,'authenticated=X/postgres'::aclitem,'service_role=X/postgres'::aclitem] and proacl <@ array['=X/postgres'::aclitem,'postgres=X/postgres'::aclitem,'anon=X/postgres'::aclitem,'authenticated=X/postgres'::aclitem,'service_role=X/postgres'::aclitem]) then
  raise exception 'Function definition/owner/ACL drift: cobs_new_user_profile; stop and recapture';
 end if;

end $guard$;
revoke execute on function public.cobs_new_user_profile() from public, anon, authenticated;
commit;
```

### p2.rollback.sql

```sql
-- REVIEW PROPOSAL ONLY. No production execution authorized.
-- Captured 2026-10-15 from ldnyctzrgcpcjmhnrpms; abort on drift.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $guard$ begin
 if not exists(select 1 from pg_proc where oid='public.cobs_new_user_profile()'::regprocedure and pg_get_userbyid(proowner)='postgres' and md5(pg_get_functiondef(oid))='f4129b6ac0c5f00c1f440b005ebbdb16' and proacl @> array['postgres=X/postgres'::aclitem,'service_role=X/postgres'::aclitem] and proacl <@ array['postgres=X/postgres'::aclitem,'service_role=X/postgres'::aclitem]) then
  raise exception 'Function definition/owner/ACL drift: cobs_new_user_profile; stop and recapture';
 end if;

end $guard$;
grant execute on function public.cobs_new_user_profile() to public, anon, authenticated;
commit;
```

### p1.rollback.sql

```sql
-- REVIEW PROPOSAL ONLY. No production execution authorized.
-- Captured 2026-10-15 from ldnyctzrgcpcjmhnrpms; abort on drift.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $guard$ begin
 if not exists(select 1 from pg_proc where oid='public.cobs_is_owner()'::regprocedure and pg_get_userbyid(proowner)='postgres' and md5(pg_get_functiondef(oid))='fa0ba4c24e7295672568d8c9f2c6f360' and proacl @> array['postgres=X/postgres'::aclitem,'authenticated=X/postgres'::aclitem,'service_role=X/postgres'::aclitem] and proacl <@ array['postgres=X/postgres'::aclitem,'authenticated=X/postgres'::aclitem,'service_role=X/postgres'::aclitem]) then
  raise exception 'Function definition/owner/ACL drift: cobs_is_owner; stop and recapture';
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='cobs_campaigns' and policyname='owner manages COBS campaigns' and roles=array['authenticated']::name[] and cmd='ALL' and permissive='PERMISSIVE' and qual='cobs_is_owner()' and with_check='cobs_is_owner()') then raise exception 'Policy drift: owner manages COBS campaigns'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='cobs_leads' and policyname='owner manages COBS leads' and roles=array['authenticated']::name[] and cmd='ALL' and permissive='PERMISSIVE' and qual='cobs_is_owner()' and with_check='cobs_is_owner()') then raise exception 'Policy drift: owner manages COBS leads'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='cobs_posts' and policyname='owner manages COBS posts' and roles=array['authenticated']::name[] and cmd='ALL' and permissive='PERMISSIVE' and qual='cobs_is_owner()' and with_check='cobs_is_owner()') then raise exception 'Policy drift: owner manages COBS posts'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='cobs_media_assets' and policyname='owner manages cobs media assets' and roles=array['authenticated']::name[] and cmd='ALL' and permissive='PERMISSIVE' and qual='cobs_is_owner()' and with_check='cobs_is_owner()') then raise exception 'Policy drift: owner manages cobs media assets'; end if;
end $guard$;
grant execute on function public.cobs_is_owner() to public, anon;
alter policy "owner manages COBS campaigns" on public."cobs_campaigns" to public;
alter policy "owner manages COBS leads" on public."cobs_leads" to public;
alter policy "owner manages COBS posts" on public."cobs_posts" to public;
alter policy "owner manages cobs media assets" on public."cobs_media_assets" to public;
commit;
```
