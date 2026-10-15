# COBS BUILDMASTERS Supabase Security Review

**Review date:** 15 October 2026 (UTC). **Status:** read-only audit and proposed remediation; nothing applied.

**Existing project:** `ldnyctzrgcpcjmhnrpms` � berica868@gmail.com's Project. **Repository branch:** `develop/dashboard-media`, inspected commit `68d0eaedc0f43a21c611debb91bb0f40b593f707`.

## 1. Executive assessment

A fresh official CLI advisor retrieval returned exactly **15 WARN findings**, no ERROR findings. Based on inspected definitions and current dependencies, this review assigns **0 Critical, 0 High, 3 Medium and 12 Low** findings. This is a scoped assessment, not a guarantee that the whole shared project has no other vulnerabilities. Four warnings concern COBS functions, ten concern other functions (including a shared safeguard), and one concerns project-wide Auth.

The immediate recommendation is narrowly scoped execute-grant hardening after dependency tests and explicit approval. Several authenticated function grants are necessary for existing RLS or a guarded approval endpoint; retaining those warnings with documented justification is safer than blindly removing permissions. Leaked-password protection currently requires Pro or above according to the official documentation; preserve the existing Free project and accept/document this residual warning unless the owner separately authorizes a different decision. No subscription purchase is proposed.

## 2. Evidence and scope

Official Supabase CLI 2.121.0, existing authorized connection. Fresh evidence is stored privately under ignored `.tools/security-audit-20261015/`: `advisors.json`, `schema.json`, `functions.json`, `inspection.json`, `rls-check.json`, and the official changelog index. No password, secret API key, Auth session or token was exported. Queries read function definitions, policies, grants, counts, owner-confirmation status and migration history; no company-record contents were needed. Catalog inspection used a read-only transaction; separate schema/function SELECTs were read-only as well.

Live snapshot: one COBS profile, zero COBS campaigns/posts/leads/media assets and zero COBS Storage objects. The owner's Auth email is confirmed and the matching profile has the owner role. All five COBS tables have RLS enabled. Anonymous and synthetic unowned identity read assertions passed; owner role lookup passed in a read-only hosted transaction. Claims in these SQL assertions are simulation, not real second-user JWT authentication.

The prior real owner application round trips and approved test cleanup are documented in [LIVE_VERIFICATION_REPORT.md](supabase/LIVE_VERIFICATION_REPORT.md). They are prior-phase evidence, not newly repeated write tests. No production writes, migrations, history repair, configuration changes, commits, pushes, merges or deployments occurred in this audit.

## 3. Finding register

Each row is one distinct advisor finding; the exact retrieved wording follows in Appendix A. Remediation packages P1�P7 below specify effects, testing and reversal for every row.

| ID  | Assessed severity | Granted role  | Component                    | Application scope         | Plan | Approval required      |
| --- | ----------------- | ------------- | ---------------------------- | ------------------------- | ---- | ---------------------- |
| F01 | Medium            | anon          | public.approve_post          | Unrelated application     | P3   | Yes, before any change |
| F02 | Low               | anon          | public.cobs_is_owner         | COBS                      | P1   | Yes, before any change |
| F03 | Low               | anon          | public.cobs_new_user_profile | COBS                      | P2   | Yes, before any change |
| F04 | Low               | anon          | public.enforce_post_version  | Unrelated application     | P4   | Yes, before any change |
| F05 | Low               | anon          | public.is_owner              | Unrelated application     | P5   | Yes, before any change |
| F06 | Low               | anon          | public.rls_auto_enable       | Shared database safeguard | P6   | Yes, before any change |
| F07 | Low               | anon          | public.same_org              | Unrelated application     | P5   | Yes, before any change |
| F08 | Medium            | authenticated | public.approve_post          | Unrelated application     | P3   | Yes, before any change |
| F09 | Low               | authenticated | public.cobs_is_owner         | COBS                      | P1   | Yes, before any change |
| F10 | Low               | authenticated | public.cobs_new_user_profile | COBS                      | P2   | Yes, before any change |
| F11 | Low               | authenticated | public.enforce_post_version  | Unrelated application     | P4   | Yes, before any change |
| F12 | Low               | authenticated | public.is_owner              | Unrelated application     | P5   | Yes, before any change |
| F13 | Low               | authenticated | public.rls_auto_enable       | Shared database safeguard | P6   | Yes, before any change |
| F14 | Low               | authenticated | public.same_org              | Unrelated application     | P5   | Yes, before any change |
| F15 | Medium            | project Auth  | Leaked-password protection   | All password users        | P7   | Yes, before any change |

## 4. Security interpretation common to F01�F14

SECURITY DEFINER executes with the function owner's privileges, here `postgres`, which can bypass table RLS. Execution therefore needs both narrow grants and a correctly scoped function body. All seven inspected functions have direct anon/authenticated grants **and** a PUBLIC execute grant. Revoking only a direct anon grant is ineffective while PUBLIC still grants it. The live anon/authenticated roles cannot CREATE objects in public; this reduces search-path substitution risk. Every flagged function has a fixed search path; the event trigger uses pg_catalog, the other six use public.

A trigger-returning function is not an ordinary callable RPC even though the advisor describes an RPC route. Trigger/event-trigger context is required. Those six role findings chiefly represent unnecessary grants and future attack surface, not proof that an anonymous user can invoke the trigger's record mutations directly. Do not turn all functions into SECURITY INVOKER: this could break protected profile creation or organization authorization helpers. Do not issue blanket revocations across the public schema or change default grants for the shared project without a separate review.

## 5. Remediation packages (PROPOSALS ONLY)

### P1 — COBS owner helper: F02 and F09

**Problem and actual impact:** `cobs_is_owner()` runs a privileged profile lookup but returns only whether the current `auth.uid()` is an owner. It accepts no caller-supplied user ID. Anonymous callers obtain false; authenticated non-owners obtain false. No arbitrary profile disclosure or owner escalation was found. F02 and F09 are Low. Four marketing-table policies, three COBS Storage policies and the approval trigger depend on this helper.

**Safest fix:** remove anonymous/PUBLIC execution while retaining authenticated execution and the existing authorization predicate. In the same reviewed transaction, target the four existing marketing policies to authenticated callers. Preserve their USING/WITH CHECK expressions and operation type. This changes who may evaluate the policy, not which authenticated user owns the workspace. The self-profile SELECT policy does not invoke the helper and need not change.

```sql
-- PROPOSAL P1 ONLY — do not execute before approval and rehearsal.
begin;
alter policy "owner manages COBS campaigns" on public.cobs_campaigns to authenticated;
alter policy "owner manages COBS leads" on public.cobs_leads to authenticated;
alter policy "owner manages COBS posts" on public.cobs_posts to authenticated;
alter policy "owner manages cobs media assets" on public.cobs_media_assets to authenticated;
revoke execute on function public.cobs_is_owner() from public, anon;
grant execute on function public.cobs_is_owner() to authenticated;
commit;
```

**Effects/risk:** no row changes, no owner role changes, no Storage policy changes. Incorrectly revoking authenticated execution would break all owner operations and media reads. F02 should disappear; F09 intentionally remains because RLS needs authenticated execution. Do not move the helper to a private schema or switch to INVOKER in this first patch. Either requires a separate dependency/body review and exact SQL proposal.

**Test/reverse:** validate ACLs, owner/non-owner/anonymous table and Storage requests, owner approval workflow and member profile self-read. Reverse policy targets to PUBLIC and restore the captured PUBLIC/anon execute grants if required, in one approved transaction. Authentication role execution stays intact throughout. **Approval: required.**

### P2 — COBS Auth provisioning trigger: F03 and F10

**Problem and actual impact:** unnecessary browser grants on `cobs_new_user_profile()`, an AFTER INSERT trigger on `auth.users`. Its body creates a profile for NEW.id and chooses owner/member from NEW.email; ordinary RPC calls cannot supply trigger context. Both findings are Low. Provisioning affects new authentication users across this shared project, even though the destination table is COBS.

```sql
-- PROPOSAL P2 ONLY.
revoke execute on function public.cobs_new_user_profile()
  from public, anon, authenticated;
```

**Effects/risk:** existing profiles/roles remain unchanged; trigger stays enabled and SECURITY DEFINER. Owner/postgres/service_role grants are preserved. Rehearse actual Auth service provisioning; a role-dependent failure could prevent signups across the project. PostgreSQL requires execute privilege when creating a trigger; do not drop/recreate the Auth trigger as part of grant cleanup. Verify its existing runtime behavior on the supported server rather than assuming ACL changes are harmless.

**Test/reverse:** in an isolated compatible environment, new member registration creates exactly one member profile, repeat handling remains idempotent, owner-email behavior remains unchanged, and direct trigger RPC cannot mutate records. Creating/removing a live Auth test user needs separate approval. Restore captured grants to PUBLIC, anon and authenticated if regression occurs. **Approval: required.**

### P3 — Unrelated approval RPC: F01 and F08

**Problem and actual impact:** `approve_post(uuid)` updates unrelated `public.posts` and inserts `public.approvals` as postgres. It checks `is_owner(p.organization_id)` before mutation, so no bypass was established. However, every anonymous/signed-in caller reaches privileged code, and its SELECT FOR UPDATE happens before authorization. Potential lock contention/error timing and future guard regressions justify Medium for both findings. This is not the COBS approval implementation. A failed RPC transaction rolls back; persistent lock abuse has not been demonstrated.

```sql
-- PROPOSAL P3 ONLY; needs the unrelated application's maintainer approval.
revoke execute on function public.approve_post(uuid) from public, anon;
grant execute on function public.approve_post(uuid) to authenticated;
```

**Safest first fix:** remove anonymous execution, preserve the guarded authenticated endpoint. F01 should clear; F08 remains an intentional authenticated privileged endpoint. Do not blindly change it to INVOKER or remove authenticated execution. Guard-before-lock redesign may be worthwhile, but requires the other application's transaction/concurrency requirements and a separately reviewed CREATE OR REPLACE body; it is not included in this ACL patch.

**Effects/risk/test:** no records are rewritten by these grant statements. Anonymous clients that improperly rely on the RPC will fail. In isolated tests, owner approval must update the correct version and audit row; same-org member, cross-org owner, missing JWT and invalid post IDs must not update records. Check rejection does not leave a committed lock or audit row. Preserve unrelated data and all organization policies. Restore PUBLIC/anon grants from snapshot if rollback is approved. **Approval: required from project owner and unrelated application maintainer.**

### P4 — Unrelated post-version trigger: F04 and F11

**Problem and actual impact:** unnecessary execute grants on `enforce_post_version()`, a trigger on unrelated posts. It changes NEW version/approval fields, not caller-selected rows; ordinary RPC invocation cannot supply trigger context. Both findings are Low.

```sql
-- PROPOSAL P4 ONLY; unrelated application scope.
revoke execute on function public.enforce_post_version()
  from public, anon, authenticated;
```

**Effects/risk/test:** no existing post changes, but future post edits depend on trigger execution. In isolated tests, caption/platform edits increment current_version and clear approved_version; Approved/Scheduled content returns to Draft and updated_at changes. Unchanged edits preserve intended version behavior. Preserve the trigger and SECURITY DEFINER until the other application's maintainer reviews whether INVOKER is sufficient. Regrant the three captured roles on regression. **Approval: required; unrelated maintainer sign-off.**

### P5 — Unrelated organization helpers: F05/F12 and F07/F14

**Problem and actual impact:** `is_owner(uuid)` and `same_org(uuid)` read the current caller's organization profile as postgres. Arguments choose an organization, not a different user's identity. Both return bounded booleans. All four findings are Low. Helpers serve unrelated table policies; same_org also serves the three campaign-media Storage policies. Stored PL/pgSQL/string SQL calls may not appear in pg_depend: review function bodies and external RPC clients as well as catalog dependencies.

```sql
-- PROPOSAL P5 ONLY; separate unrelated-maintainer approval required.
begin;
alter policy "members read organization" on public."organizations" to authenticated;
alter policy "members access brand records" on public."brand_records" to authenticated;
alter policy "members access media" on public."media_assets" to authenticated;
alter policy "members access campaigns" on public."campaigns" to authenticated;
alter policy "members access posts" on public."posts" to authenticated;
alter policy "members access versions" on public."post_versions" to authenticated;
alter policy "members read approvals" on public."approvals" to authenticated;
alter policy "owners control accounts" on public."social_accounts" to authenticated;
alter policy "owners manage jobs" on public."publish_jobs" to authenticated;
alter policy "members read analytics" on public."analytics_snapshots" to authenticated;
alter policy "members manage leads" on public."leads" to authenticated;
alter policy "owners read audit" on public."audit_logs" to authenticated;
revoke execute on function public.is_owner(uuid) from public, anon;
grant execute on function public.is_owner(uuid) to authenticated;
revoke execute on function public.same_org(uuid) from public, anon;
grant execute on function public.same_org(uuid) to authenticated;
commit;
```

**Effects/risk:** no row mutations; authenticated execution remains necessary. The fresh dependency inventory identified exactly 12 unrelated public-table policies targeted to PUBLIC; the block above retargets only those named policies without changing their predicates or operation types. Three campaign-media Storage policies already target authenticated and need no change. External clients and logical function-body callers still require maintainer confirmation before release. F05/F07 should clear; F12/F14 remain justified authenticated helper grants. Private-schema relocation is a later optional design. Rollback must also restore these 12 targets to PUBLIC.

**Test/reverse:** owner/member/cross-org/anonymous policy matrix for every dependent table, the guarded approval RPC, and upload/read/delete for campaign-media; preserve COBS bucket isolation. Restore captured PUBLIC/anon grants and any separately approved policy targets if regression occurs. **Approval: required; unrelated maintainer sign-off.**

### P6 — Shared RLS event trigger: F06 and F13

**Problem and actual impact:** unnecessary browser execution grants on `rls_auto_enable()`, an event-trigger function bound to enabled `ensure_rls`. It uses pg_catalog search path and identifier quoting to enable RLS on new public tables. It cannot be invoked as an ordinary RPC. Both findings are Low. It is a database-wide safeguard, not a COBS feature.

```sql
-- PROPOSAL P6 ONLY; administrator must verify provenance and execution roles.
revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;
```

**Effects/risk/test:** no current table or record changes. Future DDL must still automatically enable RLS. Do not disable/drop ensure_rls or convert the function to INVOKER. Rehearse CREATE TABLE, CREATE TABLE AS, and SELECT INTO under each authorized migration role in an isolated PostgreSQL instance and check resulting relrowsecurity. Also check skip behavior for non-public schemas. No test table is to be created on production in this phase. Regrant the captured three browser/PUBLIC entries if approved rollback is needed. **Approval: required from project administrator.**

### P7 — Password protection: F15

**Problem/impact:** leaked-password screening is disabled project-wide. A reused compromised password increases account-takeover risk, including takeover of the sole marketing owner. Medium; this does not establish that the owner's password is compromised.

**Specific configuration:** Supabase Dashboard → Authentication → password security settings → enable leaked-password protection. This is an Auth configuration change, not SQL. Current [official documentation](https://supabase.com/docs/guides/auth/password-security) restricts this feature to Pro and above. On this existing Free project, **do not enable a subscription or propose a silent paid fix**. Record the warning as accepted/pending and recommend a unique password managed by the owner. MFA enrollment and requiring an elevated authentication assurance level are separate optional, explicitly approved changes; enrollment alone does not make current app routes enforce MFA.

**Effects/risk/test:** enabling the feature can affect new registrations, password updates and weak-password handling, across every application using this Auth project. It does not rewrite marketing records. Any later approved change must test strong/known-compromised test passwords only in a disposable local/test environment, existing owner login, password change/recovery and the application's error handling. Never collect passwords in chat. Capture the prior setting and reverse only that setting if a rollback is authorized; never reset user passwords or alter user roles as rollback. **Approval: required for any Auth configuration change; a paid change is outside current authorization.**

## 6. COBS security controls reviewed

| Component                                                 | Live/code evidence                                                                                                                                                                             | Assessment and residual risk                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| cobs_campaigns, cobs_leads, cobs_posts, cobs_media_assets | RLS on; one ALL policy each, USING and WITH CHECK cobs_is_owner(), targeted to PUBLIC                                                                                                          | Owner check is present. Propose authenticated-only policy targeting in P1; do not change ownership semantics.                                                                                                                                                                                                                                          |
| cobs_profiles                                             | RLS on; only SELECT policy, id = auth.uid()                                                                                                                                                    | A member can read their own profile, not marketing data. Despite its name, this is self-read, not owner-only. No browser INSERT/UPDATE/DELETE policy: clients cannot promote themselves.                                                                                                                                                               |
| Browser table grants                                      | Both roles hold SELECT/INSERT/UPDATE/DELETE; no TRUNCATE/TRIGGER/REFERENCES entries in inspected grants                                                                                        | RLS denies unauthorized row operations. Anonymous table-grant reduction and removing unused profile DML grants are optional defense-in-depth, not necessary to resolve these 15 findings; require a separate exact grant review.                                                                                                                       |
| RLS bypass boundary                                       | FORCE RLS false on five tables                                                                                                                                                                 | Ordinary browser roles remain subject to RLS. Table owners/service roles can bypass it by design; do not use those credentials in the browser. No FORCE RLS change proposed.                                                                                                                                                                           |
| Approval enforcement                                      | Enabled cobs_post_approval_guard on INSERT/UPDATE; invoker function checks owner; inserts become Draft; transitions checked; author immutable; approval actor/time assigned from current owner | UI restrictions are backed by database checks. Title/body/media/campaign/source edits clear approval and scheduling. No external publishing integration exists; Scheduled is manual readiness only.                                                                                                                                                    |
| Media metadata                                            | Immutable storage path/type/size/author guard; deletion reservation refuses attached records; post guard checks/locks available media                                                          | Existing controls limit replacement/removal races. Rehearse concurrent attach/remove and direct Storage deletion before any future changes.                                                                                                                                                                                                            |
| Private cobs-media bucket                                 | public=false; 50 MiB limit; JPEG/PNG/WebP/MP4/QuickTime                                                                                                                                        | SELECT requires authenticated owner; INSERT also requires owner-prefixed path; DELETE requires owner and no referencing post. No UPDATE policy: overwrite/upsert is intentionally unavailable. Three unrelated campaign-media policies are bucket-scoped and preserved.                                                                                |
| Preview URLs                                              | App creates signed URLs valid for 3,600 seconds; completion validation uses a 60-second signed URL                                                                                             | A signed link is a bearer capability: anyone holding it can read until expiry. Private does not mean an already issued signed URL requires a new login on every fetch. Do not log/share signed links; shorter preview expiry is an optional UX/security change requiring approval.                                                                     |
| Server APIs                                               | /api/media and /api/generate call requireOwner; server validates bearer with Auth getUser, then checks cobs_profiles role; uses public project key with caller JWT                             | No service-role bypass found in these routes. Missing/invalid user rejected; authorization is based on database role, not editable user_metadata. Fresh live getUser validates token/user, not necessarily immediate revocation of every existing access token/session. Session/aal controls need separate design if stronger guarantees are required. |
| Media server validation                                   | Owner-path check; declared type/size checked against stored info; file magic bytes checked; campaign FK validated on metadata insert; discard refuses registered media                         | Server checks and Storage RLS both matter. Read-only review cannot replace adversarial end-to-end upload tests; direct authenticated owner access is privileged by design.                                                                                                                                                                             |
| Auth provisioning                                         | Existing owner email confirmed; trigger assigns role by configured email; frontend permits sign-up                                                                                             | Current project-wide confirmation, signup, rate-limit, CAPTCHA, MFA and session settings were not fully retrieved in this audit. Confirm these securely before changing provisioning. Owner email assignment is a sensitive bootstrap convention; never change it or reassign existing owners as part of grant cleanup.                                |

No critical/high bypass was established in this scope. No claim is made about all unrelated tables, extensions, external clients, deployments or full-project Auth configuration. CSP/XSS hardening, API rate limits and compromised-session response are follow-up topics, not among the 15 retrieved advisor findings.

## 7. Exact implementation order and approval gates

### Additional discoveries outside the 15 advisor findings

**A01 — High design risk, unrelated direct-table approval path.** The unrelated `public.posts` has authenticated UPDATE privilege and a members-access ALL policy based on same_org. Its only non-internal trigger, posts_version_guard, clears approval when caption/platform changes but does not check an owner's role on status-only updates or approval-version edits. Its inspected constraints are primary/foreign keys, not an approval guard. Therefore the inspected database controls permit a same-organization member to attempt direct status/approved_version changes without using the owner-checked approve_post RPC. This is a structural authorization gap if that application's approval is intended to be owner-only; no existing row was changed to demonstrate it, and no external publication impact was tested. It does **not** affect cobs_posts, which has a distinct owner-only policy and transition guard.

The unrelated maintainer should first confirm the intended role model, then prepare an invoker BEFORE INSERT/UPDATE approval guard or a least-privilege column/RPC design covering direct REST writes, owner attribution, version integrity, editing invalidation and publish_jobs eligibility. Revoking anonymous RPC access alone will not fix this path. Exact guard SQL needs that application's requirements and a separate review; do not copy the COBS trigger onto a different schema. Tests must include a member's direct status-only and approved_version updates, inserts with Approved status, owner approval and scheduling. Preserve existing rows; rehearse and reverse the new guard using its captured prior definition. **Approval required; this concern should be triaged before claiming the unrelated application is secure.**

**A02 — Medium, potentially High impact if SQL execution is exposed, unrelated broad grants.** Fresh catalog inspection confirms authenticated TRUNCATE, TRIGGER and REFERENCES on unrelated public.posts. RLS does not restrict TRUNCATE. Standard REST row operations do not directly expose TRUNCATE/CREATE TRIGGER, so these grants alone do not prove a browser can delete the table's records. They become dangerous if a permitted SQL/RPC/connection path exposes those operations. Proposed separate hardening, after caller/role review: `REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.posts FROM authenticated;`. Inspect PUBLIC/anon/inherited grants too before declaring effective privilege removal. Test ordinary DML still works and has_table_privilege is false for unwanted operations; reverse only captured grants if approved. No unrelated grant was changed. COBS tables already had these capabilities removed in the previously approved migration.

The severity totals in the finding register cover exactly the 15 advisor entries and exclude A01/A02. These additional concerns increase the importance of separate unrelated-application review; they are not a reason to broaden the COBS patch without approval.

1. **Before any change:** approve the intended scope, freeze concurrent security/migration edits, refresh definitions/ACLs/dependencies and compare their hashes to this evidence. Abort on drift. Obtain the unrelated application's maintainer approval for P3–P6.
2. **Recovery gate:** save exact ACLs, policy definitions/targets, function bodies/owners/search paths, trigger bindings, counts and a private verified backup of affected records. Rehearse scoped restoration locally. Existing COBS recovery evidence does not cover every unrelated application. If a package lacks reliable recovery, stop that package.
3. **Offline validation:** reconstruct compatible PostgreSQL/Auth/Storage roles and the inspected schema locally. Test P1 and P2 separately, then together. Prepare CLI-generated migration files only when implementation is authorized; do not invent or register versions during this report phase.
4. **Present final patch and rollback hashes for approval:** P1 first, P2 second, as separate narrowly scoped transactions/migrations. Keep caller ownership rules and owner profile unchanged. Do not run db push while historical alignment is unresolved; execution/history registration need explicit approval.
5. **After approved P1:** verify role ACLs/table RLS, owner API access, approval and Storage flows. Stop/roll back on regression before proceeding to P2. After P2, verify Auth provisioning in the approved test environment and owner login continuity.
6. **Unrelated work only after separate sign-off:** confirm the captured P5 dependency inventory and external clients; then apply P3, reviewed P5, P4 and P6 in that order with tests and recovery between packages. The SQL in P5 remains conditional until exact dependent-policy treatment is reviewed.
7. **P7:** keep documented as a Free-plan residual warning. Any alternative Auth hardening requires a separate configuration proposal and approval, without purchasing anything.
8. **Post-remediation:** rerun advisor and the complete validation matrix. If all seven anonymous grants and three trigger/event-trigger authenticated grants are safely removed, expect ten warnings to clear. Four intentionally authenticated SECURITY DEFINER warnings plus the Free-plan password warning may remain. Treat unexpected findings/count changes as a review signal, not a reason for broad automatic fixes.
9. **Documentation/history:** register only approved changes whose SQL actually ran, after the approved alignment strategy. Commit tested work locally only when requested/authorized; no merge, push or deployment is part of this audit.

## 8. Required validation plan

These are prepared acceptance tests, **not claims that proposed fixes have already passed**. Run mutations against isolated fixtures first. Hosted write tests require explicit approval of unique temporary records/users and a separate exact cleanup approval; never use company content as fixtures. Capture IDs and compare existing records privately before/after.

| Test                                     | Actor/action                                                                                                                               | Required outcome                                                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V01 ACL and RLS                          | Inspect has_function_privilege for anon/authenticated/service roles; all five relrowsecurity flags and policy predicates                   | Only intended roles execute each function; RLS stays enabled; no new broad policy or owner-role change                                                                    |
| V02 Unauthorized APIs                    | No token, malformed/expired JWT, valid non-owner JWT to both server APIs                                                                   | 401 for absent/invalid identity; 403 for authenticated non-owner; zero provider calls or prepared uploads                                                                 |
| V03 Owner workspace                      | Real owner JWT; create labelled campaign/draft, reload and retrieve                                                                        | Saved values persist, no unrelated records modified                                                                                                                       |
| V04 Direct table attacks                 | anon/member direct REST select/insert/update/delete against marketing fixtures; attempt profile-role update                                | Denied or zero rows; no profile promotion or company data exposure. Member self-profile read remains allowed                                                              |
| V05 Approval                             | Owner submit→reject→resubmit→approve; edit approved text/media/campaign/source; insert Approved; attempt Draft→Scheduled                   | Owner attribution recorded; edits reset approval; insert becomes Draft; invalid transitions denied                                                                        |
| V06 Unauthorized approval/publishing     | Valid non-owner JWT, anonymous caller and cross-org actor against COBS fixtures and unrelated approve_post RPC                             | No approval/status/audit mutation. No external publication without owner approval; current app has no publisher. Reaudit if a publisher is later added                    |
| V07 Storage privacy                      | Anonymous public-object URL; member download/list/sign; owner signed preview; expired signed URL                                           | Raw/private access denied, member cannot sign/read; owner preview works; expired link fails. A valid signed URL working without a session is expected capability behavior |
| V08 Upload validation                    | Owner small synthetic image; wrong prefix, unsupported type, forged magic bytes/size, oversized object                                     | Valid file registers/previews; invalid operations fail without registered orphan records; no company media used                                                           |
| V09 Media lifecycle                      | Remove unused synthetic asset; attempt attached delete and overwrite; concurrent attach/removal                                            | Owner unused removal succeeds, attached deletion/overwrite denied; no dangling post reference or lost business media                                                      |
| V10 Trigger compatibility                | Member Auth provisioning, unrelated post edit, isolated CREATE TABLE/AS/SELECT INTO                                                        | Correct member profile, preserved version invalidation and automatic RLS. No production DDL test tables or Auth users without approval                                    |
| V11 Organization isolation               | Other application's owner/member/cross-org accounts; all dependent policies and campaign-media lifecycle                                   | Existing authorized operations pass, cross-org access denied, COBS unaffected                                                                                             |
| V12 Preservation/recovery                | Privately compare record IDs/content hashes, constraints, policy targets, enabled triggers and Storage object inventory; rehearse rollback | Business records and unrelated definitions unchanged except explicitly approved security metadata; rollback restores the captured state                                   |
| V13 Application regression               | npm test; npm run test:e2e; npm run typecheck; npm run format:check; npm run build                                                         | All pass; mocked, local PostgreSQL and actual hosted evidence clearly separated                                                                                           |
| V14 Password settings (if ever approved) | Disposable Auth environment only: compromised/strong test passwords, existing login/recovery                                               | Intended rejection/weak-password handling and owner continuity; no passwords captured in report or chat                                                                   |

**Tests executed during this audit:** catalog/ACL/policy review and hosted read-only RLS assertions only. Existing test results (29 Vitest tests, one mocked browser test, TypeScript/format/build) belong to the prior committed verification phase. No application code or production fixes were changed, so those suites were not rerun for this documentation-only audit. Actual second-user JWT, hostile upload, concurrency, Auth provisioning after grant changes and unrelated application flows remain required future tests.

## 9. Rollback and recovery

All seven current function ACLs contain PUBLIC, postgres, anon, authenticated and service_role EXECUTE entries, granted by postgres. Capture this again before execution, including grant options and inherited roles. Proposed revokes preserve postgres/service_role. For P1/P3/P5, reversal restores the removed PUBLIC/anon grants; P2/P4/P6 restore PUBLIC/anon/authenticated. An example for the exact captured P1 state is:

```sql
-- ROLLBACK PROPOSAL ONLY; also requires authorization.
begin;
grant execute on function public.cobs_is_owner() to public, anon;
alter policy "owner manages COBS campaigns" on public.cobs_campaigns to public;
alter policy "owner manages COBS leads" on public.cobs_leads to public;
alter policy "owner manages COBS posts" on public.cobs_posts to public;
alter policy "owner manages cobs media assets" on public.cobs_media_assets to public;
commit;
```

Use exact captured grants rather than GRANT ALL. Reversal restores prior exposure and should be used only to recover a regression, followed by review. Policy/ACL changes do not require deletion or rewriting of records. Small transactional changes avoid partial policy/grant states; configure a bounded lock timeout in the final reviewed migrations and stop on lock contention.

The previous `.tools/supabase-recovery-20261015/` targeted COBS snapshot/rollback rehearsal is **not** a full shared-project backup. Do not run its old schema rollback to undo new grant changes; it targets a different migration and can refuse later data. New patches need their own recovery artifacts. Do not assume hosted Free backup/PITR availability. Obtain a verified private logical backup/restore procedure if a later proposal becomes destructive; stop if reliable recovery is unavailable. Password settings rollback must not delete accounts, reset credentials or revoke owner permissions.

## 10. Migration-history reconciliation plan

Fresh hosted history contains only `20261015002801_reconcile_existing_cobs_workspace` (34 statements). Local `202610140002_secure_workspace.sql` and `202610140003_dashboard_media.sql` remain unrecorded. Their intended objects overlap manually created objects but definitions differ; blindly applying or marking them applied would be unsafe and misleading. The registered reconciliation SQL must not be replayed; its historic header still says review draft, but execution/history evidence confirms it was applied with approval. Preserve its approved bytes/hash.

1. Keep automatic db push/reset/history repair disabled. Preserve the two historical SQL files and Git history; do not backdate or falsify execution records.
2. Export the actual complete relevant schema and protected data using official tooling, with explicit handling of managed Auth/Storage objects, unrelated policies and extensions. Store business data and connection secrets outside Git. Inventory logical function-body dependencies as well as pg_depend and external clients.
3. Rehearse a faithful restore on isolated local compatible PostgreSQL/Supabase, not a new hosted project. Verify data, constraints, owner rules, Storage policies and managed-schema assumptions. The partial PGlite COBS fixture is insufficient as the entire project's baseline.
4. Produce a statement-by-statement map of the old files: already present, superseded by actual inspected definitions, intentionally absent, or still required. Prepare a proposed archived-reference location for superseded files and a new reproducible baseline representing actual current state; do not move files or register history until that exact map is approved.
5. Rehearse both fresh install from the proposed baseline and transition from the existing hosted snapshot. Baseline creation DDL must never run against populated production merely to align history. Preserve the correctly recorded reconciliation version and explain any local consolidation explicitly.
6. Present exact baseline SQL/file hashes, archive transition, recovery rehearsal and proposed history bookkeeping for approval. Do not issue a generic repair --status applied for the two old versions. The precise approved mapping determines any later registrations; no production history command is authorized by this document.
7. After separately approved reconciliation, confirm local/remote versions and a schema comparison are consistent before permitting future automatic migrations. Security patches can instead be individually reviewed/applied with explicit bookkeeping approval while history remains unresolved; never send all pending historical files through db push.

## 11. References and delivery status

- [Supabase function privilege and SECURITY DEFINER guidance](https://supabase.com/docs/guides/database/functions): privileged functions need body authorization plus explicit role grants; PUBLIC grants matter.
- [PostgreSQL 17 CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html) and [CREATE TRIGGER](https://www.postgresql.org/docs/17/sql-createtrigger.html): execution context, function privilege and trigger creation requirements.
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control): Storage operations depend on RLS policies.
- [Supabase password security](https://supabase.com/docs/guides/auth/password-security): leaked-password feature availability and password handling.
- [Supabase changelog](https://supabase.com/changelog): index reviewed; PostgreSQL 17.11 platform changes and API grant behavior remain relevant. No upgrade is proposed.

**Review-ready result:** all 15 findings enumerated with assessed severity, exact identity/detail, scoped proposals, impact, tests, reversal and approval gates. No remediation package has been executed or validated as a production fix. P5 includes the 12 captured related public-table policies; external-client review and unrelated maintainer approval remain required before release. No production data/security/history changes, subscription actions, main merge or deployment were performed. This report is local and uncommitted for owner review.

## Appendix A. Exact advisor findings

### F01: Public Can Execute SECURITY DEFINER Function

- Advisor name: `anon_security_definer_function_executable`. Advisor level: **WARN**.
- Exact detail: Function `public.approve_post(target_post uuid)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/approve_post`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.
- Finding identity: `anon_security_definer_function_executable_public_approve_post_target_post uuid`.
- Advisor remediation: [official reference](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

### F02: Public Can Execute SECURITY DEFINER Function

- Advisor name: `anon_security_definer_function_executable`. Advisor level: **WARN**.
- Exact detail: Function `public.cobs_is_owner()` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/cobs_is_owner`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.
- Finding identity: `anon_security_definer_function_executable_public_cobs_is_owner_`.
- Advisor remediation: [official reference](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

### F03: Public Can Execute SECURITY DEFINER Function

- Advisor name: `anon_security_definer_function_executable`. Advisor level: **WARN**.
- Exact detail: Function `public.cobs_new_user_profile()` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/cobs_new_user_profile`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.
- Finding identity: `anon_security_definer_function_executable_public_cobs_new_user_profile_`.
- Advisor remediation: [official reference](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

### F04: Public Can Execute SECURITY DEFINER Function

- Advisor name: `anon_security_definer_function_executable`. Advisor level: **WARN**.
- Exact detail: Function `public.enforce_post_version()` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/enforce_post_version`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.
- Finding identity: `anon_security_definer_function_executable_public_enforce_post_version_`.
- Advisor remediation: [official reference](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

### F05: Public Can Execute SECURITY DEFINER Function

- Advisor name: `anon_security_definer_function_executable`. Advisor level: **WARN**.
- Exact detail: Function `public.is_owner(org_id uuid)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/is_owner`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.
- Finding identity: `anon_security_definer_function_executable_public_is_owner_org_id uuid`.
- Advisor remediation: [official reference](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

### F06: Public Can Execute SECURITY DEFINER Function

- Advisor name: `anon_security_definer_function_executable`. Advisor level: **WARN**.
- Exact detail: Function `public.rls_auto_enable()` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/rls_auto_enable`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.
- Finding identity: `anon_security_definer_function_executable_public_rls_auto_enable_`.
- Advisor remediation: [official reference](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

### F07: Public Can Execute SECURITY DEFINER Function

- Advisor name: `anon_security_definer_function_executable`. Advisor level: **WARN**.
- Exact detail: Function `public.same_org(org_id uuid)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/same_org`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.
- Finding identity: `anon_security_definer_function_executable_public_same_org_org_id uuid`.
- Advisor remediation: [official reference](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

### F08: Signed-In Users Can Execute SECURITY DEFINER Function

- Advisor name: `authenticated_security_definer_function_executable`. Advisor level: **WARN**.
- Exact detail: Function `public.approve_post(target_post uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/approve_post`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.
- Finding identity: `authenticated_security_definer_function_executable_public_approve_post_target_post uuid`.
- Advisor remediation: [official reference](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

### F09: Signed-In Users Can Execute SECURITY DEFINER Function

- Advisor name: `authenticated_security_definer_function_executable`. Advisor level: **WARN**.
- Exact detail: Function `public.cobs_is_owner()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/cobs_is_owner`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.
- Finding identity: `authenticated_security_definer_function_executable_public_cobs_is_owner_`.
- Advisor remediation: [official reference](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

### F10: Signed-In Users Can Execute SECURITY DEFINER Function

- Advisor name: `authenticated_security_definer_function_executable`. Advisor level: **WARN**.
- Exact detail: Function `public.cobs_new_user_profile()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/cobs_new_user_profile`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.
- Finding identity: `authenticated_security_definer_function_executable_public_cobs_new_user_profile_`.
- Advisor remediation: [official reference](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

### F11: Signed-In Users Can Execute SECURITY DEFINER Function

- Advisor name: `authenticated_security_definer_function_executable`. Advisor level: **WARN**.
- Exact detail: Function `public.enforce_post_version()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/enforce_post_version`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.
- Finding identity: `authenticated_security_definer_function_executable_public_enforce_post_version_`.
- Advisor remediation: [official reference](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

### F12: Signed-In Users Can Execute SECURITY DEFINER Function

- Advisor name: `authenticated_security_definer_function_executable`. Advisor level: **WARN**.
- Exact detail: Function `public.is_owner(org_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/is_owner`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.
- Finding identity: `authenticated_security_definer_function_executable_public_is_owner_org_id uuid`.
- Advisor remediation: [official reference](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

### F13: Signed-In Users Can Execute SECURITY DEFINER Function

- Advisor name: `authenticated_security_definer_function_executable`. Advisor level: **WARN**.
- Exact detail: Function `public.rls_auto_enable()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/rls_auto_enable`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.
- Finding identity: `authenticated_security_definer_function_executable_public_rls_auto_enable_`.
- Advisor remediation: [official reference](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

### F14: Signed-In Users Can Execute SECURITY DEFINER Function

- Advisor name: `authenticated_security_definer_function_executable`. Advisor level: **WARN**.
- Exact detail: Function `public.same_org(org_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/same_org`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.
- Finding identity: `authenticated_security_definer_function_executable_public_same_org_org_id uuid`.
- Advisor remediation: [official reference](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

### F15: Leaked Password Protection Disabled

- Advisor name: `auth_leaked_password_protection`. Advisor level: **WARN**.
- Exact detail: Supabase Auth prevents the use of compromised passwords by checking against HaveIBeenPwned.org. Enable this feature to enhance security.
- Finding identity: `auth_leaked_password_protection`.
- Advisor remediation: [official reference](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
