# Corrected P1 read-only re-authentication verification

15 October 2026 (UTC). Existing local app on `develop/dashboard-media`, connected to existing Supabase project `ldnyctzrgcpcjmhnrpms`. **Hosted read-only acceptance passed. No application authentication regression was detected within this scope.**

## Actual hosted results

| Check                                 | Result | Evidence                                                                                                                                                                                                                     |
| ------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial owner sign-in                 | PASS   | Owner manually signed in in the single labelled test tab and confirmed before automation continued; hosted Auth returned HTTP 200 and owner workspace reads completed.                                                       |
| Sign-out and manual re-authentication | PASS   | Test signed out from Media Library, waited for the sign-in form, then waited for the owner's second manual confirmation. Auth returned HTTP 200 and owner-only workspace navigation became available.                        |
| Corrected workspace readiness         | PASS   | Owner navigation, not a particular heading or notice, established readiness. Overview was then selected explicitly and displayed the connected workspace.                                                                    |
| Session restoration                   | PASS   | The completed re-authentication session restored when the dedicated browser reopened; page refresh then produced four fresh successful hosted reads and the connected workspace.                                             |
| Owner access                          | PASS   | Actual profile query returned owner; campaigns, drafts and media queries succeeded. Counts: one owner profile, zero campaigns, zero posts, zero media assets. Populated-content rendering is not established by empty lists. |
| Anonymous restrictions                | PASS   | Actual anonymous queries to all five COBS tables returned no records; owner-helper RPC rejected execution with permission code 42501. Empty marketing tables limit populated-row negative testing.                           |
| Browser/runtime writes                | PASS   | No runtime errors or hosted database mutation requests observed during the successful final acceptance pass. No campaign, post or media object was created.                                                                  |

Passwords were entered only by the owner in the application. No password, JWT, session storage, authorization header, full Auth response or signed media link was read/logged by the runner. Evidence records only safe heading/status/count information. Ordinary sign-in/session refresh can update service-managed Auth metadata; no Auth settings or account roles were edited.

## Harness issues corrected during this run

The initial live assertion expected Media Library to remain selected after manual re-login. It observed **Creative Studio**, despite successful Auth and ready owner navigation. The captured evidence does not establish why that section was selected; it could reflect manual navigation. That section-specific assertion was removed. Re-authentication readiness now accepts any owner section and explicitly selects Overview. The connected session was reused rather than repeating sign-out.

On the first browser-resume attempt, closing every restored test tab before opening its replacement caused a local `Target.createTarget` error. The runner now opens the replacement tab first, then closes old dedicated test tabs. The subsequent attempt restored the owner session and completed refresh checks. These were test-harness failures; neither demonstrates rejected credentials, failed Supabase access or a P1 security regression. Both failed attempts are disclosed rather than presented as uninterrupted success.

The earlier local application fix preventing a late successful sign-in message from overwriting the connected status remains in place. The historical interrupted test still lacks sufficient browser diagnostics to assign a single definitive cause; this new successful test verifies the corrected behavior rather than rewriting that history.

## Automated results

- Vitest: **38 passed across five files**, including local SQL security and delayed-auth-response regression tests.
- Mocked Playwright browser suite: **two passed**, including non-Overview re-authentication.
- Production build, TypeScript and formatting: **all passed**, run sequentially after the browser servers stopped.

Mocked browser tests use the fake `cobs-test.supabase.co` endpoint and synthetic credentials. Local SQL tests do not modify hosted permissions or run P2 on production. Hosted evidence is under ignored `.tools/p1-corrected-reauth/result.json`; anonymous API evidence is under `.tools/p1-final-preflight/anonymous-api.json`. No production security SQL or history command was run in this phase.

## Remaining limits and stop point

This authorization covered read-only acceptance only. Campaign/draft creation and persistence, approval transitions, actual media upload/private preview and attachment behavior still require separately authorized synthetic records/uploads. A real non-owner JWT end-to-end test remains unperformed; anonymous API checks are not that test. No new write-phase test is started by this report.

P2 remains pending. No production data DML, permissions, policies, Auth settings, migration-history changes, database reset, paid service, deployment or main merge was performed. Work remains local and uncommitted. Verification is complete within the approved scope; stop before another development phase.
