# Reproducible baseline proposal — not a migration

Prepared on `develop/dashboard-media`, 15 October 2026. No production schema/history change is authorized by this document.

## Reproduction available now

`tests/fixtures/cobs-security-schema.json` is the fresh hosted COBS catalog snapshot: columns, constraints, RLS, policies, function definitions, trigger definitions, grants, indexes and bucket configuration. It contains definitions only, not business records or Auth sessions. `cobs-security-acls.json` captures the two function ACLs. The generic restore helper now accepts a supplied snapshot; the original reconciliation fixture/tests remain intact.

Run `npm test -- tests/security-fixes.test.ts` to rebuild an isolated PGlite database from this current snapshot and test the exact four P1/P2 patch/rollback files. This is reproducible COBS security behavior, not a complete Supabase installation: Auth/Storage tables and identity resolution are minimal test scaffolding, the unrelated media policy dependency is an empty stub, and the GoTrue/Storage HTTP services are absent. Original snapshot indexes are captured for review but the helper does not reproduce their physical implementation. Do not apply this fixture/helper to production.

## Hosted history discrepancy

Only `20261015002801_reconcile_existing_cobs_workspace` is recorded (34 statements). Local `202610140002_secure_workspace.sql` and `202610140003_dashboard_media.sql` overlap manually created objects with differing definitions. Preserve both as historical references pending an approved mapping. Do not replay or mark them applied. P1/P2 are deliberately outside `supabase/migrations/`, so they cannot accidentally join an automatic migration push.

## Proposed complete baseline process

1. Freeze migration writers and privately capture a full schema/security/history export with official CLI/pg_dump, plus a verified protected data backup. Include all unrelated public objects and custom Auth/Storage policies/triggers; exclude managed-schema recreation that conflicts with the supported Supabase runtime. Capture roles/grants separately with no role passwords. Determine installed extensions and runtime compatibility before restore.
2. Build a compatible local Supabase/PostgreSQL environment using free tooling. Restore to a disposable local database only and verify records, constraints, Auth provisioning, Storage privacy and unrelated application behavior. A targeted COBS fixture is not sufficient evidence of full-project recovery. If this restore cannot be verified, stop production baseline work.
3. Generate a candidate reproducible baseline from the verified current definitions using official tools, retaining deterministic ordering and hashes. Produce a statement-by-statement comparison with both historical files: present, superseded, intentionally absent or still required. Explain any required dependency/extension ordering explicitly.
4. Propose archiving the superseded references outside active migration discovery while preserving them in Git. Specify whether the new baseline consolidates the already applied reconciliation state and how its recorded version will remain truthfully represented. Do not invent a history mapping or a backdated execution event merely to make version lists agree.
5. Test a fresh installation from the candidate baseline and an existing-snapshot transition separately. Baseline creation DDL must never run on the populated hosted database. Obtain approval for the exact baseline file/archive hashes and precise history bookkeeping only after these rehearsals pass.
6. Before any later P1/P2 production execution, refresh all guards/evidence and obtain explicit approval for those patches. Their future migration version generation and registration is a separate reviewed step, not permission to run old files. Never use unfiltered db push to bypass this discrepancy.

No full shared-project baseline, history repair or historical migration registration was executed. The remaining blockers are a verified full shared-project restore, unrelated-component dependency coverage and an explicitly approved version mapping. P1/P2 local testing does not resolve those blockers automatically.
