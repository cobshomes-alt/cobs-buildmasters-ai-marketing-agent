# Existing Supabase migration completion report

Date: 15 October 2026. Branch: `develop/dashboard-media`.

Follow-up: the subsequently authorized hosted campaign/draft/approval/media verification and approved test-only cleanup are recorded in [LIVE_VERIFICATION_REPORT.md](LIVE_VERIFICATION_REPORT.md). The limitations below describe the earlier migration phase; the follow-up report supersedes its untested-flow status. Security and migration-history recommendations are in [SECURITY_AND_BASELINE_REVIEW.md](SECURITY_AND_BASELINE_REVIEW.md).

## Applied with explicit approval

- Existing project: `berica868@gmail.com's Project`, reference `ldnyctzrgcpcjmhnrpms`.
- Official CLI `2.121.0`; official browser authorization completed by the user.
- Applied only `20261015002801_reconcile_existing_cobs_workspace.sql`.
- Approved/applied SHA-256: `cefdde6f00c7fdbeedfaa0ff284fc68da7f1f01b6350422bfa6af74ca3b6c9f0`.
- Registered only version `20261015002801` using the official migration-history command. Remote migration listing confirms that version. Neither `202610140002` nor `202610140003` was replayed or marked applied.

Immediately before execution, schema/record comparisons, the migration hash, recovery checksums and the confirmed owner/profile match all passed. The migration completed in its transaction without error. The [review](MIGRATION_REVIEW.md) documents the exact changes and recovery procedure.

## Implemented database changes

- Required lead author column and Auth foreign key, fixing the live schema mismatch with the lead form.
- Media project/product labels, campaign links and deletion reservation.
- Post campaign/media links and owner approval actor/time.
- Non-null post source.
- Owner approval transition/edit invalidation guard and immutable-media/removal guard.
- Split COBS Storage policies: owner reads, owner-path uploads and removal of unused assets. The previous broad COBS object policy was replaced atomically; RLS was never disabled.
- Media/campaign indexes.
- Removed TRUNCATE, TRIGGER and REFERENCES capabilities from the two browser roles on COBS tables. Required DML permissions remain subject to RLS.

No application record INSERT/UPDATE/DELETE was in the migration. The pre-existing owner profile is unchanged. Posts, campaigns, leads, media metadata and COBS storage objects remain empty. Existing author delete rules, original functions/triggers, the private bucket settings and the separate application's policies were preserved.

## Recovery evidence

Git-ignored recovery directory: `.tools/supabase-recovery-20261015/`.

The original COBS schema/security definitions and COBS records were captured. The actual owner profile was restored into isolated PGlite PostgreSQL, the exact reviewed migration applied locally and the generated rollback executed locally. Profile record, columns/defaults/nullability, constraints, policies and grants matched the pre-migration state. Checksums and the approved migration hash are recorded in `verification.json`.

Post-application evidence is in `postapply-schema.json`, `postapply-records.json`, `postapply-rls.json` and `postapply-verification.json`. Recovery files are excluded from Git. No Auth passwords, tokens, sessions or secret API keys were exported.

The recovery scope is COBS objects changed by this migration. It excludes unrelated application data and Auth credentials. The rollback refuses to remove newly created marketing records or COBS storage objects and must never run automatically. No live rollback was performed.

## Verification results

| Check | Result | Scope |
| --- | --- | --- |
| Pre-application live schema/records vs snapshot | PASS | Actual existing project, read-only |
| Post-application columns, original constraints/functions/triggers, indexes and guards | PASS | Actual existing project, read-only |
| Owner profile/all existing COBS records unchanged | PASS | Actual before/after comparison |
| Bucket settings and separate application's policies preserved | PASS | Actual before/after comparison |
| New migration registered | PASS | Official remote migration listing |
| Anonymous, existing-owner and synthetic unowned identity RLS assertions | PASS before and after migration | Actual database, read-only transaction; role/claim simulation rather than end-user Auth login |
| Anonymous Supabase Data API profile access | PASS: existing owner profile hidden | Actual project/public key, no mocks |
| Anonymous Supabase marketing-table reads | PASS: no rows returned | Actual project/public key, no mocks; marketing tables are empty |
| Local app HTTP render | PASS: HTTP 200, sign-in form present | Actual local Next app configured for the existing project |
| Local media and generation endpoints | PASS: anonymous and invalid bearer tokens rejected with 401 | Actual local server and Supabase Auth validation, no mocks |
| Automated suite | 29 PASS across 4 files | Mocked client/API tests plus isolated PostgreSQL tests using original and inspected schema definitions |
| Strict TypeScript | PASS | Local application/tests |
| Formatting | PASS | Local source/tests |
| Actual captured-record recovery rehearsal | PASS | Isolated local PostgreSQL; not a hosted full-project restore |
| Owner sign-in, Overview and Media Library | PASS, user confirmed | Real local app connected to the existing hosted project; manually checked, not independently observed through browser automation |

The seven additional reconciliation tests cover owner record and unrelated policy preservation, lead author correction, refusal after record drift, legacy re-review/edit invalidation, member/anonymous restrictions and revoked truncate permission, rollback equivalence, and refusal to discard newly created records. Trigger disabling and sample writes in these tests happen only in isolated local test fixtures.

## Live application acceptance

The ignored local `.env.local` now contains the existing project URL and a public Supabase key. Secret keys were not revealed or stored, and production environment variables were not modified.

A local server is available at `http://127.0.0.1:3102`. The user confirmed successful owner sign-in, Overview connection and Media Library loading against the real project. Connected browser automation is unavailable in this session, so this acceptance result is recorded as a manual user-confirmed check. No owner password, session token or verification code was requested in chat.

Persistent application save/edit/approval flows, multi-device persistence, media upload/preview/removal and real AI generation have not been tested live in this phase. No sample rows, test users or uploaded files were left in the hosted project. Live AI requests were not made. Local tests and database role simulations do not establish these end-to-end flows.

## Security advisor findings retained for review

The read-only Supabase security advisor returned 15 warnings and no error-level entries in the retrieved result:

- Seven anonymous and seven authenticated SECURITY DEFINER execution warnings, including `cobs_is_owner()` and `cobs_new_user_profile()` and functions belonging to the separate application.
- Leaked-password protection is not enabled.

The two COBS SECURITY DEFINER functions existed before migration and were preserved. Their existing execute grants/settings were outside the exact approved migration; no unrelated functions or Auth settings were changed. The live anonymous/unowned owner checks returned false and did not expose the owner profile. Advisor findings still require a scoped security review; this report does not declare the entire project warning-free.

## Remaining operational work

1. Owner browser acceptance is complete and recorded above; retain the distinction between manual acceptance and independently automated checks.
2. Separately authorize any persistent live test content/uploads before exercising full authenticated save/approval/media round trips.
3. Review existing SECURITY DEFINER exposure and Auth hardening findings without altering the separate application unexpectedly or activating paid services.
4. Review a permanent migration baseline/archive strategy. The older local reference versions remain absent remotely, so unfiltered automatic migration replay remains unsafe. Do not falsely mark them applied.
5. Keep the local recovery set private and intact; prepare updated recovery before any future destructive operation.

No project was created, no paid service was activated, no Vercel deployment occurred, and no merge into main was performed. New migration/test/documentation changes are local on the development branch; the user's `.vscode/extensions.json` was left untouched.
