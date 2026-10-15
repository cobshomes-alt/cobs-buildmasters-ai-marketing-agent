# Existing Supabase project: inspection and migration approval plan

Status: **USER APPROVAL RECEIVED; REVIEWED MIGRATION APPLIED AND REGISTERED.**

The pre-execution observations and approved plan below are retained as an audit record. See [the completion report](MIGRATION_COMPLETION.md) for final results. The SQL review header is retained to preserve the exact approved file/hash.

Inspection date: 15 October 2026 (UTC). Application branch: `develop/dashboard-media`.

## Confirmed connection and source

- Existing project: `berica868@gmail.com's Project`.
- Project reference: `ldnyctzrgcpcjmhnrpms`; region `eu-west-1`; status `ACTIVE_HEALTHY`.
- Official Supabase CLI: `2.121.0`, authorized through the official browser login. Credentials were not pasted into chat.
- Live PostgreSQL: `17.11`.
- GitHub development head verified as `3c1106fda22a6eb92ecd720fcb019d8464d53e02`. The two original migration files match that commit and were not edited.
- Catalog inspection used SELECT statements. RLS checks used a read-only transaction, local role/claim settings and assertions. The CLI reported initializing its managed login role for access. No application migration, application record write, Auth setting change or bucket configuration change has been performed.

## Live inventory

| Object | Records | Findings |
| --- | ---: | --- |
| `cobs_profiles` | 1 | Owner profile matches the confirmed `cobshomes@gmail.com` Auth account |
| `cobs_posts` | 0 | Base columns present; campaign/media links and approval audit columns absent; source is nullable |
| `cobs_campaigns` | 0 | Base columns present; author FK uses RESTRICT |
| `cobs_leads` | 0 | `created_by` absent, so the current application's lead insert is incompatible |
| `cobs_media_assets` | 0 | Base columns present; organisation labels, campaign link and deletion reservation absent |
| `cobs-media` objects | 0 | Private bucket, 52,428,800-byte limit, expected JPEG/PNG/WebP/MP4/QuickTime MIME allowlist |

All five COBS tables have RLS enabled. Owner management policies and own-profile SELECT policy exist. The profile signup and updated-at triggers exist, with definitions/names differing from the first reference migration. All users currently have profiles.

Read-only database authorization assertions passed for anonymous access denial, the existing owner identity and a synthetic unowned identity. These tests exercise the live PostgreSQL policies. They do **not** constitute browser sign-in or end-user JWT verification tests.

There are 13 additional public tables belonging to a separate application, including `organizations`, `profiles`, `posts`, `post_versions`, `approvals`, `media_assets`, `publish_jobs` and `audit_logs`. Three `campaign-media` storage policies reference that separate application's tables/functions. They are outside this migration and must remain intact.

No foreign keys referencing the COBS tables from other tables, or views using the COBS tables, were found in the inspected catalogs. This does not identify every possible external application or dynamic-SQL dependency.

## Comparison with the two reference migrations

| Reference file | Live finding | Decision |
| --- | --- | --- |
| `202610140002_secure_workspace.sql` | Most base objects exist with equivalent owner access, but lead author, source nullability, author delete rules and trigger/policy names differ | Do not replay. It would not fully reconcile existing columns and could introduce duplicate trigger/policy names or replace existing configuration |
| `202610140003_dashboard_media.sql` | Its additional columns, guards, indexes and split Storage policies are absent | Do not replay unchanged. It contains a post-status UPDATE and profile INSERT; neither is needed or permitted under the current record-preservation scope |

`supabase_migrations.schema_migrations` does not exist. No recorded migration execution can therefore be confirmed. The schema shows manually installed base functionality; neither original file can be claimed to have been executed exactly as written.

Do **not** run unfiltered `supabase db push`, `migration up`, `db reset` or migration-history repair for either original version against this project. Historical files remain in Git for reference. After the reviewed reconciliation is applied, only its actual version may be recorded; the older versions remain unrecorded, so automatic replay must remain blocked until a separate baseline/history alignment is reviewed.

## Verified targeted recovery

The recovery set is local and ignored by Git:

`C:\Users\Cobs_Homes\Documents\cobs-buildmasters-ai-marketing-agent\.tools\supabase-recovery-20261015\`

| File | SHA-256 |
| --- | --- |
| `schema.json` | `791b6af56718e299eb95ec1d9b42b32fbe697ea3dda32413c8fbe01f3735601c` |
| `records.json` | `6140ac8f6033ce4b2b100b208f9de0719dbf2afaebea786ebff2774a48286a56` |
| `rollback.sql` | `1abb894ed784d17fe7841062202ba8a6fd12486c930517e52a7ee262cf8f579b` |

The data snapshot was captured at `2026-10-15T00:27:46.865409+00:00`. It contains the COBS records, including the existing owner profile, and no Auth passwords, tokens, session records or secret API keys. Schema/security definitions and COBS bucket settings were captured separately.

The actual captured owner record was restored into isolated PGlite PostgreSQL. The proposed migration was applied **locally**, followed by the generated rollback. Original COBS columns, nullability/defaults, constraints, policies, grants and the profile record matched the reconstructed pre-migration state. A SHA-256 verification manifest is saved as `verification.json`.

Recovery covers the objects this migration changes. It does not back up the separate application's data, Auth credentials or stored media binaries. Those objects are outside the planned change; the COBS bucket currently contains no files.

The rollback is for the inspected empty marketing workspace. It refuses to run if new marketing records or COBS storage objects exist. It must never be run automatically, and would need separate approval. If writes occur after migration, stop and prepare an updated recovery plan; do not discard new records to make rollback pass. The migration itself takes COBS table locks and refuses to proceed if marketing records have appeared or the profile count changed. Recovery hashes, owner matching and live schema fingerprints must also be rechecked before application.

## Exact proposed live changes

Reviewed file: `supabase/migrations/20261015002801_reconcile_existing_cobs_workspace.sql`.

SHA-256: `cefdde6f00c7fdbeedfaa0ff284fc68da7f1f01b6350422bfa6af74ca3b6c9f0`.

Within one transaction:

1. Set a 5-second lock timeout and 30-second statement timeout; lock the five COBS tables for the brief schema update. Abort if the inspected empty-workspace/profile-count preconditions have changed. COBS reads/writes can briefly wait behind these locks; a timeout causes failure instead of indefinite waiting.
2. Add `cobs_leads.created_by` as a required UUID referencing Auth users with RESTRICT. No lead authors will be invented or backfilled.
3. Add `project`, `product`, `campaign_id`, `deletion_pending` to media assets; add `campaign_id`, `media_id`, `approved_by`, `approved_at` to posts. Add the corresponding foreign keys.
4. Make post `source` non-null. Existing posts currently number zero; unexpected incompatible data causes transaction failure rather than replacement.
5. Add owner approval/transition and immutable-media/deletion guards. Future content/attachment edits clear approval. No existing post status is updated by the migration. Legacy approvals without audit information can be deliberately resubmitted for owner review.
6. Atomically replace only `owner manages cobs media objects` with authenticated-owner SELECT, owner-path INSERT and unused-media DELETE policies. The three separate `campaign-media` policies remain unchanged. RLS stays enabled. Object overwrites are no longer permitted by the COBS policy.
7. Add indexes for post media links and media campaign links.
8. Revoke `TRUNCATE`, `REFERENCES` and `TRIGGER` from `anon` and `authenticated` on the five COBS tables. Existing DML grants remain governed by RLS. The application does not require these three elevated capabilities.

After successful application and verification, register **only version `20261015002801`** with the official migration-history command. Because no history table exists, this may create Supabase's standard migration metadata schema/table. It creates no duplicate application tables and does not mark either older reference migration as executed. If registration needs additional access or fails, stop and report the applied-schema/history state; do not blindly reapply SQL.

Effects on existing records: the owner profile and Auth account remain unchanged; no COBS record INSERT, UPDATE or DELETE is in the migration. No bucket settings, separate-application records, existing author delete rules, production environment variables or Auth configuration are changed.

## Tests and remaining checks

Local tests cover the inspected schema, owner record preservation, separate-policy preservation, lead-author correction, refusal after record drift, owner re-review/edit invalidation, nonowner/anonymous access, revoked truncate capability, targeted rollback equivalence and refusal to discard new records. Existing application/API/database tests are retained.

After approval/application:

- Reinspect columns, FKs, guards, indexes, RLS, grants and all relevant policies; compare owner profile, unrelated policies and counts to the preflight snapshot.
- Verify only the new migration version is recorded and run security advisors for relevant objects.
- Repeat read-only database owner/anonymous/unowned-identity assertions.
- Configure the local application with public Supabase connection values; do not alter production environment variables.
- Test real browser owner sign-in and loading against the existing project. End-user sign-in requires the user to enter credentials only in the local app, never chat.
- Obtain explicit authorization before any application tests that create persistent marketing records, upload media, create test users or trigger external AI requests. SQL-role simulations and mocks do not prove real Auth/Storage round trips.

Live application sign-in, data writes, storage upload/playback and AI generation remain unverified at this approval checkpoint. No production migration, deployment, merge or paid service activation has occurred.

## Approval required

Approve the exact reviewed migration/hash and registration of only its new version for project `ldnyctzrgcpcjmhnrpms`. Connection authorization and read-only inspection approval do not authorize these production changes. If the script, target, live preconditions or recovery evidence change, stop and revise the plan before execution.
