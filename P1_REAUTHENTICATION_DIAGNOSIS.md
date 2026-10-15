# P1 re-authentication diagnosis

Follow-up: corrected read-only hosted re-authentication and session restoration were subsequently verified; see [P1_CORRECTED_REAUTH_VERIFICATION.md](P1_CORRECTED_REAUTH_VERIFICATION.md). Historical uncertainty below remains unchanged.

15 October 2026 (UTC). Branch: `develop/dashboard-media`. Diagnostic work used mocks/local isolated tests only; no production records, permissions, policies, Auth settings or migration history were changed. P2 remains unapplied.

## Findings

**Confirmed automation defect:** the previous live runner waited for an exact Overview heading, then an exact “Secure Supabase workspace connected” notice. Before signing out it had navigated to Content Calendar. The application retains its active section across sign-out/sign-in; successful re-authentication can therefore render Content Calendar, not Overview. A new mocked browser test confirms the equivalent behavior from Media Library: authentication and workspace reads succeed while the Overview heading is absent. A selected section is not an authentication-ready signal.

**Confirmed local timing defect:** submitAuth unconditionally wrote “Signed in. Loading workspace…” after signInWithPassword resolved. The Auth state listener independently starts workspace loading. If workspace reads finish before that promise completes, the late message replaces the already-connected status. A deterministic component test forced this ordering, confirmed a rendered owner workspace with connected status, then failed on the old code when the late response overwrote the notice. It passes after the local fix. This is a misleading status message, not proof of a failed login or database connection.

**Historical attribution remains limited:** the stopped live manifest recorded initial owner access and campaign/draft refresh persistence, followed by awaiting re-authentication. The owner reported successful re-login and Overview selection. The runner was manually stopped while waiting; it did not capture the active heading, notice, per-read HTTP outcomes or a failing authentication response at that point. Therefore retained navigation is a demonstrated defect in its first readiness condition, and the status race is a demonstrated possible second blocker, but neither can be asserted as the sole observed cause of that exact historical stall. A wrong/stale browser tab or a delayed request cannot be excluded. There is no evidence establishing an incorrect password, lost owner permission, Supabase outage or P1 regression.

Evidence reviewed: ignored `.tools/p1-live-acceptance/run.cjs`, `manifest.json`, baseline/stopped/cleanup record snapshots; prior `.tools/p1-post-verification/owner-api.json`; existing browser/component tests; application Auth listener, loadWorkspace, session-clearing and submitAuth code. The cleaned-up manifest confirms the two temporary records were removed with separate approval. No deleted records were recreated.

## Local changes

- `app/page.tsx`: successful password sign-in no longer overwrites the status owned by workspace loading. Auth errors still display normally; the existing signup confirmation message remains. No authorization predicate, credential handling, selected-section behavior or database operation changed.
- `tests/dashboard.test.tsx`: deterministic delayed sign-in response regression test proves the connected workspace can retain Content Calendar and that connected status survives late Auth completion. It performs no database inserts.
- `tests/e2e/workspace.ts`: reusable readiness helper waits for owner-only “Workspace sections” navigation, rendered after owner/profile and workspace reads complete. A separate helper explicitly navigates to the requested section. On failure it records only heading text and whether the sign-in form is visible, never field values, cookies, tokens or headers.
- `tests/e2e/reauthentication.spec.ts`: mocked Auth logout/login with delayed workspace reads, retained Media Library section, explicit navigation to Overview, no database write requests and no runtime errors.
- `tests/e2e/dashboard.spec.ts`: uses the shared readiness helper for initial workspace readiness.
- Historical ignored live runner: readiness corrected to wait for owner navigation, then explicitly click Overview. Safe heading/sign-in diagnostics added. It was **not executed** in this phase and is not a new production authorization.

The owner navigation marker reflects the current application rendering contract, not a replacement for Supabase/RLS checks. Live verification should additionally confirm expected authenticated read responses and the intended record IDs; navigation visibility alone cannot prove all business flows work.

## Tests and results

| Check                                                | Result                                                                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New deterministic status-race test before fix        | Failed as intended: late Auth completion removed the connected notice while the owner workspace was present                                                   |
| Component tests after fix                            | Seven passed                                                                                                                                                  |
| Full automated suite                                 | **38 passed across five files**, including isolated SQL security tests                                                                                        |
| Mocked browser suite                                 | **Two passed**, including successful sign-out/re-authentication from a non-Overview section with zero database writes                                         |
| Production build, TypeScript and formatting          | PASS; a Testing Library selector typing error introduced in the new test was corrected, then TypeScript/formatting and all seven component tests passed again |
| Actual hosted re-authentication after this local fix | Not performed in this diagnostic phase                                                                                                                        |

All new Auth values in tests are synthetic mocks for the fake `cobs-test.supabase.co` endpoint. Isolated database tests do not connect to production. The late-response test models a possible ordering; it is not a captured trace of the historical hosted Auth request. The actual SDK was exercised by the mocked browser test, while the component test controls event/promise ordering explicitly. [Supabase Auth event documentation](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) and [password sign-in reference](https://supabase.com/docs/reference/javascript/auth-signinwithpassword) were consulted for the two distinct integration paths.

## Safest remaining live verification

1. First obtain approval for a **read-only** owner sign-out/sign-in check using the corrected local app/runner and a single dedicated browser context with a unique window title. Keep only the intended test page active. Use owner navigation readiness, explicitly choose Overview, and record non-sensitive heading/read-response status/count diagnostics if readiness fails. Never log passwords, JWTs, session storage, authorization headers or signed media links.
2. Confirm post-login owner reads and reload without creating records. If that fails, stop and inspect the safe diagnostics before creating anything or proposing a P1 rollback. Do not infer a security failure from a selected section or notice alone.
3. Only after read-only acceptance passes, request fresh authorization for one labelled campaign, post and synthetic PNG. The earlier two records are deleted, so the old IDs must not be reused as if still present. Capture new IDs, verify refresh/re-authentication, approval transitions/edit invalidation and the attachment/media privacy checks with the corrected readiness helper.
4. Probe anonymous/invalid-JWT requests against those actual test IDs. Distinguish a valid owner-issued signed URL (a bearer capability until expiry) from unauthenticated raw-object access. A real non-owner JWT test needs a suitable authorized account or separate Auth test-user approval; SQL claim simulation is not that end-to-end test.
5. Stop on unexpected behavior and retain exact evidence/IDs. Request separate exact-ID cleanup approval after testing. No automatic P2, history repair, security rollback or broader changes are part of this plan.

These fixes and this report remain local and uncommitted. No main merge, deployment, purchase or production test-data creation occurred.
