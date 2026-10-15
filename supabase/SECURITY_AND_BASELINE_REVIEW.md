# Security advisor and migration baseline review

Reviewed 2026-10-15 against hosted project `ldnyctzrgcpcjmhnrpms`. This document proposes changes; it does not authorize or apply them.

## All 15 advisor warnings

The captured advisor result contains 15 WARN findings, no ERROR findings: seven anonymous-role and seven authenticated-role executable SECURITY DEFINER function warnings, plus leaked-password protection. The two role columns below each represent a separate finding (14 total). Practical risk assessments reflect inspected function bodies, not proof that every caller and dependency has been tested.

| Function | Anonymous warning | Authenticated warning | Scope and assessment | Safe proposed response |
| --- | --- | --- | --- | --- |
| `cobs_is_owner()` | Low | Low | COBS authorization helper; returns only whether `auth.uid()` matches an owner profile. Fixed search path; no caller-supplied identity. Required by COBS RLS and Storage policies. | Review revoking anonymous/PUBLIC execution while explicitly retaining authenticated execution; rehearse every dependent policy first. Consider a private-schema helper in a separately reviewed migration. |
| `cobs_new_user_profile()` | Low | Low | COBS Auth trigger; inserts only the new Auth user's profile. Trigger return type prevents ordinary standalone RPC invocation. Owner assignment relies on the configured owner email. | Review removing browser/PUBLIC execution while preserving the Auth trigger and its execution context. Test new-user provisioning and owner assignment in isolation before approval. |
| `approve_post(uuid)` | Medium | Medium | Unrelated application's approval endpoint. Locks the supplied post before checking organization ownership; internal `is_owner` guard is present. Anonymous callers can potentially hold a row lock until the authorization error. No demonstrated authorization bypass. | Ask that application's maintainer to review anonymous execution, guard order, authorization and lock contention. Preserve its authenticated workflow; do not change from COBS maintenance. |
| `is_owner(uuid)` | Low | Low | Unrelated organization-role helper; checks current caller identity and requested organization. Used by other policies. | Dependency review and scoped grants by that application's maintainer; do not blanket-revoke authenticated execution. |
| `same_org(uuid)` | Low | Low | Unrelated membership helper; current caller identity is checked. Also used by the unrelated campaign-media Storage policies. | Preserve dependencies; separately review anonymous access and private-schema placement. |
| `enforce_post_version()` | Low | Low | Unrelated post-version trigger, not an ordinary RPC endpoint. Clears approval on caption/platform edits. | Review unnecessary grants without removing the trigger or changing unrelated approval behavior. |
| `rls_auto_enable()` | Low | Low | Database-wide event trigger. Uses `pg_catalog` search path and quoted identifiers to enable RLS on newly created public tables. Event-trigger return type prevents ordinary RPC invocation. | Project administrator should review grants and event-trigger provenance. Do not disable this safeguard. |

Finding 15, `auth_leaked_password_protection`: **Medium**, affects COBS and every other password-based application in this project. Compromised-password screening is disabled. Propose the administrator review availability and cost on the existing Free plan, then explicitly approve any configuration change. Do not upgrade or activate a paid feature automatically. This warning does not demonstrate that the current owner's password is compromised.

No functions, extensions, policies, grants, Auth configuration or advisor settings were changed during this review. In particular, warning suppression alone is not an acceptable reason to break an RLS helper or unrelated application.

References: [Supabase database function security](https://supabase.com/docs/guides/database/functions), [Supabase password security](https://supabase.com/docs/guides/auth/password-security), [PostgreSQL trigger behavior](https://www.postgresql.org/docs/17/trigger-definition.html).

## Migration history: safe proposed baseline

Hosted history currently records only `20261015002801_reconcile_existing_cobs_workspace` (34 statements). The older local migrations `202610140002_secure_workspace.sql` and `202610140003_dashboard_media.sql` are unrecorded. Their intended objects overlap the manually created database, but the actual definitions differ. Therefore neither replaying them nor marking both applied would be truthful or safe.

1. Freeze migration changes during the baseline review. Keep the original SQL and Git history intact. Do not run `db push`, reset, or migration-history repair.
2. Export and hash the current complete relevant schema, grants, functions, triggers, RLS/Storage policies, migration history and protected data backup using official tooling. Include dependencies on the unrelated application and managed Auth/Storage objects; never commit secrets or business records. The existing targeted COBS recovery rehearsal is not a complete project backup.
3. Prove restore on an isolated local PostgreSQL environment with compatible Supabase-managed schemas/extensions. Verify records, ownership, constraints and policies. Do not create another hosted project or paid branch.
4. Prepare a reviewed baseline describing the actual current schema. Explicitly map which historical statements are superseded, which are already present and which remain intentionally absent. Separate unrelated objects from future COBS migrations without silently losing dependencies.
5. Rehearse both a fresh installation and the transition from the inspected hosted snapshot. A baseline representing current state must not be replayed as creation DDL against the populated live database.
6. Present the exact local-file transition and any proposed migration-history registration/repair with recovery steps for explicit approval. Preserve the correctly recorded reconciliation migration. Only then perform the approved bookkeeping; require a clean migration comparison before considering any future push.

No baseline or history repair was executed. A complete restore rehearsal and the precise approved history mapping remain prerequisites; the current repository should not be used for automatic production migration deployment.
